# Getting Started

Welcome to **Acquiescence**! This guide will help you understand the basics and get up and running quickly.

## What is Acquiescence?

Acquiescence is a TypeScript library that provides sophisticated element state querying and interaction readiness detection for web applications. It goes far beyond simple existence checks to determine if elements are truly ready for user interaction.

## Core Features

### Element State Queries

Check various states of DOM elements:

- **Visibility**: Is the element visible on the page?
- **Enabled/Disabled**: Can the element be interacted with?
- **Editable**: Can the element accept text input?
- **In Viewport**: Is the element currently visible in the viewport?
- **Stable**: Has the element stopped moving/animating?

### Interaction Readiness

Determine if an element is ready for specific interactions:

- Click, double-click, hover
- Type, clear input
- Drag and drop operations
- Screenshot capture

### Smart Waiting

Wait for elements to become ready with:

- Automatic scrolling into view
- Stability detection (waits for animations to complete)
- Configurable timeouts and polling intervals
- Precise hit point calculation

## Basic Usage

### 1. Import the Library

```typescript
import { ElementStateInspector } from 'acquiescence';
```

### 2. Create an Inspector Instance

```typescript
const inspector = new ElementStateInspector();
```

::: tip
You can reuse a single `ElementStateInspector` instance throughout your application. The inspector caches computed styles for performance, but caches are short-lived and automatically managed.
:::

### 3. Query Element States

#### Check a Single State

```typescript
const button = document.querySelector('button');
const result = await inspector.queryElementState(button, 'visible');

console.log(result.matches); // true or false
console.log(result.received); // 'visible' or 'hidden'
```

#### Check Multiple States

```typescript
const input = document.querySelector('input');
const result = await inspector.queryElementStates(
  input, 
  ['visible', 'enabled', 'editable']
);

if (result.status === 'success') {
  console.log('Input is ready for typing!');
} else if (result.status === 'failure') {
  console.log(`Input is not ready: ${result.missingState}`);
} else if (result.status === 'error') {
  console.log(`Error: ${result.message}`);
}
```

### 4. Check Interaction Readiness

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

### 5. Wait for Interaction Readiness

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

::: info Automatic Scrolling
`waitForInteractionReady()` automatically scrolls elements into view if they're not currently visible in the viewport.
:::

## Common Patterns

### Pattern 1: Verify Before Action

Always verify an element's state before performing actions:

```typescript
const submitButton = document.querySelector('#submit');
const result = await inspector.queryElementStates(
  submitButton,
  ['visible', 'enabled', 'stable']
);

if (result.status === 'success') {
  submitButton.click();
} else {
  console.warn('Cannot click button:', result);
}
```

### Pattern 2: Wait with Timeout

Use timeouts to avoid waiting indefinitely:

```typescript
async function clickWhenReady(element: Element, timeout: number = 5000) {
  try {
    await inspector.waitForInteractionReady(element, 'click', timeout);
    element.dispatchEvent(new MouseEvent('click'));
  } catch (error) {
    throw new Error(`Element not ready after ${timeout}ms`);
  }
}
```

### Pattern 3: Check Visibility Helpers

For simple checks, use the helper methods:

```typescript
const element = document.querySelector('.my-element');

if (inspector.isElementVisible(element)) {
  console.log('Element is visible');
}

if (inspector.isElementDisabled(element)) {
  console.log('Element is disabled');
}

const readOnly = inspector.isElementReadOnly(element);
if (readOnly === true) {
  console.log('Element is read-only');
} else if (readOnly === false) {
  console.log('Element is editable');
} else {
  console.log('Element is not an input/editable element');
}
```

## Element States Reference

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

## Next Steps

- Learn more about [Element States](/guide/element-states)
- Understand [Interaction Readiness](/guide/interactions)
- See more [Examples](/examples/basic-usage)
- Explore the [API Reference](/api/)

