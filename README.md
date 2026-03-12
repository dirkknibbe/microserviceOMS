# Real-Time E-Commerce Order Management System

> A production-grade microservices platform demonstrating event-driven architecture, GraphQL Federation, and real-time updates — built to showcase distributed systems design skills.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Angular Frontend (port 4200)                │
│               Material Design UI · GraphQL Apollo Client         │
└─────────────────────────┬───────────────────────────────────────┘
                          │ GraphQL / WebSocket
┌─────────────────────────▼───────────────────────────────────────┐
│              GraphQL Federation Gateway (port 4000)              │
│         Apollo Gateway · JWT forwarding · Subscriptions          │
└────┬──────────────┬──────────────────────────────────────────────┘
     │              │
┌────▼────┐    ┌────▼────┐
│  Order  │    │  User   │      REST
│ Service │    │ Service │◄──────────────┐
│ :3001   │    │ :3005   │               │
│ NestJS  │    │ NestJS  │          ┌────▼───────┐  ┌──────────────┐
│GraphQL  │    │GraphQL  │          │  Payment   │  │  Inventory   │
│ TypeORM │    │JWT/bcrypt│         │  Service   │  │   Service    │
└────┬────┘    └────┬────┘          │  :3003     │  │   :3002      │
     │              │               │  NestJS    │  │ Spring Boot  │
     └──────────────┴───────────────┴────────────┴──┬─────────────┘
                                                     │
                          ┌──────────────────────────┘
                          │       Apache Kafka (port 9092)
                          │    Topics: order.events · payment.events
                          │           inventory.events · user.events
                          │
                    ┌─────▼────────┐
                    │ Notification │
                    │   Service    │
                    │   :3004      │
                    │ Spring Boot  │
                    │ Email / SMS  │
                    └──────────────┘

Infrastructure: PostgreSQL × 3 · Redis · Prometheus · Grafana · Jaeger
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 17, Angular Material, Apollo Client |
| API Gateway | GraphQL Federation (Apollo Gateway) |
| Order & User Services | NestJS, TypeScript, GraphQL (code-first) |
| Inventory & Notification | Spring Boot, Java 17, JPA |
| Payment Service | NestJS, Stripe integration |
| Message Broker | Apache Kafka |
| Databases | PostgreSQL (per service), Redis |
| Auth | JWT, bcrypt, Passport.js |
| Monitoring | Prometheus, Grafana, Jaeger (distributed tracing) |
| Containers | Docker, Docker Compose |

## Key Features

- **Event-Driven Order Flow**: Order created → Inventory reserved → Payment processed → Notification sent, all via Kafka events
- **GraphQL Federation**: Single `/graphql` endpoint composing data from independent services
- **Real-Time Updates**: WebSocket subscriptions push order status changes to the Angular UI instantly
- **Distributed Tracing**: Correlation IDs propagated across all services for end-to-end request tracking
- **Saga Pattern**: Distributed transaction handling across Order, Inventory, and Payment services
- **Independent Databases**: Each service owns its PostgreSQL schema — no shared state

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- Java 17+ (for local Inventory/Notification service development)

### Run Everything with Docker

```bash
# Clone the repo
git clone https://github.com/dirkknibbe/microserviceOMS.git
cd microserviceOMS

# Start all infrastructure + services
docker-compose -f infrastructure/docker-compose.yml up -d

# Wait ~30 seconds for services to start, then check health
curl http://localhost:3001/health   # Order service
curl http://localhost:3005/health   # User service
curl http://localhost:4000/health   # GraphQL Gateway
```

### Access Points

| Service | URL |
|---------|-----|
| Angular Frontend | http://localhost:4200 |
| GraphQL Playground | http://localhost:4000/graphql |
| Order Service API | http://localhost:3001/graphql |
| User Service API | http://localhost:3005/graphql |
| Inventory Service | http://localhost:3002/health |
| Payment Service | http://localhost:3003/health |
| Notification Service | http://localhost:3004/actuator/health |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3000 |
| Jaeger Tracing | http://localhost:16686 |

### Local Development

```bash
# Order Service
cd services/order-service && npm install && npm run start:dev

# User Service
cd services/user-service && npm install && npm run start:dev

# GraphQL Gateway
cd gateway/graphql-gateway && npm install && npm run start:dev

# Angular Frontend
cd frontend/angular-client && npm install && ng serve

# Inventory Service (requires Java 17)
cd services/inventory-service && ./mvnw spring-boot:run

# Notification Service (requires Java 17)
cd services/notification-service && ./mvnw spring-boot:run
```

## Order Flow (End-to-End)

```
1. User places order via Angular UI
   → GraphQL mutation → Order Service
   → Order saved to PostgreSQL
   → ORDER_CREATED event → Kafka

2. Inventory Service consumes ORDER_CREATED
   → Reserves stock in inventory DB
   → INVENTORY_RESERVED event → Kafka

3. Payment Service processes payment
   → Stripe payment intent created
   → PAYMENT_PROCESSED event → Kafka

4. Order Service updates status to PAID
   → ORDER_STATUS_UPDATED event → Kafka

5. Notification Service sends email/SMS
   → Customer notified of order confirmation

6. Angular UI receives real-time update
   → GraphQL subscription pushes new status
   → UI updates without page refresh
```

## Project Structure

```
├── services/
│   ├── order-service/        # NestJS + GraphQL + TypeORM
│   ├── inventory-service/    # Spring Boot + JPA
│   ├── payment-service/      # NestJS + Stripe
│   ├── notification-service/ # Spring Boot + SendGrid/Twilio
│   └── user-service/         # NestJS + GraphQL + JWT
├── gateway/
│   └── graphql-gateway/      # Apollo Federation Gateway
├── frontend/
│   └── angular-client/       # Angular 17 + Material Design
├── infrastructure/
│   ├── docker-compose.yml    # Full stack orchestration
│   ├── databases/            # SQL init scripts
│   └── monitoring/           # Prometheus + Grafana configs
├── shared/
│   ├── events/               # Kafka event type definitions
│   ├── types/                # Shared TypeScript interfaces
│   └── utils/                # Logger, correlation ID generator
└── docs/
    ├── architecture/
    └── deployment/
```

## Running Tests

```bash
# Order Service unit tests
cd services/order-service && npm test

# User Service unit tests
cd services/user-service && npm test

# Angular unit tests
cd frontend/angular-client && ng test --watch=false

# Coverage report
cd services/order-service && npm run test:cov
```

## Kafka Topics

| Topic | Producer | Consumers |
|-------|----------|-----------|
| `order.events` | Order Service | Inventory, Notification |
| `inventory.events` | Inventory Service | Order Service |
| `payment.events` | Payment Service | Order Service, Notification |
| `user.events` | User Service | Notification |
| `notification.events` | Notification Service | (monitoring) |

## What This Demonstrates

This project was built to showcase:

- **Microservices Architecture**: True service independence with separate databases and deployment units
- **Event-Driven Design**: Asynchronous communication via Kafka, avoiding tight coupling
- **GraphQL Federation**: Composing a unified API from multiple subgraph services
- **Polyglot Architecture**: NestJS (TypeScript) and Spring Boot (Java) services in the same system
- **Real-Time UX**: WebSocket subscriptions in Angular for live order tracking
- **Observability**: Distributed tracing with correlation IDs, Prometheus metrics, Grafana dashboards
- **Production Patterns**: Repository pattern, dependency injection, DTO validation, status machine transitions

---

Built with NestJS · Spring Boot · Angular · Apache Kafka · GraphQL Federation · PostgreSQL · Docker
