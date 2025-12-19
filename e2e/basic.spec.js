const { test, expect } = require('@playwright/test');

test.describe('Mortgage Calculator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads homepage', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Brickfolio');
  });

  test('displays KPI values', async ({ page }) => {
    await expect(page.locator('#kRE')).toBeVisible();
    await expect(page.locator('#kSP')).toBeVisible();
  });

  test('mix sliders exist and have values', async ({ page }) => {
    await expect(page.locator('#sliderPrime')).toBeVisible();
    await expect(page.locator('#dispPrime')).toContainText('%');
  });

  test('language toggle works', async ({ page }) => {
    await page.click('button:has-text("🌐")');
    await expect(page.locator('body')).toHaveClass(/rtl/);
  });

  test('dark mode toggle works', async ({ page }) => {
    await page.click('button:has-text("🌙")');
    await expect(page.locator('body')).toHaveClass(/dark/);
  });

  test('charts render', async ({ page }) => {
    await expect(page.locator('#wealthChart')).toBeVisible();
    await expect(page.locator('#flowChart')).toBeVisible();
  });
});
