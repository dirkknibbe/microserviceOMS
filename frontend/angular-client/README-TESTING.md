# Frontend Testing Guide

This guide explains how to test the Angular E-Commerce OMS frontend application.

## Quick Start

### Run All Tests
```bash
# Make the script executable (first time only)
chmod +x test-frontend.sh

# Run comprehensive test suite
./test-frontend.sh all
```

### Individual Test Commands
```bash
# Install dependencies
./test-frontend.sh install

# Run unit tests
./test-frontend.sh test

# Run linting
./test-frontend.sh lint

# Build application
./test-frontend.sh build

# Start development server
./test-frontend.sh serve

# Run end-to-end tests
./test-frontend.sh e2e

# Check bundle size
./test-frontend.sh size
```

## Testing Stack

### Unit Testing
- **Framework**: Jasmine + Karma
- **Coverage**: Istanbul
- **Browser**: Chrome/ChromeHeadless
- **Location**: `src/**/*.spec.ts`

### End-to-End Testing
- **Framework**: Playwright
- **Browsers**: Chrome, Firefox, Safari, Edge
- **Mobile**: iOS Safari, Android Chrome
- **Location**: `e2e/**/*.spec.ts`

### Linting
- **Framework**: ESLint + TypeScript ESLint
- **Configuration**: Angular recommended rules

## NPM Scripts

```bash
# Unit Tests
npm test                    # Run tests in watch mode
npm run test:ci            # Run tests once (CI mode)
npm run test:coverage      # Run tests with coverage

# Building
npm run build              # Development build
npm run build:prod         # Production build

# Linting
npm run lint               # Check for linting errors
npm run lint:fix           # Auto-fix linting errors

# Development
npm start                  # Start development server
npm run serve:prod         # Serve production build

# Analysis
npm run analyze            # Analyze bundle size

# E2E Testing
npm run e2e                # Run end-to-end tests

# Custom Script
npm run test-frontend      # Run our custom test script
```

## Test Coverage

### Current Coverage Targets
- **Statements**: 75%
- **Branches**: 70%
- **Functions**: 75%
- **Lines**: 75%

### Coverage Reports
After running tests with coverage, reports are available at:
- HTML Report: `coverage/angular-client/index.html`
- LCOV Report: `coverage/angular-client/lcov.info`

## Unit Tests

### Test Files Structure
```
src/
├── app/
│   ├── dashboard/
│   │   ├── dashboard.component.ts
│   │   └── dashboard.component.spec.ts
│   ├── products/
│   │   ├── product-list.component.ts
│   │   └── product-list.component.spec.ts
│   └── orders/
│       ├── order-list.component.ts
│       └── order-list.component.spec.ts
```

### Running Unit Tests
```bash
# Watch mode (development)
ng test

# Single run (CI/CD)
ng test --watch=false --browsers=ChromeHeadless

# With coverage
ng test --code-coverage
```

### Test Categories
1. **Component Initialization**
2. **Data Binding and Display**
3. **User Interactions**
4. **Template Rendering**
5. **Filtering and Search**
6. **Responsive Design**
7. **Accessibility**

## End-to-End Tests

### Test Files Structure
```
e2e/
├── dashboard.spec.ts      # Dashboard functionality
├── navigation.spec.ts     # Navigation and routing
├── products.spec.ts       # Product management
├── orders.spec.ts         # Order management
└── customers.spec.ts      # Customer management
```

### Running E2E Tests
```bash
# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test e2e/dashboard.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific browser
npx playwright test --project=chromium

# Debug mode
npx playwright test --debug
```

### E2E Test Categories
1. **Page Navigation**
2. **User Interface Interactions**
3. **Data Display and Formatting**
4. **Form Submissions**
5. **Responsive Design**
6. **Cross-browser Compatibility**

## Continuous Integration

### GitHub Actions Example
```yaml
name: Frontend Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: cd frontend/angular-client
      - run: npm ci
      - run: npm run test:ci
      - run: npm run lint
      - run: npm run build:prod
      - run: npx playwright install
      - run: npx playwright test
```

## Common Issues and Solutions

### Chrome Headless Issues
If you encounter Chrome headless issues:
```bash
# Install Chrome dependencies (Ubuntu/Debian)
sudo apt-get install -y chromium-browser

# Or use custom launcher
npm run test:ci
```

### Playwright Browser Installation
```bash
# Install all browsers
npx playwright install

# Install specific browser
npx playwright install chromium
```

### Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm test
```

## Test Configuration

### Karma Configuration
- File: `karma.conf.js`
- Coverage thresholds: 75% statements, 70% branches
- Browsers: Chrome, ChromeHeadless
- Timeout: 60 seconds

### Playwright Configuration
- File: `playwright.config.ts`
- Browsers: Chrome, Firefox, Safari, Edge
- Mobile: iOS Safari, Android Chrome
- Timeout: 60 seconds
- Retries: 2 on CI

### ESLint Configuration
- Extends: Angular recommended rules
- TypeScript support: Enabled
- Auto-fix: Available via `npm run lint:fix`

## Writing Tests

### Unit Test Example
```typescript
describe('ComponentName', () => {
  let component: ComponentName;
  let fixture: ComponentFixture<ComponentName>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComponentName, ...materialModules]
    }).compileComponents();

    fixture = TestBed.createComponent(ComponentName);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
```

### E2E Test Example
```typescript
test('should display page title', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

## Performance Testing

### Bundle Analysis
```bash
# Generate bundle analysis
npm run analyze

# This will:
# 1. Build with stats
# 2. Open webpack-bundle-analyzer
# 3. Show bundle composition
```

### Lighthouse Testing
```bash
# Install Lighthouse
npm install -g lighthouse

# Run Lighthouse audit
lighthouse http://localhost:4200 --output html --output-path ./lighthouse-report.html
```

## Best Practices

### Unit Tests
1. Test behavior, not implementation
2. Use descriptive test names
3. Group related tests with `describe`
4. Mock external dependencies
5. Test edge cases and error conditions

### E2E Tests
1. Test user workflows end-to-end
2. Use page object model for complex pages
3. Wait for elements before interacting
4. Test responsive design
5. Verify accessibility

### General
1. Run tests frequently during development
2. Maintain high test coverage
3. Keep tests fast and reliable
4. Use consistent naming conventions
5. Document complex test scenarios

## Debugging

### Unit Test Debugging
```bash
# Debug in Chrome DevTools
ng test --source-map

# Run specific test
ng test --include="**/dashboard.component.spec.ts"
```

### E2E Test Debugging
```bash
# Debug mode with browser open
npx playwright test --debug

# Headed mode
npx playwright test --headed

# Trace viewer
npx playwright show-trace trace.zip
```

## Monitoring and Reporting

### Test Results
- Unit test results: Console output + HTML report
- E2E test results: HTML report in `playwright-report/`
- Coverage report: `coverage/angular-client/index.html`

### CI/CD Integration
- JUnit XML reports for Jenkins
- JSON reports for custom processing
- Coverage reports for SonarQube
- Screenshots on failure for debugging