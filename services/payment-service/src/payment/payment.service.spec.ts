import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KAFKA_TOPICS, PaymentMethod } from '@shared/events';
import type { AuthorizePaymentCommand, CapturePaymentCommand } from '@shared/events';
import { PaymentService } from './payment.service';

describe('PaymentService saga commands', () => {
  let service: PaymentService;
  let kafkaMock: { emit: jest.Mock };

  const buildAuthorizeCommand = (
    overrides: Partial<AuthorizePaymentCommand> = {},
  ): AuthorizePaymentCommand => ({
    type: 'AUTHORIZE_PAYMENT',
    eventId: 'evt-auth-1',
    orderId: 'order-1',
    userId: 'user-1',
    amount: 50,
    currency: 'USD',
    paymentMethod: PaymentMethod.CREDIT_CARD,
    timestamp: new Date(),
    correlationId: 'corr-1',
    ...overrides,
  });

  const buildCaptureCommand = (
    overrides: Partial<CapturePaymentCommand> = {},
  ): CapturePaymentCommand => ({
    type: 'CAPTURE_PAYMENT',
    eventId: 'evt-cap-1',
    orderId: 'order-1',
    authorizationId: '',
    amount: 50,
    timestamp: new Date(),
    correlationId: 'corr-1',
    ...overrides,
  });

  const lastEmittedPayload = (): Record<string, unknown> => {
    const calls = kafkaMock.emit.mock.calls;
    return calls[calls.length - 1][1];
  };

  beforeEach(async () => {
    kafkaMock = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('sk_test_mock_key') },
        },
        { provide: 'KAFKA_SERVICE', useValue: kafkaMock },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('authorizePayment', () => {
    it('stores an authorization and emits PAYMENT_AUTHORIZED with an authorizationId', async () => {
      // Arrange
      const command = buildAuthorizeCommand();

      // Act
      await service.authorizePayment(command);

      // Assert
      expect(kafkaMock.emit).toHaveBeenCalledTimes(1);
      const [topic, payload] = kafkaMock.emit.mock.calls[0];
      expect(topic).toBe(KAFKA_TOPICS.PAYMENT_EVENTS);
      expect(payload).toMatchObject({
        eventType: 'PAYMENT_AUTHORIZED',
        orderId: 'order-1',
        amount: 50,
        correlationId: 'corr-1',
      });
      expect(typeof payload.authorizationId).toBe('string');
      expect(payload.authorizationId.length).toBeGreaterThan(0);
      expect(typeof payload.eventId).toBe('string');
      expect(payload.eventId.length).toBeGreaterThan(0);
    });

    it('declines authorization for the demo amount 13.13 without throwing', async () => {
      // Arrange
      const command = buildAuthorizeCommand({ amount: 13.13 });

      // Act & Assert (resolves normally)
      await expect(service.authorizePayment(command)).resolves.toBeUndefined();

      expect(kafkaMock.emit).toHaveBeenCalledTimes(1);
      const [topic, payload] = kafkaMock.emit.mock.calls[0];
      expect(topic).toBe(KAFKA_TOPICS.PAYMENT_EVENTS);
      expect(payload).toMatchObject({
        eventType: 'PAYMENT_AUTH_FAILED',
        orderId: 'order-1',
        amount: 13.13,
        correlationId: 'corr-1',
      });
      expect(typeof payload.reason).toBe('string');
      expect(payload.reason.length).toBeGreaterThan(0);
    });
  });

  describe('capturePayment', () => {
    it('emits PAYMENT_CAPTURED for a previously authorized order', async () => {
      // Arrange: authorize first, then capture with an EMPTY authorizationId
      // (mirrors the real saga payload — the fulfillment reply does not carry it)
      await service.authorizePayment(buildAuthorizeCommand({ amount: 50 }));
      const storedAuthorizationId = lastEmittedPayload().authorizationId;
      const command = buildCaptureCommand({ amount: 50, authorizationId: '' });

      // Act
      await service.capturePayment(command);

      // Assert
      expect(kafkaMock.emit).toHaveBeenCalledTimes(2);
      const [topic, payload] = kafkaMock.emit.mock.calls[1];
      expect(topic).toBe(KAFKA_TOPICS.PAYMENT_EVENTS);
      expect(payload).toMatchObject({
        eventType: 'PAYMENT_CAPTURED',
        orderId: 'order-1',
        amount: 50,
        correlationId: 'corr-1',
        authorizationId: storedAuthorizationId,
      });
    });

    it('fails capture for the demo amount 26.26 without throwing', async () => {
      // Arrange: authorization at 26.26 succeeds (only 13.13 declines auth)
      await service.authorizePayment(buildAuthorizeCommand({ amount: 26.26 }));
      const command = buildCaptureCommand({ amount: 26.26 });

      // Act & Assert (resolves normally)
      await expect(service.capturePayment(command)).resolves.toBeUndefined();

      expect(kafkaMock.emit).toHaveBeenCalledTimes(2);
      const payload = lastEmittedPayload();
      expect(payload).toMatchObject({
        eventType: 'PAYMENT_CAPTURE_FAILED',
        orderId: 'order-1',
        amount: 26.26,
        correlationId: 'corr-1',
      });
      expect(typeof payload.reason).toBe('string');
      expect((payload.reason as string).length).toBeGreaterThan(0);
    });

    it('fails capture when no authorization exists for the order', async () => {
      // Arrange
      const command = buildCaptureCommand({ orderId: 'order-never-authorized' });

      // Act & Assert (resolves normally)
      await expect(service.capturePayment(command)).resolves.toBeUndefined();

      expect(kafkaMock.emit).toHaveBeenCalledTimes(1);
      const [topic, payload] = kafkaMock.emit.mock.calls[0];
      expect(topic).toBe(KAFKA_TOPICS.PAYMENT_EVENTS);
      expect(payload).toMatchObject({
        eventType: 'PAYMENT_CAPTURE_FAILED',
        orderId: 'order-never-authorized',
        reason: 'authorization not found',
      });
    });
  });
});
