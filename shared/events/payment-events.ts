export enum PaymentStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export enum PaymentMethod {
  CREDIT_CARD = "CREDIT_CARD",
  DEBIT_CARD = "DEBIT_CARD",
  PAYPAL = "PAYPAL",
  STRIPE = "STRIPE",
  BANK_TRANSFER = "BANK_TRANSFER",
}

export interface PaymentInitiatedEvent {
  eventType: 'PAYMENT_INITIATED';
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  timestamp: Date;
  correlationId: string;
}

export interface PaymentProcessedEvent {
  eventType: 'PAYMENT_PROCESSED';
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  transactionId?: string;
  failureReason?: string;
  timestamp: Date;
  correlationId: string;
}

export interface PaymentFailedEvent {
  eventType: 'PAYMENT_FAILED';
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  reason: string;
  errorCode?: string;
  timestamp: Date;
  correlationId: string;
}

export interface RefundInitiatedEvent {
  eventType: 'REFUND_INITIATED';
  refundId: string;
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  reason: string;
  timestamp: Date;
  correlationId: string;
}

export interface RefundProcessedEvent {
  eventType: 'REFUND_PROCESSED';
  refundId: string;
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED';
  transactionId?: string;
  failureReason?: string;
  timestamp: Date;
  correlationId: string;
}