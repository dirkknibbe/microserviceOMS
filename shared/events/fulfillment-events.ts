export type FulfillmentStep = 'PICKED' | 'PACKED' | 'SHIPPED';

export interface OrderPickedEvent {
  eventType: 'ORDER_PICKED';
  eventId: string;
  orderId: string;
  timestamp: Date;
  correlationId: string;
}

export interface OrderPackedEvent {
  eventType: 'ORDER_PACKED';
  eventId: string;
  orderId: string;
  timestamp: Date;
  correlationId: string;
}

export interface OrderShippedEvent {
  eventType: 'ORDER_SHIPPED';
  eventId: string;
  orderId: string;
  timestamp: Date;
  correlationId: string;
}
