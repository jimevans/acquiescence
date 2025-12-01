# Best Practices

This guide covers recommended patterns and practices for using Acquiescence effectively.

## General Principles

### 1. Always Check Before Acting

Never assume an element is ready for interaction. Always verify its state first:

```typescript
// ❌ Bad: Assuming element is ready
button.click();

// ✅ Good: Verify before acting
const result = await inspector.queryElementStates(button, ['visible', 'enabled']);
if (result.status === 'success') {
  button.click();
}
```

### 2. Use Appropriate Timeouts

Choose timeouts based on expected behavior:

```typescript
// Fast UI updates: 1-2 seconds
await inspector.waitForInteractionReady(quickButton, 'click', 2000);

// Slow network requests: 5-10 seconds
await inspector.waitForInteractionReady(loadingButton, 'click', 10000);

// Complex page loads: 15-30 seconds
await inspector.waitForInteractionReady(slowPage, 'click', 30000);
```

### 3. Reuse Inspector Instances

Create one inspector and reuse it throughout your application:

```typescript
// ✅ Good: Single instance
class TestRunner {
  private inspector = new ElementStateInspector();
  
  async clickButton(selector: string) {
    const button = document.querySelector(selector);
    await this.inspector.waitForInteractionReady(button, 'click', 5000);
  }
}

// ❌ Avoid: Creating multiple instances
async function clickButton(selector: string) {
  const inspector = new ElementStateInspector(); // Creates new caches each time
  // ...
}
```

### 4. Handle Errors Gracefully

Always wrap interaction waits in try-catch blocks:

```typescript
async function safeClick(element: Element) {
  try {
    const hitPoint = await inspector.waitForInteractionReady(
      element,
      'click',
      5000
    );
    element.click();
    return true;
  } catch (error) {
    console.error('Failed to click element:', error.message);
    return false;
  }
}
```

## Element Selection

### Use Specific Selectors

Prefer specific selectors that uniquely identify elements:

```typescript
// ❌ Ambiguous
const button = document.querySelector('button');

// ✅ Specific
const button = document.querySelector('#submit-form-button');
const button = document.querySelector('[data-testid="submit-button"]');
```

### Handle Dynamic Elements

For elements that might not exist yet:

```typescript
async function waitForElement(
  selector: string,
  timeout: number = 5000
): Promise<Element> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Element ${selector} not found within timeout`);
}

// Usage
const button = await waitForElement('#dynamic-button');
await inspector.waitForInteractionReady(button, 'click', 5000);
```

## State Checking

### Check Only Necessary States

Don't check more states than you need:

```typescript
// ❌ Unnecessary checks
await inspector.queryElementStates(
  staticElement,
  ['visible', 'enabled', 'stable', 'inview']
);

// ✅ Only what's needed
await inspector.queryElementStates(staticElement, ['visible', 'enabled']);
```

### Order States by Likelihood of Failure

Put states most likely to fail first (except `stable`, which is always checked first):

```typescript
// Check visibility before enabled state
await inspector.queryElementStates(element, ['visible', 'enabled', 'stable']);
```

### Use Helper Methods When Appropriate

For simple synchronous checks, use helpers:

```typescript
// ❌ Overkill for simple check
const result = await inspector.queryElementState(element, 'visible');
if (result.matches) { /* ... */ }

// ✅ Use helper for synchronous check
if (inspector.isElementVisible(element)) {
  // ...
}
```

## Interaction Patterns

### Wait Once, Act Immediately

Don't wait multiple times for the same element:

```typescript
// ❌ Wasteful: Multiple waits
await inspector.waitForInteractionReady(button, 'click', 5000);
const rect = await inspector.getElementInViewPortRect(button);
button.click();

// ✅ Wait once, then act
const hitPoint = await inspector.waitForInteractionReady(button, 'click', 5000);
button.click();
```

### Batch Element Checks

Check multiple elements in parallel:

```typescript
// ❌ Sequential checks
for (const button of buttons) {
  await inspector.waitForInteractionReady(button, 'click', 5000);
}

// ✅ Parallel checks
await Promise.all(
  buttons.map(button =>
    inspector.waitForInteractionReady(button, 'click', 5000)
  )
);
```

### Verify After State Changes

After DOM mutations, re-verify element states:

```typescript
// Trigger state change
await toggleButton.click();

// Wait for target to reflect the change
await inspector.waitForInteractionReady(targetElement, 'click', 2000);
```

## Performance Optimization

### Minimize State Queries

Cache results when possible:

```typescript
class ElementCache {
  private states = new Map<Element, { timestamp: number, visible: boolean }>();
  
  async isVisible(element: Element): Promise<boolean> {
    const cached = this.states.get(element);
    
    // Cache valid for 100ms
    if (cached && Date.now() - cached.timestamp < 100) {
      return cached.visible;
    }
    
    const result = await inspector.queryElementState(element, 'visible');
    this.states.set(element, {
      timestamp: Date.now(),
      visible: result.matches
    });
    
    return result.matches;
  }
}
```

### Use Appropriate Interaction Types

Choose the interaction type that matches your needs:

```typescript
// ❌ Checks editability unnecessarily
await inspector.waitForInteractionReady(button, 'type', 5000);

// ✅ Use correct interaction type
await inspector.waitForInteractionReady(button, 'click', 5000);
```

### Avoid Unnecessary Stability Checks

Skip stability for known-static elements:

```typescript
// Static page elements don't need stability checks
const result = await inspector.queryElementStates(
  staticNavLink,
  ['visible', 'enabled'] // No 'stable'
);
```

## Testing Best Practices

### Create Helper Functions

Build reusable testing utilities:

```typescript
class TestHelpers {
  constructor(private inspector: ElementStateInspector) {}
  
  async clickWhenReady(selector: string, timeout = 5000) {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    
    await this.inspector.waitForInteractionReady(element, 'click', timeout);
    element.click();
  }
  
  async typeWhenReady(selector: string, text: string, timeout = 5000) {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    
    await this.inspector.waitForInteractionReady(element, 'type', timeout);
    (element as HTMLInputElement).value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  async isVisible(selector: string): Promise<boolean> {
    const element = document.querySelector(selector);
    return element ? this.inspector.isElementVisible(element) : false;
  }
}
```

### Use Descriptive Error Messages

Provide context in error messages:

```typescript
async function clickButton(name: string) {
  const button = document.querySelector(`[aria-label="${name}"]`);
  
  if (!button) {
    throw new Error(`Button "${name}" not found in DOM`);
  }
  
  try {
    await inspector.waitForInteractionReady(button, 'click', 5000);
    button.click();
  } catch (error) {
    throw new Error(
      `Failed to click "${name}" button: ${error.message}`
    );
  }
}
```

### Wait for Side Effects

After interactions, wait for expected side effects:

```typescript
async function submitForm() {
  const submitButton = document.querySelector('#submit');
  
  // Click submit
  await inspector.waitForInteractionReady(submitButton, 'click', 5000);
  submitButton.click();
  
  // Wait for success message to appear
  const successMsg = await waitForElement('.success-message', 5000);
  
  // Verify success message is visible
  const result = await inspector.queryElementState(successMsg, 'visible');
  if (!result.matches) {
    throw new Error('Success message not visible after form submission');
  }
}
```

## Common Pitfalls

### 1. Not Checking Element Connection

Always verify elements are still in the DOM:

```typescript
const element = document.querySelector('#my-element');

// Element might be removed here...

try {
  await inspector.waitForInteractionReady(element, 'click', 5000);
} catch (error) {
  if (error.message.includes('not connected')) {
    console.error('Element was removed from DOM');
  }
}
```

### 2. Ignoring Shadow DOM

Remember to traverse into shadow roots:

```typescript
// Find element in shadow DOM
const host = document.querySelector('my-component');
const button = host?.shadowRoot?.querySelector('button');

if (button) {
  await inspector.waitForInteractionReady(button, 'click', 5000);
}
```

### 3. Not Handling Async Nature

Remember that most methods are async:

```typescript
// ❌ Forgot await
inspector.waitForInteractionReady(button, 'click', 5000);
button.click(); // Clicks immediately, before element is ready!

// ✅ Properly awaited
await inspector.waitForInteractionReady(button, 'click', 5000);
button.click();
```

### 4. Using Wrong State for Interaction

Match states to your actual interaction:

```typescript
// ❌ Checking 'editable' for a button click
await inspector.queryElementStates(button, ['visible', 'editable']);

// ✅ Checking appropriate states
await inspector.queryElementStates(button, ['visible', 'enabled']);
```

## Debugging Tips

### Log State Check Results

```typescript
async function debugElementState(element: Element, states: ElementState[]) {
  console.log('Checking element:', element);
  
  for (const state of states) {
    if (state !== 'stable') {
      const result = await inspector.queryElementState(element, state);
      console.log(`  ${state}:`, result.matches ? '✓' : '✗', 
                  `(received: ${result.received})`);
    }
  }
  
  // Check stable separately
  if (states.includes('stable')) {
    const result = await inspector.queryElementStates(element, ['stable']);
    console.log(`  stable:`, result.status === 'success' ? '✓' : '✗');
  }
}
```

### Capture Screenshots on Failure

```typescript
async function clickWithScreenshot(element: Element) {
  try {
    await inspector.waitForInteractionReady(element, 'click', 5000);
    element.click();
  } catch (error) {
    // Capture state for debugging
    console.error('Click failed:', {
      visible: inspector.isElementVisible(element),
      disabled: inspector.isElementDisabled(element),
      inViewport: await inspector.isElementInViewPort(element),
      error: error.message
    });
    throw error;
  }
}
```

## Next Steps

- Check [Troubleshooting Guide](/guide/troubleshooting)
- See [Advanced Examples](/examples/advanced-patterns)
- Explore the [API Reference](/api/)

