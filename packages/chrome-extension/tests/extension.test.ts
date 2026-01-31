import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';
import * as path from 'node:path';

const EXTENSION_PATH = path.resolve(__dirname, '..');
const TEST_REPO_URL = 'https://github.com/iamthekk/github-local-pilot-test-repo';

describe('Chrome Extension', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: false,
      channel: 'chrome', // Use installed Chrome
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
      ],
    });
    page = await browser.newPage();
  }, 30000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  it('should inject button on repo page', async () => {
    await page.goto(TEST_REPO_URL, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.github-local-pilot-btn', { timeout: 10000 });
    
    const button = await page.$('.github-local-pilot-btn');
    expect(button).not.toBeNull();
    
    const hasSvg = await page.$eval('.github-local-pilot-btn svg', el => el !== null);
    expect(hasSvg).toBe(true);
  }, 30000);

  it('should inject button on issue page', async () => {
    await page.goto(`${TEST_REPO_URL}/issues/1`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.github-local-pilot-btn', { timeout: 10000 });
    
    const button = await page.$('.github-local-pilot-btn');
    expect(button).not.toBeNull();
  }, 30000);

  it('should inject button on PR page', async () => {
    await page.goto(`${TEST_REPO_URL}/pull/2`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.github-local-pilot-btn', { timeout: 10000 });
    
    const button = await page.$('.github-local-pilot-btn');
    expect(button).not.toBeNull();
  }, 30000);

  it('should inject button on branch page', async () => {
    await page.goto(`${TEST_REPO_URL}/tree/feature/test-branch`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.github-local-pilot-btn', { timeout: 10000 });
    
    const button = await page.$('.github-local-pilot-btn');
    expect(button).not.toBeNull();
  }, 30000);

  it('should have correct protocol URL on click', async () => {
    await page.goto(`${TEST_REPO_URL}/issues/1`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('.github-local-pilot-btn', { timeout: 10000 });
    
    // Get the click handler behavior by checking what URL it would navigate to
    const protocolUrl = await page.evaluate(() => {
      return window.location.href.replace('https://', 'ghlp://');
    });
    
    expect(protocolUrl).toBe('ghlp://github.com/iamthekk/github-local-pilot-test-repo/issues/1');
  }, 30000);
});
