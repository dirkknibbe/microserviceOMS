#!/bin/bash

echo "🧪 Running End-to-End Tests for E-Commerce Microservices..."

# Navigate to tests directory
cd "$(dirname "$0")/../tests"

# Check if Playwright is installed
if [ ! -d "node_modules/@playwright" ]; then
    echo "📦 Installing Playwright dependencies..."
    npm install
    npx playwright install
fi

echo ""
echo "🎯 Test Strategy:"
echo "1. Service health checks"
echo "2. GraphQL API validation"
echo "3. Frontend interface testing"
echo "4. End-to-end order flow simulation"
echo "5. Monitoring dashboard validation"
echo ""

# Run the tests
echo "▶️  Running Playwright tests..."
npx playwright test --reporter=line

echo ""
echo "📊 Generating test report..."
npx playwright show-report --host 0.0.0.0

echo ""
echo "✨ Test Results:"
echo "- HTML Report: Open tests/playwright-report/index.html"
echo "- Screenshots: Available in tests/test-results/ for any failures"
echo "- Videos: Available in tests/test-results/ for any failures"
echo ""
echo "💡 Note: Some tests may show warnings if Docker services are not running."
echo "   To run full integration tests, first start all services:"
echo "   ./scripts/start-infrastructure.sh && ./scripts/start-services.sh"
echo ""