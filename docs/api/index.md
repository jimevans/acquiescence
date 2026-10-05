# API Reference

Complete API reference for Acquiescence library.

## Overview

Acquiescence provides a TypeScript-first API for querying element states and waiting for interaction readiness. The library is built around a few core concepts:

- **ElementStateInspector**: The main class for inspecting element states
- **State Types**: Predefined element states like `visible`, `enabled`, `stable`
- **Interaction Types**: Different types of user interactions like `click`, `type`, `hover`
- **Waiters**: Helper classes for polling with timeouts
- **AriaSnapshotGenerator** and **AriaSnapshotMatcher**: Accessibility snapshots of a page, and matching them against templates
- **DomSnapshotGenerator**: Snapshots of a document for a trace viewer
- **ElementDescriber**: Descriptions of the element a user acts on, by the facts a tool can name it by
- **ActionRecorder**: Recording of the actions a user takes in a document
- **ElementPicker**: Letting a user pick an element with the mouse

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

#### Text, Label, and ARIA State

| Method | Description |
|--------|-------------|
| `elementsContainText()` | Check, for each element, whether its rendered text contains a string |
| `elementsMatchAriaStates()` | Check, for each element, whether it has every given ARIA state |
| `findElementsByLabel()` | Find the elements within some scopes whose labels match a text |
| `getElementLabels()` | Get the texts of an element's labels |
| `findOpenShadowRoots()` | Find the open shadow roots within some scopes, including nested ones |

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

### ElementStateWithoutStable

The states that `queryElementState()` accepts: every `ElementState` except `'stable'`.

```typescript
type ElementStateWithoutStable = Exclude<ElementState, 'stable'>;
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

### ElementInteractionReadiness

Result of `isInteractionReady()`:

```typescript
type ElementInteractionReadiness = {
  status: ElementInteractionReadyResult;
  interactionPoint?: { x: number, y: number };   // The hit point, when ready
  interactionOffset?: { x: number, y: number };  // The hit point's offset from the element's in-view center, when ready
  reason?: string;                               // Why the element is not ready, when 'notready'
};
```

### AriaStates

ARIA states for `elementsMatchAriaStates()`; an omitted state is not checked:

```typescript
type AriaStates = {
  checked?: boolean | 'mixed';
  pressed?: boolean | 'mixed';
  expanded?: boolean;
  selected?: boolean;
  level?: number;
  disabled?: boolean;
};
```

### Box

An element's computed box: whether it is visible, whether it is inline, its bounding rectangle, and its cursor.

```typescript
type Box = {
  visible: boolean;
  inline: boolean;
  rect?: DOMRect;
  cursor?: string;
};
```

### Waiter

The interface `TimeoutWaiter` and `RequestAnimationFrameWaiter` implement:

```typescript
type Waiter<T> = {
  waitForCondition(): Promise<T>;
  cancel(): void;
};
```

### Other Types

| Type | Description | Guide |
|------|-------------|-------|
| `DomSnapshot` | A snapshot of a document: `html`, `doctype`, `viewport`, `url`, `wallTime`, `collectionTime` | [DOM Snapshots](/guide/dom-snapshots) |
| `DomNodeSnapshot` | A node of a DOM snapshot: a string for text, or an element | [DOM Snapshots](/guide/dom-snapshots) |
| `ElementSnapshot` | An element of a DOM snapshot: its name, attributes, and children | [DOM Snapshots](/guide/dom-snapshots) |
| `DomSnapshotOptions` | `target`, an element to mark, and `frameSource`, giving each frame's `src` | [DOM Snapshots](/guide/dom-snapshots) |
| `ElementDescription` | The `target` element's facts, and its nameable `ancestors`' | [Element Descriptions](/guide/element-descriptions) |
| `ElementFacts` | An element's facts: role, accessible name, labels, attributes, text, CSS path | [Element Descriptions](/guide/element-descriptions) |
| `ElementDescriptionOptions` | `testIdAttribute` and `maxAncestors` | [Element Descriptions](/guide/element-descriptions) |
| `RecordedAction` | An action recorded: `click`, `check`, `uncheck`, `fill`, `press`, `select`, or `setInputFiles` | [Action Recording](/guide/action-recording) |
| `ModifierKey` | A modifier key held: `'Alt'`, `'Control'`, `'Meta'`, or `'Shift'` | [Action Recording](/guide/action-recording) |
| `ActionRecorderOptions` | `ignore`, which leaves out events aimed at elements it returns `true` for | [Action Recording](/guide/action-recording) |
| `ElementPickerOptions` | `resolve`, giving the element picked for the element under the pointer, and `ignore` | [Element Picking](/guide/element-picking) |

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
- `{ status: 'error', message }` if the element is not connected (`'notconnected'`), or cannot have a queried state: `'noteditable'` for `editable`, `'notcheckable'` for `checked`, `unchecked`, or `indeterminate`

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
): Promise<ElementInteractionReadiness>
```

**Parameters:**
- `element`: The element to check
- `interactionType`: Type of interaction
- `hitPointOffset`: Optional offset from element center

**Returns:** Promise resolving to an `ElementInteractionReadiness`. It does not throw.
- `{ status: 'ready', interactionPoint, interactionOffset }`: the hit point, and its offset from the element's in-view center
- `{ status: 'needsscroll' }`: the element is out of view, but can be scrolled into view
- `{ status: 'notready', reason }`: the element is not ready. The `reason` is one of:
  - a state the element failed: `'hidden'`, `'disabled'`, `'readOnly'`, `'stable'`, or `'unviewable'` (hidden by overflow)
  - `'notconnected'`, or `'noteditable'` for `type` or `clear` on an element that cannot be edited
  - `'element is not in view port'`, or `'element is not visible (width: …, height: …)'`
  - `'obscured by <x>'`, or `'obscured by <x> from <y> subtree'`, naming the element hit instead

**Example:**
```typescript
const result = await inspector.isInteractionReady(button, 'click');

if (result.status === 'ready') {
  console.log('Click at:', result.interactionPoint);
} else if (result.status === 'needsscroll') {
  button.scrollIntoView();
} else {
  console.log('Not ready:', result.reason);
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

**Returns:** Promise resolving to interaction point coordinates. An element out of view is scrolled into view while waiting.

**Throws:** Error with the message `'timeout waiting for interaction to be ready'` if the element is not ready before the timeout. Any other reason the element is not ready, including a disconnected element, is polled until the timeout.

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
- `'error'` if the element is not an `<input>`, `<textarea>`, `<select>`, or editable element, and has no role allowing `aria-readonly`

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

---

### elementsContainText()

Checks, for each element, whether its rendered text contains a string. Text is compared ignoring case, with each run of whitespace treated as one space and whitespace at either end ignored.

```typescript
elementsContainText(elements: Element[], text: string): boolean[]
```

**Returns:** For each element, in order, whether its text contains the string. Empty text is contained in every element.

---

### elementsMatchAriaStates()

Checks, for each element, whether it has every given ARIA state. A state that does not apply to an element, such as checked for a link, does not match.

```typescript
elementsMatchAriaStates(elements: Element[], states: AriaStates): boolean[]
```

**Example:**
```typescript
const [isOpen] = inspector.elementsMatchAriaStates([menuButton], { expanded: true });
```

---

### findElementsByLabel()

Finds the elements within some scopes whose labels match a text. An element's labels are the elements its `aria-labelledby` refers to; failing that, its `aria-label`; failing that, the `label` elements of a form control. Labels are compared as `elementsContainText()` compares text; with `exact`, the whole label must match, with case.

```typescript
findElementsByLabel(scopes: Array<Document | Element>, text: string, exact: boolean): Element[]
```

**Returns:** The matching elements, in the order found, each once. The scope elements themselves are not included.

---

### getElementLabels()

Gets the texts of an element's labels, as `findElementsByLabel()` matches them.

```typescript
getElementLabels(element: Element): string[]
```

**Returns:** The texts, or an empty list if the element is not labelled.

---

### findOpenShadowRoots()

Finds the open shadow roots within some scopes, including nested ones, so that a search can include them.

```typescript
findOpenShadowRoots(scopes: Array<Document | Element | ShadowRoot>): ShadowRoot[]
```

**Returns:** The open shadow roots, each once, in the order found. Closed shadow roots cannot be found.

**Example:**
```typescript
const scopes = [document, ...inspector.findOpenShadowRoots([document])];
const buttons = scopes.flatMap((scope) => Array.from(scope.querySelectorAll('button')));
```

## Accessibility Snapshots

The [Accessibility Snapshots guide](/guide/accessibility-snapshots) describes the snapshot format and the template syntax in full.

### AriaSnapshotGenerator

Takes accessibility snapshots.

```typescript
generate(rootElement: Element, options?: AriaSnapshotOptions): AriaSnapshot
```

**Parameters:**
- `rootElement`: The element to take the snapshot of, which is included if it has a role
- `options`: `refs` (default `true`) gives each node a ref; `refPrefix` (default `''`) is put before each ref

**Returns:** An `AriaSnapshot`: `text`, the snapshot in the snapshot format; `root`, the snapshot as a tree of `AriaNode` objects under a `fragment` node; and `references`, each ref with the element it refers to

**Example:**
```typescript
import { AriaSnapshotGenerator } from 'acquiescence';

const generator = new AriaSnapshotGenerator();
const snapshot = generator.generate(document.body);
console.log(snapshot.text);
// - heading "Welcome, Ada" [level=1] [ref=e2]
```

An element keeps its ref across snapshots taken by the same generator.

---

### AriaSnapshotMatcher

Matches the accessibility snapshot of an element against a template.

```typescript
match(rootElement: Element, template: string): AriaSnapshotMatchResult
```

**Parameters:**
- `rootElement`: The element whose snapshot to match
- `template`: A template in the snapshot format

**Returns:** `{ matches, actual }`: whether the snapshot matches, and the snapshot's text without refs

**Throws:** Error if the template is not valid, naming the line and column

**Example:**
```typescript
import { AriaSnapshotMatcher } from 'acquiescence';

const matcher = new AriaSnapshotMatcher();
const result = matcher.match(document.body, '- heading "Welcome, Ada" [level=1]');
console.log(result.matches); // true
```

### Snapshot Types

```typescript
type AriaSnapshotOptions = {
  refs?: boolean;      // Whether to give nodes refs; defaults to true
  refPrefix?: string;  // Text before each ref; defaults to ''
};

type AriaSnapshot = {
  root: AriaNode;                       // A fragment whose children are the snapshot's nodes
  text: string;                         // The snapshot as text
  references: AriaSnapshotReference[];  // Each ref and its element, in document order
};

type AriaSnapshotReference = { ref: string; element: Element };

type AriaNode = {
  role: string;                         // An ARIA role, 'iframe', or 'fragment'
  name: string;
  ref?: string;
  checked?: boolean | 'mixed';
  disabled?: boolean;
  expanded?: boolean;
  level?: number;
  pressed?: boolean | 'mixed';
  selected?: boolean;
  url?: string;
  placeholder?: string;
  children: Array<AriaNode | string>;   // Child nodes and runs of text
};

type AriaSnapshotMatchResult = {
  matches: boolean;
  actual: string;                       // The snapshot's text without refs
};
```

## DOM Snapshots

The [DOM Snapshots guide](/guide/dom-snapshots) describes the format and the state recorded.

### DomSnapshotGenerator

Takes snapshots of documents for a trace viewer, in the format of the frame snapshots in Playwright's traces.

```typescript
generate(document: Document, options?: DomSnapshotOptions): DomSnapshot
```

**Parameters:**
- `document`: The document to take the snapshot of
- `options`: `target` marks an element as the target of an action; `frameSource` gives the `src` of each frame in the snapshot

**Returns:** A `DomSnapshot`: `html`, the document element as a tree of nodes; `doctype`; `viewport`; `url`; `wallTime`; and `collectionTime`

## Element Descriptions

The [Element Descriptions guide](/guide/element-descriptions) describes the facts given.

### ElementDescriber

Describes elements by the facts a tool can name them by.

```typescript
describe(element: Element, options?: ElementDescriptionOptions): ElementDescription
getActionTarget(element: Element): Element
```

- `describe()` returns the facts of the element a user acting on `element` acts on (`target`), and of its nameable ancestors, nearest first (`ancestors`). `options.testIdAttribute` (default `data-testid`) names the test ID attribute; `options.maxAncestors` (default 3) limits the ancestors.
- `getActionTarget()` returns the element a user acting on `element` acts on: the element itself if it takes text, or else its closest interactive ancestor, if any.

## Action Recording

The [Action Recording guide](/guide/action-recording) describes the actions recorded.

### ActionRecorder

Records the actions a user takes in a document, from the events the browser raises for real input.

```typescript
constructor(report: (action: RecordedAction) => void, options?: ActionRecorderOptions)
start(document: Document): void
stop(): void
```

- `report` is called with each action, as it happens; `options.ignore` leaves out events aimed at elements it returns `true` for.
- `start()` starts recording a document's actions, stopping any recording already started.
- `stop()` stops recording.

## Element Picking

The [Element Picking guide](/guide/element-picking) describes the highlight and what the page sees.

### ElementPicker

Lets a user pick an element in a document with the mouse, from the events the browser raises for real input.

```typescript
constructor(pick: (element: Element) => void, options?: ElementPickerOptions)
start(document: Document): void
stop(): void
```

- `pick` is called with each element the user clicks, which the page does not see; `options.resolve` gives the element highlighted and picked for the element under the pointer, and `options.ignore` leaves out elements it returns `true` for.
- `start()` starts picking in a document, adding the highlight, and stopping any picking already started.
- `stop()` stops picking, and removes the highlight.

## Helper Classes

Both waiters poll a condition until it returns a truthy result.

- `waitForCondition()` resolves with the first truthy result. It rejects with `Timeout after Nms` if the timeout passes first, or `Wait cancelled` if `cancel()` is called. An exception thrown by the condition is ignored, and the condition is checked again.
- `cancel()` cancels the wait.
- The timeout defaults to 0, which checks the condition once.

The type argument is the condition's result type, which includes the falsy values it returns to keep polling.

### TimeoutWaiter

Generic waiter class for polling with timeout.

```typescript
constructor(
  condition: () => T | Promise<T>,
  timeoutInMilliseconds = 0,
  pollIntervalsInMilliseconds: number[] = [100]
)
```

Checks after the first are spaced by the poll intervals in turn; the last interval repeats.

```typescript
import { TimeoutWaiter } from 'acquiescence';

const waiter = new TimeoutWaiter<string | null>(
  async () => {
    // Your condition check
    return someCondition ? 'result' : null;
  },
  5000, // timeout
  [0, 100, 500] // poll intervals
);

// Resolves only with a truthy result, never null
const result = await waiter.waitForCondition();
```

### RequestAnimationFrameWaiter

Waiter that polls using requestAnimationFrame.

```typescript
constructor(condition: () => T | Promise<T>, timeoutInMilliseconds = 0)
```

```typescript
import { RequestAnimationFrameWaiter } from 'acquiescence';

const waiter = new RequestAnimationFrameWaiter<boolean>(
  () => {
    // Check on each animation frame; false keeps polling
    return someCondition;
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
- ES2022 features

## Next Steps

- Explore [Examples](/examples/basic-usage)
- Read the [Accessibility Snapshots guide](/guide/accessibility-snapshots)
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

