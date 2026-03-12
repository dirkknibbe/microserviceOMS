#!/bin/bash

echo "📊 Starting Monitoring Stack..."

# Navigate to infrastructure directory
cd "$(dirname "$0")/../infrastructure"

# Start monitoring services
echo "📈 Starting Prometheus..."
docker compose up -d prometheus

echo "📊 Starting Grafana..."
docker compose up -d grafana

echo "🔍 Starting Jaeger..."
docker compose up -d jaeger

# Wait for services to start
echo "⏳ Waiting for monitoring services to start..."
sleep 20

echo ""
echo "🎉 Monitoring stack is running!"
echo ""
echo "📊 Monitoring URLs:"
echo "- Prometheus: http://localhost:9090"
echo "- Grafana: http://localhost:3000 (admin/grafana)"
echo "- Jaeger: http://localhost:16686"
echo ""
echo "📋 Grafana Dashboards:"
echo "- E-Commerce Microservices Overview"
echo "- Service Health & Performance"
echo "- Business Metrics"
echo ""
echo "🔍 Prometheus Targets: http://localhost:9090/targets"
echo "📈 Grafana Import: Use dashboard ID or upload JSON from infrastructure/monitoring/grafana/dashboards/"
echo ""