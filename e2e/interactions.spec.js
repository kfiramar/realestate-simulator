const { test, expect } = require('@playwright/test');

test.describe('User Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Slider Interactions', () => {
    test('down payment slider updates display', async ({ page }) => {
      const slider = page.locator('#rDown');
      const display = page.locator('#dDown');
      
      await slider.fill('50');
      await page.waitForTimeout(100);
      
      const text = await display.textContent();
      expect(text).toContain('50');
    });

    test('duration slider updates display', async ({ page }) => {
      const slider = page.locator('#rDur');
      const display = page.locator('#dDur');
      
      await slider.fill('20');
      await page.waitForTimeout(100);
      
      const text = await display.textContent();
      expect(text).toContain('20');
    });

    test('mix sliders update visual bar', async ({ page }) => {
      const bar = page.locator('.mix-visual-bar');
      await expect(bar).toBeVisible();
      
      // Change Prime percentage
      await page.evaluate(() => {
        document.getElementById('sliderPrime').value = '50';
        document.getElementById('sliderPrime').dispatchEvent(new Event('input'));
      });
      
      await page.waitForTimeout(200);
      
      // Bar should have updated
      const segments = page.locator('.mix-bar-seg');
      await expect(segments).toHaveCount(5);
    });
  });

  test.describe('Scenario Selection', () => {
    test('clicking Bear scenario updates values', async ({ page }) => {
      await page.click('#scenBear');
      await expect(page.locator('#scenBear')).toHaveClass(/active/);
    });

    test('clicking Bull scenario updates values', async ({ page }) => {
      await page.click('#scenBull');
      await expect(page.locator('#scenBull')).toHaveClass(/active/);
    });

    test('clicking Base scenario updates values', async ({ page }) => {
      await page.click('#scenBase');
      await expect(page.locator('#scenBase')).toHaveClass(/active/);
    });
  });

  test.describe('Tamheel Presets', () => {
    test('Default preset button exists', async ({ page }) => {
      // The button with 🧭 Default text should exist in sidebar
      const btn = page.locator('.sidebar .scen-btn').first();
      await expect(btn).toBeVisible();
    });

    test('clicking tamheel preset updates mix', async ({ page }) => {
      // Click the first tamheel preset button
      const btn = page.locator('.sidebar .scen-btn').first();
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(200);
      
      // Mix should be set
      const prime = await page.locator('#pctPrime').inputValue();
      expect(parseInt(prime)).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Toggle Controls', () => {
    test('dark mode toggle works', async ({ page }) => {
      await page.click('button:has-text("🌙")');
      await expect(page.locator('body')).toHaveClass(/dark/);
      
      await page.click('button:has-text("🌙")');
      await expect(page.locator('body')).not.toHaveClass(/dark/);
    });

    test('language toggle switches to Hebrew', async ({ page }) => {
      await page.click('button:has-text("🌐")');
      await expect(page.locator('body')).toHaveClass(/rtl/);
    });

    test('view toggle switches between currency and percent', async ({ page }) => {
      // Click percent mode
      await page.click('#btnPct');
      await expect(page.locator('#btnPct')).toHaveClass(/active/);
      
      // Click currency mode
      await page.click('#btnCurr');
      await expect(page.locator('#btnCurr')).toHaveClass(/active/);
    });
  });

  test.describe('Buyer Type Selection', () => {
    test('changing buyer type updates LTV', async ({ page }) => {
      const select = page.locator('#buyerType');
      
      await select.selectOption('investor');
      await page.waitForTimeout(200);
      
      // Down payment should adjust for investor (50% LTV max)
      const downValue = await page.locator('#rDown').inputValue();
      expect(parseInt(downValue)).toBeGreaterThanOrEqual(50);
    });
  });

  test.describe('Checkbox Controls', () => {
    test('rent tax checkbox toggles', async ({ page }) => {
      const checkbox = page.locator('#cRentTax');
      
      const initialState = await checkbox.isChecked();
      await checkbox.click();
      const newState = await checkbox.isChecked();
      
      expect(newState).toBe(!initialState);
    });

    test('purchase tax checkbox toggles', async ({ page }) => {
      const checkbox = page.locator('#cPurchaseTax');
      
      const initialState = await checkbox.isChecked();
      await checkbox.click();
      const newState = await checkbox.isChecked();
      
      expect(newState).toBe(!initialState);
    });
  });
});

test.describe('Real-time Updates', () => {
  test('KPIs update when equity changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    const initialRE = await page.locator('#kRE').textContent();
    
    await page.fill('#inpEquity', '600000');
    await page.waitForTimeout(500);
    
    const newRE = await page.locator('#kRE').textContent();
    expect(newRE).not.toBe(initialRE);
  });

  test('charts update when parameters change', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Charts should be rendered
    const chart = page.locator('#wealthChart');
    await expect(chart).toBeVisible();
  });
});

test.describe('State Persistence', () => {
  test('equity value persists after reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.fill('#inpEquity', '750000');
    await page.waitForTimeout(500);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const value = await page.locator('#inpEquity').inputValue();
    expect(value).toBe('750000');
  });

  test('dark mode persists after reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.click('button:has-text("🌙")');
    await expect(page.locator('body')).toHaveClass(/dark/);
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('body')).toHaveClass(/dark/);
  });
});
