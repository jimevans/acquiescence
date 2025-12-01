---
layout: home

hero:
  name: Acquiescence
  text: Element State Querying & Waiting
  tagline: A powerful TypeScript library for querying and waiting for element states in the browser
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/jimevans/acquiescence
    - theme: alt
      text: API Reference
      link: /api/

features:
  - icon: 🔍
    title: Query Element States
    details: Check visibility, enabled/disabled state, editability, viewport position, and more with a simple, intuitive API.
  
  - icon: ⏱️
    title: Wait for Interactions
    details: Automatically wait for elements to be ready for interaction, with built-in stability detection and smart scrolling.
  
  - icon: 🎯
    title: Precise Hit Testing
    details: Determine exact click points and detect element obstruction with accurate hit testing that respects Shadow DOM.
  
  - icon: 🚀
    title: TypeScript First
    details: Built with TypeScript for excellent type safety and IntelliSense support in your IDE.
  
  - icon: 🌐
    title: Shadow DOM Support
    details: Full support for Shadow DOM, including closed shadow roots and composed tree traversal.
  
  - icon: ⚡
    title: Performance Optimized
    details: Smart caching of computed styles and efficient polling strategies for minimal performance impact.
---

## Quick Example

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

## Why Acquiescence?

Modern web applications are dynamic and complex. Elements appear, disappear, move around, and change state constantly. **Acquiescence** provides a robust way to:

- **Query element states** with precision, going beyond simple visibility checks
- **Wait intelligently** for elements to be ready for user interactions
- **Detect stability** to ensure elements aren't moving or animating
- **Handle edge cases** like Shadow DOM, fixed positioning, and overflow detection
- **Get actionable feedback** when elements aren't in the expected state

Perfect for:
- End-to-end testing frameworks
- Browser automation tools
- Interactive UI frameworks
- Accessibility testing tools
- Any scenario requiring reliable element state detection

## Installation

::: code-group

```bash [npm]
npm install acquiescence
```

```bash [yarn]
yarn add acquiescence
```

```bash [pnpm]
pnpm add acquiescence
```

:::

## Next Steps

<div class="vp-doc">

- [Getting Started Guide](/guide/getting-started) - Learn the basics
- [Element States](/guide/element-states) - Understand all available states
- [API Reference](/api/) - Complete API documentation
- [Examples](/examples/basic-usage) - See code examples

</div>

