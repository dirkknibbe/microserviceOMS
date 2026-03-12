export interface InventoryReservation {
  id: string;
  productId: string;
  orderId: string;
  quantity: number;
  expiresAt: Date;
}

export enum ReservationStatus {
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  CONFIRMED = "CONFIRMED",
  CANCELLED = "CANCELLED",
}

export interface InventoryReservedEvent {
  eventType: 'INVENTORY_RESERVED';
  orderId: string;
  reservations: InventoryReservation[];
  timestamp: Date;
  correlationId: string;
}

export interface InventoryReservationFailedEvent {
  eventType: 'INVENTORY_RESERVATION_FAILED';
  orderId: string;
  failedItems: Array<{
    productId: string;
    requestedQuantity: number;
    availableQuantity: number;
  }>;
  timestamp: Date;
  correlationId: string;
}

export interface InventoryReservationConfirmedEvent {
  eventType: 'INVENTORY_RESERVATION_CONFIRMED';
  orderId: string;
  reservationIds: string[];
  timestamp: Date;
  correlationId: string;
}

export interface InventoryReservationExpiredEvent {
  eventType: 'INVENTORY_RESERVATION_EXPIRED';
  orderId: string;
  reservationIds: string[];
  timestamp: Date;
  correlationId: string;
}

export interface StockUpdatedEvent {
  eventType: 'STOCK_UPDATED';
  productId: string;
  oldQuantity: number;
  newQuantity: number;
  movementType: 'IN' | 'OUT' | 'RESERVED' | 'RELEASED';
  reason: string;
  timestamp: Date;
  correlationId: string;
}