import { SagaDecision, SagaMessageType, SagaState } from './saga-states';

type TransitionTable = Partial<
  Record<SagaState, Partial<Record<SagaMessageType, Omit<SagaDecision, 'isNoOp'>>>>
>;

const TRANSITIONS: TransitionTable = {
  [SagaState.AWAITING_STOCK]: {
    INVENTORY_RESERVED: { newState: SagaState.AWAITING_AUTH, commands: ['AUTHORIZE_PAYMENT'], orderEvents: [] },
    INVENTORY_RESERVATION_FAILED: { newState: SagaState.FAILED, commands: [], orderEvents: ['ORDER_FAILED'] },
  },
  [SagaState.AWAITING_AUTH]: {
    PAYMENT_AUTHORIZED: { newState: SagaState.RELEASED, commands: ['RELEASE_ORDER'], orderEvents: ['ORDER_CONFIRMED'] },
    PAYMENT_AUTH_FAILED: { newState: SagaState.COMPENSATING, commands: ['RELEASE_STOCK'], orderEvents: [] },
  },
  [SagaState.RELEASED]: {
    ORDER_PICKED: { newState: SagaState.PICKED, commands: [], orderEvents: [] },
  },
  [SagaState.PICKED]: {
    ORDER_PACKED: { newState: SagaState.PACKED, commands: [], orderEvents: [] },
  },
  [SagaState.PACKED]: {
    ORDER_SHIPPED: { newState: SagaState.AWAITING_CAPTURE, commands: ['CAPTURE_PAYMENT'], orderEvents: ['ORDER_SHIPPED_NOTICE'] },
  },
  [SagaState.AWAITING_CAPTURE]: {
    PAYMENT_CAPTURED: { newState: SagaState.COMPLETED, commands: [], orderEvents: [] },
    PAYMENT_CAPTURE_FAILED: { newState: SagaState.CAPTURE_FAILED, commands: [], orderEvents: [] },
  },
  [SagaState.COMPENSATING]: {
    INVENTORY_RELEASED: { newState: SagaState.COMPENSATED, commands: [], orderEvents: ['ORDER_FAILED'] },
  },
};

export function transition(state: SagaState, message: SagaMessageType): SagaDecision {
  const decision = TRANSITIONS[state]?.[message];
  if (!decision) {
    return { newState: state, commands: [], orderEvents: [], isNoOp: true };
  }
  return { ...decision, isNoOp: false };
}
