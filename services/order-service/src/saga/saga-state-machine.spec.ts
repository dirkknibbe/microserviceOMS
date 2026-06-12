import { transition } from './saga-state-machine';
import { SagaState, SagaMessageType } from './saga-states';

describe('saga transition', () => {
  const legal: Array<[SagaState, SagaMessageType, SagaState, string[], string[]]> = [
    // [from, message, to, commands, orderEvents]
    [SagaState.AWAITING_STOCK, 'INVENTORY_RESERVED', SagaState.AWAITING_AUTH, ['AUTHORIZE_PAYMENT'], []],
    [SagaState.AWAITING_STOCK, 'INVENTORY_RESERVATION_FAILED', SagaState.FAILED, [], ['ORDER_FAILED']],
    [SagaState.AWAITING_AUTH, 'PAYMENT_AUTHORIZED', SagaState.RELEASED, ['RELEASE_ORDER'], ['ORDER_CONFIRMED']],
    [SagaState.AWAITING_AUTH, 'PAYMENT_AUTH_FAILED', SagaState.COMPENSATING, ['RELEASE_STOCK'], []],
    [SagaState.RELEASED, 'ORDER_PICKED', SagaState.PICKED, [], []],
    [SagaState.PICKED, 'ORDER_PACKED', SagaState.PACKED, [], []],
    [SagaState.PACKED, 'ORDER_SHIPPED', SagaState.AWAITING_CAPTURE, ['CAPTURE_PAYMENT'], ['ORDER_SHIPPED_NOTICE']],
    [SagaState.AWAITING_CAPTURE, 'PAYMENT_CAPTURED', SagaState.COMPLETED, [], []],
    [SagaState.AWAITING_CAPTURE, 'PAYMENT_CAPTURE_FAILED', SagaState.CAPTURE_FAILED, [], []],
    [SagaState.COMPENSATING, 'INVENTORY_RELEASED', SagaState.COMPENSATED, [], ['ORDER_FAILED']],
  ];

  it.each(legal)('%s + %s -> %s', (from, msg, to, commands, orderEvents) => {
    const d = transition(from, msg);
    expect(d.newState).toBe(to);
    expect(d.commands).toEqual(commands);
    expect(d.orderEvents).toEqual(orderEvents);
    expect(d.isNoOp).toBe(false);
  });

  it('no-ops every (state, message) pair not in the legal table', () => {
    const states = Object.values(SagaState);
    const messages: SagaMessageType[] = [
      'INVENTORY_RESERVED', 'INVENTORY_RESERVATION_FAILED', 'INVENTORY_RELEASED',
      'PAYMENT_AUTHORIZED', 'PAYMENT_AUTH_FAILED', 'PAYMENT_CAPTURED',
      'PAYMENT_CAPTURE_FAILED', 'ORDER_PICKED', 'ORDER_PACKED', 'ORDER_SHIPPED',
    ];
    const legalKeys = new Set(legal.map(([f, m]) => `${f}|${m}`));
    for (const s of states) {
      for (const m of messages) {
        if (legalKeys.has(`${s}|${m}`)) continue;
        const d = transition(s, m);
        expect(d.isNoOp).toBe(true);
        expect(d.newState).toBe(s);
        expect(d.commands).toEqual([]);
        expect(d.orderEvents).toEqual([]);
      }
    }
  });
});
