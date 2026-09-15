const base = require('@playwright/test');

/**
 * Browser source:
 * - E2E_CDP_URL set (e.g. http://127.0.0.1:9222): attach to an already running Chrome.
 *   Tests still get a fresh context, so the existing browser session is untouched.
 * - Otherwise: launch Playwright's Chromium (requires `npx playwright install chromium`).
 */
const test = base.test.extend({
  browser: [
    async ({ playwright, launchOptions }, use) => {
      const cdpUrl = process.env.E2E_CDP_URL;
      const browser = cdpUrl
        ? await playwright.chromium.connectOverCDP(cdpUrl)
        : await playwright.chromium.launch(launchOptions);

      await use(browser);

      // For CDP this only closes contexts created by the tests and disconnects
      await browser.close();
    },
    { scope: 'worker' },
  ],
});

module.exports = { test, expect: base.expect };
