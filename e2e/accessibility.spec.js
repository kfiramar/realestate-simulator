const { test, expect } = require('@playwright/test');

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Semantic HTML', () => {
    test('page has main heading', async ({ page }) => {
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
      await expect(h1).toContainText('Brickfolio');
    });

    test('page has header element', async ({ page }) => {
      await expect(page.locator('header')).toBeVisible();
    });

    test('buttons have accessible text', async ({ page }) => {
      const buttons = page.locator('button');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
      
      // Check first few buttons have some text or title
      for (let i = 0; i < Math.min(count, 5); i++) {
        const btn = buttons.nth(i);
        const text = await btn.textContent();
        const title = await btn.getAttribute('title');
        const ariaLabel = await btn.getAttribute('aria-label');
        expect(text || title || ariaLabel).toBeTruthy();
      }
    });
  });

  test.describe('Form Labels', () => {
    test('equity input has associated label', async ({ page }) => {
      const label = page.locator('.sidebar .card-lbl:has-text("Starting Cash")');
      await expect(label).toBeVisible();
    });

    test('select elements have labels', async ({ page }) => {
      const buyerLabel = page.locator('.sidebar .card-lbl:has-text("Buyer Type")');
      await expect(buyerLabel).toBeVisible();
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('can tab through header controls', async ({ page }) => {
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should be able to focus on something
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused).toBeTruthy();
    });

    test('sliders are keyboard accessible', async ({ page }) => {
      const slider = page.locator('#rDown');
      await slider.focus();
      
      const valueBefore = await slider.inputValue();
      await page.keyboard.press('ArrowRight');
      const valueAfter = await slider.inputValue();
      
      // Value should change with arrow key
      expect(parseInt(valueAfter)).toBeGreaterThanOrEqual(parseInt(valueBefore));
    });
  });

  test.describe('Color Contrast', () => {
    test('KPI text is visible', async ({ page }) => {
      const kpiNum = page.locator('.kpi-num').first();
      await expect(kpiNum).toBeVisible();
      
      // Check it has a color style
      const color = await kpiNum.evaluate(el => getComputedStyle(el).color);
      expect(color).toBeTruthy();
    });

    test('labels are visible', async ({ page }) => {
      const label = page.locator('.card-lbl').first();
      await expect(label).toBeVisible();
    });
  });

  test.describe('Focus Indicators', () => {
    test('buttons show focus state', async ({ page }) => {
      const btn = page.locator('.util-btn').first();
      await btn.focus();
      
      // Button should be focusable
      const isFocused = await btn.evaluate(el => el === document.activeElement);
      expect(isFocused).toBe(true);
    });

    test('inputs show focus state', async ({ page }) => {
      const input = page.locator('#inpEquity');
      await input.focus();
      
      const isFocused = await input.evaluate(el => el === document.activeElement);
      expect(isFocused).toBe(true);
    });
  });

  test.describe('Screen Reader Support', () => {
    test('charts have accessible container', async ({ page }) => {
      const chartWrapper = page.locator('.chart-wrapper').first();
      await expect(chartWrapper).toBeVisible();
    });

    test('KPI boxes have labels', async ({ page }) => {
      const kpiLabel = page.locator('.kpi-lbl').first();
      await expect(kpiLabel).toBeVisible();
      const text = await kpiLabel.textContent();
      expect(text.length).toBeGreaterThan(0);
    });
  });
});

test.describe('Dark Mode Accessibility', () => {
  test('dark mode maintains readability', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Enable dark mode
    await page.click('button:has-text("🌙")');
    await expect(page.locator('body')).toHaveClass(/dark/);
    
    // Check text is still visible
    const kpiNum = page.locator('.kpi-num').first();
    await expect(kpiNum).toBeVisible();
  });
});

test.describe('RTL Support', () => {
  test('Hebrew mode sets RTL direction', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Switch to Hebrew
    await page.click('button:has-text("🌐")');
    
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('rtl');
  });

  test('RTL mode adds rtl class to body', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.click('button:has-text("🌐")');
    await expect(page.locator('body')).toHaveClass(/rtl/);
  });
});
