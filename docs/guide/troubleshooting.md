# Troubleshooting

This guide helps you diagnose and fix common issues when using Acquiescence.

## Common Issues

### Element Not Found

**Problem:** You get errors about elements not being found or being `null`.

**Symptoms:**
```typescript
const button = document.querySelector('#my-button'); // null
await inspector.waitForInteractionReady(button, 'click', 5000); // Error!
```

**Solutions:**

1. **Wait for element to exist:**
```typescript
async function waitForElement(selector: string, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Element ${selector} not found`);
}

const button = await waitForElement('#my-button');
```

2. **Check your selector:**
```typescript
// Verify element exists in console
console.log(document.querySelector('#my-button'));

// Try different selectors
document.querySelector('[data-testid="my-button"]');
document.querySelector('.my-button-class');
```

3. **Check for Shadow DOM:**
```typescript
// Element might be inside shadow root
const host = document.querySelector('my-component');
const button = host?.shadowRoot?.querySelector('#my-button');
```

### Element Not Connected Error

**Problem:** Error message: "element not connected"

**Symptoms:**
```typescript
// Error: element not connected
const result = await inspector.queryElementStates(button, ['visible']);
```

**Cause:** The element was removed from the DOM between selection and state check.

**Solutions:**

1. **Store reference to stable element:**
```typescript
// ❌ Element might be replaced
function getButton() {
  return document.querySelector('#button');
}

// Use fresh reference
await inspector.waitForInteractionReady(getButton(), 'click', 5000);
```

2. **Re-query if element might be replaced:**
```typescript
async function clickWithRetry(selector: string) {
  for (let i = 0; i < 3; i++) {
    try {
      const element = document.querySelector(selector);
      if (!element) throw new Error('Element not found');
      
      await inspector.waitForInteractionReady(element, 'click', 5000);
      element.click();
      return;
    } catch (error) {
      if (error.message.includes('not connected') && i < 2) {
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      throw error;
    }
  }
}
```

### Timeout Waiting for Interaction

**Problem:** Error message: "timeout waiting for interaction to be ready"

**Symptoms:**
```typescript
// Throws after 5 seconds
await inspector.waitForInteractionReady(element, 'click', 5000);
```

**Diagnose:**

```typescript
// Check what state is preventing readiness
async function diagnoseInteraction(element: Element, type: ElementInteractionType) {
  console.log('Diagnosing element:', element);
  
  // Check each required state
  const visible = await inspector.queryElementState(element, 'visible');
  console.log('Visible:', visible.matches, visible.received);
  
  const enabled = await inspector.queryElementState(element, 'enabled');
  console.log('Enabled:', enabled.matches, enabled.received);
  
  const inview = await inspector.queryElementState(element, 'inview');
  console.log('In View:', inview.matches, inview.received);
  
  const stable = await inspector.queryElementStates(element, ['stable']);
  console.log('Stable:', stable.status);
  
  if (type === 'type' || type === 'clear') {
    const editable = await inspector.queryElementState(element, 'editable');
    console.log('Editable:', editable.matches, editable.received);
  }
}

await diagnoseInteraction(element, 'click');
```

**Solutions:**

1. **Element not visible:**
```typescript
// Check if element has display:none or visibility:hidden
const style = window.getComputedStyle(element);
console.log('Display:', style.display);
console.log('Visibility:', style.visibility);
console.log('Opacity:', style.opacity);
```

2. **Element is disabled:**
```typescript
// Check if disabled
console.log('Disabled attr:', element.hasAttribute('disabled'));
console.log('Aria-disabled:', element.getAttribute('aria-disabled'));

// Check parent for aria-disabled
let parent = element.parentElement;
while (parent) {
  if (parent.getAttribute('aria-disabled') === 'true') {
    console.log('Parent is aria-disabled:', parent);
    break;
  }
  parent = parent.parentElement;
}
```

3. **Element not in viewport:**
```typescript
// Check viewport position
const rect = element.getBoundingClientRect();
console.log('Element rect:', rect);
console.log('Viewport size:', {
  width: window.innerWidth,
  height: window.innerHeight
});

// Try scrolling manually
element.scrollIntoView({ block: 'center', inline: 'center' });
```

4. **Element not stable:**
```typescript
// Check if element is animating
const style = window.getComputedStyle(element);
console.log('Animation:', style.animation);
console.log('Transition:', style.transition);

// Wait longer for animations to complete
await inspector.waitForInteractionReady(element, 'click', 10000);
```

### Element Obscured by Another Element

**Problem:** Error mentioning an element is obscured by another element.

**Symptoms:**
```typescript
// Error: <div class="overlay"> from <dialog> subtree
await inspector.getElementClickPoint(button);
```

**Cause:** Another element is covering the target element at its center point.

**Solutions:**

1. **Close obstructing elements:**
```typescript
// Close modal/dialog first
const modal = document.querySelector('.modal');
if (modal) {
  modal.style.display = 'none';
}

// Now try interaction
await inspector.waitForInteractionReady(button, 'click', 5000);
```

2. **Use offset to click different part:**
```typescript
// Click offset from center to avoid obstruction
const result = await inspector.isInteractionReady(
  button,
  'click',
  { x: 20, y: 0 } // 20px right of center
);
```

3. **Wait for obstruction to disappear:**
```typescript
// Wait for overlay to disappear
async function waitForElementGone(selector: string, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const element = document.querySelector(selector);
    if (!element || !inspector.isElementVisible(element)) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

await waitForElementGone('.loading-overlay');
await inspector.waitForInteractionReady(button, 'click', 5000);
```

### Element Hidden by Overflow

**Problem:** Error message: "element is not in view port, and cannot be scrolled into view due to overflow"

**Cause:** Element is hidden by an ancestor with `overflow: hidden`.

**Solutions:**

1. **Check overflow styles:**
```typescript
// Find which parent has overflow:hidden
let parent = element.parentElement;
while (parent) {
  const style = window.getComputedStyle(parent);
  if (style.overflow === 'hidden' || style.overflowX === 'hidden' || style.overflowY === 'hidden') {
    console.log('Parent with overflow:hidden:', parent);
  }
  parent = parent.parentElement;
}
```

2. **Temporarily change overflow:**
```typescript
// Store original overflow
const parent = element.closest('.container');
const originalOverflow = parent.style.overflow;

// Change to allow scrolling
parent.style.overflow = 'visible';

// Interact
await inspector.waitForInteractionReady(element, 'click', 5000);
element.click();

// Restore
parent.style.overflow = originalOverflow;
```

### Editable State Error

**Problem:** Error: "Element is not an `<input>`, `<textarea>`, `<select>` or [contenteditable]..."

**Cause:** Trying to check `editable` state on a non-input element.

**Solutions:**

1. **Check correct element type:**
```typescript
// Verify element type
console.log('Tag name:', element.tagName);
console.log('Is contenteditable:', element.hasAttribute('contenteditable'));

// Only check editable for appropriate elements
if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) ||
    element.hasAttribute('contenteditable')) {
  await inspector.queryElementState(element, 'editable');
}
```

2. **Use correct interaction type:**
```typescript
// For buttons, use 'click' not 'type'
await inspector.waitForInteractionReady(button, 'click', 5000); // ✓

// For inputs, use 'type'
await inspector.waitForInteractionReady(input, 'type', 5000); // ✓
```

## Performance Issues

### Slow State Checks

**Problem:** State checks taking too long.

**Solutions:**

1. **Reduce unnecessary checks:**
```typescript
// ❌ Too many checks
await inspector.queryElementStates(element, 
  ['visible', 'enabled', 'editable', 'stable', 'inview']
);

// ✅ Only necessary checks
await inspector.queryElementStates(element, ['visible', 'enabled']);
```

2. **Skip stability when not needed:**
```typescript
// Static elements don't need stability
await inspector.queryElementStates(staticElement, ['visible']);
```

3. **Use helper methods for sync checks:**
```typescript
// ❌ Async when sync would work
const result = await inspector.queryElementState(element, 'visible');

// ✅ Sync helper
const visible = inspector.isElementVisible(element);
```

### Memory Leaks

**Problem:** Memory usage grows over time.

**Cause:** Holding references to removed elements.

**Solutions:**

1. **Don't store element references long-term:**
```typescript
// ❌ Storing elements
class PageObject {
  private button = document.querySelector('#button');
}

// ✅ Query when needed
class PageObject {
  getButton() {
    return document.querySelector('#button');
  }
}
```

2. **Clean up in tests:**
```typescript
afterEach(() => {
  // Clear DOM
  document.body.innerHTML = '';
  
  // Force garbage collection in Node.js test environments
  if (global.gc) {
    global.gc();
  }
});
```

## Browser-Specific Issues

### Safari Issues

**Problem:** Behavior differs in Safari.

**Solutions:**

1. **Longer timeouts in Safari:**
```typescript
const timeout = navigator.userAgent.includes('Safari') ? 10000 : 5000;
await inspector.waitForInteractionReady(element, 'click', timeout);
```

2. **Check Intersection Observer support:**
```typescript
if (!window.IntersectionObserver) {
  console.error('IntersectionObserver not supported');
  // Use polyfill or alternative approach
}
```

### Firefox Issues

**Problem:** Different hit testing behavior.

**Solutions:**

1. **Account for different `elementsFromPoint` behavior:**
   - Acquiescence handles this internally, but be aware of possible differences

2. **Use longer stability checks:**
```typescript
// Firefox sometimes needs extra frame for stability
await inspector.queryElementStates(element, ['stable']);
```

## Debugging Tools

### Visual Debugging

```typescript
function highlightElement(element: Element, color = 'red') {
  element.style.outline = `3px solid ${color}`;
  setTimeout(() => {
    element.style.outline = '';
  }, 2000);
}

// Highlight element being checked
highlightElement(button);
await inspector.waitForInteractionReady(button, 'click', 5000);
```

### Comprehensive Diagnostic

```typescript
async function fullDiagnostic(element: Element) {
  console.log('=== Element Diagnostic ===');
  console.log('Element:', element);
  console.log('Connected:', element.isConnected);
  console.log('Tag:', element.tagName);
  console.log('ID:', element.id);
  console.log('Classes:', element.className);
  
  const rect = element.getBoundingClientRect();
  console.log('Rect:', rect);
  
  const style = window.getComputedStyle(element);
  console.log('Display:', style.display);
  console.log('Visibility:', style.visibility);
  console.log('Opacity:', style.opacity);
  console.log('Position:', style.position);
  
  console.log('\n=== State Checks ===');
  console.log('Visible:', inspector.isElementVisible(element));
  console.log('Disabled:', inspector.isElementDisabled(element));
  console.log('Scrollable:', inspector.isElementScrollable(element));
  
  const inView = await inspector.isElementInViewPort(element);
  console.log('In Viewport:', inView);
  
  console.log('\n=== Interaction Check ===');
  try {
    const result = await inspector.isInteractionReady(element, 'click');
    console.log('Interaction Ready:', result);
  } catch (error) {
    console.log('Interaction Error:', error.message);
  }
}
```

## Getting Help

If you're still stuck:

1. **Check the examples:**
   - [Basic Usage](/examples/basic-usage)
   - [Advanced Patterns](/examples/advanced-patterns)

2. **Review the API documentation:**
   - [API Reference](/api/)

3. **Provide minimal reproduction:**
   - Create a minimal HTML page demonstrating the issue
   - Include the specific Acquiescence code that's failing
   - Note which browser and version

4. **File an issue:**
   - Include diagnostic output
   - Provide expected vs actual behavior
   - Share any error messages

## Next Steps

- Review [Best Practices](/guide/best-practices)
- See [Examples](/examples/basic-usage)
- Check [API Reference](/api/)

