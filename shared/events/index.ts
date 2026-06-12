// Export all event types for easy importing
export * from './order-events';
export * from './inventory-events';
export * from './payment-events';
export * from './notification-events';
export * from './user-events';
export * from './fulfillment-events';
export * from './saga-commands';

// Union type for all possible events
import type { OrderCreatedEvent, OrderConfirmedEvent, OrderCancelledEvent, OrderStatusUpdatedEvent } from './order-events';
import type { InventoryReservedEvent, InventoryReservationFailedEvent, InventoryReservationConfirmedEvent, InventoryReservationExpiredEvent, StockUpdatedEvent, InventoryReleasedEvent } from './inventory-events';
import type { PaymentInitiatedEvent, PaymentProcessedEvent, PaymentFailedEvent, RefundInitiatedEvent, RefundProcessedEvent, PaymentAuthorizedEvent, PaymentAuthFailedEvent, PaymentCapturedEvent, PaymentCaptureFailedEvent } from './payment-events';
import type { NotificationRequestedEvent, NotificationSentEvent, NotificationFailedEvent } from './notification-events';
import type { UserCreatedEvent, UserUpdatedEvent, UserDeletedEvent, UserLoginEvent, UserLogoutEvent, PasswordChangedEvent, EmailVerifiedEvent } from './user-events';
import type { OrderPickedEvent, OrderPackedEvent, OrderShippedEvent } from './fulfillment-events';

export type DomainEvent =
  | OrderCreatedEvent
  | OrderConfirmedEvent
  | OrderCancelledEvent
  | OrderStatusUpdatedEvent
  | InventoryReservedEvent
  | InventoryReservationFailedEvent
  | InventoryReservationConfirmedEvent
  | InventoryReservationExpiredEvent
  | StockUpdatedEvent
  | InventoryReleasedEvent
  | PaymentInitiatedEvent
  | PaymentProcessedEvent
  | PaymentFailedEvent
  | RefundInitiatedEvent
  | RefundProcessedEvent
  | PaymentAuthorizedEvent
  | PaymentAuthFailedEvent
  | PaymentCapturedEvent
  | PaymentCaptureFailedEvent
  | NotificationRequestedEvent
  | NotificationSentEvent
  | NotificationFailedEvent
  | UserCreatedEvent
  | UserUpdatedEvent
  | UserDeletedEvent
  | UserLoginEvent
  | UserLogoutEvent
  | PasswordChangedEvent
  | EmailVerifiedEvent
  | OrderPickedEvent
  | OrderPackedEvent
  | OrderShippedEvent;

// Kafka topic mappings
export const KAFKA_TOPICS = {
  ORDER_EVENTS: 'order.events',
  INVENTORY_EVENTS: 'inventory.events',
  INVENTORY_COMMANDS: 'inventory.commands',
  FULFILLMENT_EVENTS: 'fulfillment.events',
  FULFILLMENT_COMMANDS: 'fulfillment.commands',
  PAYMENT_EVENTS: 'payment.events',
  PAYMENT_COMMANDS: 'payment.commands',
  NOTIFICATION_EVENTS: 'notification.events',
  USER_EVENTS: 'user.events',
} as const;

export type KafkaTopics = typeof KAFKA_TOPICS[keyof typeof KAFKA_TOPICS];

// Event routing helper
export function getTopicForEvent(event: DomainEvent): KafkaTopics {
  switch (event.eventType) {
    case 'ORDER_CREATED':
    case 'ORDER_CONFIRMED':
    case 'ORDER_CANCELLED':
    case 'ORDER_STATUS_UPDATED':
      return KAFKA_TOPICS.ORDER_EVENTS;

    case 'INVENTORY_RESERVED':
    case 'INVENTORY_RESERVATION_FAILED':
    case 'INVENTORY_RESERVATION_CONFIRMED':
    case 'INVENTORY_RESERVATION_EXPIRED':
    case 'STOCK_UPDATED':
    case 'INVENTORY_RELEASED':
      return KAFKA_TOPICS.INVENTORY_EVENTS;

    case 'PAYMENT_INITIATED':
    case 'PAYMENT_PROCESSED':
    case 'PAYMENT_FAILED':
    case 'REFUND_INITIATED':
    case 'REFUND_PROCESSED':
    case 'PAYMENT_AUTHORIZED':
    case 'PAYMENT_AUTH_FAILED':
    case 'PAYMENT_CAPTURED':
    case 'PAYMENT_CAPTURE_FAILED':
      return KAFKA_TOPICS.PAYMENT_EVENTS;

    case 'ORDER_PICKED':
    case 'ORDER_PACKED':
    case 'ORDER_SHIPPED':
      return KAFKA_TOPICS.FULFILLMENT_EVENTS;

    case 'NOTIFICATION_REQUESTED':
    case 'NOTIFICATION_SENT':
    case 'NOTIFICATION_FAILED':
      return KAFKA_TOPICS.NOTIFICATION_EVENTS;

    case 'USER_CREATED':
    case 'USER_UPDATED':
    case 'USER_DELETED':
    case 'USER_LOGIN':
    case 'USER_LOGOUT':
    case 'PASSWORD_CHANGED':
    case 'EMAIL_VERIFIED':
      return KAFKA_TOPICS.USER_EVENTS;

    default:
      throw new Error(`Unknown event type: ${(event as any).eventType}`);
  }
}