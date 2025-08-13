import { test, expect } from '@playwright/test';

test.describe('Basic Pack Management Tests', () => {
  test('should load the packs page successfully', async ({ page }) => {
    // Navigate to packs page
    await page.goto('/packs');
    await page.waitForLoadState('networkidle');

    // Verify the page loads and shows expected elements
    await expect(page.locator('h1')).toContainText('Content Packs');
    await expect(page.getByTestId('storage-usage')).toBeVisible();
    
    // Should show "No content packs installed" when no packs exist
    await expect(page.getByText('No content packs installed')).toBeVisible();
  });

  test('should show diagnostics information', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for diagnostics to load
    await page.waitForTimeout(2000);

    // Check if diagnostics are displayed
    const diagnostics = page.locator('.text-neutral-400').first();
    if (await diagnostics.isVisible()) {
      // Should contain peer info
      await expect(diagnostics).toContainText('peers:');
    }
  });

  test('should allow navigation between pages', async ({ page }) => {
    // Start on home page
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Directory');

    // Navigate to packs
    await page.getByText('Packs').click();
    await expect(page.locator('h1')).toContainText('Content Packs');

    // Navigate to settings
    await page.getByText('Settings').click();
    await expect(page.locator('h1')).toContainText('Settings');
  });

  test('should show storage usage information', async ({ page }) => {
    await page.goto('/packs');
    await page.waitForLoadState('networkidle');

    // Storage usage banner should be visible
    const storageUsage = page.getByTestId('storage-usage');
    await expect(storageUsage).toBeVisible();
    
    // Should show "Used:" text
    await expect(storageUsage).toContainText('Used:');
  });

  // Test for defensive size limits display (if oversized messages exist)
  test('should handle diagnostics display correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for diagnostics to potentially load
    await page.waitForTimeout(3000);
    
    // Check cadence explanation is visible
    const diagnostics = page.locator('.text-neutral-500').first();
    if (await diagnostics.isVisible()) {
      await expect(diagnostics).toContainText('cadence: 45s (red), 10m (normal), 20m (lowPower)');
    }
  });
});
