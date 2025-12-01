# API Reference

Complete API reference for Acquiescence library.

## Overview

Acquiescence provides a TypeScript-first API for querying element states and waiting for interaction readiness. The library is built around a few core concepts:

- **ElementStateInspector**: The main class for inspecting element states
- **State Types**: Predefined element states like `visible`, `enabled`, `stable`
- **Interaction Types**: Different types of user interactions like `click`, `type`, `hover`
- **Waiters**: Helper classes for polling with timeouts

## Quick Reference

### Main Class

#### **ElementStateInspector**

The primary class for all element state inspection operations.

```typescript
import { ElementStateInspector } from 'acquiescence';

const inspector = new ElementStateInspector();
```

### Core Methods

#### State Querying

| Method | Description |
|--------|-------------|
| `queryElementState()` | Check a single element state |
| `queryElementStates()` | Check multiple element states |
| `isElementVisible()` | Synchronously check visibility |
| `isElementDisabled()` | Synchronously check disabled state |
| `isElementReadOnly()` | Synchronously check read-only state |
| `isElementScrollable()` | Check if element can be scrolled into view |

#### Interaction Checking

| Method | Description |
|--------|-------------|
| `isInteractionReady()` | Check if element is ready for interaction |
| `waitForInteractionReady()` | Wait for element to become ready |
| `getElementClickPoint()` | Get the precise click point for an element |

#### Viewport Methods

| Method | Description |
|--------|-------------|
| `isElementInViewPort()` | Check if element is in viewport |
| `getElementInViewPortRect()` | Get element's bounding rect in viewport |

## Type Definitions

### ElementState

Union type representing all possible element states:

```typescript
type ElementState = 
  | 'visible'      // Element is visible
  | 'hidden'       // Element is hidden
  | 'enabled'      // Element is enabled
  | 'disabled'     // Element is disabled
  | 'editable'     // Element can accept text input
  | 'checked'      // Checkbox/radio is checked
  | 'unchecked'    // Checkbox/radio is unchecked
  | 'indeterminate' // Checkbox is indeterminate
  | 'stable'       // Element position is stable
  | 'inview'       // Element is in viewport
  | 'notinview'    // Element not in viewport but scrollable
  | 'unviewable';  // Element cannot be scrolled into view
```

### ElementInteractionType

Types of interactions that can be performed:

```typescript
type ElementInteractionType = 
  | 'click'        // Single click
  | 'doubleclick'  // Double click
  | 'hover'        // Hover/mouseover
  | 'drag'         // Drag operation
  | 'drop'         // Drop operation
  | 'type'         // Text input
  | 'clear'        // Clear input
  | 'screenshot';  // Screenshot capture
```

### ElementStateQueryResult

Result from querying an element state:

```typescript
interface ElementStateQueryResult {
  matches: boolean;      // True if state matches
  received?: string;     // Actual state received
  isRadio?: boolean;     // True if element is a radio button
}
```

### ElementInteractionReadyResult

Result from checking interaction readiness:

```typescript
type ElementInteractionReadyResult = 
  | 'ready'       // Element is ready
  | 'notready'    // Element is not ready
  | 'needsscroll'; // Element needs scrolling
```

## Method Details

### queryElementState()

Queries a single state of an element.

```typescript
async queryElementState(
  node: Node,
  state: ElementStateWithoutStable
): Promise<ElementStateQueryResult>
```

**Parameters:**
- `node`: The node to query (converted to nearest element)
- `state`: The state to check (cannot be `'stable'`)

**Returns:** Promise resolving to query result with `matches` and `received` properties

**Throws:** Error if invalid state is provided

**Example:**
```typescript
const result = await inspector.queryElementState(button, 'visible');
console.log(result.matches); // true or false
console.log(result.received); // 'visible' or 'hidden'
```

---

### queryElementStates()

Queries multiple states of an element.

```typescript
async queryElementStates(
  node: Node,
  states: ElementState[]
): Promise<
  | { status: 'success' }
  | { status: 'failure', missingState: ElementState }
  | { status: 'error', message: string }
>
```

**Parameters:**
- `node`: The node to query
- `states`: Array of states to check

**Returns:** Promise resolving to:
- `{ status: 'success' }` if all states match
- `{ status: 'failure', missingState }` if any state doesn't match
- `{ status: 'error', message }` if element is not connected

**Example:**
```typescript
const result = await inspector.queryElementStates(
  input,
  ['visible', 'enabled', 'editable']
);

if (result.status === 'success') {
  // All states matched
} else if (result.status === 'failure') {
  console.log('Missing:', result.missingState);
}
```

---

### isInteractionReady()

Checks if an element is ready for a specific interaction.

```typescript
async isInteractionReady(
  element: Element,
  interactionType: ElementInteractionType,
  hitPointOffset?: { x: number, y: number }
): Promise<{
  status: ElementInteractionReadyResult,
  interactionPoint?: { x: number, y: number }
}>
```

**Parameters:**
- `element`: The element to check
- `interactionType`: Type of interaction
- `hitPointOffset`: Optional offset from element center

**Returns:** Promise with status and optional interaction point

**Throws:** Error if element is not connected or cannot be interacted with

**Example:**
```typescript
const result = await inspector.isInteractionReady(button, 'click');

if (result.status === 'ready') {
  console.log('Click at:', result.interactionPoint);
} else if (result.status === 'needsscroll') {
  element.scrollIntoView();
}
```

---

### waitForInteractionReady()

Waits for an element to become ready for interaction.

```typescript
async waitForInteractionReady(
  element: Element,
  interactionType: ElementInteractionType,
  timeoutInMilliseconds: number,
  hitPointOffset?: { x: number, y: number }
): Promise<{ x: number, y: number }>
```

**Parameters:**
- `element`: Element to wait for
- `interactionType`: Type of interaction
- `timeoutInMilliseconds`: Maximum wait time
- `hitPointOffset`: Optional offset from center

**Returns:** Promise resolving to interaction point coordinates

**Throws:** Error if timeout is reached or element cannot be interacted with

**Example:**
```typescript
try {
  const hitPoint = await inspector.waitForInteractionReady(
    button,
    'click',
    5000
  );
  // Element is ready at hitPoint
} catch (error) {
  console.error('Timeout waiting for element');
}
```

---

### isElementVisible()

Synchronously checks if an element is visible.

```typescript
isElementVisible(element: Element): boolean
```

**Parameters:**
- `element`: Element to check

**Returns:** `true` if element is visible, `false` otherwise

**Example:**
```typescript
if (inspector.isElementVisible(element)) {
  console.log('Element is visible');
}
```

---

### isElementDisabled()

Synchronously checks if an element is disabled.

```typescript
isElementDisabled(element: Element): boolean
```

**Parameters:**
- `element`: Element to check

**Returns:** `true` if element is disabled (native or ARIA), `false` otherwise

**Example:**
```typescript
if (!inspector.isElementDisabled(button)) {
  button.click();
}
```

---

### isElementReadOnly()

Synchronously checks if an element is read-only.

```typescript
isElementReadOnly(element: Element): boolean | 'error'
```

**Parameters:**
- `element`: Element to check

**Returns:** 
- `true` if element is read-only
- `false` if element is editable
- `'error'` if element type doesn't support read-only

**Example:**
```typescript
const readOnly = inspector.isElementReadOnly(input);

if (readOnly === true) {
  console.log('Input is read-only');
} else if (readOnly === false) {
  console.log('Input is editable');
}
```

---

### isElementInViewPort()

Checks if an element is currently in the viewport.

```typescript
async isElementInViewPort(element: Element): Promise<boolean>
```

**Parameters:**
- `element`: Element to check

**Returns:** Promise resolving to `true` if in viewport, `false` otherwise

**Example:**
```typescript
const inView = await inspector.isElementInViewPort(element);

if (!inView) {
  element.scrollIntoView();
}
```

---

### getElementInViewPortRect()

Gets the bounding rectangle of an element within the viewport.

```typescript
async getElementInViewPortRect(
  element: Element
): Promise<{
  x: number,
  y: number,
  width: number,
  height: number
} | undefined>
```

**Parameters:**
- `element`: Element to get rect for

**Returns:** Promise resolving to rect object or `undefined` if not in viewport

**Example:**
```typescript
const rect = await inspector.getElementInViewPortRect(element);

if (rect) {
  console.log(`Element at (${rect.x}, ${rect.y})`);
  console.log(`Size: ${rect.width}x${rect.height}`);
}
```

## Helper Classes

### TimeoutWaiter

Generic waiter class for polling with timeout.

```typescript
import { TimeoutWaiter } from 'acquiescence';

const waiter = new TimeoutWaiter<string>(
  async () => {
    // Your condition check
    return someCondition ? 'result' : null;
  },
  5000, // timeout
  [0, 100, 500] // poll intervals
);

const result = await waiter.waitForCondition();
```

### RequestAnimationFrameWaiter

Waiter that polls using requestAnimationFrame.

```typescript
import { RequestAnimationFrameWaiter } from 'acquiescence';

const waiter = new RequestAnimationFrameWaiter<boolean>(
  () => {
    // Check on each animation frame
    return someCondition || undefined;
  },
  5000 // timeout
);

const result = await waiter.waitForCondition();
```

## TypeScript Usage

Full type safety with IntelliSense support:

```typescript
import { 
  ElementStateInspector,
  ElementState,
  ElementInteractionType,
  ElementStateQueryResult
} from 'acquiescence';

const inspector: ElementStateInspector = new ElementStateInspector();

// Type-safe state array
const states: ElementState[] = ['visible', 'enabled'];

// Type-safe interaction types
const interactionType: ElementInteractionType = 'click';

// Typed results
const result: ElementStateQueryResult = 
  await inspector.queryElementState(element, 'visible');
```

## Browser Compatibility

- **Chrome/Edge**: 80+
- **Firefox**: 80+
- **Safari**: 14+

Requires support for:
- IntersectionObserver API
- requestAnimationFrame
- ES2020 features

## Next Steps

- Explore [Examples](/examples/basic-usage)
- Review [Best Practices](/guide/best-practices)
- See [Getting Started Guide](/guide/getting-started)

::: tip Auto-Generated Documentation
For complete API documentation with all method signatures, parameter types, and return types, see the [Full TypeDoc API Reference](/api-reference/index.html).

The TypeDoc documentation is automatically generated from the TypeScript source code and includes:
- Complete method signatures with all overloads
- Detailed parameter and return type information
- Source code links
- Inheritance hierarchies
- Module organization
:::

