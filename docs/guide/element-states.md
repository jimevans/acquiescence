# Element States

Acquiescence provides comprehensive element state detection that goes beyond simple presence checks. Understanding these states is key to effectively using the library.

## Available States

### Visibility States

#### `visible`

The element is visible on the page. An element is considered visible when:

- It has a positive width and height (> 0)
- The `visibility` CSS property is set to `visible`
- The `display` CSS property is not `none`
- The `opacity` is greater than 0
- Element passes `checkVisibility()` check

```typescript
const result = await inspector.queryElementState(element, 'visible');
// result.matches: true if visible, false otherwise
// result.received: 'visible' or 'hidden'
```

::: details Special Cases

**Elements with `display: contents`:**
Elements with `display: contents` are not rendered themselves, but their children are. Acquiescence checks if any child element is visible.

**Text nodes:**
For elements with only text content, Acquiescence creates a range to check if the text has positive dimensions.

:::

#### `hidden`

The inverse of `visible`. The element is not visible on the page.

```typescript
const result = await inspector.queryElementState(element, 'hidden');
// result.matches: true if hidden, false otherwise
```

### Interaction States

#### `enabled`

The element is not disabled and can be interacted with. Checks:

- Native `disabled` attribute (for form elements)
- `aria-disabled="true"` on the element or any ancestor

```typescript
const result = await inspector.queryElementState(button, 'enabled');
// result.matches: true if enabled, false if disabled
// result.received: 'enabled' or 'disabled'
```

::: info ARIA Disabled
Unlike the native `disabled` attribute, `aria-disabled` applies to all descendants in the accessibility tree. Acquiescence respects this by checking the entire ancestor chain.
:::

#### `disabled`

The inverse of `enabled`. The element is disabled.

```typescript
const result = await inspector.queryElementState(button, 'disabled');
```

#### `editable`

The element can accept text input. For an element to be editable, it must be:

1. Not disabled
2. Not readonly
3. One of:
   - An `<input>`, `<textarea>`, or `<select>` element
   - An element with `contenteditable="true"`
   - An element with a role that supports `aria-readonly`

```typescript
const result = await inspector.queryElementState(input, 'editable');
// result.matches: true if editable
// result.received: 'editable', 'disabled', or 'readOnly'
```

::: warning
If you query `editable` on an element that cannot be editable (like a `<div>` without `contenteditable`), the method will throw an error.
:::

### Viewport States

#### `inview`

The element is currently visible within the viewport. Uses the Intersection Observer API to determine if the element intersects with the viewport.

An element is considered `inview` if:
- It intersects with the viewport
- It can be scrolled into view (not hidden by `overflow: hidden`)

```typescript
const result = await inspector.queryElementState(element, 'inview');
// result.matches: true if in viewport and scrollable
// result.received: 'inview', 'notinview', or 'unviewable'
```

#### `notinview` (received state only)

The element is not currently in the viewport but could be scrolled into view. This is a received state value, not a queryable state.

#### `unviewable` (received state only)

The element cannot be scrolled into view because it's hidden by an ancestor with `overflow: hidden`. This is a received state value, not a queryable state.

```typescript
const result = await inspector.queryElementState(element, 'inview');

if (result.received === 'unviewable') {
  console.log('Element is hidden by overflow and cannot be scrolled to');
}
```

### Animation States

#### `stable`

The element's position has been stable for at least one animation frame. This is useful for ensuring elements aren't moving before interacting with them.

```typescript
const result = await inspector.queryElementStates(element, ['visible', 'stable']);

if (result.status === 'failure' && result.missingState === 'stable') {
  console.log('Element is still moving or animating');
}
```

::: tip When to use stable
Use the `stable` state when:
- Elements are animating into view
- Dealing with lazy-loaded content that shifts the page
- Working with carousels or scrolling animations
- Ensuring precise click coordinates
:::

## Combining States

You can check multiple states at once using `queryElementStates()`:

```typescript
const result = await inspector.queryElementStates(
  button,
  ['visible', 'enabled', 'stable', 'inview']
);

if (result.status === 'success') {
  console.log('Button is fully ready for interaction!');
} else if (result.status === 'failure') {
  console.log(`Button is missing: ${result.missingState}`);
}
```

### Common State Combinations

| Combination | Use Case |
|-------------|----------|
| `['visible', 'enabled']` | Button ready to click |
| `['visible', 'enabled', 'editable']` | Input ready to type |
| `['visible', 'inview', 'stable']` | Element ready for screenshot |
| `['visible', 'enabled', 'stable', 'inview']` | Element ready for precise interaction |

## State Check Order

When using `queryElementStates()`, states are checked in the order provided, with one exception:

::: warning Stability is checked first
The `stable` state is always checked first, regardless of its position in the array. This is because:
1. Stability checking requires waiting for animation frames
2. Other state checks are synchronous (or nearly so)
3. If an element isn't stable, there's no point checking other states yet
:::

```typescript
// 'stable' is checked first, even though it's last in the array
await inspector.queryElementStates(element, ['visible', 'enabled', 'stable']);
```

## Helper Methods

For convenience, Acquiescence provides synchronous helper methods for common state checks:

### `isElementVisible(element: Element): boolean`

Synchronously checks if an element is visible.

```typescript
if (inspector.isElementVisible(element)) {
  console.log('Element is visible');
}
```

### `isElementDisabled(element: Element): boolean`

Synchronously checks if an element is disabled.

```typescript
if (!inspector.isElementDisabled(button)) {
  button.click();
}
```

### `isElementReadOnly(element: Element): boolean | 'error'`

Synchronously checks if an element is readonly. Returns `'error'` if the element type doesn't support readonly.

```typescript
const readOnly = inspector.isElementReadOnly(input);

if (readOnly === true) {
  console.log('Input is readonly');
} else if (readOnly === false) {
  console.log('Input is editable');
} else {
  console.log('Element does not support readonly');
}
```

### `isElementScrollable(element: Element): boolean`

Checks if an element can be scrolled into view.

```typescript
if (!inspector.isElementScrollable(element)) {
  console.log('Element is hidden by overflow: hidden');
}
```

## Next Steps

- Learn about [Interaction Readiness](/guide/interactions)
- See [Examples](/examples/checking-states)
- Explore the [API Reference](/api/)

