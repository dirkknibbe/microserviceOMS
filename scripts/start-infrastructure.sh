#!/bin/bash

echo "🚀 Starting E-Commerce Microservices Infrastructure..."

# Navigate to infrastructure directory
cd "$(dirname "$0")/../infrastructure"

# Start infrastructure services first
echo "📦 Starting infrastructure services (Kafka, PostgreSQL, Redis)..."
docker compose up -d zookeeper kafka postgres-orders postgres-inventory postgres-users redis

# Wait for services to be ready
echo "⏳ Waiting for infrastructure services to be ready..."
sleep 30

# Check if Kafka is ready
echo "🔍 Checking Kafka availability..."
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Kafka is ready"
else
    echo "❌ Kafka is not ready, please check logs"
    exit 1
fi

# Check PostgreSQL connections
echo "🔍 Checking database connections..."
docker exec postgres-orders pg_isready -U orderuser -d orders_db > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Orders database is ready"
else
    echo "❌ Orders database is not ready"
fi

docker exec postgres-inventory pg_isready -U inventoryuser -d inventory_db > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Inventory database is ready"
else
    echo "❌ Inventory database is not ready"
fi

docker exec postgres-users pg_isready -U useruser -d users_db > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Users database is ready"
else
    echo "❌ Users database is not ready"
fi

# Check Redis
echo "🔍 Checking Redis..."
docker exec redis redis-cli ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis is not ready"
fi

echo ""
echo "🎉 Infrastructure services are running!"
echo ""
echo "📊 Service URLs:"
echo "- Kafka: localhost:9092"
echo "- Orders DB: localhost:5432"
echo "- Inventory DB: localhost:5433" 
echo "- Users DB: localhost:5434"
echo "- Redis: localhost:6379"
echo ""
echo "Next steps:"
echo "1. Run ./start-services.sh to start microservices"
echo "2. Run ./start-monitoring.sh to start monitoring stack"
echo "3. Access GraphQL Playground at http://localhost:4000/graphql"
echo ""