# Advanced Patterns

Advanced usage patterns and techniques for Acquiescence.

## Performance Optimization

### Example 1: Batch Operations with Caching

```typescript
class CachedInspector {
  private inspector = new ElementStateInspector();
  private cache = new Map<Element, { timestamp: number; data: any }>();
  private cacheTimeout = 100; // ms
  
  async queryWithCache(element: Element, states: ElementState[]) {
    const cached = this.cache.get(element);
    const now = Date.now();
    
    if (cached && now - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    
    const result = await this.inspector.queryElementStates(element, states);
    this.cache.set(element, { timestamp: now, data: result });
    
    // Clean old cache entries
    for (const [el, cache] of this.cache.entries()) {
      if (now - cache.timestamp > this.cacheTimeout) {
        this.cache.delete(el);
      }
    }
    
    return result;
  }
}
```

### Example 2: Debounced State Checking

```typescript
class DebouncedChecker {
  private inspector = new ElementStateInspector();
  private pending = new Map<Element, NodeJS.Timeout>();
  
  checkWithDebounce(
    element: Element,
    states: ElementState[],
    delay: number = 250
  ): Promise<any> {
    return new Promise((resolve) => {
      // Cancel pending check
      const existing = this.pending.get(element);
      if (existing) {
        clearTimeout(existing);
      }
      
      // Schedule new check
      const timeout = setTimeout(async () => {
        this.pending.delete(element);
        const result = await this.inspector.queryElementStates(element, states);
        resolve(result);
      }, delay);
      
      this.pending.set(element, timeout);
    });
  }
}
```

## Complex Interaction Scenarios

### Example 3: Drag and Drop

```typescript
async function dragAndDrop(source: Element, target: Element) {
  try {
    // Wait for source to be ready for dragging
    const sourcePoint = await inspector.waitForInteractionReady(source, 'drag', 5000);
    
    // Wait for target to be ready for dropping
    const targetPoint = await inspector.waitForInteractionReady(target, 'drop', 5000);
    
    // Simulate drag start
    source.dispatchEvent(new DragEvent('dragstart', {
      clientX: sourcePoint.x,
      clientY: sourcePoint.y,
      bubbles: true,
      cancelable: true
    }));
    
    // Simulate drag over target
    target.dispatchEvent(new DragEvent('dragover', {
      clientX: targetPoint.x,
      clientY: targetPoint.y,
      bubbles: true,
      cancelable: true
    }));
    
    // Simulate drop
    target.dispatchEvent(new DragEvent('drop', {
      clientX: targetPoint.x,
      clientY: targetPoint.y,
      bubbles: true,
      cancelable: true
    }));
    
    // Simulate drag end
    source.dispatchEvent(new DragEvent('dragend', {
      bubbles: true,
      cancelable: true
    }));
    
    console.log('✓ Drag and drop completed');
    return true;
  } catch (error) {
    console.error('✗ Drag and drop failed:', error.message);
    return false;
  }
}
```

### Example 4: Double Click with Verification

```typescript
async function doubleClickWithVerification(element: Element) {
  try {
    const hitPoint = await inspector.waitForInteractionReady(
      element,
      'doubleclick',
      5000
    );
    
    // First click
    element.dispatchEvent(new MouseEvent('click', {
      clientX: hitPoint.x,
      clientY: hitPoint.y,
      bubbles: true,
      detail: 1
    }));
    
    // Small delay between clicks
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verify element is still ready
    const stillReady = await inspector.isInteractionReady(element, 'doubleclick');
    
    if (stillReady.status !== 'ready') {
      throw new Error('Element became unstable between clicks');
    }
    
    // Second click
    element.dispatchEvent(new MouseEvent('click', {
      clientX: hitPoint.x,
      clientY: hitPoint.y,
      bubbles: true,
      detail: 2
    }));
    
    // Double click event
    element.dispatchEvent(new MouseEvent('dblclick', {
      clientX: hitPoint.x,
      clientY: hitPoint.y,
      bubbles: true
    }));
    
    console.log('✓ Double click completed');
    return true;
  } catch (error) {
    console.error('✗ Double click failed:', error.message);
    return false;
  }
}
```

## Shadow DOM Handling

### Example 5: Deep Shadow DOM Traversal

```typescript
async function clickInShadowDOM(
  hostSelector: string,
  shadowSelector: string
) {
  const host = document.querySelector(hostSelector);
  
  if (!host?.shadowRoot) {
    throw new Error(`Shadow host not found or no shadow root: ${hostSelector}`);
  }
  
  const element = host.shadowRoot.querySelector(shadowSelector);
  
  if (!element) {
    throw new Error(`Element not found in shadow DOM: ${shadowSelector}`);
  }
  
  await inspector.waitForInteractionReady(element, 'click', 5000);
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  
  console.log('✓ Clicked element in shadow DOM');
}

// Usage
await clickInShadowDOM('my-component', '#shadow-button');
```

### Example 6: Closed Shadow Root Handling

```typescript
class ShadowDOMHelper {
  private inspector = new ElementStateInspector();
  private shadowRootRegistry = new WeakMap<Element, ShadowRoot>();
  
  registerClosedShadowRoot(host: Element, shadowRoot: ShadowRoot) {
    this.shadowRootRegistry.set(host, shadowRoot);
  }
  
  async interactWithClosedShadow(
    host: Element,
    shadowSelector: string,
    interactionType: ElementInteractionType
  ) {
    const shadowRoot = this.shadowRootRegistry.get(host);
    
    if (!shadowRoot) {
      throw new Error('Closed shadow root not registered');
    }
    
    const element = shadowRoot.querySelector(shadowSelector);
    
    if (!element) {
      throw new Error(`Element not found: ${shadowSelector}`);
    }
    
    await this.inspector.waitForInteractionReady(element, interactionType, 5000);
    return element;
  }
}
```

## Conditional Waiting

### Example 7: Wait for One of Multiple Conditions

```typescript
async function waitForAny<T>(
  promises: Promise<T>[],
  timeout: number = 5000
): Promise<{ index: number; result: T }> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        reject(new Error('Timeout waiting for any condition'));
      }
    }, timeout);
    
    promises.forEach((promise, index) => {
      promise.then(result => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve({ index, result });
        }
      }).catch(() => {
        // Ignore individual failures
      });
    });
  });
}

// Usage: Click whichever button becomes ready first
async function clickFirstReady() {
  const buttons = [
    document.querySelector('#button1'),
    document.querySelector('#button2'),
    document.querySelector('#button3')
  ].filter((b): b is Element => b !== null);
  
  const promises = buttons.map(button =>
    inspector.waitForInteractionReady(button, 'click', 10000)
  );
  
  const { index, result } = await waitForAny(promises, 10000);
  
  console.log(`Button ${index + 1} ready first`);
  buttons[index].click();
}
```

### Example 8: Conditional Interaction Based on State

```typescript
async function smartInteract(element: Element) {
  // Check all possible states
  const visible = await inspector.queryElementState(element, 'visible');
  const enabled = await inspector.queryElementState(element, 'enabled');
  const inview = await inspector.queryElementState(element, 'inview');
  
  console.log('Element state:', {
    visible: visible.received,
    enabled: enabled.received,
    inview: inview.received
  });
  
  // Take action based on state
  if (visible.received === 'hidden') {
    console.log('Making element visible...');
    (element as HTMLElement).style.display = 'block';
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (enabled.received === 'disabled') {
    console.log('Cannot interact: element is disabled');
    return false;
  }
  
  if (inview.received === 'notinview') {
    console.log('Scrolling element into view...');
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 500));
  } else if (inview.received === 'unviewable') {
    console.log('Cannot scroll: element is unviewable');
    return false;
  }
  
  // Now wait for full readiness
  await inspector.waitForInteractionReady(element, 'click', 5000);
  element.click();
  return true;
}
```

## Custom Waiters

### Example 9: Custom Polling Strategy

```typescript
class CustomWaiter {
  private inspector = new ElementStateInspector();
  
  async waitWithCustomPoll(
    element: Element,
    condition: (element: Element) => Promise<boolean>,
    pollIntervals: number[] = [0, 100, 200, 500, 1000],
    timeout: number = 10000
  ): Promise<void> {
    const start = Date.now();
    let intervalIndex = 0;
    
    while (Date.now() - start < timeout) {
      if (await condition(element)) {
        return;
      }
      
      const delay = pollIntervals[Math.min(intervalIndex, pollIntervals.length - 1)];
      intervalIndex++;
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }
  
  async waitForStableAndVisible(element: Element, timeout: number = 5000) {
    await this.waitWithCustomPoll(
      element,
      async (el) => {
        const visible = this.inspector.isElementVisible(el);
        if (!visible) return false;
        
        const stable = await this.inspector.queryElementStates(el, ['stable']);
        return stable.status === 'success';
      },
      [0, 50, 100, 250, 500],
      timeout
    );
  }
}
```

### Example 10: Wait with Progress Callback

```typescript
async function waitWithProgress(
  element: Element,
  interactionType: ElementInteractionType,
  timeout: number,
  onProgress: (elapsed: number, status: string) => void
) {
  const start = Date.now();
  const pollInterval = 100;
  
  while (Date.now() - start < timeout) {
    const elapsed = Date.now() - start;
    
    try {
      const result = await inspector.isInteractionReady(element, interactionType);
      
      if (result.status === 'ready') {
        onProgress(elapsed, 'ready');
        return result.interactionPoint;
      }
      
      onProgress(elapsed, result.status);
      
      if (result.status === 'needsscroll') {
        element.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    } catch (error) {
      onProgress(elapsed, `error: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  throw new Error(`Timeout after ${timeout}ms`);
}

// Usage
await waitWithProgress(
  button,
  'click',
  5000,
  (elapsed, status) => {
    console.log(`${elapsed}ms: ${status}`);
  }
);
```

## Testing Utilities

### Example 11: Test Helper Class

```typescript
class TestHelpers {
  private inspector = new ElementStateInspector();
  
  async assertVisible(selector: string, message?: string) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    const result = await this.inspector.queryElementState(element, 'visible');
    if (!result.matches) {
      throw new Error(message || `Expected ${selector} to be visible, but was ${result.received}`);
    }
  }
  
  async assertClickable(selector: string, message?: string) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    const result = await this.inspector.queryElementStates(element, ['visible', 'enabled']);
    if (result.status !== 'success') {
      throw new Error(
        message || `Expected ${selector} to be clickable, but ${result.missingState}`
      );
    }
  }
  
  async waitAndClick(selector: string, timeout: number = 5000) {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    await this.inspector.waitForInteractionReady(element, 'click', timeout);
    element.click();
  }
  
  async waitAndType(selector: string, text: string, timeout: number = 5000) {
    const element = document.querySelector<HTMLInputElement>(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
    
    await this.inspector.waitForInteractionReady(element, 'type', timeout);
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  async waitForDisappear(selector: string, timeout: number = 5000) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      const element = document.querySelector(selector);
      
      if (!element || !this.inspector.isElementVisible(element)) {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Element ${selector} did not disappear within ${timeout}ms`);
  }
}
```

### Example 12: Snapshot Testing

```typescript
class ElementStateSnapshot {
  private inspector = new ElementStateInspector();
  
  async captureSnapshot(element: Element) {
    return {
      visible: this.inspector.isElementVisible(element),
      disabled: this.inspector.isElementDisabled(element),
      readOnly: this.inspector.isElementReadOnly(element),
      scrollable: this.inspector.isElementScrollable(element),
      inViewport: await this.inspector.isElementInViewPort(element),
      viewportRect: await this.inspector.getElementInViewPortRect(element),
      timestamp: Date.now()
    };
  }
  
  async compareSnapshots(
    element: Element,
    before: any,
    after: any
  ) {
    const changes: string[] = [];
    
    for (const key of Object.keys(before)) {
      if (key === 'timestamp') continue;
      
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes.push(`${key}: ${JSON.stringify(before[key])} → ${JSON.stringify(after[key])}`);
      }
    }
    
    return changes;
  }
  
  async trackChanges(
    element: Element,
    duration: number = 5000,
    interval: number = 100
  ) {
    const snapshots: any[] = [];
    const start = Date.now();
    
    while (Date.now() - start < duration) {
      snapshots.push(await this.captureSnapshot(element));
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    return snapshots;
  }
}
```

## Performance Monitoring

### Example 13: Timing Decorator

```typescript
function timed(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;
      console.log(`${propertyKey} took ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`${propertyKey} failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    }
  };
  
  return descriptor;
}

class TimedInspector {
  private inspector = new ElementStateInspector();
  
  @timed
  async waitForInteraction(element: Element, type: ElementInteractionType, timeout: number) {
    return await this.inspector.waitForInteractionReady(element, type, timeout);
  }
}
```

### Example 14: Metrics Collection

```typescript
class InspectorWithMetrics {
  private inspector = new ElementStateInspector();
  private metrics = {
    queriesTotal: 0,
    queriesSuccess: 0,
    queriesFailed: 0,
    averageQueryTime: 0,
    totalQueryTime: 0
  };
  
  async queryWithMetrics(element: Element, states: ElementState[]) {
    const start = performance.now();
    this.metrics.queriesTotal++;
    
    try {
      const result = await this.inspector.queryElementStates(element, states);
      
      if (result.status === 'success') {
        this.metrics.queriesSuccess++;
      } else {
        this.metrics.queriesFailed++;
      }
      
      const duration = performance.now() - start;
      this.metrics.totalQueryTime += duration;
      this.metrics.averageQueryTime = 
        this.metrics.totalQueryTime / this.metrics.queriesTotal;
      
      return result;
    } catch (error) {
      this.metrics.queriesFailed++;
      throw error;
    }
  }
  
  getMetrics() {
    return { ...this.metrics };
  }
  
  resetMetrics() {
    this.metrics = {
      queriesTotal: 0,
      queriesSuccess: 0,
      queriesFailed: 0,
      averageQueryTime: 0,
      totalQueryTime: 0
    };
  }
}
```

## Next Steps

- Review [Best Practices](/guide/best-practices)
- See [Troubleshooting Guide](/guide/troubleshooting)
- Explore the [API Reference](/api/)

