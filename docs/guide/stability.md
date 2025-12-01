# Stability Detection

Stability detection ensures that elements have stopped moving or animating before you interact with them. This is crucial for reliable automation and testing.

## What is Stability?

An element is considered **stable** when its bounding rectangle (position and size) remains unchanged for at least one animation frame. This means:

- The element isn't currently animating
- The element isn't being repositioned by layout changes
- The element isn't affected by scrolling animations
- The element's size isn't changing

## Why Stability Matters

### Problem: Moving Targets

Consider this scenario:

```typescript
// Element is animating into view
const button = document.querySelector('.animated-button');

// Try to click immediately
button.click(); // Might miss! Element is moving
```

Without stability detection:
- Clicks might land on the wrong coordinates
- Screenshots might be blurry or show partial animations
- Elements might move after you've calculated their position

### Solution: Wait for Stability

```typescript
const result = await inspector.queryElementStates(button, ['visible', 'stable']);

if (result.status === 'success') {
  button.click(); // Now we know the element is stable
}
```

## How Stability Detection Works

Acquiescence checks stability by:

1. Recording the element's `getBoundingClientRect()` values
2. Waiting for the next animation frame (using `requestAnimationFrame`)
3. Checking if the position and size are unchanged
4. Repeating for at least one full animation frame cycle

```typescript
// Pseudocode of stability detection
let lastRect = element.getBoundingClientRect();

await nextAnimationFrame();

const currentRect = element.getBoundingClientRect();

const isStable = 
  lastRect.x === currentRect.x &&
  lastRect.y === currentRect.y &&
  lastRect.width === currentRect.width &&
  lastRect.height === currentRect.height;
```

::: info Animation Frames
Stability requires checking across animation frames because JavaScript animations, CSS transitions, and CSS animations all update during the browser's rendering cycle, which occurs between animation frames.
:::

## Using Stability Checks

### As Part of State Queries

```typescript
// Check if element is stable
const result = await inspector.queryElementStates(
  element,
  ['visible', 'stable']
);

if (result.status === 'failure' && result.missingState === 'stable') {
  console.log('Element is still moving');
}
```

### Built into Interaction Readiness

All interaction readiness checks automatically include stability:

```typescript
// Automatically waits for stability
const hitPoint = await inspector.waitForInteractionReady(
  button,
  'click',
  5000
);
```

## Common Scenarios

### 1. CSS Transitions

When elements transition in:

```css
.modal {
  opacity: 0;
  transform: translateY(-20px);
  transition: all 0.3s ease-out;
}

.modal.show {
  opacity: 1;
  transform: translateY(0);
}
```

```typescript
// Show the modal
modal.classList.add('show');

// Wait for it to be stable
const result = await inspector.queryElementStates(
  modal,
  ['visible', 'stable']
);

// Now it's safe to interact
```

### 2. CSS Animations

For animations that repeat or run once:

```css
@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

.slide {
  animation: slideIn 0.5s ease-out;
}
```

```typescript
// Wait for animation to complete
const hitPoint = await inspector.waitForInteractionReady(
  slidingElement,
  'click',
  2000 // Give enough time for animation
);
```

### 3. JavaScript Animations

For elements animated with JavaScript:

```javascript
// Animate element position
function animateElement(element) {
  let pos = 0;
  const interval = setInterval(() => {
    pos += 5;
    element.style.left = pos + 'px';
    
    if (pos >= 100) {
      clearInterval(interval);
    }
  }, 10);
}
```

```typescript
animateElement(box);

// Wait for stability
await inspector.waitForInteractionReady(box, 'click', 3000);
```

### 4. Lazy Loading & Layout Shifts

When content loads and shifts the page:

```typescript
// Image loads and pushes button down
const button = document.querySelector('.below-image');

// Wait for layout to stabilize
const result = await inspector.queryElementStates(
  button,
  ['visible', 'stable', 'inview']
);
```

### 5. Infinite Animations

::: warning Infinite Animations
Elements with infinite animations will never be stable! Consider removing or pausing animations before interaction:

```typescript
// Pause animations
element.style.animationPlayState = 'paused';

// Now check stability
const result = await inspector.queryElementStates(
  element,
  ['visible', 'stable']
);

// Resume animations after interaction
element.style.animationPlayState = 'running';
```
:::

## Performance Considerations

### Stability Check Cost

Stability detection requires waiting for animation frames, which means:

- Minimum wait time: ~16ms (one frame at 60fps)
- Actual wait time: depends on when element becomes stable
- CPU impact: minimal (only `getBoundingClientRect()` calls)

### When to Skip Stability

You might skip stability checks when:

- You know elements are static
- Performance is critical
- You're checking many elements at once

```typescript
// Skip stability for known-static elements
const result = await inspector.queryElementStates(
  staticElement,
  ['visible', 'enabled'] // No 'stable'
);
```

### Optimizing Wait Times

```typescript
// Short timeout for known-fast animations
await inspector.waitForInteractionReady(element, 'click', 1000);

// Longer timeout for complex page loads
await inspector.waitForInteractionReady(element, 'click', 10000);
```

## Advanced Patterns

### Pattern 1: Retry Until Stable

```typescript
async function waitUntilStable(
  element: Element,
  timeout: number = 5000
): Promise<void> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    const result = await inspector.queryElementStates(
      element,
      ['stable']
    );
    
    if (result.status === 'success') {
      return;
    }
    
    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error('Element did not stabilize within timeout');
}
```

### Pattern 2: Stability with Tolerance

For elements that might have sub-pixel changes:

```typescript
async function isStableWithTolerance(
  element: Element,
  tolerance: number = 1
): Promise<boolean> {
  const rect1 = element.getBoundingClientRect();
  
  await new Promise(resolve => requestAnimationFrame(resolve));
  
  const rect2 = element.getBoundingClientRect();
  
  return (
    Math.abs(rect1.x - rect2.x) <= tolerance &&
    Math.abs(rect1.y - rect2.y) <= tolerance &&
    Math.abs(rect1.width - rect2.width) <= tolerance &&
    Math.abs(rect1.height - rect2.height) <= tolerance
  );
}
```

### Pattern 3: Wait for Multiple Elements

```typescript
async function waitForAllStable(
  elements: Element[],
  timeout: number = 5000
): Promise<void> {
  const promises = elements.map(element =>
    inspector.waitForInteractionReady(element, 'screenshot', timeout)
  );
  
  await Promise.all(promises);
  console.log('All elements are stable');
}
```

## Debugging Stability Issues

### Check Why Element Isn't Stable

```typescript
async function debugStability(element: Element) {
  let lastRect = element.getBoundingClientRect();
  
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    const rect = element.getBoundingClientRect();
    
    if (rect.x !== lastRect.x || rect.y !== lastRect.y) {
      console.log(`Frame ${i}: Position changed`, {
        from: { x: lastRect.x, y: lastRect.y },
        to: { x: rect.x, y: rect.y }
      });
    }
    
    if (rect.width !== lastRect.width || rect.height !== lastRect.height) {
      console.log(`Frame ${i}: Size changed`, {
        from: { w: lastRect.width, h: lastRect.height },
        to: { w: rect.width, h: rect.height }
      });
    }
    
    lastRect = rect;
  }
}
```

## Next Steps

- Learn about [Best Practices](/guide/best-practices)
- See [Waiting Examples](/examples/waiting-interactions)
- Explore the [API Reference](/api/)

