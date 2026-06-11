# Enterprise OMS Patterns — Research Findings & Roadmap

**Date:** 2026-06-11
**Method:** Multi-source web research over primary vendor docs and engineering blogs; each claim below survived adversarial verification (3-voter refutation panel) unless marked *(supporting — primary-sourced, not panel-verified)*. Feeds `docs/superpowers/specs/2026-06-10-orchestrated-order-saga-design.md` (v2).

## How real OMSs model the order lifecycle

### IBM Sterling Order Management
- The lifecycle is a configurable **pipeline**, not a hardcoded enum: a chain of transactions and statuses defined per business. Statuses are numerically coded — Created (1100), Released (3200), Shipped (3700). ([pipeline docs](https://www.ibm.com/docs/en/order-management-sw/10.0.0?topic=pipelines-order-fulfillment-pipeline))
- **Transitions are first-class entities** ("transactions") with a *drop status* (entered on completion) and *pickup status* (pulls the order into the next transaction). The pipeline doubles as the event-hook system: notifications and side effects attach to pipeline positions. ([status configuration](https://www.ibm.com/docs/en/order-management-sw/10.0?topic=configuration-order-fulfillment-statuses))
- **Released is the explicit OMS→WMS handoff**, gated on inventory already reserved (Scheduled). `Unscheduled` is the built-in stock-release compensating transition. The pipeline **ends at Shipped** — no Delivered status; returns are separate states.
- **Quantity-level granularity:** 3 of 10 units of one line can be Released while 7 stay Created, with inventory records split accordingly. Inventory bookkeeping is a *declarative side effect of status transitions* (Status Inventory Types table), not ad-hoc service logic. ([status inventory types](https://www.ibm.com/docs/en/order-management?topic=components-defining-status-inventory-types))
- Failure states are first-class: `Backordered` (pre-schedule) and `Backordered From Node` (warehouse accepted, then couldn't fulfill — post-release rework).

### Shopify
- **Order state ≠ fulfillment work state.** A `FulfillmentOrder` is a system-created grouping of line items by fulfillment location (one order → many FulfillmentOrders); a separate `Fulfillment` object represents work actually done, created after pick/pack but before carrier pickup. Order-level completion is *computed* from line-item fulfillment. ([FulfillmentOrder API](https://shopify.dev/docs/api/admin-graphql/latest/objects/FulfillmentOrder))
- Seven statuses: OPEN, IN_PROGRESS, SCHEDULED, ON_HOLD, INCOMPLETE, CLOSED, CANCELLED — with **two parallel state fields**: `status` (work) and `requestStatus` (merchant↔warehouse negotiation: SUBMITTED, ACCEPTED, REJECTED, CANCELLATION_REQUESTED, …).
- **Release-to-warehouse is a request/accept handshake**: the fulfillment service must accept; after acceptance the merchant loses unilateral cancellation — cancel becomes a negotiated request the warehouse may reject (e.g., already shipped). ([fulfillment service apps](https://shopify.dev/docs/apps/build/orders-fulfillment/fulfillment-service-apps/build-for-fulfillment-services))
- Valid next moves are advertised per state via a `supportedActions` list; closed fulfillment orders are immutable.
- Event integration is **thin notification + query back**: a minimal webhook ping, then the service pulls full state via GraphQL — with documented eventual consistency and an official polling fallback.

### Salesforce Order Management
- `FulfillmentOrder` = sub-order grouped by location + delivery method + recipient. **Two-tier state machine:** a merchant-customizable Status picklist mapped onto a fixed StatusCategory that system processing depends on. ([FulfillmentOrder object](https://developer.salesforce.com/docs/atlas.en-us.order_management_developer_guide.meta/order_management_developer_guide/sforce_api_objects_fulfillmentorder.htm))

### Manhattan Active Omni (+ Shopify integration)
- **The OMS owns capture/refund timing**: authorization happens at storefront checkout; capture is deferred and triggered by the OMS at fulfillment. Lifecycle transitions like release-to-location are driven by the OMS rules engine (ATP logic), not the storefront or warehouse. ([integration writeup](https://www.shopify.com/enterprise/blog/order-management-manhattan-shopify))

### Saleor (open source — state machine visible in code) *(supporting)*
- Order status (`PARTIALLY_FULFILLED`, `FULFILLED`, …) is **derived by rollup from line-item/fulfillment state**, never set directly; `Fulfillment` has its own status enum decoupled from `OrderStatus`. ([order status docs](https://docs.saleor.io/developer/checkout/order-status), [actions.py](https://github.com/saleor/saleor/blob/main/saleor/order/actions.py))
- Auth and capture are distinct events with different downstream effects (`order_authorized` vs `order_charged`). Cancellation is an atomic compensating action: one DB transaction records the event, deallocates stock, sets CANCELED, dispatches webhooks.
- Stock side effects couple to transitions: allocate on confirm, deduct + release allocation on fulfill, restock on fulfillment cancel.

### Medusa (open source) *(supporting)*
- Ships an embedded **durable workflow engine** — explicitly orchestration, with per-step compensation, persisted execution state, retries, timeouts, parallel steps. Events trigger orchestrated workflows rather than chains of choreographed handlers. ([workflows docs](https://docs.medusajs.com/learn/fundamentals/workflows))

### commercetools *(supporting)*
- Payment is a **transaction-level state machine** (Initial → Pending → Success/Failure) where the final transition is triggered by the PSP's webhook, not the platform. Fulfillment start is gated on an Authorization-Success transaction. ([payments lifecycle](https://docs.commercetools.com/checkout/payments-lifecycle))

## Event-driven architecture patterns *(supporting)*

- **Orchestration over choreography at scale:** Netflix began with peer-to-peer choreography and abandoned it for a central orchestrator (Conductor) as process complexity grew; the Decider combines a declarative blueprint with current state to compute next tasks. Workers are idempotent, stateless, queue-polling. ([Netflix Conductor](https://netflixtechblog.com/netflix-conductor-a-microservices-orchestrator-2e8d4771bf40))
- Morling's case for orchestration: a single queryable place for saga status; no point-to-point coupling between participants. Caveat: sagas behave like *read uncommitted* for the overall business transaction. ([InfoQ: saga orchestration + outbox](https://www.infoq.com/articles/saga-orchestration-outbox/))
- **Transactional outbox:** write the event to an `outbox` table in the same local DB transaction as the business write; Debezium CDC tails the log and relays to Kafka. Kills the dual-write problem. Recommended schema: `(id uuid, aggregatetype, aggregateid, type, payload jsonb)` with an EventRouter SMT mapping aggregatetype → topic. ([Debezium outbox](https://debezium.io/blog/2019/02/19/reliable-microservices-data-exchange-with-the-outbox-pattern/))
- **Consumer dedup journal:** at-least-once delivery means consumers record processed event IDs in a message-log table *in the same transaction* as their business write — rollback un-marks the message for retry. (Adopted in saga v1.)

## Gap analysis: our v1 vs. enterprise

| Concern | Enterprise | Our v1 (post-revision) |
|---|---|---|
| Payment timing | Auth at order, capture at ship | ✅ adopted |
| Warehouse handoff | Explicit Released status / handshake | ✅ explicit RELEASE_ORDER command (no accept/reject negotiation) |
| Status granularity | Line-item or quantity level, derived rollup | Order-level saga; status derived from saga state |
| Idempotency | Processed-message journal | ✅ adopted |
| Reliable publish | Transactional outbox + CDC | ❌ documented dual-write window |
| Holds / backorders | First-class states | ❌ reject → FAILED only |
| Flow visibility | Queryable saga/pipeline status, supportedActions | Saga table queryable; no actions API |

## Roadmap

**Phase 2 — Reliability hardening.** Transactional outbox tables in order/payment services + Debezium connector on the existing Kafka/Postgres infra; dead-letter topic; stuck-saga sweep (scheduled scan of stale `saga_instances`); capture retry with escalation alert.

**Phase 3 — Fulfillment realism.** `FulfillmentOrder` entity grouping line items (single location at first); order status becomes a rollup of fulfillment-order states (PARTIALLY_SHIPPED appears); ON_HOLD as a first-class blocking state with release; BACKORDERED instead of hard STOCK_REJECTED failure; warehouse accept/reject handshake on RELEASE_ORDER (Shopify's requestStatus, simplified); `supportedActions`-style field on the order GraphQL type.

**Phase 4 — Scale-out patterns.** Multi-location inventory with ATP-style sourcing choice at release; quantity-level partial release (Sterling model); evaluate extracting the saga into a workflow-engine abstraction (Temporal-style durable execution) once the state machine outgrows one module.

**Separate track — Deployment** (own spec, previously agreed): Kubernetes manifests, GitHub Actions CI/CD, probes, observability.
