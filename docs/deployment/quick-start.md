# Quick Start Guide

## Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- Java 17+ (for local development)
- Git

## 1. Clone and Setup

```bash
git clone <repository-url>
cd microserviceOMS
```

## 2. Start the System

### Option A: Full Docker Deployment (Recommended)

```bash
# Start everything with one command
./scripts/start-infrastructure.sh
./scripts/start-services.sh
./scripts/start-monitoring.sh

# Test the system
./scripts/test-system.sh
```

### Option B: Step-by-Step

```bash
# 1. Start infrastructure (databases, Kafka, Redis)
cd infrastructure
docker compose up -d zookeeper kafka postgres-orders postgres-inventory postgres-users redis

# 2. Wait for infrastructure to be ready
sleep 30

# 3. Start microservices
docker compose up -d order-service inventory-service payment-service notification-service user-service

# 4. Start GraphQL Gateway
docker compose up -d graphql-gateway

# 5. Start Angular Frontend
docker compose up -d angular-client

# 6. Start monitoring
docker compose up -d prometheus grafana jaeger
```

## 3. Access the System

- **Angular Frontend**: http://localhost:4200
- **GraphQL Playground**: http://localhost:4000/graphql
- **Grafana Dashboard**: http://localhost:3000 (admin/grafana)
- **Prometheus**: http://localhost:9090
- **Jaeger Tracing**: http://localhost:16686

## 4. Test Order Creation

### Via GraphQL Playground

```graphql
mutation {
  createOrder(
    input: {
      userId: "550e8400-e29b-41d4-a716-446655440101"
      items: [
        { productId: "550e8400-e29b-41d4-a716-446655440201", quantity: 2 }
      ]
    }
  ) {
    id
    status
    totalAmount
    items {
      productId
      quantity
      unitPrice
    }
  }
}
```

### Via cURL

```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { createOrder(input: { userId: \"550e8400-e29b-41d4-a716-446655440101\", items: [{ productId: \"550e8400-e29b-41d4-a716-446655440201\", quantity: 2 }] }) { id status totalAmount } }"
  }'
```

## 5. Monitor the System

### View Service Metrics

- Open Grafana: http://localhost:3000
- Login with admin/grafana
- View "E-Commerce Microservices Overview" dashboard

### Check Service Logs

```bash
# View all services
docker compose logs -f

# View specific service
docker compose logs -f order-service
docker compose logs -f inventory-service
```

### Monitor Kafka Messages

```bash
# Watch order events
docker exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic order.events \
  --from-beginning

# Watch inventory events
docker exec kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic inventory.events \
  --from-beginning
```

## 6. Development Mode

### Start Services Locally

```bash
# Order Service
cd services/order-service
npm install
npm run start:dev

# User Service
cd services/user-service
npm install
npm run start:dev

# Inventory Service
cd services/inventory-service
./mvnw spring-boot:run

# Angular Frontend
cd frontend/angular-client
npm install
ng serve
```

## Troubleshooting

### Common Issues

1. **Services not starting**: Check Docker resource allocation
2. **Database connection errors**: Ensure PostgreSQL containers are running
3. **Kafka errors**: Verify Zookeeper is running before Kafka
4. **GraphQL Federation errors**: Ensure subgraph services are healthy

### Debug Commands

```bash
# Check service health
curl http://localhost:3001/health
curl http://localhost:3002/actuator/health

# Check Docker container status
docker compose ps

# View container logs
docker compose logs [service-name]

# Restart specific service
docker compose restart [service-name]
```

### Reset System

```bash
# Stop all services
docker compose down

# Remove volumes (will delete data)
docker compose down -v

# Restart fresh
./scripts/start-infrastructure.sh
./scripts/start-services.sh
```

## Next Steps

- Explore the GraphQL schema at http://localhost:4000/graphql
- Monitor real-time metrics in Grafana
- Create orders and watch the event flow
- Experiment with service failures and recovery
- Review distributed tracing in Jaeger
