import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { KAFKA_TOPICS, PaymentMethod } from '@shared/events';
import type { SagaCommand } from '@shared/events';
import { Order } from '../order/entities/order.entity';
import { OrderStatus } from '../order/entities/order-status.enum';
import { SagaInstance } from './entities/saga-instance.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { transition } from './saga-state-machine';
import {
  ORDER_STATUS_PROJECTION,
  SagaCommandType,
  SagaMessageType,
  SagaOrderEventType,
  SagaState,
} from './saga-states';

const COMMAND_TOPICS: Record<SagaCommandType, string> = {
  RESERVE_STOCK: KAFKA_TOPICS.INVENTORY_COMMANDS,
  RELEASE_STOCK: KAFKA_TOPICS.INVENTORY_COMMANDS,
  RELEASE_ORDER: KAFKA_TOPICS.FULFILLMENT_COMMANDS,
  AUTHORIZE_PAYMENT: KAFKA_TOPICS.PAYMENT_COMMANDS,
  CAPTURE_PAYMENT: KAFKA_TOPICS.PAYMENT_COMMANDS,
};

interface IncomingSagaMessage {
  eventId?: string;
  orderId: string;
  correlationId: string;
  authorizationId?: string;
}

@Injectable()
export class SagaService {
  private readonly logger = new Logger(SagaService.name);

  constructor(
    @InjectRepository(SagaInstance) private readonly sagaRepository: Repository<SagaInstance>,
    @InjectRepository(ProcessedEvent) private readonly processedEventRepository: Repository<ProcessedEvent>,
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async startSaga(order: Order, correlationId: string): Promise<void> {
    const instance = this.sagaRepository.create({
      sagaId: order.id,
      currentState: SagaState.AWAITING_STOCK,
      correlationId,
      history: [
        { state: SagaState.AWAITING_STOCK, message: 'ORDER_CREATED', timestamp: new Date().toISOString() },
      ],
    });
    await this.sagaRepository.save(instance);
    await this.dispatchCommand('RESERVE_STOCK', order, correlationId);
  }

  async handleMessage(messageType: SagaMessageType, payload: IncomingSagaMessage): Promise<void> {
    if (payload.eventId) {
      const seen = await this.processedEventRepository.findOne({ where: { eventId: payload.eventId } });
      if (seen) {
        this.logger.log(`Duplicate event skipped: ${payload.eventId} (${messageType})`);
        return;
      }
    }

    const instance = await this.sagaRepository.findOne({ where: { sagaId: payload.orderId } });
    if (!instance) {
      this.logger.warn(`No saga for orderId=${payload.orderId}, message=${messageType} — skipping`);
      return;
    }

    const decision = transition(instance.currentState, messageType);
    if (decision.isNoOp) {
      this.logger.log(`No-op: ${messageType} in ${instance.currentState} (orderId=${payload.orderId})`);
      await this.markProcessed(payload.eventId);
      return;
    }

    const order = await this.orderRepository.findOne({ where: { id: payload.orderId }, relations: ['items'] });
    if (!order) {
      this.logger.warn(`Order ${payload.orderId} not found for saga transition — skipping`);
      return;
    }

    instance.currentState = decision.newState;
    instance.history = [
      ...instance.history,
      { state: decision.newState, message: messageType, timestamp: new Date().toISOString() },
    ];
    await this.sagaRepository.save(instance);
    await this.markProcessed(payload.eventId);

    const projected = ORDER_STATUS_PROJECTION[decision.newState];
    if (order.status !== projected) {
      order.status = projected;
      await this.orderRepository.save(order);
    }

    for (const command of decision.commands) {
      await this.dispatchCommand(command, order, instance.correlationId, payload.authorizationId);
    }
    for (const orderEvent of decision.orderEvents) {
      this.emitOrderEvent(orderEvent, order, instance.correlationId);
    }

    if (decision.newState === SagaState.CAPTURE_FAILED) {
      this.logger.error(`OPS ALERT: capture failed for shipped order ${order.id} — manual intervention required`);
    }
  }

  private async markProcessed(eventId?: string): Promise<void> {
    if (!eventId) return;
    await this.processedEventRepository.save(this.processedEventRepository.create({ eventId }));
  }

  private async dispatchCommand(
    type: SagaCommandType,
    order: Order,
    correlationId: string,
    authorizationId?: string,
  ): Promise<void> {
    const base = { eventId: randomUUID(), orderId: order.id, timestamp: new Date(), correlationId };
    let command: SagaCommand;
    switch (type) {
      case 'RESERVE_STOCK':
        command = {
          ...base,
          type,
          items: order.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        };
        break;
      case 'AUTHORIZE_PAYMENT':
        command = {
          ...base,
          type,
          userId: order.userId,
          amount: Number(order.totalAmount),
          currency: 'USD',
          paymentMethod: PaymentMethod.CREDIT_CARD,
        };
        break;
      case 'CAPTURE_PAYMENT':
        command = { ...base, type, authorizationId: authorizationId ?? '', amount: Number(order.totalAmount) };
        break;
      case 'RELEASE_STOCK':
      case 'RELEASE_ORDER':
        command = { ...base, type };
        break;
    }
    this.kafkaClient.emit(COMMAND_TOPICS[type], command);
    this.logger.log(`Dispatched ${type} for order ${order.id} (correlationId=${correlationId})`);
  }

  private emitOrderEvent(kind: SagaOrderEventType, order: Order, correlationId: string): void {
    const eventTypeMap: Record<SagaOrderEventType, string> = {
      ORDER_CONFIRMED: 'ORDER_CONFIRMED',
      ORDER_SHIPPED_NOTICE: 'ORDER_STATUS_UPDATED',
      ORDER_FAILED: 'ORDER_CANCELLED',
    };
    this.kafkaClient.emit(KAFKA_TOPICS.ORDER_EVENTS, {
      eventType: eventTypeMap[kind],
      orderId: order.id,
      userId: order.userId,
      ...(kind === 'ORDER_SHIPPED_NOTICE'
        ? { oldStatus: OrderStatus.PROCESSING, newStatus: OrderStatus.SHIPPED }
        : {}),
      ...(kind === 'ORDER_FAILED' ? { reason: 'Saga failed' } : {}),
      timestamp: new Date(),
      correlationId,
    });
  }
}
