import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global test teardown...');
  
  // Log test summary
  console.log('📊 Test Summary:');
  console.log('- System validation tests completed');
  console.log('- Check test-results.html for detailed report');
  console.log('- Screenshots and videos saved for any failures');
  
  console.log('🎉 Global teardown complete');
}

export default globalTeardown;