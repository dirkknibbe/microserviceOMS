import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { SagaService } from './saga.service';
import { SagaInstance } from './entities/saga-instance.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { SagaState } from './saga-states';
import { Order } from '../order/entities/order.entity';
import { OrderStatus } from '../order/entities/order-status.enum';

const mockRepository = () => ({
  create: jest.fn((entity) => entity),
  save: jest.fn((entity) => Promise.resolve(entity)),
  findOne: jest.fn(),
});

const mockKafkaClient = () => ({
  emit: jest.fn(),
});

const buildOrder = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 'order-1',
    userId: 'user-1',
    status: OrderStatus.PENDING,
    totalAmount: 299.98,
    items: [
      {
        productId: 'product-1',
        quantity: 2,
        unitPrice: 149.99,
        totalPrice: 299.98,
      },
    ],
    ...overrides,
  }) as Order;

const buildSagaInstance = (overrides: Partial<SagaInstance> = {}): SagaInstance =>
  ({
    sagaId: 'order-1',
    currentState: SagaState.AWAITING_STOCK,
    correlationId: 'corr-1',
    history: [
      { state: SagaState.AWAITING_STOCK, message: 'ORDER_CREATED', timestamp: '2026-01-01T00:00:00.000Z' },
    ],
    ...overrides,
  }) as SagaInstance;

describe('SagaService', () => {
  let service: SagaService;
  let sagaRepo: ReturnType<typeof mockRepository>;
  let processedEventRepo: ReturnType<typeof mockRepository>;
  let orderRepo: ReturnType<typeof mockRepository>;
  let kafkaClient: ReturnType<typeof mockKafkaClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SagaService,
        { provide: getRepositoryToken(SagaInstance), useFactory: mockRepository },
        { provide: getRepositoryToken(ProcessedEvent), useFactory: mockRepository },
        { provide: getRepositoryToken(Order), useFactory: mockRepository },
        { provide: 'KAFKA_SERVICE', useFactory: mockKafkaClient },
      ],
    }).compile();

    module.useLogger(false);

    service = module.get<SagaService>(SagaService);
    sagaRepo = module.get(getRepositoryToken(SagaInstance));
    processedEventRepo = module.get(getRepositoryToken(ProcessedEvent));
    orderRepo = module.get(getRepositoryToken(Order));
    kafkaClient = module.get('KAFKA_SERVICE');
  });

  describe('startSaga', () => {
    it('persists AWAITING_STOCK instance and emits RESERVE_STOCK to inventory.commands', async () => {
      // Arrange
      const order = buildOrder();

      // Act
      await service.startSaga(order, 'corr-1');

      // Assert
      expect(sagaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          sagaId: 'order-1',
          currentState: SagaState.AWAITING_STOCK,
          correlationId: 'corr-1',
          history: [
            expect.objectContaining({
              state: SagaState.AWAITING_STOCK,
              message: 'ORDER_CREATED',
              timestamp: expect.any(String),
            }),
          ],
        }),
      );
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'inventory.commands',
        expect.objectContaining({
          type: 'RESERVE_STOCK',
          orderId: 'order-1',
          correlationId: 'corr-1',
          items: [
            { productId: 'product-1', quantity: 2, unitPrice: 149.99, totalPrice: 299.98 },
          ],
        }),
      );
    });
  });

  describe('handleMessage', () => {
    it('advances to AWAITING_AUTH and requests payment authorization when inventory reserves', async () => {
      // Arrange
      processedEventRepo.findOne.mockResolvedValue(null);
      sagaRepo.findOne.mockResolvedValue(buildSagaInstance());
      orderRepo.findOne.mockResolvedValue(buildOrder());

      // Act
      await service.handleMessage('INVENTORY_RESERVED', {
        eventId: 'evt-1',
        orderId: 'order-1',
        correlationId: 'corr-1',
      });

      // Assert
      expect(sagaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ sagaId: 'order-1', currentState: SagaState.AWAITING_AUTH }),
      );
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'payment.commands',
        expect.objectContaining({
          type: 'AUTHORIZE_PAYMENT',
          orderId: 'order-1',
          userId: 'user-1',
          amount: 299.98,
        }),
      );
    });

    it('skips already-processed events', async () => {
      // Arrange
      processedEventRepo.findOne.mockResolvedValue({ eventId: 'evt-dup' });

      // Act
      await service.handleMessage('INVENTORY_RESERVED', {
        eventId: 'evt-dup',
        orderId: 'order-1',
        correlationId: 'corr-1',
      });

      // Assert
      expect(sagaRepo.findOne).not.toHaveBeenCalled();
      expect(sagaRepo.save).not.toHaveBeenCalled();
      expect(orderRepo.save).not.toHaveBeenCalled();
      expect(kafkaClient.emit).not.toHaveBeenCalled();
    });

    it('ignores messages for unknown orders', async () => {
      // Arrange
      processedEventRepo.findOne.mockResolvedValue(null);
      sagaRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.handleMessage('INVENTORY_RESERVED', {
          eventId: 'evt-2',
          orderId: 'order-unknown',
          correlationId: 'corr-1',
        }),
      ).resolves.toBeUndefined();
      expect(sagaRepo.save).not.toHaveBeenCalled();
      expect(kafkaClient.emit).not.toHaveBeenCalled();
    });

    it('compensates with stock release when authorization fails', async () => {
      // Arrange
      processedEventRepo.findOne.mockResolvedValue(null);
      sagaRepo.findOne.mockResolvedValue(buildSagaInstance({ currentState: SagaState.AWAITING_AUTH }));
      orderRepo.findOne.mockResolvedValue(buildOrder());

      // Act
      await service.handleMessage('PAYMENT_AUTH_FAILED', {
        eventId: 'evt-3',
        orderId: 'order-1',
        correlationId: 'corr-1',
      });

      // Assert
      expect(sagaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentState: SagaState.COMPENSATING }),
      );
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'inventory.commands',
        expect.objectContaining({ type: 'RELEASE_STOCK', orderId: 'order-1' }),
      );
    });

    it('captures payment and marks order shipped when warehouse ships', async () => {
      // Arrange
      processedEventRepo.findOne.mockResolvedValue(null);
      sagaRepo.findOne.mockResolvedValue(buildSagaInstance({ currentState: SagaState.PACKED }));
      orderRepo.findOne.mockResolvedValue(buildOrder({ status: OrderStatus.PROCESSING }));

      // Act
      await service.handleMessage('ORDER_SHIPPED', {
        eventId: 'evt-4',
        orderId: 'order-1',
        correlationId: 'corr-1',
        authorizationId: 'auth-1',
      });

      // Assert
      expect(sagaRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ currentState: SagaState.AWAITING_CAPTURE }),
      );
      expect(kafkaClient.emit).toHaveBeenCalledWith(
        'payment.commands',
        expect.objectContaining({
          type: 'CAPTURE_PAYMENT',
          orderId: 'order-1',
          authorizationId: 'auth-1',
          amount: 299.98,
        }),
      );
      expect(orderRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'order-1', status: OrderStatus.SHIPPED }),
      );
    });

    it('no-op transition records the event but emits nothing', async () => {
      // Arrange
      processedEventRepo.findOne.mockResolvedValue(null);
      sagaRepo.findOne.mockResolvedValue(buildSagaInstance({ currentState: SagaState.AWAITING_AUTH }));

      // Act
      await service.handleMessage('INVENTORY_RESERVED', {
        eventId: 'evt-5',
        orderId: 'order-1',
        correlationId: 'corr-1',
      });

      // Assert
      expect(kafkaClient.emit).not.toHaveBeenCalled();
      expect(sagaRepo.save).not.toHaveBeenCalled();
      expect(processedEventRepo.save).toHaveBeenCalledTimes(1);
      expect(processedEventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ eventId: 'evt-5' }),
      );
    });
  });
});
