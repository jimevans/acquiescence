import { defineConfig } from 'vitest/config';
import { webdriverio } from '@vitest/browser-webdriverio';

// Get browser from environment variable, default to chrome
const browser = process.env.VITEST_BROWSER || 'chrome';

// Check if headless mode is explicitly disabled via CLI
const isHeadless = !process.argv.includes('--browser.headless=false');

// Browser-specific capabilities
const getBrowserCapabilities = () => {
  switch (browser) {
    case 'firefox':
      const firefoxArgs: string[] = [];
      
      // Only add -headless if headless mode is enabled
      if (isHeadless) {
        firefoxArgs.push('-headless');
      }
      
      return {
        'moz:firefoxOptions': {
          args: firefoxArgs
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
      const chromeArgs = [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-setuid-sandbox',
        '--disable-software-rasterizer',
      ];
      
      // Only add --headless if headless mode is enabled
      if (isHeadless) {
        chromeArgs.unshift('--headless');
      }
      
      return {
        'goog:chromeOptions': {
          args: chromeArgs
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
        // Configure webdriver options with better CI support
        connectionRetryCount: 3,
        connectionRetryTimeout: 30000,
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

