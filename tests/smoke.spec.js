// @ts-check
const { test, expect } = require('@playwright/test');

// Phase 0 smoke test: confirms the core booking → tracking → chat flow renders
// and the in-memory state engine reacts. No backend / network calls required.

test('landing page renders the brand and services', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Errand Boy/i);
  await expect(page.locator('.logo-text')).toHaveText(/ERRAND BOY/i);
  // All four service cards are present.
  await expect(page.locator('.service-card')).toHaveCount(4);
});

test('booking a market run starts the live tracker', async ({ page }) => {
  await page.goto('/');
  await page.locator('#service-market').click();
  await expect(page.locator('#booking-modal')).toBeVisible();

  await page.locator('#market-items').fill('Basket of Tomatoes, 1 bag of rice');
  await page.locator('#btn-submit-book-market').click();

  // Tracker switches from the empty state to the active layout.
  await expect(page.locator('#active-tracker-layout')).toBeVisible();
  await expect(page.locator('#track-title')).toHaveText(/Market Run/i);
  // Active errand count flips to 1.
  await expect(page.locator('#stat-active')).toHaveText('1');
});

test('chat drawer opens and shows the missing-key banner without a Gemini key', async ({ page }) => {
  await page.goto('/');
  await page.locator('#service-market').click();
  await page.locator('#market-items').fill('Milk');
  await page.locator('#btn-submit-book-market').click();

  await page.locator('#chat-toggle-btn').click();
  await expect(page.locator('#chat-drawer-container')).toHaveClass(/open/);
  await expect(page.locator('#gemini-warning-banner')).toBeVisible();
});

test('wallet top-up increases the displayed balance', async ({ page }) => {
  await page.goto('/');
  const before = await page.locator('#wallet-balance').innerText();
  await page.locator('#wallet-card-trigger').click();
  await page.locator('#topup-amount').fill('50000');
  await page.locator('#btn-submit-topup').click();
  const after = await page.locator('#wallet-balance').innerText();
  expect(after).not.toBe(before);
});
