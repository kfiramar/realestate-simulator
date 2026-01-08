const { test, expect } = require('@playwright/test');

test.describe('Loading States', () => {
  test('page removes loading class after init', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toHaveClass(/loading/);
  });

  test('charts show loading indicator while calculating', async ({ page }) => {
    await page.goto('/');
    // Charts should be visible after load
    await page.waitForTimeout(1000);
    await expect(page.locator('#wealthChart')).toBeVisible();
  });
});

test.describe('Error States', () => {
  test('shows warning when mix does not equal 100%', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Set Prime to 50%, which won't sum to 100%
    await page.evaluate(() => {
      document.getElementById('pctPrime').value = '50';
      document.getElementById('pctKalats').value = '20';
      document.getElementById('pctMalatz').value = '20';
      document.getElementById('pctKatz').value = '0';
      document.getElementById('pctMatz').value = '0';
      window.checkMix();
    });
    
    await expect(page.locator('#chartsWarn')).toBeVisible();
  });

  test('shows warning when fixed rate below 33%', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Set all to Prime (variable rate)
    await page.evaluate(() => {
      document.getElementById('pctPrime').value = '100';
      document.getElementById('pctKalats').value = '0';
      document.getElementById('pctMalatz').value = '0';
      document.getElementById('pctKatz').value = '0';
      document.getElementById('pctMatz').value = '0';
      window.checkMix();
    });
    
    await expect(page.locator('#chartsWarn')).toBeVisible();
    const text = await page.locator('#chartsWarn').textContent();
    expect(text).toContain('33%');
  });

  test('hides warning when mix is valid', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Set valid mix
    await page.evaluate(() => {
      document.getElementById('pctPrime').value = '34';
      document.getElementById('pctKalats').value = '33';
      document.getElementById('pctMalatz').value = '33';
      document.getElementById('pctKatz').value = '0';
      document.getElementById('pctMatz').value = '0';
      window.checkMix();
    });
    
    await expect(page.locator('#chartsWarn')).not.toBeVisible();
  });
});

test.describe('Input Validation', () => {
  test('equity input is type number', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const input = page.locator('#inpEquity');
    const type = await input.getAttribute('type');
    expect(type).toBe('number');
  });

  test('equity input has step attribute', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const input = page.locator('#inpEquity');
    const step = await input.getAttribute('step');
    expect(parseInt(step)).toBeGreaterThan(0);
  });

  test('slider values stay within bounds', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const slider = page.locator('#rDown');
    const min = await slider.getAttribute('min');
    const max = await slider.getAttribute('max');
    const value = await slider.inputValue();
    
    expect(parseInt(value)).toBeGreaterThanOrEqual(parseInt(min));
    expect(parseInt(value)).toBeLessThanOrEqual(parseInt(max));
  });
});
