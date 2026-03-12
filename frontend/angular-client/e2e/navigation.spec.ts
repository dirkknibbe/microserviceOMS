import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should redirect to dashboard by default', async ({ page }) => {
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should display main navigation sidebar', async ({ page }) => {
    const sidebar = page.locator('mat-sidenav');
    await expect(sidebar).toBeVisible();
    
    // Check navigation items
    await expect(page.locator('a[routerLink="/dashboard"]')).toContainText('Dashboard');
    await expect(page.locator('a[routerLink="/orders"]')).toContainText('Orders');
    await expect(page.locator('a[routerLink="/products"]')).toContainText('Products');
    await expect(page.locator('a[routerLink="/customers"]')).toContainText('Customers');
  });

  test('should display main toolbar', async ({ page }) => {
    const toolbar = page.locator('mat-toolbar.main-toolbar');
    await expect(toolbar).toBeVisible();
    await expect(toolbar).toContainText('E-Commerce Order Management System');
    
    // Check toolbar buttons
    await expect(page.locator('button[mat-icon-button]:has(mat-icon:text("notifications"))')).toBeVisible();
    await expect(page.locator('button[mat-icon-button]:has(mat-icon:text("account_circle"))')).toBeVisible();
  });

  test('should navigate to different pages via sidebar', async ({ page }) => {
    // Navigate to Dashboard
    await page.click('a[routerLink="/dashboard"]');
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('h1')).toContainText('Dashboard Overview');

    // Navigate to Orders
    await page.click('a[routerLink="/orders"]');
    await expect(page).toHaveURL(/.*orders/);
    await expect(page.locator('h1')).toContainText('Order Management');

    // Navigate to Products
    await page.click('a[routerLink="/products"]');
    await expect(page).toHaveURL(/.*products/);
    await expect(page.locator('h1')).toContainText('Product Catalog');

    // Navigate to Customers
    await page.click('a[routerLink="/customers"]');
    await expect(page).toHaveURL(/.*customers/);
    await expect(page.locator('h1')).toContainText('Customer Management');
  });

  test('should highlight active navigation item', async ({ page }) => {
    // Navigate to Orders and check if it's highlighted
    await page.click('a[routerLink="/orders"]');
    await expect(page.locator('a[routerLink="/orders"]')).toHaveClass(/active/);
    
    // Navigate to Products and check if it's highlighted
    await page.click('a[routerLink="/products"]');
    await expect(page.locator('a[routerLink="/products"]')).toHaveClass(/active/);
  });

  test('should display navigation icons', async ({ page }) => {
    // Check navigation icons
    await expect(page.locator('a[routerLink="/dashboard"] mat-icon')).toContainText('dashboard');
    await expect(page.locator('a[routerLink="/orders"] mat-icon')).toContainText('shopping_cart');
    await expect(page.locator('a[routerLink="/products"] mat-icon')).toContainText('inventory');
    await expect(page.locator('a[routerLink="/customers"] mat-icon')).toContainText('people');
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Navigation should still be visible and functional
    await expect(page.locator('mat-sidenav')).toBeVisible();
    await expect(page.locator('mat-toolbar')).toBeVisible();
    
    // Navigation items should still work
    await page.click('a[routerLink="/products"]');
    await expect(page).toHaveURL(/.*products/);
  });

  test('should maintain navigation state across page reloads', async ({ page }) => {
    // Navigate to orders page
    await page.click('a[routerLink="/orders"]');
    await expect(page).toHaveURL(/.*orders/);
    
    // Reload the page
    await page.reload();
    
    // Should still be on orders page with navigation working
    await expect(page).toHaveURL(/.*orders/);
    await expect(page.locator('h1')).toContainText('Order Management');
    await expect(page.locator('a[routerLink="/orders"]')).toHaveClass(/active/);
  });

  test('should display brand name in sidebar', async ({ page }) => {
    const sidebarTitle = page.locator('mat-sidenav mat-toolbar');
    await expect(sidebarTitle).toContainText('OMS Admin');
  });

  test('should handle deep linking correctly', async ({ page }) => {
    // Direct navigation to products page
    await page.goto('/products');
    await expect(page).toHaveURL(/.*products/);
    await expect(page.locator('h1')).toContainText('Product Catalog');
    await expect(page.locator('a[routerLink="/products"]')).toHaveClass(/active/);
    
    // Direct navigation to customers page
    await page.goto('/customers');
    await expect(page).toHaveURL(/.*customers/);
    await expect(page.locator('h1')).toContainText('Customer Management');
    await expect(page.locator('a[routerLink="/customers"]')).toHaveClass(/active/);
  });
});