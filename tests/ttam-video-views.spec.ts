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
  // console.log('API return data:', json);
  if (json.msg !== 'success') {
    throw new Error('API return failed!');
  }
  return json;
}

async function exitCampaignCreation(page) {
  await page.locator('span[role="button"][aria-label="Close"] >> svg.arcou-icon-close').click();
  await page.waitForLoadState('load');

  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'Not now' }).click();

  await page.locator('span.menu-title', { hasText: 'Campaign' }).click();
  await page.locator('.exit-error-dialog-footer').getByRole('button', { name: /^Exit$/ }).click();
  await page.waitForLoadState('load');
}

test('ttam', async () => {
  // For normal test accounts, add to whitelist to test without using CDP mode (here using my personal online account)
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = await context.newPage();

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
  await page.getByTestId(testIds.Creative.add_tiktok_post).click();
  await page.waitForLoadState('load');

  await page.mouse.wheel(0, 3000)
  // select the 1st video
  await page.getByTestId(testIds.Creative.library_item_0).locator('label[role="checkbox"]').click();
  await page.getByTestId(testIds.Creative.library_confirm).click();
  await page.waitForLoadState('load');

  await page.getByTestId(testIds.Creative.publish_all).getByText('Publish all').click();
  await page.waitForLoadState('load');

  // compare screenshot if needed
  // await expect(page).toHaveScreenshot();

  // If using a normal test account, the payment method page will not pop up after clicking Publish all (here because I used my personal online account)
  await exitCampaignCreation(page);

  // After successful submission, it will go to the campaign list page. Use CampaignId or CampaignName to check if the newly created Campaign can be queried and compare if the status is normal.
  // To save UI automation time, the delete Campaign API will be called directly. In normal cases, the deletion operation from the page will not be specifically verified.

  await context.close();
});
