const { test, expect } = require('@playwright/test');

test.describe('Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Initial Load', () => {
    test('page loads within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('KPIs render after load', async ({ page }) => {
      await page.waitForTimeout(1000);
      const kpi = page.locator('#kRE');
      await expect(kpi).toBeVisible();
      const text = await kpi.textContent();
      expect(text).toBeTruthy();
    });

    test('charts render after load', async ({ page }) => {
      await page.waitForTimeout(1500);
      const chart = page.locator('#wealthChart');
      await expect(chart).toBeVisible();
    });
  });

  test.describe('Interaction Response', () => {
    test('slider change updates display quickly', async ({ page }) => {
      const slider = page.locator('#rDown');
      const display = page.locator('#dDown');
      
      const startTime = Date.now();
      await slider.fill('60');
      await page.waitForTimeout(100);
      const responseTime = Date.now() - startTime;
      
      // Display should update within 500ms
      expect(responseTime).toBeLessThan(500);
      const text = await display.textContent();
      expect(text).toContain('60');
    });

    test('scenario button responds quickly', async ({ page }) => {
      const startTime = Date.now();
      await page.click('#scenBull');
      await page.waitForTimeout(100);
      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(500);
      await expect(page.locator('#scenBull')).toHaveClass(/active/);
    });
  });

  test.describe('Memory & Resources', () => {
    test('no console errors on load', async ({ page }) => {
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      // Filter out expected errors (like favicon)
      const realErrors = errors.filter(e => !e.includes('favicon'));
      expect(realErrors.length).toBe(0);
    });

    test('multiple slider changes do not cause errors', async ({ page }) => {
      const errors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      
      const slider = page.locator('#rDown');
      
      // Rapidly change slider
      for (let i = 30; i <= 60; i += 5) {
        await slider.fill(String(i));
        await page.waitForTimeout(50);
      }
      
      await page.waitForTimeout(500);
      expect(errors.length).toBe(0);
    });
  });
});

test.describe('Mobile Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('mobile layout loads quickly', async ({ page }) => {
    await expect(page.locator('.mobile-content')).toBeVisible();
  });

  test('tab switching is instant', async ({ page }) => {
    const startTime = Date.now();
    await page.click('.tab-btn[data-tab="settings"]');
    await expect(page.locator('.tab-panel[data-tab="settings"]')).toBeVisible();
    const switchTime = Date.now() - startTime;
    
    expect(switchTime).toBeLessThan(300);
  });

  test('accordion toggle is responsive', async ({ page }) => {
    await page.click('.tab-btn[data-tab="settings"]');
    
    const startTime = Date.now();
    await page.click('.accordion-section[data-section="mix"] .accordion-header');
    await expect(page.locator('.accordion-section[data-section="mix"]')).toHaveClass(/open/);
    const toggleTime = Date.now() - startTime;
    
    expect(toggleTime).toBeLessThan(300);
  });
});
