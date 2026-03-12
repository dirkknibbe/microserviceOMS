export interface UserCreatedEvent {
  eventType: 'USER_CREATED';
  userId: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  timestamp: Date;
  correlationId: string;
}

export interface UserUpdatedEvent {
  eventType: 'USER_UPDATED';
  userId: string;
  updatedFields: Record<string, any>;
  timestamp: Date;
  correlationId: string;
}

export interface UserDeletedEvent {
  eventType: 'USER_DELETED';
  userId: string;
  email: string;
  reason: string;
  timestamp: Date;
  correlationId: string;
}

export interface UserLoginEvent {
  eventType: 'USER_LOGIN';
  userId: string;
  email: string;
  ipAddress: string;
  deviceInfo?: string;
  timestamp: Date;
  correlationId: string;
}

export interface UserLogoutEvent {
  eventType: 'USER_LOGOUT';
  userId: string;
  sessionId: string;
  timestamp: Date;
  correlationId: string;
}

export interface PasswordChangedEvent {
  eventType: 'PASSWORD_CHANGED';
  userId: string;
  email: string;
  timestamp: Date;
  correlationId: string;
}

export interface EmailVerifiedEvent {
  eventType: 'EMAIL_VERIFIED';
  userId: string;
  email: string;
  timestamp: Date;
  correlationId: string;
}