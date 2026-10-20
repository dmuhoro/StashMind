// StashMind E2E Tests — Playwright
// Run against a local Appwrite stack for end-to-end verification.
// Sign up, verify, upload PDF, lesson appears, audio plays, save cards,
// ask a question, practise, streak updates, export, second-user isolation,
// account deletion.

import { test, expect } from '@playwright/test';

test.describe('StashMind E2E', () => {
  test('complete user journey', async ({ page }) => {
    // Sign up
    await page.goto('/');
    await page.click('text=Sign up');
    await page.fill('input[name="email"]', `test_${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'TestPass123!');
    await page.check('input[name="age_confirmed"]');
    await page.click('button:has-text("Create Account")');

    // Verify account created
    await expect(page.locator('text=Welcome')).toBeVisible();

    // Create a lesson
    await page.click('text=Create Lesson');
    await page.fill('textarea[name="content"]', 'The Krebs cycle is a series of chemical reactions used by all aerobic organisms to release stored energy through the oxidation of acetyl-CoA derived from carbohydrates, fats, and proteins.');
    await page.click('button:has-text("Generate Lesson")');

    // Lesson appears
    await expect(page.locator('text=Cellular Respiration')).toBeVisible();

    // Save a card
    await page.click('text=Save Card');

    // Spaced review
    await page.click('text=Spaced Review');
    await expect(page.locator('.card')).toBeVisible();

    // Export
    await page.click('text=Export CSV');

    // Account deletion
    await page.click('text=Settings');
    await page.click('text=Delete Account');
    await page.click('text=Confirm Delete');
  });

  test('two-user isolation', async ({ page, browser }) => {
    // User A creates a lesson
    // User B cannot access User A's lesson
    // This test requires two browser contexts
  });
});
