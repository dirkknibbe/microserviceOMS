export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export enum OrderStatus {
  PENDING = "PENDING",
  CONFIRMED = "CONFIRMED", 
  PAID = "PAID",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

export interface OrderCreatedEvent {
  eventType: 'ORDER_CREATED';
  orderId: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  timestamp: Date;
  correlationId: string;
}

export interface OrderConfirmedEvent {
  eventType: 'ORDER_CONFIRMED';
  orderId: string;
  userId: string;
  timestamp: Date;
  correlationId: string;
}

export interface OrderCancelledEvent {
  eventType: 'ORDER_CANCELLED';
  orderId: string;
  userId: string;
  reason: string;
  timestamp: Date;
  correlationId: string;
}

export interface OrderStatusUpdatedEvent {
  eventType: 'ORDER_STATUS_UPDATED';
  orderId: string;
  userId: string;
  oldStatus: OrderStatus;
  newStatus: OrderStatus;
  reason?: string;
  timestamp: Date;
  correlationId: string;
}