// Export all common types
export * from './common';

// DTOs for API requests/responses
export interface CreateOrderDto {
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface UpdateOrderStatusDto {
  orderId: string;
  status: string;
  reason?: string;
}

export interface CreateUserDto {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface CreatePaymentDto {
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentDetails: Record<string, any>;
}

export interface UpdateProductStockDto {
  productId: string;
  quantity: number;
  operation: 'ADD' | 'SUBTRACT' | 'SET';
}

export interface SendNotificationDto {
  userId: string;
  type: 'EMAIL' | 'SMS' | 'PUSH';
  template: string;
  data: Record<string, any>;
}

// GraphQL input types
export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderInput {
  userId: string;
  items: OrderItemInput[];
}

export interface UpdateOrderInput {
  id: string;
  status?: string;
}

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface UpdateUserInput {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

// Filter and sort types
export interface OrderFilters {
  userId?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ProductFilters {
  name?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
}

export interface UserFilters {
  email?: string;
  username?: string;
  isActive?: boolean;
  isVerified?: boolean;
}

export interface SortOptions {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface PaginationOptions {
  page: number;
  limit: number;
}