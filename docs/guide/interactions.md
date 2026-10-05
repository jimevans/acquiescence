# Interactions

Beyond state checking, Acquiescence provides powerful tools for determining if elements are ready for specific user interactions.

## Interaction Types

Acquiescence supports checking readiness for different interaction types:

| Type | Description |
|------|-------------|
| `click` | Single click interaction |
| `doubleclick` | Double-click interaction |
| `hover` | Hover/mouseover interaction |
| `drag` | Drag operation start |
| `drop` | Drop operation target |
| `type` | Text input operation |
| `clear` | Clear input operation |
| `screenshot` | Screenshot capture |

## Checking Interaction Readiness

### `isInteractionReady()`

Checks if an element is currently ready for a specific interaction:

```typescript
const result = await inspector.isInteractionReady(button, 'click');

if (result.status === 'ready') {
  console.log('Element is ready at point:', result.interactionPoint);
  // result.interactionPoint: { x: number, y: number }
  // result.interactionOffset: the same point, as an offset from the element's in-view center
} else if (result.status === 'needsscroll') {
  console.log('Element is out of view, but can be scrolled into view');
} else {
  console.log('Element is not ready for interaction:', result.reason);
}
```

`isInteractionReady()` does not throw. When the element is not ready, `result.reason` says why; see [Reasons an Element Is Not Ready](#reasons-an-element-is-not-ready).

#### Required States by Interaction Type

Different interactions require different element states:

**Click, Double-click, Hover, Drag:**
- `visible`
- `enabled`
- `stable`
- `inview`

**Type, Clear:**
- `visible`
- `enabled`
- `editable`
- `stable`
- `inview`

**Screenshot:**
- `visible`
- `stable`
- `inview`

**Drop:**
- `visible`
- `stable`
- `inview`

### Hit Point Calculation

When an element is ready, `isInteractionReady()` returns the precise point where the interaction should occur, in viewport coordinates, as `interactionPoint`. It also returns the point as `interactionOffset`, an offset from the element's in-view center point, which is where a WebDriver element origin places the pointer:

```typescript
const result = await inspector.isInteractionReady(button, 'click');

if (result.status === 'ready') {
  const { x, y } = result.interactionPoint;
  
  // Use these coordinates for your interaction
  button.dispatchEvent(new MouseEvent('click', {
    clientX: x,
    clientY: y,
    bubbles: true
  }));
}
```

#### Custom Hit Point Offset

You can specify a custom offset from the element's center:

```typescript
// Click 10px right and 5px down from center
const result = await inspector.isInteractionReady(
  button,
  'click',
  { x: 10, y: 5 }
);
```

### Element Obstruction Detection

`isInteractionReady()` performs hit testing to ensure the target element isn't obscured by another element:

```typescript
const result = await inspector.isInteractionReady(button, 'click');

if (result.status === 'ready') {
  console.log('Clear path to element');
} else if (result.reason?.startsWith('obscured by')) {
  console.error(result.reason);
  // Example: "obscured by <div class='modal'> from <dialog> subtree"
}
```

::: info Shadow DOM Support
Hit testing works with Shadow DOM, including closed shadow roots, because it walks up from the target element through its shadow roots to the document. The algorithm traverses the composed tree to accurately determine if the target is accessible.
:::

## Waiting for Interaction Readiness

### `waitForInteractionReady()`

Waits for an element to become ready for interaction, with automatic scrolling and intelligent polling:

```typescript
try {
  const hitPoint = await inspector.waitForInteractionReady(
    button,
    'click',
    5000 // timeout in milliseconds
  );
  
  console.log(`Ready at (${hitPoint.x}, ${hitPoint.y})`);
  // Perform your interaction
} catch (error) {
  console.error('Element not ready within timeout');
}
```

### Automatic Scrolling

If an element needs scrolling, `waitForInteractionReady()` automatically scrolls it into view:

```typescript
// This will automatically scroll the button into view
const hitPoint = await inspector.waitForInteractionReady(
  hiddenButton,
  'click',
  5000
);
```

The scrolling uses:
```typescript
element.scrollIntoView({
  behavior: 'instant',
  block: 'center',
  inline: 'center'
});
```

### Polling Strategy

The waiting mechanism uses an intelligent polling strategy with increasing intervals:

| Attempt | Delay |
|---------|-------|
| 1st | 0ms (immediate) |
| 2nd | 0ms |
| 3rd | 20ms |
| 4th | 50ms |
| 5th | 100ms |
| 6th | 100ms |
| 7th+ | 500ms |

This ensures:
- Fast response for already-ready elements
- Reasonable performance for quick transitions
- Efficient polling for longer waits

## Advanced Patterns

### Pattern 1: Retry with Scrolling

```typescript
async function clickWithRetry(element: Element, maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const hitPoint = await inspector.waitForInteractionReady(
        element,
        'click',
        2000
      );
      
      // Perform click
      element.dispatchEvent(new MouseEvent('click', {
        clientX: hitPoint.x,
        clientY: hitPoint.y,
        bubbles: true
      }));
      
      return; // Success
    } catch (error) {
      if (i === maxAttempts - 1) throw error;
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
```

### Pattern 2: Check Before Wait

```typescript
async function smartWaitForClick(element: Element) {
  // Quick check first
  const check = await inspector.isInteractionReady(element, 'click');
  
  if (check.status === 'ready') {
    return check.interactionPoint;
  }
  
  if (check.status === 'needsscroll') {
    // Just scroll and return immediately
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Now wait with timeout
  return inspector.waitForInteractionReady(element, 'click', 5000);
}
```

### Pattern 3: Validate Interaction Point

```typescript
async function getValidatedInteractionPoint(element: Element) {
  const result = await inspector.isInteractionReady(element, 'click');
  
  if (result.status !== 'ready') {
    throw new Error(`Element not ready: ${result.status}`);
  }
  
  const rect = await inspector.getElementInViewPortRect(element);
  
  if (!rect) {
    throw new Error('Element not in viewport');
  }
  
  const { x, y } = result.interactionPoint;
  
  // Verify point is within element bounds
  if (x < rect.x || x > rect.x + rect.width ||
      y < rect.y || y > rect.y + rect.height) {
    throw new Error('Interaction point outside element bounds');
  }
  
  return { x, y };
}
```

## Error Handling

### Reasons an Element Is Not Ready

`isInteractionReady()` reports why an element is not ready as `result.reason`, with `status: 'notready'`:

| Reason | Meaning |
|--------|---------|
| `'notconnected'` | The element was removed from the DOM |
| `'stable'` | The element is still moving |
| `'hidden'` | The element is not visible |
| `'unviewable'` | The element is hidden by overflow on an ancestor and cannot be scrolled into view |
| `'disabled'` | The element is disabled |
| `'readOnly'` | The element is read-only (`type` and `clear`) |
| `'noteditable'` | The element cannot be edited at all (`type` and `clear`) |
| `'element is not in view port'` | The element is not in the viewport when its hit point is computed |
| `'element is not visible (width: …, height: …)'` | The element's rectangle in the viewport has zero width or height |
| `'obscured by <element>'` or `'obscured by <element> from <ancestor> subtree'` | Another element would receive the interaction |

An element that is out of view but can be scrolled into view has `status: 'needsscroll'`, not a reason.

### Handling Errors

`waitForInteractionReady()` keeps polling while the element is not ready for any of these reasons, including when it is not connected. It throws only when the timeout is reached, with the message `'timeout waiting for interaction to be ready'`. To find out why, check the element afterward:

```typescript
try {
  const hitPoint = await inspector.waitForInteractionReady(
    element,
    'click',
    5000
  );
  
  // Perform interaction
} catch (error) {
  const result = await inspector.isInteractionReady(element, 'click');
  if (result.reason === 'notconnected') {
    console.error('Element was removed from DOM');
  } else if (result.reason === 'unviewable') {
    console.error('Element cannot be scrolled into view');
  } else {
    console.error('Element did not become ready in time:', result.reason ?? result.status);
  }
}
```

## Related Methods

### `getElementInViewPortRect()`

Gets the bounding rectangle of an element within the viewport:

```typescript
const rect = await inspector.getElementInViewPortRect(element);

if (rect) {
  console.log(`Element bounds: ${rect.x}, ${rect.y}, ${rect.width}x${rect.height}`);
} else {
  console.log('Element not in viewport');
}
```

### `isElementInViewPort()`

Checks if an element intersects with the viewport:

```typescript
const inView = await inspector.isElementInViewPort(element);

if (inView) {
  console.log('Element is in viewport');
}
```

### `getElementClickPoint()`

Gets the click point for an element without checking all states:

```typescript
const result = await inspector.getElementClickPoint(element);

if (result.status === 'success') {
  console.log('Click point:', result.hitPoint);
} else {
  console.error('Error:', result.message);
}
```

## Next Steps

- See [Stability Detection](/guide/stability)
- Explore [Best Practices](/guide/best-practices)
- Check out [Interaction Examples](/examples/waiting-interactions)
- View the [API Reference](/api/)

