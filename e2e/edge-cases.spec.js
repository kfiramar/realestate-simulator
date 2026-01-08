const { test, expect } = require('@playwright/test');

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Extreme Values', () => {
    test('handles very large equity', async ({ page }) => {
      await page.fill('#inpEquity', '10000000');
      await page.waitForTimeout(500);
      
      // Should not crash, KPIs should update
      const kpi = page.locator('#kRE');
      await expect(kpi).toBeVisible();
    });

    test('handles minimum equity', async ({ page }) => {
      await page.fill('#inpEquity', '100000');
      await page.waitForTimeout(500);
      
      const kpi = page.locator('#kRE');
      await expect(kpi).toBeVisible();
    });

    test('handles 100% down payment', async ({ page }) => {
      await page.locator('#rDown').fill('100');
      await page.waitForTimeout(500);
      
      // Should handle gracefully
      const kpi = page.locator('#kRE');
      await expect(kpi).toBeVisible();
    });

    test('handles minimum term (1 year)', async ({ page }) => {
      await page.locator('#rDur').fill('1');
      await page.waitForTimeout(500);
      
      const display = page.locator('#dDur');
      const text = await display.textContent();
      expect(text).toContain('1');
    });

    test('handles maximum term (30 years)', async ({ page }) => {
      await page.locator('#rDur').fill('30');
      await page.waitForTimeout(500);
      
      const display = page.locator('#dDur');
      const text = await display.textContent();
      expect(text).toContain('30');
    });
  });

  test.describe('Invalid Mix Combinations', () => {
    test('shows warning for 0% total mix', async ({ page }) => {
      await page.evaluate(() => {
        ['Prime', 'Kalats', 'Malatz', 'Katz', 'Matz'].forEach(t => {
          document.getElementById('pct' + t).value = '0';
        });
        window.checkMix();
      });
      
      await expect(page.locator('#chartsWarn')).toBeVisible();
    });

    test('shows warning for over 100% mix', async ({ page }) => {
      await page.evaluate(() => {
        document.getElementById('pctPrime').value = '60';
        document.getElementById('pctKalats').value = '60';
        document.getElementById('pctMalatz').value = '0';
        document.getElementById('pctKatz').value = '0';
        document.getElementById('pctMatz').value = '0';
        window.checkMix();
      });
      
      await expect(page.locator('#chartsWarn')).toBeVisible();
    });
  });

  test.describe('Rapid Interactions', () => {
    test('handles rapid slider changes', async ({ page }) => {
      const slider = page.locator('#rDown');
      
      // Rapidly change values
      for (let i = 0; i < 10; i++) {
        await slider.fill(String(30 + i * 5));
      }
      
      await page.waitForTimeout(500);
      
      // Should still be functional
      const kpi = page.locator('#kRE');
      await expect(kpi).toBeVisible();
    });

    test('handles rapid tab switching on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Rapidly switch tabs
      for (let i = 0; i < 5; i++) {
        await page.click('.tab-btn[data-tab="settings"]');
        await page.click('.tab-btn[data-tab="results"]');
      }
      
      // Should still be functional
      await expect(page.locator('.mobile-content')).toBeVisible();
    });
  });

  test.describe('State Recovery', () => {
    test('recovers from invalid localStorage', async ({ page }) => {
      // Set invalid state
      await page.evaluate(() => {
        localStorage.setItem('mortgageCalcState', 'invalid json');
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should still load
      await expect(page.locator('.kpi-grid')).toBeVisible();
    });

    test('handles missing localStorage gracefully', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.clear();
      });
      
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should load with defaults
      await expect(page.locator('.kpi-grid')).toBeVisible();
    });
  });

  test.describe('Browser Features', () => {
    test('works with JavaScript enabled', async ({ page }) => {
      await expect(page.locator('.kpi-grid')).toBeVisible();
    });

    test('handles window resize', async ({ page }) => {
      // Start desktop
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(page.locator('.sidebar')).toBeVisible();
      
      // Resize to mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(200);
      await expect(page.locator('.mobile-content')).toBeVisible();
      
      // Resize back to desktop
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(200);
      await expect(page.locator('.sidebar')).toBeVisible();
    });
  });
});

test.describe('Accessibility Edge Cases', () => {
  test('handles keyboard-only navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Tab through the page
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
    }
    
    // Should have focused something
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeTruthy();
  });

  test('escape key does not break anything', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    
    // Page should still be functional
    await expect(page.locator('.kpi-grid')).toBeVisible();
  });
});
