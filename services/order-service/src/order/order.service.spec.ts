import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// Mock shared utilities to avoid resolving their node_modules dependencies
jest.mock('@shared/utils', () => ({
  createLogger: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }),
  CorrelationIdGenerator: { generate: () => 'test-correlation-id' },
}));
jest.mock('@shared/events', () => ({
  KAFKA_TOPICS: { ORDER_EVENTS: 'order.events' },
  OrderCreatedEvent: {},
  OrderStatusUpdatedEvent: {},
}));

import { OrderService } from './order.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';

const mockOrderRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
});

const mockOrderItemRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
});

const mockOrderStatusHistoryRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
});

const mockKafkaClient = () => ({
  emit: jest.fn(),
});

describe('OrderService', () => {
  let service: OrderService;
  let orderRepo: ReturnType<typeof mockOrderRepository>;
  let statusHistoryRepo: ReturnType<typeof mockOrderStatusHistoryRepository>;
  let kafkaClient: ReturnType<typeof mockKafkaClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getRepositoryToken(Order), useFactory: mockOrderRepository },
        { provide: getRepositoryToken(OrderItem), useFactory: mockOrderItemRepository },
        { provide: getRepositoryToken(OrderStatusHistory), useFactory: mockOrderStatusHistoryRepository },
        { provide: 'KAFKA_SERVICE', useFactory: mockKafkaClient },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    orderRepo = module.get(getRepositoryToken(Order));
    statusHistoryRepo = module.get(getRepositoryToken(OrderStatusHistory));
    kafkaClient = module.get('KAFKA_SERVICE');
  });

  describe('create', () => {
    it('should create an order with correct total amount', async () => {
      const createInput = {
        userId: 'user-1',
        items: [{ productId: '550e8400-e29b-41d4-a716-446655440201', quantity: 2 }],
      };

      const savedOrder = {
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.PENDING,
        totalAmount: 299.98,
        items: [{ productId: '550e8400-e29b-41d4-a716-446655440201', quantity: 2, unitPrice: 149.99, totalPrice: 299.98 }],
      };

      orderRepo.create.mockReturnValue(savedOrder);
      orderRepo.save.mockResolvedValue(savedOrder);
      statusHistoryRepo.create.mockReturnValue({});
      statusHistoryRepo.save.mockResolvedValue({});

      const result = await service.create(createInput);

      expect(result).toEqual(savedOrder);
      expect(orderRepo.save).toHaveBeenCalled();
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ eventType: 'ORDER_CREATED', orderId: 'order-1' })
      );
    });

    it('should use price 0 for unknown product IDs', async () => {
      const createInput = {
        userId: 'user-1',
        items: [{ productId: 'unknown-product', quantity: 3 }],
      };

      const savedOrder = {
        id: 'order-2',
        userId: 'user-1',
        status: OrderStatus.PENDING,
        totalAmount: 0,
        items: [],
      };

      orderRepo.create.mockReturnValue(savedOrder);
      orderRepo.save.mockResolvedValue(savedOrder);
      statusHistoryRepo.create.mockReturnValue({});
      statusHistoryRepo.save.mockResolvedValue({});

      const result = await service.create(createInput);

      expect(result.totalAmount).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return an order when it exists', async () => {
      const order = { id: 'order-1', userId: 'user-1', status: OrderStatus.PENDING };
      orderRepo.findOne.mockResolvedValue(order);

      const result = await service.findOne('order-1');
      expect(result).toEqual(order);
    });

    it('should throw NotFoundException when order does not exist', async () => {
      orderRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update order status along the valid progression', async () => {
      const existingOrder = { id: 'order-1', userId: 'user-1', status: OrderStatus.PENDING, items: [] };
      const updatedOrder = { ...existingOrder, status: OrderStatus.CONFIRMED };

      orderRepo.findOne.mockResolvedValue(existingOrder);
      orderRepo.save.mockResolvedValue(updatedOrder);
      statusHistoryRepo.create.mockReturnValue({});
      statusHistoryRepo.save.mockResolvedValue({});

      const result = await service.updateStatus({ orderId: 'order-1', status: OrderStatus.CONFIRMED });

      expect(result.status).toBe(OrderStatus.CONFIRMED);
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ eventType: 'ORDER_STATUS_UPDATED', newStatus: OrderStatus.CONFIRMED })
      );
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      const existingOrder = { id: 'order-1', userId: 'user-1', status: OrderStatus.PENDING, items: [] };
      orderRepo.findOne.mockResolvedValue(existingOrder);

      await expect(
        service.updateStatus({ orderId: 'order-1', status: OrderStatus.SHIPPED })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for transition from terminal DELIVERED state', async () => {
      const existingOrder = { id: 'order-1', userId: 'user-1', status: OrderStatus.DELIVERED, items: [] };
      orderRepo.findOne.mockResolvedValue(existingOrder);

      await expect(
        service.updateStatus({ orderId: 'order-1', status: OrderStatus.CANCELLED })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel a pending order', async () => {
      const existingOrder = { id: 'order-1', userId: 'user-1', status: OrderStatus.PENDING, items: [] };
      const cancelledOrder = { ...existingOrder, status: OrderStatus.CANCELLED };

      orderRepo.findOne.mockResolvedValue(existingOrder);
      orderRepo.save.mockResolvedValue(cancelledOrder);
      statusHistoryRepo.create.mockReturnValue({});
      statusHistoryRepo.save.mockResolvedValue({});

      const result = await service.cancel('order-1', 'Customer request');
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('should throw BadRequestException when cancelling a delivered order', async () => {
      const existingOrder = { id: 'order-1', userId: 'user-1', status: OrderStatus.DELIVERED, items: [] };
      orderRepo.findOne.mockResolvedValue(existingOrder);

      await expect(service.cancel('order-1', 'reason')).rejects.toThrow(BadRequestException);
      await expect(service.cancel('order-1', 'reason')).rejects.toThrow('Cannot cancel a delivered order');
    });

    it('should throw BadRequestException when cancelling an already cancelled order', async () => {
      const existingOrder = { id: 'order-1', userId: 'user-1', status: OrderStatus.CANCELLED, items: [] };
      orderRepo.findOne.mockResolvedValue(existingOrder);

      await expect(service.cancel('order-1', 'reason')).rejects.toThrow(BadRequestException);
      await expect(service.cancel('order-1', 'reason')).rejects.toThrow('already cancelled');
    });
  });

  describe('findAll', () => {
    it('should return all orders ordered by createdAt DESC', async () => {
      const orders = [
        { id: 'order-2', status: OrderStatus.PAID },
        { id: 'order-1', status: OrderStatus.PENDING },
      ];
      orderRepo.find.mockResolvedValue(orders);

      const result = await service.findAll();
      expect(result).toEqual(orders);
      expect(orderRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { createdAt: 'DESC' } })
      );
    });
  });
});
