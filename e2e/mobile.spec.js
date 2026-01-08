const { test, expect } = require('@playwright/test');

// Viewports
const mobile = { width: 375, height: 667 };
const desktop = { width: 1280, height: 800 };

test.describe('Mobile Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(mobile);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Foundation', () => {
    test('shows mobile layout on small screens', async ({ page }) => {
      await expect(page.locator('.mobile-content')).toBeVisible();
      await expect(page.locator('.mobile-tabs')).toBeVisible();
    });

    test('hides desktop layout on mobile', async ({ page }) => {
      await expect(page.locator('.sidebar')).not.toBeVisible();
      await expect(page.locator('.main')).not.toBeVisible();
    });

    test('has compact header', async ({ page }) => {
      const header = page.locator('header');
      const box = await header.boundingBox();
      expect(box.height).toBeLessThanOrEqual(56);
    });
  });

  test.describe('Tab Navigation', () => {
    test('has 2 tabs (Results and Settings)', async ({ page }) => {
      const tabs = page.locator('.mobile-tabs .tab-btn');
      await expect(tabs).toHaveCount(2);
    });

    test('Results tab is active by default', async ({ page }) => {
      await expect(page.locator('.tab-btn[data-tab="results"]')).toHaveClass(/active/);
      await expect(page.locator('.tab-panel[data-tab="results"]')).toBeVisible();
    });

    test('clicking Settings tab switches view', async ({ page }) => {
      await page.click('.tab-btn[data-tab="settings"]');
      await expect(page.locator('.tab-btn[data-tab="settings"]')).toHaveClass(/active/);
      await expect(page.locator('.tab-panel[data-tab="settings"]')).toBeVisible();
      await expect(page.locator('.tab-panel[data-tab="results"]')).not.toBeVisible();
    });

    test('tab state persists after reload', async ({ page }) => {
      await page.click('.tab-btn[data-tab="settings"]');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.tab-btn[data-tab="settings"]')).toHaveClass(/active/);
    });
  });

  test.describe('Results Tab', () => {
    test('shows 4 KPI boxes', async ({ page }) => {
      const kpis = page.locator('.mobile-kpi-grid .kpi-box');
      await expect(kpis).toHaveCount(4);
    });

    test('KPIs display numeric values', async ({ page }) => {
      // Wait for simulation to complete
      await page.waitForTimeout(1000);
      const reRoi = await page.locator('#mKpiReRoiVal').textContent();
      expect(reRoi).toMatch(/\d+\.?\d*%/);
    });

    test('shows both charts', async ({ page }) => {
      await expect(page.locator('.mobile-charts-stack')).toBeVisible();
      await expect(page.locator('#mWealthChart')).toBeVisible();
      await expect(page.locator('#mFlowChart')).toBeVisible();
    });

    test('shows deal summary', async ({ page }) => {
      await expect(page.locator('.mobile-deal-summary')).toBeVisible();
      await expect(page.locator('#mValAsset')).toBeVisible();
      await expect(page.locator('#mValMortgage')).toBeVisible();
    });
  });

  test.describe('Settings Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('.tab-btn[data-tab="settings"]');
    });

    test('has accordion sections', async ({ page }) => {
      await expect(page.locator('.mobile-accordion')).toBeVisible();
      const sections = page.locator('.accordion-section');
      await expect(sections).toHaveCount(5); // deal, mix, market, costs, advanced
    });

    test('Deal Structure is open by default', async ({ page }) => {
      await expect(page.locator('.accordion-section[data-section="deal"]')).toHaveClass(/open/);
    });

    test('clicking section header toggles it', async ({ page }) => {
      // Close deal section
      await page.click('.accordion-section[data-section="deal"] .accordion-header');
      await expect(page.locator('.accordion-section[data-section="deal"]')).not.toHaveClass(/open/);
      
      // Open mix section
      await page.click('.accordion-section[data-section="mix"] .accordion-header');
      await expect(page.locator('.accordion-section[data-section="mix"]')).toHaveClass(/open/);
    });

    test('has Starting Cash input', async ({ page }) => {
      await expect(page.locator('#mInpEquity')).toBeVisible();
    });

    test('has Buyer Type selector', async ({ page }) => {
      await expect(page.locator('#mBuyerType')).toBeVisible();
    });

    test('has Down Payment slider', async ({ page }) => {
      await expect(page.locator('#mRDown')).toBeVisible();
    });

    test('has Reset button in Advanced section', async ({ page }) => {
      await page.click('.accordion-section[data-section="advanced"] .accordion-header');
      await expect(page.locator('.mobile-reset-btn')).toBeVisible();
    });
  });

  test.describe('Mobile-Desktop Sync', () => {
    test('changing mobile equity updates simulation', async ({ page }) => {
      await page.click('.tab-btn[data-tab="settings"]');
      await page.fill('#mInpEquity', '500000');
      await page.waitForTimeout(500);
      
      // Switch to results and check values updated
      await page.click('.tab-btn[data-tab="results"]');
      const asset = await page.locator('#mValAsset').textContent();
      expect(asset).not.toBe('₪0');
    });
  });
});

test.describe('Desktop Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(desktop);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('shows desktop layout on large screens', async ({ page }) => {
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.main')).toBeVisible();
  });

  test('hides mobile layout on desktop', async ({ page }) => {
    await expect(page.locator('.mobile-content')).not.toBeVisible();
    await expect(page.locator('.mobile-tabs')).not.toBeVisible();
  });

  test('shows KPI grid', async ({ page }) => {
    await expect(page.locator('.kpi-grid')).toBeVisible();
  });

  test('shows charts', async ({ page }) => {
    await expect(page.locator('#wealthChart')).toBeVisible();
    await expect(page.locator('#flowChart')).toBeVisible();
  });
});

test.describe('Responsive Breakpoint', () => {
  test('switches to mobile at 768px', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 800 });
    await page.goto('/');
    await expect(page.locator('.mobile-content')).toBeVisible();
  });

  test('stays desktop at 769px', async ({ page }) => {
    await page.setViewportSize({ width: 769, height: 800 });
    await page.goto('/');
    await expect(page.locator('.sidebar')).toBeVisible();
  });
});
