const { test, expect } = require('@playwright/test');

// Mobile viewport
const mobile = { width: 375, height: 667 }; // iPhone SE

test.describe('Mobile Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(mobile);
    await page.goto('/');
  });

  // Phase 1: Foundation
  test.describe('Phase 1 - Foundation', () => {
    test('body has is-mobile class on mobile viewport', async ({ page }) => {
      await expect(page.locator('body')).toHaveClass(/is-mobile/);
    });

    test('sidebar is hidden on mobile', async ({ page }) => {
      await expect(page.locator('.sidebar')).not.toBeVisible();
    });

    test('desktop main content is hidden on mobile', async ({ page }) => {
      await expect(page.locator('.main')).not.toBeVisible();
    });
  });

  // Phase 2: Tab Navigation
  test.describe('Phase 2 - Tab Navigation', () => {
    test('mobile tab bar is visible', async ({ page }) => {
      await expect(page.locator('.mobile-tabs')).toBeVisible();
    });

    test('has 4 tabs', async ({ page }) => {
      const tabs = page.locator('.mobile-tabs .tab-btn');
      await expect(tabs).toHaveCount(4);
    });

    test('Results tab is active by default', async ({ page }) => {
      await expect(page.locator('.tab-btn[data-tab="results"]')).toHaveClass(/active/);
    });

    test('clicking Settings tab shows settings panel', async ({ page }) => {
      await page.click('.tab-btn[data-tab="settings"]');
      await expect(page.locator('.tab-panel[data-tab="settings"]')).toBeVisible();
      await expect(page.locator('.tab-panel[data-tab="results"]')).not.toBeVisible();
    });

    test('clicking Charts tab shows charts panel', async ({ page }) => {
      await page.click('.tab-btn[data-tab="charts"]');
      await expect(page.locator('.tab-panel[data-tab="charts"]')).toBeVisible();
    });

    test('clicking More tab shows more panel', async ({ page }) => {
      await page.click('.tab-btn[data-tab="more"]');
      await expect(page.locator('.tab-panel[data-tab="more"]')).toBeVisible();
    });
  });

  // Phase 3: Results Tab
  test.describe('Phase 3 - Results Tab', () => {
    test('shows 4 primary KPIs', async ({ page }) => {
      const kpis = page.locator('.mobile-kpi-grid .kpi-box');
      await expect(kpis).toHaveCount(4);
    });

    test('shows RE ROI KPI', async ({ page }) => {
      await expect(page.locator('.mobile-kpi-grid #mKpiReRoi')).toBeVisible();
    });

    test('shows deal summary', async ({ page }) => {
      await expect(page.locator('.mobile-deal-summary')).toBeVisible();
    });

    test('has expandable "More details" section', async ({ page }) => {
      const moreBtn = page.locator('.mobile-more-kpis-btn');
      await expect(moreBtn).toBeVisible();
      await moreBtn.click();
      await expect(page.locator('.mobile-secondary-kpis')).toBeVisible();
    });
  });

  // Phase 4: Settings Tab
  test.describe('Phase 4 - Settings Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('.tab-btn[data-tab="settings"]');
    });

    test('has accordion sections', async ({ page }) => {
      await expect(page.locator('.mobile-accordion')).toBeVisible();
    });

    test('Deal Structure section is open by default', async ({ page }) => {
      await expect(page.locator('.accordion-section[data-section="deal"]')).toHaveClass(/open/);
    });

    test('clicking closed section opens it', async ({ page }) => {
      await page.click('.accordion-header[data-section="mix"]');
      await expect(page.locator('.accordion-section[data-section="mix"]')).toHaveClass(/open/);
    });

    test('has buyer type selector', async ({ page }) => {
      await expect(page.locator('.accordion-section[data-section="deal"] #mBuyerType')).toBeVisible();
    });

    test('has down payment slider', async ({ page }) => {
      await expect(page.locator('.accordion-section[data-section="deal"] #mRDown')).toBeVisible();
    });
  });

  // Phase 5: Charts Tab
  test.describe('Phase 5 - Charts Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('.tab-btn[data-tab="charts"]');
    });

    test('shows chart container', async ({ page }) => {
      await expect(page.locator('.mobile-chart-container')).toBeVisible();
    });

    test('has swipe indicators', async ({ page }) => {
      await expect(page.locator('.chart-dots')).toBeVisible();
    });

    test('shows wealth chart by default', async ({ page }) => {
      await expect(page.locator('.mobile-chart[data-chart="wealth"]')).toBeVisible();
    });
  });

  // Phase 6: More Tab
  test.describe('Phase 6 - More Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.click('.tab-btn[data-tab="more"]');
    });

    test('has reset button', async ({ page }) => {
      await expect(page.locator('.mobile-reset-btn')).toBeVisible();
    });

    test('has advanced settings section', async ({ page }) => {
      await expect(page.locator('.mobile-advanced-settings')).toBeVisible();
    });
  });

  // Phase 7: Header
  test.describe('Phase 7 - Header', () => {
    test('header is compact', async ({ page }) => {
      const header = page.locator('header');
      const box = await header.boundingBox();
      expect(box.height).toBeLessThanOrEqual(56); // Allow some padding
    });

    test('view toggles are hidden', async ({ page }) => {
      await expect(page.locator('.view-toggles')).not.toBeVisible();
    });

    test('language and dark mode buttons visible', async ({ page }) => {
      await expect(page.locator('button:has-text("🌐")')).toBeVisible();
      await expect(page.locator('button:has-text("🌙")')).toBeVisible();
    });
  });
});

// Desktop should remain unchanged
test.describe('Desktop Layout (unchanged)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
  });

  test('body does not have is-mobile class', async ({ page }) => {
    await expect(page.locator('body')).not.toHaveClass(/is-mobile/);
  });

  test('sidebar is visible', async ({ page }) => {
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('mobile tabs are hidden', async ({ page }) => {
    await expect(page.locator('.mobile-tabs')).not.toBeVisible();
  });

  test('main content is visible', async ({ page }) => {
    await expect(page.locator('.main')).toBeVisible();
  });
});
