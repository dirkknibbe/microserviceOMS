import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...');
  
  // Launch a browser to check if services are running
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const services = [
    { name: 'GraphQL Gateway', url: 'http://localhost:4000/health' },
    { name: 'Angular Frontend', url: 'http://localhost:4200' },
    { name: 'Prometheus', url: 'http://localhost:9090/-/healthy' },
    { name: 'Grafana', url: 'http://localhost:3000/api/health' }
  ];
  
  console.log('🔍 Checking service availability...');
  
  for (const service of services) {
    try {
      const response = await page.request.get(service.url);
      if (response.status() === 200) {
        console.log(`✅ ${service.name} is running`);
      } else {
        console.log(`⚠️  ${service.name} returned status ${response.status()}`);
      }
    } catch (error) {
      console.log(`❌ ${service.name} is not accessible`);
    }
  }
  
  await browser.close();
  
  console.log('🎯 Global setup complete. Note: Some tests may be skipped if services are not running.');
  console.log('💡 To run full tests, first execute: ./scripts/start-infrastructure.sh && ./scripts/start-services.sh');
}

export default globalSetup;