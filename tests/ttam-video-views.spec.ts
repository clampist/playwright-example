import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
import { testIds } from '../fixtures/test-ids';
dotenv.config();
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'https://ads.tiktok.com';

async function validateApiResponse(page, urlKeyword) {
  const [response] = await Promise.all([
    page.waitForResponse(resp =>
      resp.url().includes(urlKeyword) && resp.status() === 200
    ),
  ]);
  const json = await response.json();
  if (json.msg !== 'success') {
    throw new Error('API return failed!');
  }
  return json;
}

async function selectVideoInDrawer(page) {
  // Wait for drawer to fully load
  await page.waitForSelector('.sideslip', { state: 'visible', timeout: 10000 });
  await page.waitForSelector('.sideslip .tab-mixed-post-container', { state: 'visible', timeout: 15000 });
  
  // Wait for content to render
  await page.waitForTimeout(2000);
  
  // Find video cards
  const videoCardByClass = page.locator('.sideslip .video');
  const classCount = await videoCardByClass.count();
  
  if (classCount === 0) {
    throw new Error('No video cards found in drawer');
  }
  
  // Select the first video card
  const videoCard = videoCardByClass.first();
  await videoCard.waitFor({ state: 'visible', timeout: 10000 });
  
  // Click on video card
  try {
    await videoCard.click();
  } catch (error) {
    await videoCard.click({ force: true });
  }
  
  // Wait for confirm button to become available
  const confirmButton = page.locator('.sideslip button[data-testid="hybrid-drawer-footer-submit-button"]');
  await confirmButton.waitFor({ state: 'visible', timeout: 10000 });
  
  // Check if button is enabled
  const isDisabled = await confirmButton.getAttribute('disabled');
  if (isDisabled) {
    await page.waitForFunction(() => {
      const button = document.querySelector('button[data-testid="hybrid-drawer-footer-submit-button"]');
      return button && !button.hasAttribute('disabled');
    }, { timeout: 15000 });
  }
  
  await confirmButton.click();
  await page.waitForLoadState('load', { timeout: 60000 });
}

async function exitCampaignCreation(page) {
  // Use more precise selector to locate close button
  try {
    await page.locator('svg.arcou-icon.arcou-icon-close').click();
  } catch (error) {
    await page.locator('span[role="button"][aria-label="Close"]').click();
  }
  
  await page.waitForLoadState('load');
  await page.waitForTimeout(3000);
  
  // Wait and click "Not now" button
  try {
    await page.getByRole('button', { name: 'Not now' }).click();
  } catch (error) {
    // Button may not exist, continue execution
  }

  // Wait and click Campaign menu
  try {
    await page.locator('.menu-title-container .menu-title:has-text("Campaign")').click();
  } catch (error) {
    try {
      await page.locator('[data-testid="ks-text-index-o9Z3fb"]').click();
    } catch (error2) {
      await page.locator('.menu-title:has-text("Campaign")').click();
    }
  }
  
  // Wait and click Exit button
  try {
    await page.locator('.exit-error-dialog-footer').getByRole('button', { name: /^Exit$/ }).click();
  } catch (error) {
    await page.locator('button:has-text("Exit")').click();
  }
  
  await page.waitForLoadState('load');
}

test('ttam', async () => {
  // Set test-level timeout
  test.setTimeout(120000); // 2 minutes
  
  // For normal test accounts, add to whitelist to test without using CDP mode (here using my personal online account)
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = await context.newPage();

  // Set default page timeout
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  // Just for debugging and observation, comment out for formal testing
  await page.waitForTimeout(1000);

  await page.goto(`${BASE_URL}/i18n/creation/1nn/create/campaign?aadvid=${process.env.AADVID}`);

  /* Campaign */

  // video views
  await page.getByTestId(testIds.Campaign.objective_video_views).click();

  await page.mouse.wheel(0, 3000)

  await page.getByTestId(testIds.Campaign.CBO_daily_budget).locator('input').fill('5000');

  const campaignContinueButton = page.getByTestId(testIds.Campaign.continue_button);
  await campaignContinueButton.waitFor({ state: 'visible' });
  await Promise.all([
    validateApiResponse(page, '/api/v4/i18n/creation/ad_snap/save/'),
    campaignContinueButton.click()
  ]);
  await page.waitForLoadState('load');

  /* AdGroup */
  // configure others ...
  const adgContinueButton = page.getByTestId(testIds.AdGroup.continue_button);
  await adgContinueButton.waitFor({ state: 'visible' });
  await Promise.all([
    validateApiResponse(page, '/api/v4/i18n/creation/creative_snap/save/'),
    adgContinueButton.click()
  ]);
  await page.waitForLoadState('load');

  /* Creative */
  // + TikTok post
  // Use more stable selector, prioritize data-tea-std_component_name attribute
  try {
    await page.getByTestId(testIds.Creative.add_tiktok_post).click();
  } catch (error) {
    // If testid fails, use alternative selector
    await page.locator(testIds.Creative.add_tiktok_post_alt).click();
  }
  await page.waitForLoadState('load');

  // First switch to TikTok posts tab
  try {
    await page.locator(testIds.Creative.tiktok_posts_tab_id).click();
  } catch (error) {
    // If id selector fails, use alternative selector
    await page.locator(testIds.Creative.tiktok_posts_tab_text).click();
  }
  await page.waitForLoadState('load');
    
  await page.mouse.wheel(0, 3000)
  
  // Select video
  await selectVideoInDrawer(page);

  await page.getByTestId(testIds.Creative.publish_all).getByText('Publish all').click();
  await page.waitForLoadState('load');

  // compare screenshot if needed
  // await expect(page).toHaveScreenshot();

  // If using a normal test account, the payment method page will not pop up after clicking Publish all (here because I used my personal online account)
  try {
    await exitCampaignCreation(page);
  } catch (error) {
    // Even if exit fails, the test has successfully completed the main workflow
  }

  // After successful submission, it will go to the campaign list page. Use CampaignId or CampaignName to check if the newly created Campaign can be queried and compare if the status is normal.
  // To save UI automation time, the delete Campaign API will be called directly. In normal cases, the deletion operation from the page will not be specifically verified.

  await context.close();
});
