# Acquiescence

> A powerful TypeScript library for querying and waiting for element states in the browser

[![npm version](https://img.shields.io/npm/v/acquiescence.svg)](https://www.npmjs.com/package/acquiescence)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/jimevans/acquiescence/actions/workflows/ci.yml/badge.svg)](https://github.com/jimevans/acquiescence/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/jimevans/acquiescence/graph/badge.svg?token=8S7FYOCILA)](https://codecov.io/gh/jimevans/acquiescence)

## Overview

**Acquiescence** provides sophisticated element state querying and interaction readiness detection for web applications. It goes far beyond simple existence checks to determine if elements are truly ready for user interaction.

Perfect for:
- 🧪 End-to-end testing frameworks
- 🤖 Browser automation tools
- 🎨 Interactive UI frameworks
- ♿ Accessibility testing tools
- ✅ Any scenario requiring reliable element state detection

## Features

- **🔍 Query Element States** - Check visibility, enabled/disabled state, ability to enter text, viewport position, and more with a simple, intuitive API
- **⏱️ Wait for Interactions** - Automatically wait for elements to be ready for interaction, with built-in stability detection and smart scrolling
- **🎯 Precise Hit Testing** - Determine exact click points and detect element obstruction with accurate hit testing that respects Shadow DOM
- **🚀 TypeScript First** - Built with TypeScript for excellent type safety and IntelliSense support in your IDE
- **🌐 Shadow DOM Support** - Full support for Shadow DOM, including closed shadow roots and composed tree traversal
- **⚡ Performance Optimized** - Smart caching of computed styles and efficient polling strategies for minimal performance impact

## Installation

```bash
npm install acquiescence
```

```bash
yarn add acquiescence
```

```bash
pnpm add acquiescence
```

## Quick Start

```typescript
import { ElementStateInspector } from 'acquiescence';

const inspector = new ElementStateInspector();
const button = document.querySelector('#submit-button');

// Check if an element is visible and enabled
const result = await inspector.queryElementStates(button, ['visible', 'enabled']);

if (result.status === 'success') {
  console.log('Button is ready!');
} else {
  console.log(`Button is ${result.missingState}`);
}

// Wait for an element to be ready for interaction
try {
  const hitPoint = await inspector.waitForInteractionReady(
    button,
    'click',
    5000 // 5 second timeout
  );
  console.log(`Element ready at point (${hitPoint.x}, ${hitPoint.y})`);
} catch (error) {
  console.error('Element not ready within timeout');
}
```

## Usage Examples

### Querying Element States

Check various states of DOM elements:

```typescript
const input = document.querySelector('input');

// Check a single state
const visibleResult = await inspector.queryElementState(input, 'visible');
console.log(visibleResult.matches); // true or false

// Check multiple states
const result = await inspector.queryElementStates(
  input,
  ['visible', 'enabled', 'editable']
);

if (result.status === 'success') {
  console.log('Input is ready for typing!');
} else if (result.status === 'failure') {
  console.log(`Input is not ready: ${result.missingState}`);
}
```

### Available Element States

| State | Description |
|-------|-------------|
| `visible` | Element is visible (has positive size, not hidden by CSS) |
| `hidden` | Element is not visible |
| `enabled` | Element is not disabled |
| `disabled` | Element is disabled (via disabled attribute or aria-disabled) |
| `editable` | Element can accept text input (not disabled or readonly) |
| `inview` | Element is currently visible in the viewport |
| `notinview` | Element is not in viewport but could be scrolled into view |
| `unviewable` | Element cannot be scrolled into view (hidden by overflow) |
| `stable` | Element's position hasn't changed for at least one animation frame |

### Checking Interaction Readiness

```typescript
const button = document.querySelector('button');
const result = await inspector.isInteractionReady(button, 'click');

if (result.status === 'ready') {
  console.log('Ready to click at:', result.interactionPoint);
} else if (result.status === 'needsscroll') {
  console.log('Element needs to be scrolled into view');
} else {
  console.log('Element is not ready for interaction');
}
```

### Waiting for Interaction Readiness

```typescript
const button = document.querySelector('button');

try {
  const hitPoint = await inspector.waitForInteractionReady(
    button,
    'click',
    5000 // 5 second timeout
  );
  
  console.log(`Ready to click at (${hitPoint.x}, ${hitPoint.y})`);
  // Perform your click action here
} catch (error) {
  console.error('Element not ready within timeout:', error.message);
}
```

**Note:** `waitForInteractionReady()` automatically scrolls elements into view if they're not currently visible in the viewport.

### Supported Interaction Types

- `click` - Single click
- `dblclick` - Double click
- `hover` - Mouse hover
- `type` - Text input
- `clear` - Clear input field
- `drag` - Drag operation
- `screenshot` - Screenshot capture

### Helper Methods

For simple checks, use the helper methods:

```typescript
const element = document.querySelector('.my-element');

// Check visibility
if (inspector.isElementVisible(element)) {
  console.log('Element is visible');
}

// Check if disabled
if (inspector.isElementDisabled(element)) {
  console.log('Element is disabled');
}

// Check if read-only
const readOnly = inspector.isElementReadOnly(element);
if (readOnly === true) {
  console.log('Element is read-only');
} else if (readOnly === false) {
  console.log('Element is editable');
}
```

## Browser Support

Acquiescence can be used in both Node.js environments (with jsdom) and directly in the browser.

### Browser Bundle

For direct browser usage, a bundled version is available:

```html
<script src="node_modules/acquiescence/dist/acquiescence.browser.js"></script>
<script>
  const inspector = new Acquiescence.ElementStateInspector();
  // Use the inspector
</script>
```

## API Reference

### `ElementStateInspector`

The main class for querying element states and waiting for interactions.

#### Methods

- `queryElementState(element, state)` - Check a single element state
- `queryElementStates(element, states)` - Check multiple element states
- `isInteractionReady(element, interactionType)` - Check if element is ready for interaction
- `waitForInteractionReady(element, interactionType, timeout)` - Wait for element to be ready
- `isElementVisible(element)` - Helper to check visibility
- `isElementDisabled(element)` - Helper to check disabled state
- `isElementReadOnly(element)` - Helper to check read-only state

For complete API documentation, see the [full API reference](https://yourusername.github.io/element-state/api/).

## Documentation

For more detailed documentation, guides, and examples, visit:

📚 **[Full Documentation](https://jimevans.github.io/acquiescence/)**

- [Getting Started Guide](https://jimevans.github.io/acquiescence/guide/getting-started)
- [Element States Guide](https://jimevans.github.io/acquiescence/guide/element-states)
- [Interaction Types Guide](https://jimevans.github.io/acquiescence/guide/interactions)
- [Best Practices](https://jimevans.github.io/acquiescence/guide/best-practices)
- [API Reference](https://jimevans.github.io/acquiescence/api/)

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/jimevans/acquiescence.git
cd element-state

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build documentation
npm run docs:build

# Serve documentation locally
npm run docs:dev
```

### Scripts

- `npm run build` - Build the TypeScript project
- `npm run build:browser` - Build the browser bundle
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run linter
- `npm run lint:fix` - Fix linting issues
- `npm run docs:dev` - Start documentation dev server
- `npm run docs:build` - Build documentation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Why "Acquiescence"?

**Acquiescence** means "the reluctant acceptance of something without protest" - which perfectly describes what this library helps you do: wait patiently (but efficiently!) for elements to reach the state you need them to be in, without constantly polling or throwing errors.

## Related Projects

- [Selenium](https://selenium.dev/) - Browser automation framework
- [WebdriverIO](https://webdriver.io/) - Browser and mobile automation
- [Puppeteer](https://pptr.dev/) - Chrome DevTools Protocol
- [Testing Library](https://testing-library.com/) - Simple and complete testing utilities

---

Made with ❤️ by the Acquiescence team

