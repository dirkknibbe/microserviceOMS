import { SagaConsumer } from './saga.consumer';

describe('SagaConsumer', () => {
  let consumer: SagaConsumer;
  const mockSagaService = { handleMessage: jest.fn() };

  beforeEach(() => {
    consumer = new SagaConsumer(mockSagaService as never);
    jest.clearAllMocks();
  });

  describe('message routing', () => {
    it('forwards a valid saga event from inventory', async () => {
      const event = {
        eventType: 'INVENTORY_RESERVED',
        eventId: 'e1',
        orderId: 'o1',
        correlationId: 'c1',
      };

      await consumer.onInventoryEvent(event);

      expect(mockSagaService.handleMessage).toHaveBeenCalledWith('INVENTORY_RESERVED', {
        eventId: 'e1',
        orderId: 'o1',
        correlationId: 'c1',
        authorizationId: undefined,
      });
    });

    it('ignores non-saga eventType', async () => {
      const event = {
        eventType: 'STOCK_UPDATED',
        orderId: 'o1',
      };

      await consumer.onInventoryEvent(event);

      expect(mockSagaService.handleMessage).not.toHaveBeenCalled();
    });

    it('ignores event with missing orderId', async () => {
      const event = {
        eventType: 'PAYMENT_AUTHORIZED',
      };

      await consumer.onPaymentEvent(event);

      expect(mockSagaService.handleMessage).not.toHaveBeenCalled();
    });

    it('defaults missing correlationId to "unknown"', async () => {
      const event = {
        eventType: 'ORDER_SHIPPED',
        orderId: 'o1',
      };

      await consumer.onFulfillmentEvent(event);

      expect(mockSagaService.handleMessage).toHaveBeenCalledWith('ORDER_SHIPPED', {
        eventId: undefined,
        orderId: 'o1',
        correlationId: 'unknown',
        authorizationId: undefined,
      });
    });
  });
});
