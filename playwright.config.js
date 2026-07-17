const { defineConfig, devices } = require('@playwright/test');

const serverEnv = {
  ...process.env,
  JWT_SECRET: 'tabletto-e2e-only-secret',
  ENABLE_STOCK_SCHEDULER: 'false',
  ENABLE_INTERNAL_ENDPOINTS: 'true',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '2587',
  SMTP_FROM: 'tabletto-e2e@example.test'
};

module.exports = defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results/artifacts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 8_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        baseURL: 'http://127.0.0.1:3030'
      }
    },
    {
      name: 'mobile-pixel-7',
      use: {
        ...devices['Pixel 7'],
        baseURL: 'http://127.0.0.1:3031'
      }
    }
  ],
  // Playwright starts both servers before the run. Project-specific base URLs
  // select the matching process, while separate databases isolate server state.
  webServer: [
    {
      command: 'rm -f /tmp/tabletto-e2e-desktop.db && npm start',
      url: 'http://127.0.0.1:3030/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...serverEnv,
        DB_PATH: '/tmp/tabletto-e2e-desktop.db',
        PORT: '3030'
      }
    },
    {
      command: 'rm -f /tmp/tabletto-e2e-mobile.db && npm start',
      url: 'http://127.0.0.1:3031/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...serverEnv,
        DB_PATH: '/tmp/tabletto-e2e-mobile.db',
        PORT: '3031'
      }
    }
  ]
});
