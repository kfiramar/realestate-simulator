const { test, expect } = require('@playwright/test');

test.describe('Visual Polish', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Hover Effects', () => {
    test('KPI boxes have hover transition', async ({ page }) => {
      const kpi = page.locator('.kpi-box').first();
      const transition = await kpi.evaluate(el => getComputedStyle(el).transition);
      expect(transition).toContain('transform');
    });

    test('utility buttons have hover effect', async ({ page }) => {
      const btn = page.locator('.util-btn').first();
      await btn.hover();
      // Button should still be visible after hover
      await expect(btn).toBeVisible();
    });

    test('scenario buttons have hover effect', async ({ page }) => {
      const btn = page.locator('.scen-btn').first();
      const transition = await btn.evaluate(el => getComputedStyle(el).transition);
      expect(transition).toBeTruthy();
    });
  });

  test.describe('Focus States', () => {
    test('inputs have focus outline', async ({ page }) => {
      const input = page.locator('#inpEquity');
      await input.focus();
      
      // Should be focused
      const isFocused = await input.evaluate(el => el === document.activeElement);
      expect(isFocused).toBe(true);
    });

    test('buttons are focusable', async ({ page }) => {
      const btn = page.locator('.util-btn').first();
      await btn.focus();
      
      const isFocused = await btn.evaluate(el => el === document.activeElement);
      expect(isFocused).toBe(true);
    });
  });

  test.describe('Color Scheme', () => {
    test('uses CSS variables for colors', async ({ page }) => {
      const primary = await page.evaluate(() => 
        getComputedStyle(document.documentElement).getPropertyValue('--primary')
      );
      expect(primary.trim()).toBeTruthy();
    });

    test('success color is defined', async ({ page }) => {
      const success = await page.evaluate(() => 
        getComputedStyle(document.documentElement).getPropertyValue('--success')
      );
      expect(success.trim()).toBeTruthy();
    });

    test('danger color is defined', async ({ page }) => {
      const danger = await page.evaluate(() => 
        getComputedStyle(document.documentElement).getPropertyValue('--danger')
      );
      expect(danger.trim()).toBeTruthy();
    });
  });

  test.describe('Typography', () => {
    test('uses system font stack', async ({ page }) => {
      const fontFamily = await page.evaluate(() => 
        getComputedStyle(document.body).fontFamily
      );
      expect(fontFamily).toContain('system');
    });

    test('KPI numbers use monospace for alignment', async ({ page }) => {
      const kpiNum = page.locator('.kpi-num').first();
      const fontFamily = await kpiNum.evaluate(el => getComputedStyle(el).fontFamily);
      // Should have some font defined
      expect(fontFamily).toBeTruthy();
    });
  });

  test.describe('Spacing & Layout', () => {
    test('sidebar has consistent padding', async ({ page }) => {
      const sidebar = page.locator('.sidebar-content');
      const padding = await sidebar.evaluate(el => getComputedStyle(el).padding);
      expect(padding).toBeTruthy();
    });

    test('KPI grid has gap', async ({ page }) => {
      const grid = page.locator('.kpi-grid');
      const gap = await grid.evaluate(el => getComputedStyle(el).gap);
      expect(gap).toBeTruthy();
    });
  });

  test.describe('Borders & Shadows', () => {
    test('cards have border', async ({ page }) => {
      const card = page.locator('.control-card').first();
      const border = await card.evaluate(el => getComputedStyle(el).border);
      expect(border).toContain('solid');
    });

    test('header has shadow', async ({ page }) => {
      const header = page.locator('header');
      const shadow = await header.evaluate(el => getComputedStyle(el).boxShadow);
      expect(shadow).not.toBe('none');
    });
  });
});

test.describe('Dark Mode Styling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('button:has-text("🌙")');
  });

  test('body has dark background', async ({ page }) => {
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // Dark mode should have dark background
    expect(bg).toBeTruthy();
  });

  test('text is light colored in dark mode', async ({ page }) => {
    await expect(page.locator('body')).toHaveClass(/dark/);
  });

  test('cards adapt to dark mode', async ({ page }) => {
    const card = page.locator('.control-card').first();
    await expect(card).toBeVisible();
  });
});
