import { defineConfig } from 'vitest/config';
import { webdriverio } from '@vitest/browser-webdriverio';

// Get browser from environment variable, default to chrome
const browser = process.env.VITEST_BROWSER || 'chrome';

// Browser-specific capabilities
const getBrowserCapabilities = () => {
  switch (browser) {
    case 'firefox':
      return {
        'moz:firefoxOptions': {
          args: [
            '-headless',
          ]
        }
      };
    case 'safari':
      return {
        // Safari capabilities - Safari doesn't support many custom args
        'webkit:WebRTC': {
          DisableInsecureMediaCapture: true
        }
      };
    case 'chrome':
    default:
      return {
        'goog:chromeOptions': {
          args: [
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-gpu',
          ]
        }
      };
  }
};

export default defineConfig({
  test: {
    // Fallback environment when browser mode is disabled
    environment: 'jsdom',
    
    // Browser mode configuration
    browser: {
      enabled: false,
      provider: webdriverio({
        // Configure webdriver options for proper cleanup
        connectionRetryCount: 0,
        connectionRetryTimeout: 5000,
        capabilities: getBrowserCapabilities()
      }),
      headless: true,
      instances: [
        { browser: browser as 'chrome' | 'firefox' | 'safari' }
      ],
      // Prevent file handle leaks by running tests sequentially
      fileParallelism: false,
      // Isolate each test file in its own browser context
      isolate: false,
    },
    
    include: ['src/**/__tests__/**/*.test.ts'],
    
    // Increase timeout for browser tests
    testTimeout: 30000,
    
    // Increase teardown timeout to allow proper cleanup
    teardownTimeout: 5000,
    
    // Configure coverage
    coverage: {
      provider: 'istanbul', // use istanbul for all code coverage
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/__tests__/**'],
      reportsDirectory: './coverage',
      enabled: false, // Enable via CLI flag --coverage
    },
  },
});

