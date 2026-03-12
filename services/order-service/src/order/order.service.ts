import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { CreateOrderInput } from './dto/create-order.dto';
import { UpdateOrderStatusInput } from './dto/update-order.dto';
import { createLogger, CorrelationIdGenerator } from '@shared/utils';
import { OrderCreatedEvent, OrderStatusUpdatedEvent, KAFKA_TOPICS } from '@shared/events';

@Injectable()
export class OrderService {
  private readonly logger = createLogger('OrderService');

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(OrderStatusHistory)
    private readonly orderStatusHistoryRepository: Repository<OrderStatusHistory>,
    @Inject('KAFKA_SERVICE')
    private readonly kafkaClient: ClientProxy,
  ) {}

  async create(createOrderInput: CreateOrderInput): Promise<Order> {
    const correlationId = CorrelationIdGenerator.generate();
    
    this.logger.info('Creating new order', {
      correlationId,
      userId: createOrderInput.userId,
      itemCount: createOrderInput.items.length,
    });

    try {
      // TODO: In real implementation, fetch product prices from inventory service
      // For now, using mock prices
      const mockPrices = {
        '550e8400-e29b-41d4-a716-446655440201': 149.99,
        '550e8400-e29b-41d4-a716-446655440202': 199.99,
        '550e8400-e29b-41d4-a716-446655440203': 29.99,
      };

      let totalAmount = 0;
      const orderItems: Partial<OrderItem>[] = [];

      for (const item of createOrderInput.items) {
        const unitPrice = mockPrices[item.productId] || 0;
        const totalPrice = unitPrice * item.quantity;
        totalAmount += totalPrice;

        orderItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
        });
      }

      // Create order with items
      const order = this.orderRepository.create({
        userId: createOrderInput.userId,
        status: OrderStatus.PENDING,
        totalAmount,
        items: orderItems as OrderItem[],
      });

      const savedOrder = await this.orderRepository.save(order);

      // Create initial status history
      const statusHistory = this.orderStatusHistoryRepository.create({
        order: savedOrder,
        oldStatus: null,
        newStatus: OrderStatus.PENDING,
        reason: 'Order created',
      });
      await this.orderStatusHistoryRepository.save(statusHistory);

      // Emit order created event
      const orderCreatedEvent: OrderCreatedEvent = {
        eventType: 'ORDER_CREATED',
        orderId: savedOrder.id,
        userId: savedOrder.userId,
        items: savedOrder.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
        totalAmount: savedOrder.totalAmount,
        timestamp: new Date(),
        correlationId,
      };

      this.kafkaClient.emit(KAFKA_TOPICS.ORDER_EVENTS, orderCreatedEvent);

      this.logger.info('Order created successfully', {
        correlationId,
        orderId: savedOrder.id,
        totalAmount: savedOrder.totalAmount,
      });

      return savedOrder;
    } catch (error) {
      this.logger.error('Failed to create order', { correlationId }, error);
      throw error;
    }
  }

  async findAll(): Promise<Order[]> {
    return this.orderRepository.find({
      relations: ['items', 'statusHistory'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items', 'statusHistory'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async findByUserId(userId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { userId },
      relations: ['items', 'statusHistory'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(updateOrderStatusInput: UpdateOrderStatusInput): Promise<Order> {
    const correlationId = CorrelationIdGenerator.generate();
    const { orderId, status, reason } = updateOrderStatusInput;

    this.logger.info('Updating order status', {
      correlationId,
      orderId,
      newStatus: status,
      reason,
    });

    const order = await this.findOne(orderId);
    const oldStatus = order.status;

    // Validate status transition
    if (!this.isValidStatusTransition(oldStatus, status)) {
      throw new BadRequestException(
        `Invalid status transition from ${oldStatus} to ${status}`
      );
    }

    // Update order status
    order.status = status;
    const updatedOrder = await this.orderRepository.save(order);

    // Create status history entry
    const statusHistory = this.orderStatusHistoryRepository.create({
      order: updatedOrder,
      oldStatus,
      newStatus: status,
      reason: reason || `Status updated to ${status}`,
    });
    await this.orderStatusHistoryRepository.save(statusHistory);

    // Emit status updated event
    const statusUpdatedEvent: OrderStatusUpdatedEvent = {
      eventType: 'ORDER_STATUS_UPDATED',
      orderId: updatedOrder.id,
      userId: updatedOrder.userId,
      oldStatus,
      newStatus: status,
      reason,
      timestamp: new Date(),
      correlationId,
    };

    this.kafkaClient.emit(KAFKA_TOPICS.ORDER_EVENTS, statusUpdatedEvent);

    this.logger.info('Order status updated successfully', {
      correlationId,
      orderId,
      oldStatus,
      newStatus: status,
    });

    return updatedOrder;
  }

  async cancel(orderId: string, reason: string): Promise<Order> {
    const correlationId = CorrelationIdGenerator.generate();

    this.logger.info('Cancelling order', {
      correlationId,
      orderId,
      reason,
    });

    const order = await this.findOne(orderId);

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Cannot cancel a delivered order');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    return this.updateStatus({
      orderId,
      status: OrderStatus.CANCELLED,
      reason,
    });
  }

  private isValidStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
    const validTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PAID, OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [], // Terminal state
      [OrderStatus.CANCELLED]: [], // Terminal state
    };

    return validTransitions[from]?.includes(to) || false;
  }
}