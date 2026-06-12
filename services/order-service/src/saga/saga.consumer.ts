import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { KAFKA_TOPICS } from '@shared/events';
import { SagaService } from './saga.service';
import { SAGA_MESSAGE_TYPES, SagaMessageType } from './saga-states';

interface RawSagaEvent {
  eventType?: string;
  eventId?: string;
  orderId?: string;
  correlationId?: string;
  authorizationId?: string;
}

@Controller()
export class SagaConsumer {
  private readonly logger = new Logger(SagaConsumer.name);

  constructor(private readonly sagaService: SagaService) {}

  @EventPattern(KAFKA_TOPICS.INVENTORY_EVENTS)
  async onInventoryEvent(@Payload() event: RawSagaEvent): Promise<void> {
    await this.route(event);
  }

  @EventPattern(KAFKA_TOPICS.FULFILLMENT_EVENTS)
  async onFulfillmentEvent(@Payload() event: RawSagaEvent): Promise<void> {
    await this.route(event);
  }

  @EventPattern(KAFKA_TOPICS.PAYMENT_EVENTS)
  async onPaymentEvent(@Payload() event: RawSagaEvent): Promise<void> {
    await this.route(event);
  }

  private async route(event: RawSagaEvent): Promise<void> {
    if (!event?.eventType || !event.orderId || !(SAGA_MESSAGE_TYPES as readonly string[]).includes(event.eventType)) {
      this.logger.debug(`Ignoring non-saga event: ${event?.eventType ?? 'unknown'}`);
      return;
    }
    await this.sagaService.handleMessage(event.eventType as SagaMessageType, {
      eventId: event.eventId,
      orderId: event.orderId,
      correlationId: event.correlationId ?? 'unknown',
      authorizationId: event.authorizationId,
    });
  }
}
