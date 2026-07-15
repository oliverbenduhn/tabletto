const { defineConfig, devices } = require('@playwright/test');

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
    baseURL: 'http://127.0.0.1:3000',
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
        viewport: { width: 1440, height: 900 }
      }
    },
    {
      name: 'mobile-pixel-7',
      use: {
        ...devices['Pixel 7']
      }
    }
  ],
  webServer: {
    command: 'npm run build:frontend && npm start',
    url: 'http://127.0.0.1:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      JWT_SECRET: 'tabletto-e2e-only-secret',
      DB_PATH: '/tmp/tabletto-e2e.db',
      ENABLE_STOCK_SCHEDULER: 'false',
      PORT: '3000'
    }
  }
});
