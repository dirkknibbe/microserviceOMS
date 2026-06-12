import type { OrderItem } from './order-events';
import type { PaymentMethod } from './payment-events';

interface CommandBase {
  eventId: string;
  orderId: string;
  timestamp: Date;
  correlationId: string;
}

export interface ReserveStockCommand extends CommandBase {
  type: 'RESERVE_STOCK';
  items: OrderItem[];
}

export interface ReleaseStockCommand extends CommandBase {
  type: 'RELEASE_STOCK';
}

export interface ReleaseOrderCommand extends CommandBase {
  type: 'RELEASE_ORDER';
}

export interface AuthorizePaymentCommand extends CommandBase {
  type: 'AUTHORIZE_PAYMENT';
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
}

export interface CapturePaymentCommand extends CommandBase {
  type: 'CAPTURE_PAYMENT';
  authorizationId: string;
  amount: number;
}

export type SagaCommand =
  | ReserveStockCommand
  | ReleaseStockCommand
  | ReleaseOrderCommand
  | AuthorizePaymentCommand
  | CapturePaymentCommand;
