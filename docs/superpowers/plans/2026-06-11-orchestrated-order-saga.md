# Orchestrated Order Saga Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the full order lifecycle as an orchestrated saga: stock reservation → payment authorization → warehouse pick/pack/ship → payment capture, with stock-release compensation.

**Architecture:** A persisted state machine inside order-service commands the other services over Kafka command topics and reacts to their reply events. inventory-service (Java) plays two roles — stock ledger and simulated warehouse. payment-service splits authorize from capture. Order status becomes a projection of saga state.

**Tech Stack:** NestJS 10 (order, payment), Spring Boot 3 / Java 17 (inventory), Kafka (kafkajs / spring-kafka), TypeORM + PostgreSQL (orders DB), Angular 17 + Apollo.

**Spec:** `docs/superpowers/specs/2026-06-10-orchestrated-order-saga-design.md` (v2).

**Deviations from spec discovered during planning (codebase wins):**
1. Topics use **dot notation** (`order.events`) — new topics follow: `inventory.commands`, `fulfillment.commands`, `fulfillment.events`, `payment.commands`.
2. Reply events **already exist**: `INVENTORY_RESERVED`, `INVENTORY_RESERVATION_FAILED` (not the spec's STOCK_RESERVED/STOCK_REJECTED). We add `INVENTORY_RELEASED`.
3. Java reservation logic **already exists** (`InventoryService.processOrderCreated/confirmReservation/releaseReservationsForOrder`) but is dead code: the Kafka consumer deserializes to `LinkedHashMap` (no type headers, `VALUE_DEFAULT_TYPE=Object`), so `instanceof OrderCreatedEvent` never matches. We refit this logic behind command listeners with explicit `ObjectMapper.convertValue` deserialization and delete `OrderEventListener`.
4. Neither order-service nor payment-service currently runs a Kafka **consumer** — both need `connectMicroservice` hybrid bootstrap.
5. payment-service has **no database** — payment authorizations live in an in-memory `Map` (documented dev limitation; saga state itself is persisted in the orders DB).
6. Order status enums (shared `shared/events/order-events.ts` AND `services/order-service/src/order/entities/order-status.enum.ts`) gain `PROCESSING`, `COMPLETED`, `FAILED` (additive, GraphQL-safe).

**Context for workers with zero project knowledge:**
- Run order-service: `GRAPHQL_PORT=3001 npx ts-node -r tsconfig-paths/register src/main.ts` from `services/order-service/`
- Unit tests: `npx jest` from the service directory; Java: `mvn test` from `services/inventory-service/`
- Kafka/Postgres run via `docker compose up -d` in `infrastructure/`
- TS path alias `@shared/*` maps to `shared/*` — never use relative imports across packages
- NestJS conventions: DI always, repository pattern, no `any`, barrel exports per module
- Commit after every green test. Never add a Claude co-author line to commits.

---

### Task 1: Shared contracts — topics, commands, events, statuses

**Files:**
- Modify: `shared/events/order-events.ts` (OrderStatus enum)
- Modify: `shared/events/payment-events.ts` (append auth/capture events)
- Modify: `shared/events/inventory-events.ts` (append InventoryReleasedEvent)
- Create: `shared/events/fulfillment-events.ts`
- Create: `shared/events/saga-commands.ts`
- Modify: `shared/events/index.ts` (topics, exports, DomainEvent, routing)
- Modify: `services/order-service/src/order/entities/order-status.enum.ts`

- [ ] **Step 1: Add new order statuses (both enums)**

In `shared/events/order-events.ts`, replace the `OrderStatus` enum with:

```typescript
export enum OrderStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  CONFIRMED = "CONFIRMED",
  PAID = "PAID",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}
```

In `services/order-service/src/order/entities/order-status.enum.ts`, replace the enum body identically (keep the `registerEnumType(OrderStatus, { name: 'OrderStatus' })` call).

- [ ] **Step 2: Append payment auth/capture events**

Append to `shared/events/payment-events.ts`:

```typescript
export interface PaymentAuthorizedEvent {
  eventType: 'PAYMENT_AUTHORIZED';
  eventId: string;
  authorizationId: string;
  orderId: string;
  amount: number;
  timestamp: Date;
  correlationId: string;
}

export interface PaymentAuthFailedEvent {
  eventType: 'PAYMENT_AUTH_FAILED';
  eventId: string;
  orderId: string;
  amount: number;
  reason: string;
  timestamp: Date;
  correlationId: string;
}

export interface PaymentCapturedEvent {
  eventType: 'PAYMENT_CAPTURED';
  eventId: string;
  authorizationId: string;
  orderId: string;
  amount: number;
  timestamp: Date;
  correlationId: string;
}

export interface PaymentCaptureFailedEvent {
  eventType: 'PAYMENT_CAPTURE_FAILED';
  eventId: string;
  authorizationId: string;
  orderId: string;
  amount: number;
  reason: string;
  timestamp: Date;
  correlationId: string;
}
```

- [ ] **Step 3: Append InventoryReleasedEvent**

Append to `shared/events/inventory-events.ts`:

```typescript
export interface InventoryReleasedEvent {
  eventType: 'INVENTORY_RELEASED';
  eventId: string;
  orderId: string;
  timestamp: Date;
  correlationId: string;
}
```

- [ ] **Step 4: Create fulfillment events**

Create `shared/events/fulfillment-events.ts`:

```typescript
export type FulfillmentStep = 'PICKED' | 'PACKED' | 'SHIPPED';

export interface OrderPickedEvent {
  eventType: 'ORDER_PICKED';
  eventId: string;
  orderId: string;
  timestamp: Date;
  correlationId: string;
}

export interface OrderPackedEvent {
  eventType: 'ORDER_PACKED';
  eventId: string;
  orderId: string;
  timestamp: Date;
  correlationId: string;
}

export interface OrderShippedEvent {
  eventType: 'ORDER_SHIPPED';
  eventId: string;
  orderId: string;
  timestamp: Date;
  correlationId: string;
}
```

- [ ] **Step 5: Create saga commands**

Create `shared/events/saga-commands.ts`:

```typescript
import type { OrderItem } from './order-events';
import type { PaymentMethod } from './payment-events';

interface CommandBase {
  eventId: string;
  orderId: string;
  timestamp: Date;
  correlationId: string;
}

export interface ReserveStockCommand extends CommandBase {
  type: 'RESERVE_STOCK';
  items: OrderItem[];
}

export interface ReleaseStockCommand extends CommandBase {
  type: 'RELEASE_STOCK';
}

export interface ReleaseOrderCommand extends CommandBase {
  type: 'RELEASE_ORDER';
}

export interface AuthorizePaymentCommand extends CommandBase {
  type: 'AUTHORIZE_PAYMENT';
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
}

export interface CapturePaymentCommand extends CommandBase {
  type: 'CAPTURE_PAYMENT';
  authorizationId: string;
  amount: number;
}

export type SagaCommand =
  | ReserveStockCommand
  | ReleaseStockCommand
  | ReleaseOrderCommand
  | AuthorizePaymentCommand
  | CapturePaymentCommand;
```

- [ ] **Step 6: Wire topics, exports, and routing**

In `shared/events/index.ts`:
1. Add to the export block at the top: `export * from './fulfillment-events';` and `export * from './saga-commands';`
2. Replace `KAFKA_TOPICS` with:

```typescript
export const KAFKA_TOPICS = {
  ORDER_EVENTS: 'order.events',
  INVENTORY_EVENTS: 'inventory.events',
  INVENTORY_COMMANDS: 'inventory.commands',
  FULFILLMENT_EVENTS: 'fulfillment.events',
  FULFILLMENT_COMMANDS: 'fulfillment.commands',
  PAYMENT_EVENTS: 'payment.events',
  PAYMENT_COMMANDS: 'payment.commands',
  NOTIFICATION_EVENTS: 'notification.events',
  USER_EVENTS: 'user.events',
} as const;
```

3. Add the new event types to the `DomainEvent` union (import them with the other type imports): `PaymentAuthorizedEvent | PaymentAuthFailedEvent | PaymentCapturedEvent | PaymentCaptureFailedEvent | InventoryReleasedEvent | OrderPickedEvent | OrderPackedEvent | OrderShippedEvent`.
4. In `getTopicForEvent`, add cases: `'PAYMENT_AUTHORIZED' | 'PAYMENT_AUTH_FAILED' | 'PAYMENT_CAPTURED' | 'PAYMENT_CAPTURE_FAILED'` → `KAFKA_TOPICS.PAYMENT_EVENTS`; `'INVENTORY_RELEASED'` → `KAFKA_TOPICS.INVENTORY_EVENTS`; `'ORDER_PICKED' | 'ORDER_PACKED' | 'ORDER_SHIPPED'` → `KAFKA_TOPICS.FULFILLMENT_EVENTS`.

- [ ] **Step 7: Verify compile**

Run from `services/order-service/`: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (warnings about unused types are fine).

- [ ] **Step 8: Commit**

```bash
git add shared/events services/order-service/src/order/entities/order-status.enum.ts
git commit -m "feat: add saga command/event contracts and new order statuses"
```

---

### Task 2: Saga state machine (pure function, TDD)

**Files:**
- Create: `services/order-service/src/saga/saga-states.ts`
- Create: `services/order-service/src/saga/saga-state-machine.ts`
- Test: `services/order-service/src/saga/saga-state-machine.spec.ts`

- [ ] **Step 1: Define states and message/decision types**

Create `services/order-service/src/saga/saga-states.ts`:

```typescript
import { OrderStatus } from '../order/entities/order-status.enum';

export enum SagaState {
  AWAITING_STOCK = 'AWAITING_STOCK',
  AWAITING_AUTH = 'AWAITING_AUTH',
  RELEASED = 'RELEASED',
  PICKED = 'PICKED',
  PACKED = 'PACKED',
  AWAITING_CAPTURE = 'AWAITING_CAPTURE',
  COMPLETED = 'COMPLETED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
  FAILED = 'FAILED',
  CAPTURE_FAILED = 'CAPTURE_FAILED',
}

export const TERMINAL_STATES: readonly SagaState[] = [
  SagaState.COMPLETED,
  SagaState.COMPENSATED,
  SagaState.FAILED,
  SagaState.CAPTURE_FAILED,
];

/** Reply-event types the saga reacts to. */
export type SagaMessageType =
  | 'INVENTORY_RESERVED'
  | 'INVENTORY_RESERVATION_FAILED'
  | 'INVENTORY_RELEASED'
  | 'PAYMENT_AUTHORIZED'
  | 'PAYMENT_AUTH_FAILED'
  | 'PAYMENT_CAPTURED'
  | 'PAYMENT_CAPTURE_FAILED'
  | 'ORDER_PICKED'
  | 'ORDER_PACKED'
  | 'ORDER_SHIPPED';

/** Command kinds the saga can dispatch (payloads are built by SagaService). */
export type SagaCommandType =
  | 'RESERVE_STOCK'
  | 'RELEASE_STOCK'
  | 'RELEASE_ORDER'
  | 'AUTHORIZE_PAYMENT'
  | 'CAPTURE_PAYMENT';

/** Order-level event kinds the saga emits for the notification service. */
export type SagaOrderEventType = 'ORDER_CONFIRMED' | 'ORDER_SHIPPED_NOTICE' | 'ORDER_FAILED';

export interface SagaDecision {
  newState: SagaState;
  commands: SagaCommandType[];
  orderEvents: SagaOrderEventType[];
  isNoOp: boolean;
}

export const ORDER_STATUS_PROJECTION: Record<SagaState, OrderStatus> = {
  [SagaState.AWAITING_STOCK]: OrderStatus.PENDING,
  [SagaState.AWAITING_AUTH]: OrderStatus.PENDING,
  [SagaState.COMPENSATING]: OrderStatus.PENDING,
  [SagaState.RELEASED]: OrderStatus.PROCESSING,
  [SagaState.PICKED]: OrderStatus.PROCESSING,
  [SagaState.PACKED]: OrderStatus.PROCESSING,
  [SagaState.AWAITING_CAPTURE]: OrderStatus.SHIPPED,
  [SagaState.CAPTURE_FAILED]: OrderStatus.SHIPPED,
  [SagaState.COMPLETED]: OrderStatus.COMPLETED,
  [SagaState.FAILED]: OrderStatus.FAILED,
  [SagaState.COMPENSATED]: OrderStatus.FAILED,
};
```

- [ ] **Step 2: Write the failing transition-matrix test**

Create `services/order-service/src/saga/saga-state-machine.spec.ts`:

```typescript
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
```

- [ ] **Step 3: Run test to verify it fails**

Run from `services/order-service/`: `npx jest src/saga/saga-state-machine.spec.ts`
Expected: FAIL — `Cannot find module './saga-state-machine'`

- [ ] **Step 4: Implement the state machine**

Create `services/order-service/src/saga/saga-state-machine.ts`:

```typescript
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/saga/saga-state-machine.spec.ts`
Expected: PASS (11 tests)

- [ ] **Step 6: Commit**

```bash
git add services/order-service/src/saga
git commit -m "feat: saga state machine as pure function with full transition matrix tests"
```

---

### Task 3: Saga persistence — entities and DDL

**Files:**
- Create: `services/order-service/src/saga/entities/saga-instance.entity.ts`
- Create: `services/order-service/src/saga/entities/processed-event.entity.ts`
- Modify: `infrastructure/databases/orders-init.sql` (append)

- [ ] **Step 1: Create SagaInstance entity**

```typescript
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { SagaState } from '../saga-states';

export interface SagaHistoryEntry {
  state: SagaState;
  message: string;
  timestamp: string;
}

@Entity('saga_instances')
export class SagaInstance {
  @PrimaryColumn('uuid', { name: 'saga_id' })
  sagaId: string; // = orderId

  @Column({ name: 'current_state', type: 'varchar', length: 32 })
  currentState: SagaState;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  history: SagaHistoryEntry[];

  @Column({ name: 'correlation_id', type: 'varchar', length: 64 })
  correlationId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

- [ ] **Step 2: Create ProcessedEvent entity**

```typescript
import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('processed_events')
export class ProcessedEvent {
  @PrimaryColumn('uuid', { name: 'event_id' })
  eventId: string;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt: Date;
}
```

- [ ] **Step 3: Append DDL to orders-init.sql** (parity for fresh volumes; dev relies on TypeORM `synchronize: true`)

```sql
CREATE TABLE IF NOT EXISTS saga_instances (
    saga_id UUID PRIMARY KEY,
    current_state VARCHAR(32) NOT NULL,
    history JSONB NOT NULL DEFAULT '[]',
    correlation_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processed_events (
    event_id UUID PRIMARY KEY,
    processed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 4: Verify compile, commit**

Run: `npx tsc --noEmit -p tsconfig.json` from `services/order-service/`. Expected: clean.

```bash
git add services/order-service/src/saga/entities infrastructure/databases/orders-init.sql
git commit -m "feat: saga instance and processed-event persistence"
```

---

### Task 4: SagaService (TDD) — apply, persist, dispatch

**Files:**
- Create: `services/order-service/src/saga/saga.service.ts`
- Test: `services/order-service/src/saga/saga.service.spec.ts`
- Create: `services/order-service/src/saga/index.ts`

The service: `startSaga(order, correlationId)` creates the instance in AWAITING_STOCK and sends RESERVE_STOCK; `handleMessage(messageType, payload)` loads the instance, dedups by eventId, applies `transition`, persists state + history, updates order status via the projection, dispatches commands and order events. Command payloads are built from the Order row. Use the existing `KAFKA_SERVICE` client token and `this.kafkaClient.emit(topic, payload)` exactly like `order.service.ts:97`. Generate `eventId` with `randomUUID()` from `node:crypto`.

- [ ] **Step 1: Write failing tests** — mock `Repository<SagaInstance>`, `Repository<ProcessedEvent>`, `Repository<Order>`, and a `{ emit: jest.fn() }` kafka client (provide via `{ provide: 'KAFKA_SERVICE', useValue: kafkaMock }`). Test cases (AAA, descriptive names):

```typescript
// 1. startSaga persists AWAITING_STOCK and emits RESERVE_STOCK to inventory.commands
// 2. handleMessage INVENTORY_RESERVED in AWAITING_STOCK -> persists AWAITING_AUTH,
//    emits AUTHORIZE_PAYMENT to payment.commands with order total
// 3. handleMessage with already-processed eventId -> no state change, no emit
// 4. handleMessage for unknown orderId -> logs and returns (no throw)
// 5. PAYMENT_AUTH_FAILED in AWAITING_AUTH -> COMPENSATING + RELEASE_STOCK emitted
// 6. ORDER_SHIPPED in PACKED -> AWAITING_CAPTURE + CAPTURE_PAYMENT + order status SHIPPED persisted
// 7. duplicate INVENTORY_RESERVED while in AWAITING_AUTH (no-op transition) -> nothing emitted
```

Each test asserts: saved entity state, `kafkaMock.emit` calls (topic + payload `type`), and order status update.

- [ ] **Step 2: Run to verify failure** — `npx jest src/saga/saga.service.spec.ts` → FAIL (module not found).

- [ ] **Step 3: Implement SagaService**

```typescript
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { KAFKA_TOPICS } from '@shared/events';
import type { SagaCommand } from '@shared/events';
import { Order } from '../order/entities/order.entity';
import { OrderStatus } from '../order/entities/order-status.enum';
import { SagaInstance } from './entities/saga-instance.entity';
import { ProcessedEvent } from './entities/processed-event.entity';
import { transition } from './saga-state-machine';
import { ORDER_STATUS_PROJECTION, SagaCommandType, SagaMessageType, SagaState } from './saga-states';

const COMMAND_TOPICS: Record<SagaCommandType, string> = {
  RESERVE_STOCK: KAFKA_TOPICS.INVENTORY_COMMANDS,
  RELEASE_STOCK: KAFKA_TOPICS.INVENTORY_COMMANDS,
  RELEASE_ORDER: KAFKA_TOPICS.FULFILLMENT_COMMANDS,
  AUTHORIZE_PAYMENT: KAFKA_TOPICS.PAYMENT_COMMANDS,
  CAPTURE_PAYMENT: KAFKA_TOPICS.PAYMENT_COMMANDS,
};

interface IncomingSagaMessage {
  eventId?: string;
  orderId: string;
  correlationId: string;
  authorizationId?: string;
}

@Injectable()
export class SagaService {
  private readonly logger = new Logger(SagaService.name);

  constructor(
    @InjectRepository(SagaInstance) private readonly sagaRepository: Repository<SagaInstance>,
    @InjectRepository(ProcessedEvent) private readonly processedEventRepository: Repository<ProcessedEvent>,
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    @Inject('KAFKA_SERVICE') private readonly kafkaClient: ClientKafka,
  ) {}

  async startSaga(order: Order, correlationId: string): Promise<void> {
    const instance = this.sagaRepository.create({
      sagaId: order.id,
      currentState: SagaState.AWAITING_STOCK,
      correlationId,
      history: [{ state: SagaState.AWAITING_STOCK, message: 'ORDER_CREATED', timestamp: new Date().toISOString() }],
    });
    await this.sagaRepository.save(instance);
    await this.dispatchCommand('RESERVE_STOCK', order, correlationId);
  }

  async handleMessage(messageType: SagaMessageType, payload: IncomingSagaMessage): Promise<void> {
    if (payload.eventId) {
      const seen = await this.processedEventRepository.findOne({ where: { eventId: payload.eventId } });
      if (seen) {
        this.logger.log(`Duplicate event skipped: ${payload.eventId} (${messageType})`);
        return;
      }
    }

    const instance = await this.sagaRepository.findOne({ where: { sagaId: payload.orderId } });
    if (!instance) {
      this.logger.warn(`No saga for orderId=${payload.orderId}, message=${messageType} — skipping`);
      return;
    }

    const decision = transition(instance.currentState, messageType);
    if (decision.isNoOp) {
      this.logger.log(`No-op: ${messageType} in ${instance.currentState} (orderId=${payload.orderId})`);
      await this.markProcessed(payload.eventId);
      return;
    }

    const order = await this.orderRepository.findOne({ where: { id: payload.orderId }, relations: ['items'] });
    if (!order) {
      this.logger.warn(`Order ${payload.orderId} not found for saga transition — skipping`);
      return;
    }

    instance.currentState = decision.newState;
    instance.history = [
      ...instance.history,
      { state: decision.newState, message: messageType, timestamp: new Date().toISOString() },
    ];
    await this.sagaRepository.save(instance);
    await this.markProcessed(payload.eventId);

    const projected = ORDER_STATUS_PROJECTION[decision.newState];
    if (order.status !== projected) {
      order.status = projected;
      await this.orderRepository.save(order);
    }

    for (const command of decision.commands) {
      await this.dispatchCommand(command, order, instance.correlationId, payload.authorizationId);
    }
    for (const orderEvent of decision.orderEvents) {
      this.emitOrderEvent(orderEvent, order, instance.correlationId);
    }

    if (decision.newState === SagaState.CAPTURE_FAILED) {
      this.logger.error(
        `OPS ALERT: capture failed for shipped order ${order.id} — manual intervention required`,
      );
    }
  }

  private async markProcessed(eventId?: string): Promise<void> {
    if (!eventId) return;
    await this.processedEventRepository.save(this.processedEventRepository.create({ eventId }));
  }

  private async dispatchCommand(
    type: SagaCommandType,
    order: Order,
    correlationId: string,
    authorizationId?: string,
  ): Promise<void> {
    const base = { eventId: randomUUID(), orderId: order.id, timestamp: new Date(), correlationId };
    let command: SagaCommand;
    switch (type) {
      case 'RESERVE_STOCK':
        command = {
          ...base, type,
          items: order.items.map(i => ({
            productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice,
          })),
        };
        break;
      case 'AUTHORIZE_PAYMENT':
        command = { ...base, type, userId: order.userId, amount: Number(order.totalAmount), currency: 'USD', paymentMethod: 'CREDIT_CARD' as never };
        break;
      case 'CAPTURE_PAYMENT':
        command = { ...base, type, authorizationId: authorizationId ?? '', amount: Number(order.totalAmount) };
        break;
      case 'RELEASE_STOCK':
      case 'RELEASE_ORDER':
        command = { ...base, type };
        break;
    }
    this.kafkaClient.emit(COMMAND_TOPICS[type], command);
    this.logger.log(`Dispatched ${type} for order ${order.id} (correlationId=${correlationId})`);
  }

  private emitOrderEvent(kind: string, order: Order, correlationId: string): void {
    const eventTypeMap: Record<string, string> = {
      ORDER_CONFIRMED: 'ORDER_CONFIRMED',
      ORDER_SHIPPED_NOTICE: 'ORDER_STATUS_UPDATED',
      ORDER_FAILED: 'ORDER_CANCELLED',
    };
    this.kafkaClient.emit(KAFKA_TOPICS.ORDER_EVENTS, {
      eventType: eventTypeMap[kind],
      orderId: order.id,
      userId: order.userId,
      ...(kind === 'ORDER_SHIPPED_NOTICE' ? { oldStatus: OrderStatus.PROCESSING, newStatus: OrderStatus.SHIPPED } : {}),
      ...(kind === 'ORDER_FAILED' ? { reason: 'Saga failed' } : {}),
      timestamp: new Date(),
      correlationId,
    });
  }
}
```

Note on `authorizationId`: PAYMENT_AUTHORIZED replies carry it; the saga passes it through to CAPTURE_PAYMENT. To keep v1 simple, the payment service also keeps its own orderId→authorization map, so an empty `authorizationId` in CAPTURE_PAYMENT is tolerated there (lookup by orderId).

- [ ] **Step 4: Run tests** — `npx jest src/saga/saga.service.spec.ts` → PASS.

- [ ] **Step 5: Create the barrel** — `services/order-service/src/saga/index.ts`:

```typescript
export * from './saga-states';
export * from './saga-state-machine';
export * from './saga.service';
export * from './entities/saga-instance.entity';
export * from './entities/processed-event.entity';
```

- [ ] **Step 6: Commit** — `git commit -m "feat: saga service with dedup journal, projection, and command dispatch"`

---

### Task 5: Saga module, Kafka consumer, hybrid bootstrap, wire order creation

**Files:**
- Create: `services/order-service/src/saga/saga.module.ts`
- Create: `services/order-service/src/saga/saga.consumer.ts`
- Modify: `services/order-service/src/app.module.ts` (import SagaModule)
- Modify: `services/order-service/src/main.ts` (connectMicroservice)
- Modify: `services/order-service/src/order/order.service.ts` (start saga in createOrder)
- Modify: `services/order-service/src/order/order.module.ts` (import SagaModule)

- [ ] **Step 1: SagaModule** — mirror the `ClientsModule.registerAsync` block from `order.module.ts:14-30` verbatim (KAFKA_SERVICE, clientId `order-service-saga`), plus `TypeOrmModule.forFeature([SagaInstance, ProcessedEvent, Order, OrderItem, OrderStatusHistory])`. Providers: `[SagaService]`, controllers: `[SagaConsumer]`, exports: `[SagaService]`.

- [ ] **Step 2: SagaConsumer** — a controller with `@EventPattern` per reply topic. Discriminate on `eventType`:

```typescript
import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { KAFKA_TOPICS } from '@shared/events';
import { SagaService } from './saga.service';
import { SagaMessageType } from './saga-states';

const SAGA_MESSAGE_TYPES: readonly string[] = [
  'INVENTORY_RESERVED', 'INVENTORY_RESERVATION_FAILED', 'INVENTORY_RELEASED',
  'PAYMENT_AUTHORIZED', 'PAYMENT_AUTH_FAILED', 'PAYMENT_CAPTURED', 'PAYMENT_CAPTURE_FAILED',
  'ORDER_PICKED', 'ORDER_PACKED', 'ORDER_SHIPPED',
];

interface RawSagaEvent {
  eventType?: string;
  eventId?: string;
  orderId?: string;
  correlationId?: string;
  authorizationId?: string;
}

@Controller()
export class SagaConsumer {
  private readonly logger = new Logger(SagaConsumer.name);

  constructor(private readonly sagaService: SagaService) {}

  @EventPattern(KAFKA_TOPICS.INVENTORY_EVENTS)
  async onInventoryEvent(@Payload() event: RawSagaEvent): Promise<void> {
    await this.route(event);
  }

  @EventPattern(KAFKA_TOPICS.FULFILLMENT_EVENTS)
  async onFulfillmentEvent(@Payload() event: RawSagaEvent): Promise<void> {
    await this.route(event);
  }

  @EventPattern(KAFKA_TOPICS.PAYMENT_EVENTS)
  async onPaymentEvent(@Payload() event: RawSagaEvent): Promise<void> {
    await this.route(event);
  }

  private async route(event: RawSagaEvent): Promise<void> {
    if (!event?.eventType || !event.orderId || !SAGA_MESSAGE_TYPES.includes(event.eventType)) {
      this.logger.debug(`Ignoring non-saga event: ${event?.eventType ?? 'unknown'}`);
      return;
    }
    await this.sagaService.handleMessage(event.eventType as SagaMessageType, {
      eventId: event.eventId,
      orderId: event.orderId,
      correlationId: event.correlationId ?? 'unknown',
      authorizationId: event.authorizationId,
    });
  }
}
```

- [ ] **Step 3: Hybrid bootstrap** — in `services/order-service/src/main.ts`, after app creation and before `listen` (keep the file's existing style; it uses `require` for compression/helmet):

```typescript
app.connectMicroservice({
  transport: Transport.KAFKA,
  options: {
    client: {
      clientId: 'order-service-consumer',
      brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
    },
    consumer: { groupId: 'order-service-saga' },
  },
});
await app.startAllMicroservices();
```

Import `Transport` from `@nestjs/microservices`.

- [ ] **Step 4: Wire createOrder** — in `order.service.ts`, inject `SagaService` (constructor: `private readonly sagaService: SagaService`) and after the ORDER_CREATED emit (`order.service.ts:97`) add:

```typescript
await this.sagaService.startSaga(savedOrder, correlationId);
```

Add `SagaModule` to `order.module.ts` imports and `app.module.ts` imports. Watch for circular imports: SagaModule must NOT import OrderModule (it gets Order via TypeOrmModule.forFeature directly).

- [ ] **Step 5: Update existing order.service.spec.ts** — the createOrder tests now need a SagaService mock: `{ provide: SagaService, useValue: { startSaga: jest.fn() } }`. Add assertion that `startSaga` was called once with the saved order.

- [ ] **Step 6: Run all order-service tests** — `npx jest` → all pass (existing 11 + updated). Boot check: `GRAPHQL_PORT=3001 npx ts-node -r tsconfig-paths/register src/main.ts` starts without DI errors (requires docker infra up).

- [ ] **Step 7: Commit** — `git commit -m "feat: saga module with kafka consumer, hybrid bootstrap, order wiring"`

---

### Task 6: Payment service — authorize/capture split (TDD)

**Files:**
- Modify: `services/payment-service/src/payment/payment.service.ts`
- Create: `services/payment-service/src/payment/payment-commands.controller.ts`
- Modify: `services/payment-service/src/payment/payment.module.ts`
- Modify: `services/payment-service/src/main.ts` (hybrid bootstrap, groupId `payment-service`)
- Test: `services/payment-service/src/payment/payment.service.spec.ts`

- [ ] **Step 1: Write failing tests** for the new methods (mock kafka client as in Task 4):

```typescript
// 1. authorizePayment stores an authorization and emits PAYMENT_AUTHORIZED with authorizationId
// 2. authorizePayment with amount 13.13 emits PAYMENT_AUTH_FAILED with reason, does NOT throw
// 3. capturePayment for known orderId emits PAYMENT_CAPTURED
// 4. capturePayment with amount 26.26 emits PAYMENT_CAPTURE_FAILED, does NOT throw
// 5. capturePayment for unknown orderId emits PAYMENT_CAPTURE_FAILED with reason 'authorization not found'
```

- [ ] **Step 2: Verify failure** — `npx jest` from `services/payment-service/` → FAIL.

- [ ] **Step 3: Implement.** Add to `payment.service.ts` (keep the existing `processPayment` REST path working; new code is additive). Constants at top: `const AUTH_DECLINE_AMOUNT = 13.13;` `const CAPTURE_FAIL_AMOUNT = 26.26;`

```typescript
interface StoredAuthorization {
  authorizationId: string;
  orderId: string;
  amount: number;
  status: 'AUTHORIZED' | 'CAPTURED' | 'CAPTURE_FAILED';
}

// In-memory store: payment-service has no database. Restart loses auths —
// acceptable for the mock processor; the saga itself is persisted in orders DB.
private readonly authorizations = new Map<string, StoredAuthorization>();

async authorizePayment(command: AuthorizePaymentCommand): Promise<void> {
  const { orderId, amount, correlationId } = command;
  if (amount === AUTH_DECLINE_AMOUNT) {
    this.kafkaClient.emit(KAFKA_TOPICS.PAYMENT_EVENTS, {
      eventType: 'PAYMENT_AUTH_FAILED', eventId: randomUUID(), orderId, amount,
      reason: 'Card declined by issuer (demo trigger)', timestamp: new Date(), correlationId,
    });
    this.logger.warn('Authorization declined', { correlationId, orderId, amount });
    return;
  }
  const authorizationId = randomUUID();
  this.authorizations.set(orderId, { authorizationId, orderId, amount, status: 'AUTHORIZED' });
  this.kafkaClient.emit(KAFKA_TOPICS.PAYMENT_EVENTS, {
    eventType: 'PAYMENT_AUTHORIZED', eventId: randomUUID(), authorizationId, orderId, amount,
    timestamp: new Date(), correlationId,
  });
  this.logger.info('Payment authorized', { correlationId, orderId, authorizationId });
}

async capturePayment(command: CapturePaymentCommand): Promise<void> {
  const { orderId, amount, correlationId } = command;
  const auth = this.authorizations.get(orderId);
  const fail = (reason: string): void => {
    this.kafkaClient.emit(KAFKA_TOPICS.PAYMENT_EVENTS, {
      eventType: 'PAYMENT_CAPTURE_FAILED', eventId: randomUUID(),
      authorizationId: auth?.authorizationId ?? '', orderId, amount, reason,
      timestamp: new Date(), correlationId,
    });
    this.logger.error('Capture failed', { correlationId, orderId, reason });
  };
  if (!auth) return fail('authorization not found');
  if (amount === CAPTURE_FAIL_AMOUNT) {
    this.authorizations.set(orderId, { ...auth, status: 'CAPTURE_FAILED' });
    return fail('Capture rejected by processor (demo trigger)');
  }
  this.authorizations.set(orderId, { ...auth, status: 'CAPTURED' });
  this.kafkaClient.emit(KAFKA_TOPICS.PAYMENT_EVENTS, {
    eventType: 'PAYMENT_CAPTURED', eventId: randomUUID(), authorizationId: auth.authorizationId,
    orderId, amount, timestamp: new Date(), correlationId,
  });
  this.logger.info('Payment captured', { correlationId, orderId });
}
```

Import `randomUUID` from `node:crypto`, command types from `@shared/events`. Match the file's existing logger call style (it uses a custom logger with `(message, context)` signature — check lines 36-130).

- [ ] **Step 4: Command consumer controller** — `payment-commands.controller.ts`:

```typescript
import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { KAFKA_TOPICS } from '@shared/events';
import type { AuthorizePaymentCommand, CapturePaymentCommand } from '@shared/events';
import { PaymentService } from './payment.service';

@Controller()
export class PaymentCommandsController {
  private readonly logger = new Logger(PaymentCommandsController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @EventPattern(KAFKA_TOPICS.PAYMENT_COMMANDS)
  async onCommand(@Payload() command: AuthorizePaymentCommand | CapturePaymentCommand): Promise<void> {
    switch (command?.type) {
      case 'AUTHORIZE_PAYMENT':
        return this.paymentService.authorizePayment(command);
      case 'CAPTURE_PAYMENT':
        return this.paymentService.capturePayment(command);
      default:
        this.logger.warn(`Unknown command on payment.commands: ${JSON.stringify(command)}`);
    }
  }
}
```

Register in `payment.module.ts` controllers. Add the same hybrid `connectMicroservice` block from Task 5 Step 3 to payment `main.ts` (clientId `payment-service-consumer`, groupId `payment-service`).

- [ ] **Step 5: Run tests** — `npx jest` → PASS. Boot check the service starts.

- [ ] **Step 6: Commit** — `git commit -m "feat: payment authorize/capture split with command consumer and demo failure triggers"`

---

### Task 7: Java inventory — command DTOs, SagaCommandListener, retire dead listener

**Files:**
- Create: `services/inventory-service/src/main/java/com/microservice/oms/inventory/command/ReserveStockCommand.java`
- Create: `.../command/ReleaseStockCommand.java` (same package)
- Create: `.../event/InventoryReleasedEvent.java`
- Create: `.../listener/SagaCommandListener.java`
- Modify: `.../service/InventoryService.java` (extract `reserveStock`, emit released event, add eventId/idempotency)
- Delete: `.../listener/OrderEventListener.java` (dead code — deserialization never matched; reservation now command-driven)
- Modify: `src/main/resources/application.yml` (topics)
- Test: `src/test/java/com/microservice/oms/inventory/service/InventoryServiceTest.java` (extend or create)

- [ ] **Step 1: application.yml topics** — under `app.kafka.topics:` add:

```yaml
      inventory-commands: inventory.commands
      fulfillment-commands: fulfillment.commands
      fulfillment-events: fulfillment.events
```

- [ ] **Step 2: Command DTOs** — POJOs with Lombok `@Data @NoArgsConstructor @AllArgsConstructor` and `@JsonIgnoreProperties(ignoreUnknown = true)` (the TS side sends extra fields like `timestamp`). `ReserveStockCommand`: `String type; UUID eventId; UUID orderId; List<Item> items; String correlationId;` with nested `@Data @NoArgsConstructor @AllArgsConstructor @JsonIgnoreProperties(ignoreUnknown = true) public static class Item { private UUID productId; private Integer quantity; }`. `ReleaseStockCommand`: `String type; UUID eventId; UUID orderId; String correlationId;`.

- [ ] **Step 3: InventoryReleasedEvent** — mirror `InventoryReservedEvent`'s style: fields `String eventType; UUID eventId; UUID orderId; LocalDateTime timestamp; String correlationId;` (Lombok `@Data @AllArgsConstructor @NoArgsConstructor`); construct with `eventType = "INVENTORY_RELEASED"`.

- [ ] **Step 4: Failing JUnit tests** — `reserveStock` is the extracted core of `processOrderCreated` (same body, parameter is `ReserveStockCommand`). Tests (Mockito, mirror existing test style if a test class exists; otherwise create):

```java
// 1. reserveStock with sufficient stock saves reservation and sends INVENTORY_RESERVED
// 2. reserveStock with insufficient stock sends INVENTORY_RESERVATION_FAILED and releases partials
// 3. reserveStock called twice for same orderId (active reservation exists) re-sends
//    INVENTORY_RESERVED without creating duplicate reservations  [natural-key idempotency]
// 4. releaseStock sends INVENTORY_RELEASED after releasing; releasing an order with no
//    active reservations still sends INVENTORY_RELEASED (idempotent)
```

Run `mvn test` → FAIL (methods missing).

- [ ] **Step 5: Implement** — in `InventoryService`:
  - `@Transactional public void reserveStock(ReserveStockCommand cmd)`: first check `reservationRepository.findActiveReservationsByOrderId(cmd.getOrderId())` — if non-empty, log duplicate and re-emit INVENTORY_RESERVED (idempotent retry), return. Otherwise run the existing `processOrderCreated` body (loop items, reserve, save movements, emit reserved/failed), adapting `OrderCreatedEvent.OrderItemDto` → `ReserveStockCommand.Item`, and **include `eventId` (fresh `UUID.randomUUID()`) in the emitted events** (add an `eventId` field to `InventoryReservedEvent` and `InventoryReservationFailedEvent` — additive constructor change; update existing call sites).
  - `@Transactional public void releaseStock(ReleaseStockCommand cmd)`: call existing `releaseReservationsForOrder(cmd.getOrderId())`, then `kafkaTemplate.send(inventoryEventsTopic, new InventoryReleasedEvent("INVENTORY_RELEASED", UUID.randomUUID(), cmd.getOrderId(), LocalDateTime.now(), cmd.getCorrelationId()))`.
  - Delete `processOrderCreated` once `reserveStock` owns the logic (its only caller was the deleted listener).

- [ ] **Step 6: SagaCommandListener** — consume as Map and convert explicitly (this is the deserialization fix):

```java
package com.microservice.oms.inventory.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microservice.oms.inventory.command.ReleaseStockCommand;
import com.microservice.oms.inventory.command.ReserveStockCommand;
import com.microservice.oms.inventory.service.InventoryService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class SagaCommandListener {

    private final InventoryService inventoryService;
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = "${app.kafka.topics.inventory-commands}")
    public void handleInventoryCommand(Map<String, Object> payload, Acknowledgment acknowledgment) {
        String type = String.valueOf(payload.get("type"));
        try {
            switch (type) {
                case "RESERVE_STOCK" ->
                    inventoryService.reserveStock(objectMapper.convertValue(payload, ReserveStockCommand.class));
                case "RELEASE_STOCK" ->
                    inventoryService.releaseStock(objectMapper.convertValue(payload, ReleaseStockCommand.class));
                default -> log.warn("Unknown command on inventory.commands: {}", type);
            }
            acknowledgment.acknowledge();
        } catch (Exception e) {
            log.error("Error processing {} command", type, e);
            acknowledgment.acknowledge(); // avoid infinite reprocessing; DLQ is roadmap
        }
    }
}
```

NestJS `ClientKafka.emit` sends plain JSON — Map deserialization works with the existing consumer factory (`VALUE_DEFAULT_TYPE=Object` yields LinkedHashMap). Delete `OrderEventListener.java`.

- [ ] **Step 7: Run `mvn test`** → PASS. Commit: `git commit -m "feat: inventory command listener with idempotent reserve/release, retire dead order listener"`

---

### Task 8: Java inventory — warehouse fulfillment simulator

**Files:**
- Create: `.../command/ReleaseOrderCommand.java` (`type, eventId, orderId, correlationId` + `@JsonIgnoreProperties`)
- Create: `.../event/FulfillmentStepEvent.java`
- Create: `.../service/FulfillmentSimulator.java`
- Modify: `.../listener/SagaCommandListener.java` (add fulfillment-commands listener)
- Modify: `application.yml` (step delay)
- Test: `src/test/java/com/microservice/oms/inventory/service/FulfillmentSimulatorTest.java`

- [ ] **Step 1: Config** — add under `app:` in application.yml:

```yaml
  fulfillment:
    step-delay-ms: 2000
```

- [ ] **Step 2: FulfillmentStepEvent** — one class, `eventType` set per step (`ORDER_PICKED`/`ORDER_PACKED`/`ORDER_SHIPPED`): fields `String eventType; UUID eventId; UUID orderId; LocalDateTime timestamp; String correlationId;` (Lombok `@Data @AllArgsConstructor @NoArgsConstructor`).

- [ ] **Step 3: Failing tests** — with `stepDelayMs` set to 0 via reflection/setter and mocked `KafkaTemplate` + `InventoryService`:

```java
// 1. releaseOrder(cmd) eventually sends ORDER_PICKED, ORDER_PACKED, ORDER_SHIPPED
//    in order to fulfillment.events (Awaitility or CountDownLatch on the mock)
// 2. confirmReservation(orderId) is invoked exactly once, before ORDER_SHIPPED is sent
// 3. releaseOrder for an orderId already in flight is ignored (no duplicate events)
```

Run `mvn test` → FAIL.

- [ ] **Step 4: Implement FulfillmentSimulator**

```java
package com.microservice.oms.inventory.service;

import com.microservice.oms.inventory.command.ReleaseOrderCommand;
import com.microservice.oms.inventory.event.FulfillmentStepEvent;
import jakarta.annotation.PreDestroy;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class FulfillmentSimulator {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final InventoryService inventoryService;

    @Value("${app.kafka.topics.fulfillment-events}")
    private String fulfillmentEventsTopic;

    @Value("${app.fulfillment.step-delay-ms:2000}")
    private long stepDelayMs;

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private final Map<UUID, Boolean> inFlight = new ConcurrentHashMap<>();

    public void releaseOrder(ReleaseOrderCommand cmd) {
        if (inFlight.putIfAbsent(cmd.getOrderId(), Boolean.TRUE) != null) {
            log.warn("Order {} already in fulfillment — ignoring duplicate RELEASE_ORDER", cmd.getOrderId());
            return;
        }
        log.info("Warehouse accepted order {} (correlationId={})", cmd.getOrderId(), cmd.getCorrelationId());
        scheduler.schedule(() -> emitStep("ORDER_PICKED", cmd), stepDelayMs, TimeUnit.MILLISECONDS);
        scheduler.schedule(() -> emitStep("ORDER_PACKED", cmd), stepDelayMs * 2, TimeUnit.MILLISECONDS);
        scheduler.schedule(() -> ship(cmd), stepDelayMs * 3, TimeUnit.MILLISECONDS);
    }

    private void ship(ReleaseOrderCommand cmd) {
        try {
            // Sterling pattern: shipping converts the reservation into a stock decrement
            inventoryService.confirmReservation(cmd.getOrderId());
            emitStep("ORDER_SHIPPED", cmd);
        } finally {
            inFlight.remove(cmd.getOrderId());
        }
    }

    private void emitStep(String eventType, ReleaseOrderCommand cmd) {
        FulfillmentStepEvent event = new FulfillmentStepEvent(
            eventType, UUID.randomUUID(), cmd.getOrderId(), LocalDateTime.now(), cmd.getCorrelationId());
        kafkaTemplate.send(fulfillmentEventsTopic, event);
        log.info("{} for order {} (correlationId={})", eventType, cmd.getOrderId(), cmd.getCorrelationId());
    }

    @PreDestroy
    public void shutdown() {
        scheduler.shutdownNow();
    }
}
```

Add to `SagaCommandListener`:

```java
    private final FulfillmentSimulator fulfillmentSimulator;

    @KafkaListener(topics = "${app.kafka.topics.fulfillment-commands}")
    public void handleFulfillmentCommand(Map<String, Object> payload, Acknowledgment acknowledgment) {
        String type = String.valueOf(payload.get("type"));
        try {
            if ("RELEASE_ORDER".equals(type)) {
                fulfillmentSimulator.releaseOrder(objectMapper.convertValue(payload, ReleaseOrderCommand.class));
            } else {
                log.warn("Unknown command on fulfillment.commands: {}", type);
            }
            acknowledgment.acknowledge();
        } catch (Exception e) {
            log.error("Error processing {} command", type, e);
            acknowledgment.acknowledge();
        }
    }
```

- [ ] **Step 5: Run `mvn test`** → PASS. Commit: `git commit -m "feat: warehouse fulfillment simulator with pick/pack/ship lifecycle"`

---

### Task 9: Angular — live status polling

**Files:**
- Modify: `frontend/angular-client/src/app/orders/order-detail.component.ts`

- [ ] **Step 1: Read the component first.** It queries the order via Apollo. Add polling that runs only while the order is non-terminal:

```typescript
private static readonly TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED', 'DELIVERED'];
private static readonly POLL_INTERVAL_MS = 3000;
```

Use Apollo `watchQuery` with `pollInterval: OrderDetailComponent.POLL_INTERVAL_MS`; in the subscription handler call `this.orderQuery.stopPolling()` when `TERMINAL_STATUSES.includes(order.status)`. If the component currently uses a one-shot `query()`, convert: `this.orderQuery = this.apollo.watchQuery({...}); this.orderQuery.valueChanges.subscribe(...)`. Unsubscribe and `stopPolling()` in `ngOnDestroy`.

- [ ] **Step 2: Add status display entries** for PROCESSING / COMPLETED / FAILED wherever the template maps statuses to chips/colors (find the existing PENDING/SHIPPED handling and extend it).

- [ ] **Step 3: Manual verify** — with the full stack running, place an order from the UI and watch the detail page advance PENDING → PROCESSING → SHIPPED → COMPLETED without reload. Commit: `git commit -m "feat: live order status polling until terminal state"`

---

### Task 10: Integration verification

**Files:**
- Create: `scripts/test-saga-flow.sh`
- Modify: `README.md` (saga section + demo triggers)

- [ ] **Step 1: Write the script** — bash, requires the full stack up (docker infra + all services). Targets the gateway (`http://localhost:4000/graphql`):

```bash
#!/usr/bin/env bash
set -euo pipefail
GATEWAY=http://localhost:4000/graphql

place_order() { # $1 = unit price
  curl -s "$GATEWAY" -H 'content-type: application/json' -d "{\"query\":\"mutation { createOrder(createOrderInput: { userId: \\\"$(uuidgen)\\\", items: [{ productId: \\\"REPLACE_WITH_SEEDED_PRODUCT_ID\\\", quantity: 1, unitPrice: $1 }] }) { id status } }\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["createOrder"]["id"])'
}

poll_status() { # $1 = orderId, $2 = expected, $3 = max attempts (2s apart)
  local status=""
  for _ in $(seq 1 "$3"); do
    status=$(curl -s "$GATEWAY" -H 'content-type: application/json' -d "{\"query\":\"query { order(id: \\\"$1\\\") { status } }\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["order"]["status"])')
    [ "$status" = "$2" ] && echo "OK: order $1 reached $2" && return 0
    sleep 2
  done
  echo "FAIL: order $1 stuck at $status (expected $2)"; return 1
}

echo "— Happy path —";        id=$(place_order 49.99);  poll_status "$id" COMPLETED 20
echo "— Auth decline —";      id=$(place_order 13.13);  poll_status "$id" FAILED 10
echo "— Capture failure —";   id=$(place_order 26.26);  poll_status "$id" SHIPPED 20
echo "All saga flows verified."
```

Before committing: replace `REPLACE_WITH_SEEDED_PRODUCT_ID` with a real product UUID from `infrastructure/databases/inventory-init.sql` seed data, and verify the exact mutation/query field names against the actual schema (`createOrder` input shape lives in `services/order-service/src/order/dto/`). Adjust until the script runs green — it must pass for real, not aspirationally. Note: order total = unitPrice × quantity, so quantity 1 at 13.13 produces the 13.13 total the demo trigger matches.

- [ ] **Step 2: Run it** — `bash scripts/test-saga-flow.sh` with everything up. All three flows must print OK. Also grep one correlationId across order/inventory/payment service logs to confirm end-to-end tracing (success criterion 3).

- [ ] **Step 3: README** — add a "Saga in action" section: the state machine diagram (copy from the spec), the demo amounts ($13.13 auth decline, $26.26 capture failure), and the one-command demo. Commit: `git commit -m "feat: saga integration test script and README demo section"`

---

## Self-Review Notes

- **Spec coverage:** Task 1 (contracts/enums) ↔ spec Message design; Tasks 2–5 ↔ order-service section + state machine + idempotency; Task 6 ↔ payment section; Tasks 7–8 ↔ inventory two-roles section; Task 9 ↔ frontend; Task 10 ↔ success criteria. Notification service: no task (spec says no changes).
- **Known simplification:** `markProcessed` runs as a separate save rather than inside one DB transaction with the saga save — acceptable for v1 (spec already accepts a dual-write window); noted for the Phase 2 outbox work.
- **Type consistency:** `SagaMessageType` strings equal the emitted `eventType` values across Tasks 6–8; the `type` discriminator on commands matches the Java DTO `type` field and TS `SagaCommand.type`; `OrderItem.unitPrice/totalPrice` exist on the TS side and Java `ReserveStockCommand.Item` ignores extras via `@JsonIgnoreProperties`.
