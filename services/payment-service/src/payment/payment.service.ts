import { Injectable, Inject, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import Stripe from 'stripe';
import { createLogger, CorrelationIdGenerator } from '../../../shared/utils';
import { 
  PaymentInitiatedEvent, 
  PaymentProcessedEvent, 
  PaymentFailedEvent,
  PaymentStatus,
  PaymentMethod,
  KAFKA_TOPICS 
} from '../../../shared/events';
import { ProcessPaymentDto } from './dto/process-payment.dto';

@Injectable()
export class PaymentService {
  private readonly logger = createLogger('PaymentService');
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService,
    @Inject('KAFKA_SERVICE')
    private readonly kafkaClient: ClientProxy,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }
    
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-08-16',
    });
  }

  async processPayment(processPaymentDto: ProcessPaymentDto): Promise<any> {
    const correlationId = CorrelationIdGenerator.generate();
    const { orderId, userId, amount, currency, paymentMethod, paymentDetails } = processPaymentDto;
    
    this.logger.info('Processing payment', {
      correlationId,
      orderId,
      userId,
      amount,
      currency,
      paymentMethod,
    });

    const paymentId = CorrelationIdGenerator.generate();

    // Emit payment initiated event
    const paymentInitiatedEvent: PaymentInitiatedEvent = {
      eventType: 'PAYMENT_INITIATED',
      paymentId,
      orderId,
      userId,
      amount,
      currency,
      paymentMethod: paymentMethod as PaymentMethod,
      timestamp: new Date(),
      correlationId,
    };

    this.kafkaClient.emit(KAFKA_TOPICS.PAYMENT_EVENTS, paymentInitiatedEvent);

    try {
      let paymentResult;

      switch (paymentMethod) {
        case PaymentMethod.STRIPE:
        case PaymentMethod.CREDIT_CARD:
        case PaymentMethod.DEBIT_CARD:
          paymentResult = await this.processStripePayment(paymentDetails, amount, currency);
          break;
        
        default:
          throw new BadRequestException(`Unsupported payment method: ${paymentMethod}`);
      }

      // Emit payment processed event (success)
      const paymentProcessedEvent: PaymentProcessedEvent = {
        eventType: 'PAYMENT_PROCESSED',
        paymentId,
        orderId,
        userId,
        amount,
        currency,
        status: PaymentStatus.SUCCESS,
        transactionId: paymentResult.transactionId,
        timestamp: new Date(),
        correlationId,
      };

      this.kafkaClient.emit(KAFKA_TOPICS.PAYMENT_EVENTS, paymentProcessedEvent);

      this.logger.info('Payment processed successfully', {
        correlationId,
        paymentId,
        orderId,
        transactionId: paymentResult.transactionId,
      });

      return {
        paymentId,
        status: 'SUCCESS',
        transactionId: paymentResult.transactionId,
        amount,
        currency,
      };

    } catch (error) {
      this.logger.error('Payment processing failed', { correlationId, orderId }, error);

      // Emit payment failed event
      const paymentFailedEvent: PaymentFailedEvent = {
        eventType: 'PAYMENT_FAILED',
        paymentId,
        orderId,
        userId,
        amount,
        reason: error.message || 'Payment processing failed',
        errorCode: error.code || 'UNKNOWN_ERROR',
        timestamp: new Date(),
        correlationId,
      };

      this.kafkaClient.emit(KAFKA_TOPICS.PAYMENT_EVENTS, paymentFailedEvent);

      throw new InternalServerErrorException('Payment processing failed');
    }
  }

  private async processStripePayment(
    paymentDetails: any, 
    amount: number, 
    currency: string
  ): Promise<{ transactionId: string }> {
    
    this.logger.info('Processing Stripe payment', { amount, currency });

    try {
      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe expects amount in cents
        currency: currency.toLowerCase(),
        payment_method: paymentDetails.paymentMethodId,
        confirmation_method: 'manual',
        confirm: true,
        return_url: paymentDetails.returnUrl || 'http://localhost:4200/payment/complete',
      });

      if (paymentIntent.status === 'succeeded') {
        return { transactionId: paymentIntent.id };
      } else if (paymentIntent.status === 'requires_action') {
        // Handle 3D Secure or other authentication
        throw new Error('Payment requires additional authentication');
      } else {
        throw new Error(`Payment failed with status: ${paymentIntent.status}`);
      }

    } catch (error) {
      this.logger.error('Stripe payment error', {}, error);
      
      if (error.type === 'StripeCardError') {
        throw new BadRequestException(`Card error: ${error.message}`);
      } else if (error.type === 'StripeInvalidRequestError') {
        throw new BadRequestException(`Invalid request: ${error.message}`);
      } else {
        throw new InternalServerErrorException('Payment processing failed');
      }
    }
  }

  async createPaymentIntent(amount: number, currency: string): Promise<any> {
    const correlationId = CorrelationIdGenerator.generate();
    
    this.logger.info('Creating payment intent', {
      correlationId,
      amount,
      currency,
    });

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };

    } catch (error) {
      this.logger.error('Failed to create payment intent', { correlationId }, error);
      throw new InternalServerErrorException('Failed to create payment intent');
    }
  }

  async handleWebhook(signature: string, payload: Buffer): Promise<void> {
    const correlationId = CorrelationIdGenerator.generate();
    
    try {
      const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
      const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      this.logger.info('Stripe webhook received', {
        correlationId,
        eventType: event.type,
        eventId: event.id,
      });

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object, correlationId);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object, correlationId);
          break;
        
        default:
          this.logger.info('Unhandled webhook event type', {
            correlationId,
            eventType: event.type,
          });
      }

    } catch (error) {
      this.logger.error('Webhook processing failed', { correlationId }, error);
      throw error;
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: any, correlationId: string): Promise<void> {
    this.logger.info('Payment intent succeeded', {
      correlationId,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
    });

    // Additional processing for successful payments
    // In a real implementation, you might update order status, send confirmations, etc.
  }

  private async handlePaymentIntentFailed(paymentIntent: any, correlationId: string): Promise<void> {
    this.logger.error('Payment intent failed', {
      correlationId,
      paymentIntentId: paymentIntent.id,
      failureReason: paymentIntent.last_payment_error?.message,
    });

    // Additional processing for failed payments
    // In a real implementation, you might notify the user, update order status, etc.
  }
}