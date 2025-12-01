# Basic Usage Examples

This page demonstrates common patterns and basic usage of Acquiescence.

## Setup

First, import and create an inspector instance:

```typescript
import { ElementStateInspector } from 'acquiescence';

const inspector = new ElementStateInspector();
```

## Example 1: Check if Button is Clickable

```typescript
async function checkButtonClickable() {
  const button = document.querySelector<HTMLButtonElement>('#submit-button');
  
  if (!button) {
    console.error('Button not found');
    return;
  }
  
  // Check if button is visible and enabled
  const result = await inspector.queryElementStates(button, ['visible', 'enabled']);
  
  if (result.status === 'success') {
    console.log('✓ Button is clickable');
    button.click();
  } else if (result.status === 'failure') {
    console.log(`✗ Button is not clickable: ${result.missingState}`);
  } else {
    console.log(`✗ Error: ${result.message}`);
  }
}
```

## Example 2: Check if Input is Editable

```typescript
async function checkInputEditable() {
  const input = document.querySelector<HTMLInputElement>('#email-input');
  
  if (!input) {
    console.error('Input not found');
    return;
  }
  
  // Check if input is visible, enabled, and editable
  const result = await inspector.queryElementStates(
    input,
    ['visible', 'enabled', 'editable']
  );
  
  if (result.status === 'success') {
    console.log('✓ Input is ready for typing');
    input.value = 'test@example.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (result.status === 'failure') {
    console.log(`✗ Input is not editable: ${result.missingState}`);
  }
}
```

## Example 3: Simple Visibility Check

```typescript
function checkVisibility() {
  const element = document.querySelector('#my-element');
  
  if (!element) {
    console.log('Element not found');
    return;
  }
  
  // Synchronous helper method
  if (inspector.isElementVisible(element)) {
    console.log('✓ Element is visible');
  } else {
    console.log('✗ Element is hidden');
  }
}
```

## Example 4: Check Disabled State

```typescript
function checkDisabled() {
  const button = document.querySelector<HTMLButtonElement>('#action-button');
  
  if (!button) {
    console.log('Button not found');
    return;
  }
  
  // Check both native disabled and aria-disabled
  if (inspector.isElementDisabled(button)) {
    console.log('✗ Button is disabled');
    console.log('  Has disabled attr:', button.hasAttribute('disabled'));
    console.log('  Has aria-disabled:', button.getAttribute('aria-disabled'));
  } else {
    console.log('✓ Button is enabled');
  }
}
```

## Example 5: Check if Element is in Viewport

```typescript
async function checkInViewport() {
  const element = document.querySelector('#footer-link');
  
  if (!element) {
    console.log('Element not found');
    return;
  }
  
  const inView = await inspector.isElementInViewPort(element);
  
  if (inView) {
    console.log('✓ Element is in viewport');
  } else {
    console.log('✗ Element is not in viewport');
    console.log('  Try scrolling to element...');
    
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Wait a moment for scroll
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check again
    const inViewNow = await inspector.isElementInViewPort(element);
    console.log('  Now in viewport:', inViewNow);
  }
}
```

## Example 6: Get Element's Viewport Rectangle

```typescript
async function getViewportRect() {
  const element = document.querySelector('#card');
  
  if (!element) {
    console.log('Element not found');
    return;
  }
  
  const rect = await inspector.getElementInViewPortRect(element);
  
  if (rect) {
    console.log('Element viewport rect:', {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    });
    
    // Calculate center point
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    console.log(`Center point: (${centerX}, ${centerY})`);
  } else {
    console.log('Element is not in viewport');
  }
}
```

## Example 7: Check Read-Only State

```typescript
function checkReadOnly() {
  const input = document.querySelector<HTMLInputElement>('#readonly-input');
  
  if (!input) {
    console.log('Input not found');
    return;
  }
  
  const readOnly = inspector.isElementReadOnly(input);
  
  if (readOnly === true) {
    console.log('✗ Input is read-only');
  } else if (readOnly === false) {
    console.log('✓ Input is editable');
  } else {
    console.log('Element does not support read-only state');
  }
}
```

## Example 8: Check Multiple Elements

```typescript
async function checkMultipleElements() {
  const buttons = document.querySelectorAll<HTMLButtonElement>('.action-button');
  
  console.log(`Checking ${buttons.length} buttons...`);
  
  // Check all buttons in parallel
  const results = await Promise.all(
    Array.from(buttons).map(async (button, index) => {
      const result = await inspector.queryElementStates(
        button,
        ['visible', 'enabled']
      );
      
      return {
        index,
        button,
        ready: result.status === 'success',
        issue: result.status === 'failure' ? result.missingState : null
      };
    })
  );
  
  // Report results
  results.forEach(({ index, ready, issue }) => {
    if (ready) {
      console.log(`✓ Button ${index} is ready`);
    } else {
      console.log(`✗ Button ${index} issue: ${issue}`);
    }
  });
  
  const readyCount = results.filter(r => r.ready).length;
  console.log(`${readyCount} of ${buttons.length} buttons are ready`);
}
```

## Example 9: Wait for Element to Become Visible

```typescript
async function waitForVisible(selector: string, timeout = 5000) {
  const element = document.querySelector(selector);
  
  if (!element) {
    throw new Error(`Element ${selector} not found`);
  }
  
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    const result = await inspector.queryElementState(element, 'visible');
    
    if (result.matches) {
      console.log(`✓ Element became visible after ${Date.now() - start}ms`);
      return;
    }
    
    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Element did not become visible within ${timeout}ms`);
}

// Usage
await waitForVisible('.loading-indicator', 3000);
```

## Example 10: Create a Helper Class

```typescript
class ElementChecker {
  private inspector = new ElementStateInspector();
  
  async isClickable(selector: string): Promise<boolean> {
    const element = document.querySelector(selector);
    if (!element) return false;
    
    const result = await this.inspector.queryElementStates(
      element,
      ['visible', 'enabled']
    );
    
    return result.status === 'success';
  }
  
  async isEditable(selector: string): Promise<boolean> {
    const element = document.querySelector(selector);
    if (!element) return false;
    
    const result = await this.inspector.queryElementStates(
      element,
      ['visible', 'enabled', 'editable']
    );
    
    return result.status === 'success';
  }
  
  isVisible(selector: string): boolean {
    const element = document.querySelector(selector);
    if (!element) return false;
    
    return this.inspector.isElementVisible(element);
  }
  
  async getElementInfo(selector: string) {
    const element = document.querySelector(selector);
    if (!element) {
      return { found: false };
    }
    
    return {
      found: true,
      visible: this.inspector.isElementVisible(element),
      disabled: this.inspector.isElementDisabled(element),
      inViewport: await this.inspector.isElementInViewPort(element),
      rect: await this.inspector.getElementInViewPortRect(element)
    };
  }
}

// Usage
const checker = new ElementChecker();

if (await checker.isClickable('#submit-button')) {
  console.log('Button is clickable');
}

const info = await checker.getElementInfo('#my-element');
console.log('Element info:', info);
```

## Next Steps

- See [Checking States Examples](/examples/checking-states)
- Learn about [Waiting for Interactions](/examples/waiting-interactions)
- Explore [Advanced Patterns](/examples/advanced-patterns)

