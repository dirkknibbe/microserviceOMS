export enum NotificationType {
  EMAIL = "EMAIL",
  SMS = "SMS",
  PUSH = "PUSH",
}

export enum NotificationTemplate {
  ORDER_CONFIRMATION = "ORDER_CONFIRMATION",
  ORDER_SHIPPED = "ORDER_SHIPPED",
  ORDER_DELIVERED = "ORDER_DELIVERED",
  ORDER_CANCELLED = "ORDER_CANCELLED",
  PAYMENT_SUCCESS = "PAYMENT_SUCCESS",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  INVENTORY_LOW = "INVENTORY_LOW",
  WELCOME = "WELCOME",
  PASSWORD_RESET = "PASSWORD_RESET",
}

export interface NotificationRequestedEvent {
  eventType: 'NOTIFICATION_REQUESTED';
  notificationId: string;
  userId: string;
  type: NotificationType;
  template: NotificationTemplate;
  recipient: string; // email address or phone number
  data: Record<string, any>;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  timestamp: Date;
  correlationId: string;
}

export interface NotificationSentEvent {
  eventType: 'NOTIFICATION_SENT';
  notificationId: string;
  userId: string;
  type: NotificationType;
  recipient: string;
  status: 'SUCCESS' | 'FAILED';
  providerId?: string; // SendGrid message ID, Twilio SID, etc.
  failureReason?: string;
  timestamp: Date;
  correlationId: string;
}

export interface NotificationFailedEvent {
  eventType: 'NOTIFICATION_FAILED';
  notificationId: string;
  userId: string;
  type: NotificationType;
  recipient: string;
  reason: string;
  errorCode?: string;
  retryCount: number;
  timestamp: Date;
  correlationId: string;
}