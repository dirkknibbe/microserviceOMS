# E-Commerce Microservices Architecture

## System Overview

This system demonstrates a modern microservices architecture for an e-commerce order management system using:

- **5 Core Microservices** (Order, Inventory, Payment, Notification, User)
- **GraphQL Federation** for unified API gateway
- **Apache Kafka** for asynchronous event-driven communication
- **Angular Frontend** with real-time WebSocket updates
- **Docker Containerization** for consistent deployment

## Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐
│  Angular Client │    │  GraphQL Gateway│
│     (Port 4200) │◄──►│   (Port 4000)   │
└─────────────────┘    └─────────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
            ┌───────▼──┐  ┌─────▼─────┐   │
            │Order Svc │  │ User Svc  │   │
            │(Port 3001)│  │(Port 3005)│   │
            └───────────┘  └───────────┘   │
                    │                      │
            ┌───────▼─────────────────────▼──┐
            │        Apache Kafka            │
            │       (Port 9092)              │
            └┬─────────────────┬──────────────┘
             │                 │
    ┌────────▼──┐  ┌──────────▼──┐  ┌─────────▼───┐
    │Inventory  │  │ Payment Svc │  │Notification │
    │   Svc     │  │(Port 3003)  │  │    Svc      │
    │(Port 3002)│  └─────────────┘  │(Port 3004)  │
    └───────────┘                   └─────────────┘
         │
    ┌────▼─────┐    ┌─────────────┐    ┌───────────┐
    │PostgreSQL│    │ PostgreSQL  │    │PostgreSQL │
    │Orders DB │    │Inventory DB │    │ Users DB  │
    │(Port 5432)│   │(Port 5433)  │    │(Port 5434)│
    └──────────┘    └─────────────┘    └───────────┘
```

## Event Flow

### Order Creation Flow
1. **Frontend** → Create order via GraphQL
2. **GraphQL Gateway** → Routes to Order Service
3. **Order Service** → Publishes `ORDER_CREATED` event to Kafka
4. **Inventory Service** → Consumes event, reserves inventory
5. **Inventory Service** → Publishes `INVENTORY_RESERVED` event
6. **Order Service** → Updates status to `CONFIRMED`
7. **Notification Service** → Sends confirmation email

### Payment Processing Flow
1. **Frontend** → Initiates payment
2. **Payment Service** → Processes with Stripe
3. **Payment Service** → Publishes `PAYMENT_PROCESSED` event
4. **Order Service** → Updates status to `PAID`
5. **Inventory Service** → Confirms inventory reservation
6. **Notification Service** → Sends payment confirmation

## Technology Stack

### Backend Services
- **NestJS** (Order, Payment, User services)
- **Spring Boot** (Inventory, Notification services)
- **GraphQL Federation** (API Gateway)
- **Apache Kafka** (Event streaming)
- **PostgreSQL** (Primary databases)
- **Redis** (Caching & sessions)

### Frontend
- **Angular 17** with Bootstrap 5
- **Apollo GraphQL Client** for API communication
- **WebSocket** subscriptions for real-time updates
- **RxJS** for reactive programming

### Infrastructure
- **Docker & Docker Compose** for containerization
- **Prometheus** for metrics collection
- **Grafana** for monitoring dashboards
- **Jaeger** for distributed tracing

## Key Features

### Microservices Patterns
- **Domain-Driven Design** - Each service owns its domain
- **Event Sourcing** - All changes tracked via events
- **CQRS** - Separate read/write models where appropriate
- **Saga Pattern** - Distributed transaction handling
- **Circuit Breaker** - Resilience against cascading failures

### Real-Time Capabilities
- **GraphQL Subscriptions** for live order tracking
- **Kafka Event Streaming** for instant inventory updates
- **WebSocket connections** for push notifications
- **Redis Pub/Sub** for real-time frontend updates

### Observability
- **Distributed Tracing** across all service calls
- **Structured Logging** with correlation IDs
- **Prometheus Metrics** for performance monitoring
- **Grafana Dashboards** for business insights
- **Health Checks** for all services

## Performance Targets

- **Response Time**: < 200ms for 95th percentile
- **Throughput**: 1000+ orders per minute
- **Availability**: 99.9% uptime
- **Consistency**: Eventual consistency with <5s propagation

## Security Features

- **JWT Authentication** for user sessions
- **HTTPS/TLS** for all external communication
- **Input Validation** on all API endpoints
- **CORS Configuration** for cross-origin requests
- **Helmet.js** for security headers

## Getting Started

1. **Start Infrastructure**: `./scripts/start-infrastructure.sh`
2. **Start Services**: `./scripts/start-services.sh`
3. **Start Monitoring**: `./scripts/start-monitoring.sh`
4. **Run Tests**: `./scripts/test-system.sh`

## Development

Each service can be developed independently:
- Services have their own package.json/pom.xml
- Shared types in `/shared` directory
- Database per service principle
- Event-driven inter-service communication