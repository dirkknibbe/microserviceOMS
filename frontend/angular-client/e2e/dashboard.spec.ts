import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('should display dashboard title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Dashboard Overview');
  });

  test('should display metrics cards', async ({ page }) => {
    const metricCards = page.locator('.metric-card');
    await expect(metricCards).toHaveCount(4);
    
    // Check if all metric cards have values
    const metricValues = page.locator('.metric-value');
    await expect(metricValues).toHaveCount(4);
    
    for (let i = 0; i < 4; i++) {
      await expect(metricValues.nth(i)).not.toBeEmpty();
    }
  });

  test('should display recent orders table', async ({ page }) => {
    const ordersTable = page.locator('.orders-table');
    await expect(ordersTable).toBeVisible();
    
    // Check table headers
    await expect(page.locator('th')).toContainText(['Order ID', 'Customer', 'Status', 'Total', 'Date']);
    
    // Check if there are order rows
    const orderRows = page.locator('mat-row');
    await expect(orderRows).toHaveCount(5); // Based on sample data
  });

  test('should display quick actions', async ({ page }) => {
    const actionsCard = page.locator('.actions-card');
    await expect(actionsCard).toBeVisible();
    
    // Check action buttons
    await expect(page.locator('button:has-text("New Order")')).toBeVisible();
    await expect(page.locator('button:has-text("Manage Products")')).toBeVisible();
    await expect(page.locator('button:has-text("View Customers")')).toBeVisible();
    await expect(page.locator('button:has-text("Generate Report")')).toBeVisible();
  });

  test('should display system status', async ({ page }) => {
    const systemStatusCard = page.locator('.system-status-card');
    await expect(systemStatusCard).toBeVisible();
    
    // Check if all services are shown as online
    const onlineServices = page.locator('.status-icon.online');
    await expect(onlineServices).toHaveCount(6);
  });

  test('should navigate to orders page when clicking New Order', async ({ page }) => {
    await page.click('button:has-text("New Order")');
    await expect(page).toHaveURL(/.*orders/);
  });

  test('should navigate to products page when clicking Manage Products', async ({ page }) => {
    await page.click('button:has-text("Manage Products")');
    await expect(page).toHaveURL(/.*products/);
  });

  test('should navigate to customers page when clicking View Customers', async ({ page }) => {
    await page.click('button:has-text("View Customers")');
    await expect(page).toHaveURL(/.*customers/);
  });

  test('should display status chips with correct colors', async ({ page }) => {
    const statusChips = page.locator('mat-chip');
    await expect(statusChips).toHaveCount(5); // Based on sample orders
    
    // Check if status chips have appropriate classes
    const shippedChip = page.locator('mat-chip.status-shipped');
    await expect(shippedChip).toBeVisible();
    
    const confirmedChip = page.locator('mat-chip.status-confirmed');
    await expect(confirmedChip).toBeVisible();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check if dashboard still displays correctly
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.metric-card')).toHaveCount(4);
    
    // Check if metrics are stacked vertically on mobile
    const metricsGrid = page.locator('.metrics-grid');
    await expect(metricsGrid).toBeVisible();
  });

  test('should format currency values correctly', async ({ page }) => {
    const currencyElements = page.locator('text=/\\$[\\d,]+\\.\\d{2}/');
    await expect(currencyElements.first()).toBeVisible();
    
    // Check specific metric value format
    const revenueMetric = page.locator('.metric-card').filter({ hasText: 'Revenue' });
    await expect(revenueMetric.locator('.metric-value')).toContainText('$');
  });

  test('should display trend indicators', async ({ page }) => {
    const trendIndicators = page.locator('.metric-trend');
    await expect(trendIndicators).toHaveCount(4);
    
    // Check if trends show percentage
    for (let i = 0; i < 4; i++) {
      await expect(trendIndicators.nth(i)).toContainText('%');
    }
  });
});