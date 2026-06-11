# Orchestrated Order Saga — Design

**Date:** 2026-06-10
**Status:** Approved
**Goal:** Close the loop on the order lifecycle. Today an order is created with status PENDING and never advances: payment is never invoked in the flow, inventory consumes ORDER_EVENTS but does nothing, and no service reports back to the order service. This spec wires the full flow as an orchestrated saga with compensation.

A second phase (Kubernetes + CI/CD deployment) was agreed but is intentionally **not** part of this spec; it gets its own brainstorm/spec after this ships.

## Decisions made (and why)

1. **Orchestration over choreography.** An explicit state machine in one place, commanding each step and reacting to replies. Chosen by Dirk for visibility of the flow and the deeper learning value; the trade-off is more topics and more code than an event chain.
2. **Orchestrator lives inside order-service** as a `saga/` module — the order is the aggregate whose lifecycle the saga manages; a standalone orchestrator service would add a deployable with no learning payoff.
3. **Inventory reserved before payment is charged.** Charging for unshippable goods is the worse failure; this ordering also yields the natural compensation path (release stock on payment failure) without needing refunds in v1.
4. **Saga state is persisted** (table in the orders DB) so the flow survives an order-service restart.

## Message design

Commands are directed requests ("do this") sent only by the orchestrator; events/replies are facts ("this happened") emitted by the service that did the work.

| Topic | Kind | Messages | Producer → Consumer |
|---|---|---|---|
| `inventory-commands` | command | RESERVE_STOCK, RELEASE_STOCK | order-service → inventory-service |
| `inventory-events` | reply | STOCK_RESERVED, STOCK_REJECTED, STOCK_RELEASED | inventory-service → order-service |
| `payment-commands` | command | PROCESS_PAYMENT | order-service → payment-service |
| `payment-events` | reply (exists) | PAYMENT_PROCESSED, PAYMENT_FAILED | payment-service → order-service, notification-service |
| `order-events` | event (exists) | ORDER_CREATED, ORDER_CONFIRMED, ORDER_FAILED | order-service → notification-service |

Every message envelope carries: `eventId` (UUID), `orderId` (doubles as sagaId), `correlationId` (via `shared/utils/correlation.ts`), `timestamp`, `type`, `payload`. One correlationId must be greppable across all four services' logs for a single order.

Topic name constants live in the shared `KAFKA_TOPICS` map (extend the existing one; Java services mirror the names in `application.yml` under `app.kafka.topics.*`).

## State machine

Persisted in `saga_instances` (orders DB): `saga_id` (= orderId, PK), `current_state`, `history` (JSONB array of `{state, message, timestamp}`), `created_at`, `updated_at`.

```
ORDER_CREATED            → AWAITING_STOCK     + send RESERVE_STOCK
AWAITING_STOCK
  ← STOCK_RESERVED       → AWAITING_PAYMENT   + send PROCESS_PAYMENT
  ← STOCK_REJECTED       → FAILED             + order status FAILED, emit ORDER_FAILED
AWAITING_PAYMENT
  ← PAYMENT_PROCESSED    → COMPLETED          + order status CONFIRMED, emit ORDER_CONFIRMED
  ← PAYMENT_FAILED       → COMPENSATING       + send RELEASE_STOCK
COMPENSATING
  ← STOCK_RELEASED       → COMPENSATED        + order status FAILED, emit ORDER_FAILED
```

The transition logic is a **pure function**: `(currentState, incomingMessage) → { newState, commands[], orderStatus? }`. No I/O inside it. Any (state, message) pair not listed above returns a no-op result (same state, no commands) — this is the idempotency/duplicate defense.

## Changes per service

### order-service (NestJS)
- New `src/saga/` module: `saga-state-machine.ts` (pure function + types), `saga.service.ts` (loads instance, applies transition, persists, dispatches commands), `saga.consumer.ts` (`@EventPattern` on `inventory-events` and `payment-events`), `saga-instance.entity.ts` + repository.
- Order creation starts a saga (create instance, apply ORDER_CREATED) instead of only emitting ORDER_EVENTS.
- Order status transitions (PENDING → CONFIRMED/FAILED) happen only via saga outcomes.
- Follows existing conventions: DI throughout, repository pattern, no `any`, barrel export, `ClientsModule.registerAsync` for Kafka registered in the saga module (known gotcha: AppModule registration does not propagate).

### inventory-service (Java/Spring Boot)
- Replace the do-nothing `OrderEventListener` with a `@KafkaListener` on `inventory-commands`.
- RESERVE_STOCK: atomic reservation per line item — `UPDATE inventory SET reserved = reserved + :qty WHERE product_id = :id AND (quantity - reserved) >= :qty`; all items must succeed (single DB transaction) or the whole reservation rolls back → STOCK_REJECTED with a reason.
- RELEASE_STOCK: decrement `reserved` for the order's items → STOCK_RELEASED.
- Reservations are tracked per order (`stock_reservations` table: order_id, product_id, qty) so RELEASE_STOCK is idempotent — releasing an unknown/already-released order replies STOCK_RELEASED without modifying stock.
- Emits replies on `inventory-events`.

### payment-service (NestJS)
- New `@EventPattern('payment-commands')` consumer invoking the existing `processPayment`.
- Existing PAYMENT_PROCESSED / PAYMENT_FAILED emissions on `payment-events` are reused as the reply channel.
- Deterministic failure trigger for demos: an order total of exactly **$13.13** is declined by the mock processor.
- `processPayment` must stop throwing `InternalServerErrorException` on decline when invoked via command (a declined card is a business outcome, not a server error) — it emits PAYMENT_FAILED and returns.

### notification-service (Java/Spring Boot)
- No changes. Already listens on `order-events` and `payment-events`.

### gateway / frontend (Angular)
- No schema changes. The order detail view refetches (poll every 3s while status is PENDING, stop on terminal status) so the user can watch PENDING → CONFIRMED happen. GraphQL subscriptions remain out of scope.

## Idempotency & failure handling

- Kafka delivery is at-least-once; duplicate messages are expected. Defenses: (1) the state machine no-ops illegal transitions; (2) inventory reservation/release are idempotent per order via the `stock_reservations` table; (3) consumers log-and-skip messages for unknown orderIds.
- Consumer groups: one group per service (`order-service-saga`, `inventory-service`, `payment-service`) so each service gets every message once per group.

### Explicitly out of scope (future work)
- Reply timeouts / stuck-saga detection (scheduled sweep of stale `saga_instances`).
- Dead-letter topic for poison messages.
- Payment refunds (not needed: stock is released instead of charging first).
- GraphQL subscriptions for live status push.
- Outbox pattern for atomically persisting state + publishing (acknowledged as the production-grade answer; v1 accepts the small dual-write window and documents it).

## Testing

- **State machine (TDD, written first):** Jest tests covering every state × message combination from the table above, including all illegal pairs (assert no-op). Pure function — no mocks needed.
- **inventory-service (JUnit):** reservation succeeds when stock suffices, rejects when short, rolls back partial multi-item reservations, release is idempotent.
- **payment command consumer (Jest):** command triggers processPayment; $13.13 produces PAYMENT_FAILED without throwing.
- **Integration (script, extends `scripts/test-system.sh`):** boot docker-compose; place an order via the gateway → poll until CONFIRMED (timeout 30s); place a $13.13 order → poll until FAILED and assert inventory `reserved` returned to its prior value.

## Success criteria

1. An order placed through the Angular UI visibly advances PENDING → CONFIRMED without manual intervention.
2. A $13.13 order visibly advances PENDING → FAILED, and reserved stock is released.
3. One `correlationId` greps the full flow across order, inventory, payment, and notification logs.
4. All new unit tests pass; existing 20 tests still pass.
