import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { KAFKA_TOPICS } from '@shared/events';
import type { AuthorizePaymentCommand, CapturePaymentCommand } from '@shared/events';
import { PaymentService } from './payment.service';

@Controller()
export class PaymentCommandsController {
  private readonly logger = new Logger(PaymentCommandsController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @EventPattern(KAFKA_TOPICS.PAYMENT_COMMANDS)
  async onCommand(
    @Payload() command: AuthorizePaymentCommand | CapturePaymentCommand,
  ): Promise<void> {
    switch (command?.type) {
      case 'AUTHORIZE_PAYMENT':
        return this.paymentService.authorizePayment(command);
      case 'CAPTURE_PAYMENT':
        return this.paymentService.capturePayment(command);
      default:
        this.logger.warn(
          `Unknown command on payment.commands: ${JSON.stringify((command as { type?: string })?.type)}`,
        );
    }
  }
}
