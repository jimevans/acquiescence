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
} else if (result.status === 'needsscroll') {
  console.log('Element needs to be scrolled into view');
} else {
  console.log('Element is not ready for interaction');
}
```

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

When an element is ready, `isInteractionReady()` returns the precise point where the interaction should occur:

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
try {
  const result = await inspector.isInteractionReady(button, 'click');
  
  if (result.status === 'ready') {
    console.log('Clear path to element');
  }
} catch (error) {
  // Error thrown if element is obscured
  console.error(error.message);
  // Example: "<div class='modal'> from <dialog> subtree"
}
```

::: info Shadow DOM Support
Hit testing works correctly with Shadow DOM, including closed shadow roots. The algorithm traverses the composed tree to accurately determine if the target is accessible.
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

### Possible Errors

When using interaction methods, you may encounter these errors:

**"element not connected"**
- The element was removed from the DOM

**"element is not in view port, and cannot be scrolled into view due to overflow"**
- The element is hidden by `overflow: hidden` on an ancestor

**"element is not visible"**
- The element has zero width or height

**"`<element>` from `<ancestor>` subtree"**
- The target element is obscured by another element

**"timeout waiting for interaction to be ready"**
- The element didn't become ready within the specified timeout

### Handling Errors

```typescript
try {
  const hitPoint = await inspector.waitForInteractionReady(
    element,
    'click',
    5000
  );
  
  // Perform interaction
} catch (error) {
  if (error.message.includes('not connected')) {
    console.error('Element was removed from DOM');
  } else if (error.message.includes('timeout')) {
    console.error('Element did not become ready in time');
  } else if (error.message.includes('overflow')) {
    console.error('Element cannot be scrolled into view');
  } else {
    console.error('Unexpected error:', error.message);
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

