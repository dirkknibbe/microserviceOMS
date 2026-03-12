#!/bin/bash

echo "🚀 Starting E-Commerce Microservices..."

# Navigate to infrastructure directory
cd "$(dirname "$0")/../infrastructure"

# Start microservices
echo "📦 Starting microservices..."
docker compose up -d order-service inventory-service payment-service notification-service user-service

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 45

# Start GraphQL Gateway
echo "🌐 Starting GraphQL Federation Gateway..."
docker compose up -d graphql-gateway

# Wait for gateway to start
sleep 15

# Start Angular frontend
echo "🖥️  Starting Angular frontend..."
docker compose up -d angular-client

echo ""
echo "🎉 All services are starting up!"
echo ""
echo "📊 Service URLs:"
echo "- Order Service: http://localhost:3001"
echo "- Inventory Service: http://localhost:3002"  
echo "- Payment Service: http://localhost:3003"
echo "- Notification Service: http://localhost:3004"
echo "- User Service: http://localhost:3005"
echo "- GraphQL Gateway: http://localhost:4000/graphql"
echo "- Angular Frontend: http://localhost:4200"
echo ""
echo "🔍 Health Check Commands:"
echo "curl http://localhost:3001/health  # Order Service"
echo "curl http://localhost:3002/actuator/health  # Inventory Service"
echo "curl http://localhost:3003/health  # Payment Service"
echo "curl http://localhost:3004/actuator/health  # Notification Service"
echo "curl http://localhost:3005/health  # User Service"
echo "curl http://localhost:4000/health  # GraphQL Gateway"
echo ""
echo "⏳ Services may take a few minutes to fully initialize..."
echo "💡 Check logs with: docker-compose logs -f [service-name]"
echo ""