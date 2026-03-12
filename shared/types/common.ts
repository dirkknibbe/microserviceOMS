// Common domain types used across services
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Order domain types
export interface Order extends BaseEntity {
  userId: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
}

export interface OrderItem {
  id?: string;
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

// Product domain types
export interface Product extends BaseEntity {
  name: string;
  description: string;
  price: number;
  sku: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

// User domain types
export interface User extends BaseEntity {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isActive: boolean;
  isVerified: boolean;
}

export interface UserAddress extends BaseEntity {
  userId: string;
  type: 'shipping' | 'billing';
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface UserPreferences extends BaseEntity {
  userId: string;
  notificationEmail: boolean;
  notificationSms: boolean;
  notificationPush: boolean;
  theme: 'light' | 'dark';
  language: string;
  currency: string;
}

// Payment domain types
export interface Payment extends BaseEntity {
  orderId: string;
  userId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  failureReason?: string;
}

export enum PaymentMethod {
  CREDIT_CARD = "CREDIT_CARD",
  DEBIT_CARD = "DEBIT_CARD",
  PAYPAL = "PAYPAL",
  STRIPE = "STRIPE",
  BANK_TRANSFER = "BANK_TRANSFER",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: Date;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error types
export interface ErrorDetails {
  code: string;
  message: string;
  field?: string;
  details?: any;
}

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, public readonly field: string, details?: any) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', `${resource} with id ${id} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: any) {
    super('CONFLICT', message, details);
    this.name = 'ConflictError';
  }
}