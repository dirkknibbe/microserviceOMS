import { OrderStatus } from '../order/entities/order-status.enum';

export enum SagaState {
  AWAITING_STOCK = 'AWAITING_STOCK',
  AWAITING_AUTH = 'AWAITING_AUTH',
  RELEASED = 'RELEASED',
  PICKED = 'PICKED',
  PACKED = 'PACKED',
  AWAITING_CAPTURE = 'AWAITING_CAPTURE',
  COMPLETED = 'COMPLETED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  FAILED = 'FAILED',
  CAPTURE_FAILED = 'CAPTURE_FAILED',
}

export const TERMINAL_STATES: readonly SagaState[] = [
  SagaState.COMPLETED,
  SagaState.COMPENSATED,
  SagaState.FAILED,
  SagaState.CAPTURE_FAILED,
];

export const SAGA_MESSAGE_TYPES = [
  'INVENTORY_RESERVED',
  'INVENTORY_RESERVATION_FAILED',
  'INVENTORY_RELEASED',
  'PAYMENT_AUTHORIZED',
  'PAYMENT_AUTH_FAILED',
  'PAYMENT_CAPTURED',
  'PAYMENT_CAPTURE_FAILED',
  'ORDER_PICKED',
  'ORDER_PACKED',
  'ORDER_SHIPPED',
] as const;

/** Reply-event types the saga reacts to. */
export type SagaMessageType = (typeof SAGA_MESSAGE_TYPES)[number];

/** Command kinds the saga can dispatch (payloads are built by SagaService). */
export type SagaCommandType =
  | 'RESERVE_STOCK'
  | 'RELEASE_STOCK'
  | 'RELEASE_ORDER'
  | 'AUTHORIZE_PAYMENT'
  | 'CAPTURE_PAYMENT';

/** Order-level event kinds the saga emits for the notification service. */
export type SagaOrderEventType = 'ORDER_CONFIRMED' | 'ORDER_SHIPPED_NOTICE' | 'ORDER_FAILED';

export interface SagaDecision {
  newState: SagaState;
  commands: readonly SagaCommandType[];
  orderEvents: readonly SagaOrderEventType[];
  isNoOp: boolean;
}

export const ORDER_STATUS_PROJECTION: Record<SagaState, OrderStatus> = {
  [SagaState.AWAITING_STOCK]: OrderStatus.PENDING,
  [SagaState.AWAITING_AUTH]: OrderStatus.PENDING,
  [SagaState.COMPENSATING]: OrderStatus.PENDING,
  [SagaState.RELEASED]: OrderStatus.PROCESSING,
  [SagaState.PICKED]: OrderStatus.PROCESSING,
  [SagaState.PACKED]: OrderStatus.PROCESSING,
  [SagaState.AWAITING_CAPTURE]: OrderStatus.SHIPPED,
  [SagaState.CAPTURE_FAILED]: OrderStatus.SHIPPED,
  [SagaState.COMPLETED]: OrderStatus.COMPLETED,
  [SagaState.FAILED]: OrderStatus.FAILED,
  [SagaState.COMPENSATED]: OrderStatus.FAILED,
};
