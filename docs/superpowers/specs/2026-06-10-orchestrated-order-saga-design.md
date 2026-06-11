# Orchestrated Order Saga — Design (v2)

**Date:** 2026-06-10, revised 2026-06-11 after enterprise OMS research
**Status:** Approved
**Goal:** Close the loop on the order lifecycle. Today an order is created with status PENDING and never advances: payment is never invoked in the flow, inventory consumes ORDER_EVENTS but does nothing, and no service reports back to the order service. This spec wires the full flow as an orchestrated saga with compensation, a payment authorize/capture split, and a simulated warehouse fulfillment lifecycle.

**v2 revision:** incorporates verified findings from enterprise OMS research (IBM Sterling, Shopify, Salesforce OMS, Manhattan Active Omni, Saleor, Medusa, transactional-outbox literature). Full findings and the roadmap beyond v1 live in `docs/architecture/enterprise-oms-patterns.md`. The Kubernetes/CI-CD phase remains a separate future spec.

## Decisions made (and why)

1. **Orchestration over choreography.** Explicit state machine in one place. Validated by research: Netflix abandoned choreography for a central orchestrator as flows grew; an orchestrator gives a single queryable place for saga status (Morling/InfoQ).
2. **Orchestrator lives inside order-service** as a `saga/` module — the order is the aggregate whose lifecycle the saga manages.
3. **Authorize at order time, capture at shipment** (v2 change). Every studied OMS does this: Manhattan triggers capture from the OMS at fulfillment; Saleor and commercetools model auth and capture as distinct events. A pre-capture failure is a cheap stock release; charging for unshipped goods is the failure real OMSs design against.
4. **Inventory reserved before payment auth.** Unchanged from v1, now corroborated: Sterling gates Released on inventory already reserved, and models Unscheduled as the stock-release compensating transition.
5. **Fulfillment is part of the lifecycle** (v2 change). Sterling's pipeline (`Released → ... → Shipped`) makes release-to-warehouse an explicit status, and ends at Shipped (no Delivered — carriers are someone else's state machine). inventory-service doubles as the warehouse executor; warehouse concerns get their own topics so a future extraction changes no contracts.
6. **Order status is a projection of saga state** (v2 change), never set directly — the Saleor/Shopify derivation principle, simplified to one fulfillment per order in v1.
7. **Saga state is persisted** (table in the orders DB) so the flow survives an order-service restart.
8. **Consumer idempotency via a processed-events journal** (v2 change) — the documented at-least-once dedup pattern: record handled event IDs in the same DB transaction as the consumer's own write.

## Message design

Commands are directed requests ("do this") sent only by the orchestrator; events/replies are facts ("this happened") emitted by the service that did the work.

| Topic | Kind | Messages | Producer → Consumer |
|---|---|---|---|
| `inventory-commands` | command | RESERVE_STOCK, RELEASE_STOCK | order-service → inventory-service |
| `inventory-events` | reply | STOCK_RESERVED, STOCK_REJECTED, STOCK_RELEASED | inventory-service → order-service |
| `fulfillment-commands` | command | RELEASE_ORDER | order-service → inventory-service (warehouse role) |
| `fulfillment-events` | reply | ORDER_PICKED, ORDER_PACKED, ORDER_SHIPPED | inventory-service → order-service |
| `payment-commands` | command | AUTHORIZE_PAYMENT, CAPTURE_PAYMENT | order-service → payment-service |
| `payment-events` | reply | AUTH_APPROVED, AUTH_DECLINED, PAYMENT_CAPTURED, CAPTURE_FAILED | payment-service → order-service, notification-service |
| `order-events` | event (exists) | ORDER_CREATED, ORDER_CONFIRMED, ORDER_SHIPPED, ORDER_FAILED | order-service → notification-service |

Warehouse topics are separate from inventory topics even though one service consumes both: they are different logical roles (stock ledger vs. fulfillment execution), so extracting a real warehouse service later changes deployment, not contracts.

Every message envelope carries: `eventId` (UUID), `orderId` (doubles as sagaId), `correlationId` (via `shared/utils/correlation.ts`), `timestamp`, `type`, `payload`. One correlationId must be greppable across all four services' logs for a single order.

Topic name constants live in the shared `KAFKA_TOPICS` map; Java services mirror the names in `application.yml` under `app.kafka.topics.*`.

## State machine

Persisted in `saga_instances` (orders DB): `saga_id` (= orderId, PK), `current_state`, `history` (JSONB array of `{state, message, timestamp}`), `created_at`, `updated_at`.

```
ORDER_CREATED             → AWAITING_STOCK      + send RESERVE_STOCK
AWAITING_STOCK
  ← STOCK_RESERVED        → AWAITING_AUTH       + send AUTHORIZE_PAYMENT
  ← STOCK_REJECTED        → FAILED              + emit ORDER_FAILED
AWAITING_AUTH
  ← AUTH_APPROVED         → RELEASED            + send RELEASE_ORDER, emit ORDER_CONFIRMED
  ← AUTH_DECLINED         → COMPENSATING        + send RELEASE_STOCK
RELEASED
  ← ORDER_PICKED          → PICKED
PICKED
  ← ORDER_PACKED          → PACKED
PACKED
  ← ORDER_SHIPPED         → AWAITING_CAPTURE    + send CAPTURE_PAYMENT, emit ORDER_SHIPPED
AWAITING_CAPTURE
  ← PAYMENT_CAPTURED      → COMPLETED
  ← CAPTURE_FAILED        → CAPTURE_FAILED      (terminal; ops alert logged — goods already shipped)
COMPENSATING
  ← STOCK_RELEASED        → COMPENSATED         + emit ORDER_FAILED
```

The transition logic is a **pure function**: `(currentState, incomingMessage) → { newState, commands[], events[] }`. No I/O inside it. Any (state, message) pair not listed returns a no-op result — the first idempotency defense.

**Order status is derived from saga state** (a projection, never set directly):

| Saga state | Order status |
|---|---|
| AWAITING_STOCK, AWAITING_AUTH, COMPENSATING | PENDING |
| RELEASED, PICKED, PACKED | PROCESSING |
| AWAITING_CAPTURE, CAPTURE_FAILED | SHIPPED |
| COMPLETED | COMPLETED |
| FAILED, COMPENSATED | FAILED |

CAPTURE_FAILED keeps the order SHIPPED (the customer has the goods) and logs an ops alert; real OMSs retry/escalate — out of scope for v1, documented in the patterns doc.

## Changes per service

### order-service (NestJS)
- New `src/saga/` module: `saga-state-machine.ts` (pure function + types), `saga.service.ts` (loads instance, applies transition, persists, dispatches commands/events), `saga.consumer.ts` (`@EventPattern` on `inventory-events`, `fulfillment-events`, `payment-events`), `saga-instance.entity.ts` + repository, `processed-event.entity.ts`.
- Order creation starts a saga; order status becomes a projection (resolver maps saga state → status; the `orders.status` column is updated from the projection for query simplicity).
- Conventions: DI throughout, repository pattern, no `any`, barrel export, `ClientsModule.registerAsync` registered in the saga module (AppModule registration does not propagate).

### inventory-service (Java/Spring Boot) — two roles
- **Stock ledger role:** `@KafkaListener` on `inventory-commands`. RESERVE_STOCK: per line item, atomic `UPDATE inventory SET reserved = reserved + :qty WHERE product_id = :id AND (quantity - reserved) >= :qty`; all items in one DB transaction or STOCK_REJECTED with reason. RELEASE_STOCK: decrement `reserved`. Reservations tracked in `stock_reservations` (order_id, product_id, qty) so release is idempotent.
- **Warehouse role (new):** `@KafkaListener` on `fulfillment-commands`. On RELEASE_ORDER, a fulfillment simulator advances pick → pack → ship on a timer (configurable `app.fulfillment.step-delay-ms`, default 2000), emitting ORDER_PICKED / ORDER_PACKED / ORDER_SHIPPED on `fulfillment-events`. Shipping converts the reservation to a stock decrement (reserved -= qty, quantity -= qty) — mirroring Sterling's inventory-bookkeeping-per-status-move.
- Replies carry the original correlationId.

### payment-service (NestJS)
- `processPayment` splits into `authorizePayment` and `capturePayment` (both mock; a `payment_authorizations` table records auth → captured/failed).
- `@EventPattern` consumer on `payment-commands` dispatching by message type.
- Deterministic demo triggers: order total **$13.13** → AUTH_DECLINED; **$26.26** → authorizes, then CAPTURE_FAILED.
- Declines/failures are business outcomes: emit the event and return — no thrown `InternalServerErrorException`.

### notification-service (Java/Spring Boot)
- No changes; it now hears richer `order-events` (CONFIRMED, SHIPPED, FAILED).

### gateway / frontend (Angular)
- No schema changes. Order detail polls every 3s while status is non-terminal so the user watches PENDING → PROCESSING → SHIPPED → COMPLETED live. Subscriptions remain out of scope.

## Idempotency & failure handling

- Kafka is at-least-once; duplicates are expected. Three defenses:
  1. **Processed-events journal**: each consumer inserts `eventId` into `processed_events` (PK) in the same DB transaction as its state change; duplicate insert → skip. Implemented in order-service (TypeORM) and inventory-service (JPA); payment-service dedups via the `payment_authorizations` unique orderId.
  2. The state machine no-ops illegal transitions.
  3. Consumers log-and-skip unknown orderIds.
- Consumer groups: `order-service-saga`, `inventory-service`, `payment-service`.

### Explicitly out of scope (see `docs/architecture/enterprise-oms-patterns.md` for the roadmap)
- Transactional outbox + CDC (v1 accepts and documents the dual-write window).
- Holds (Shopify-style ON_HOLD), backorders, capture retry/escalation.
- FulfillmentOrder entity / line-item-level state / multi-location split.
- Reply timeouts / stuck-saga sweep, dead-letter topic, GraphQL subscriptions.

## Testing

- **State machine (TDD, written first):** Jest tests for every state × message pair in the table, including all illegal pairs (assert no-op). Pure function — no mocks.
- **inventory-service (JUnit):** reservation success/short/rollback; release idempotency; ship converts reservation to decrement; simulator emits pick/pack/ship in order.
- **payment-service (Jest):** authorize/capture dispatch; $13.13 → AUTH_DECLINED; $26.26 → CAPTURE_FAILED; no throws on declines.
- **Integration (extends `scripts/test-system.sh`):** happy path → COMPLETED (timeout 60s); $13.13 order → FAILED with `reserved` restored; $26.26 order → SHIPPED with capture-failure alert in logs.

## Success criteria

1. An order placed through the Angular UI visibly advances PENDING → PROCESSING → SHIPPED → COMPLETED without manual intervention.
2. A $13.13 order advances PENDING → FAILED and reserved stock is released; a $26.26 order ends SHIPPED with a logged capture-failure alert.
3. One `correlationId` greps the full flow across order, inventory, payment, and notification logs.
4. All new unit tests pass; existing 20 tests still pass.
