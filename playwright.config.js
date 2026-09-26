const { defineConfig, devices } = require('@playwright/test');

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const PORT = process.env.VISUAL_PORT || '1111';
const BASE = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: '.visual/report', open: 'never' }],
  ],
  outputDir: '.visual/artifacts',
  use: {
    baseURL: BASE,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'system-chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { executablePath: CHROMIUM_PATH },
      },
    },
  ],
  webServer: {
    command: `zola serve --interface 127.0.0.1 --port ${PORT}`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
