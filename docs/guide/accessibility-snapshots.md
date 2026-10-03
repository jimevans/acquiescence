# Accessibility Snapshots

An accessibility snapshot describes part of a page the way assistive technology sees it: each element that has a role, with its accessible name and states, and the text between them. Snapshots are compact enough to read at a glance, which makes them useful for asserting the structure of a page in a test, and for giving an automated agent a view of a page that it can act on.

Acquiescence renders snapshots as text in a format compatible with [Playwright's aria snapshots](https://playwright.dev/docs/aria-snapshots). It supports a subset of that format, described below, so that every snapshot it writes can be read back as a template.

## Taking a Snapshot

`AriaSnapshotGenerator.generate()` takes a snapshot of an element and everything within it.

```typescript
import { AriaSnapshotGenerator } from 'acquiescence';

const generator = new AriaSnapshotGenerator();
const snapshot = generator.generate(document.body);

console.log(snapshot.text);
```

In the browser bundle, the class is `Acquiescence.AriaSnapshotGenerator`.

For this page:

```html
<header><h1>Welcome, Ada</h1></header>
<nav aria-label="Main"><a href="/">Home</a> <a href="/orders">Orders</a></nav>
<main>
  <form aria-label="Sign in">
    <label>Email <input type="email" placeholder="you@example.com"></label>
    <label><input type="checkbox" checked> Remember me</label>
    <button>Sign in</button>
  </form>
  <p>Need an account? <a href="/join">Join</a></p>
</main>
```

the snapshot's text is:

```yaml
- banner [ref=e1]:
  - heading "Welcome, Ada" [level=1] [ref=e2]
- navigation "Main" [ref=e3]:
  - link "Home" [ref=e4]:
    - /url: /
  - link "Orders" [ref=e5]:
    - /url: /orders
- main [ref=e6]:
  - form "Sign in" [ref=e7]:
    - text: Email
    - textbox "Email" [ref=e8]:
      - /placeholder: you@example.com
    - checkbox "Remember me" [checked] [ref=e9]
    - text: Remember me
    - button "Sign in" [ref=e10]
  - paragraph [ref=e11]:
    - text: Need an account?
    - link "Join" [ref=e12]:
      - /url: /join
```

The element passed to `generate()` is included in the snapshot if it has a role of its own.

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `refs` | `true` | Whether to give each node a ref. Without refs, the text is easier to read and compare, and `references` is empty. |
| `refPrefix` | `''` | Text to put before each ref, such as one that identifies the frame the snapshot was taken in: with `'f1'`, refs read `f1e3`. |

### The Result

| Property | Type | Description |
|----------|------|-------------|
| `text` | `string` | The snapshot as text, in the format described below. |
| `root` | `AriaNode` | The snapshot as a tree: a node with the role `fragment` whose children are the snapshot's nodes. |
| `references` | `AriaSnapshotReference[]` | Each ref in the snapshot and the element it refers to, `{ ref, element }`, in document order. |

## The Format

A snapshot is a YAML list. Each line describes a node, an element with a role, and the nodes, text, and properties within it are nested beneath it.

```yaml
- role "name" [attribute] [attribute=value]:
  - /property: value
  - text: some text
  - role "name"
```

### What Is Included

An element appears in the snapshot if it has an [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#role_definitions), explicit or implicit, other than `generic`, `none`, or `presentation`. The content of an element that does not appear moves up to its nearest ancestor that does, so a `<div>` or `<span>` around a button leaves the button where the `<div>` was.

Hidden content is left out with everything within it: elements that are not rendered (`display: none`, `visibility: hidden`, or a closed `<details>` element's content), elements that are `aria-hidden="true"` or inside one, and children of a shadow host that are not assigned to a slot. `<script>`, `<style>`, `<noscript>`, and `<template>` elements are always left out.

The snapshot follows the composed tree: it includes the content of open shadow roots, and the nodes assigned to a slot in place of the slot's fallback content. An element listed in another element's `aria-owns` appears beneath that element, and only there.

### Names

A node's accessible name follows its role, in double quotes with JSON escapes, so `"` and `\` appear as `\"` and `\\`. A node without a name has no quotes. A name longer than 900 characters is left off the line, to keep the line within the limits of YAML keys, but it remains in the tree.

### Attributes

A node's states follow its name, in this order:

| Attribute | Shown when |
|-----------|------------|
| `[checked]`, `[checked=mixed]` | A checkbox, radio button, switch, or another role that supports `aria-checked` is checked, or partly checked. |
| `[disabled]` | The element is disabled natively, or by `aria-disabled` on it or an ancestor. |
| `[expanded]` | The element is expanded: an open `<details>` element, or `aria-expanded="true"`. |
| `[level=N]` | The element has a level: a heading `<h1>` to `<h6>`, or `aria-level` on a role that supports it. |
| `[pressed]`, `[pressed=mixed]` | A toggle button is pressed, or partly pressed. |
| `[selected]` | An option, tab, row, cell, or tree item is selected. |
| `[ref=…]` | Always, unless the snapshot was taken with `refs: false`. |

Only states that are on are shown. The tree holds the false states too, as described in [The Tree](#the-tree).

### Text

The text between nodes is merged into runs, with white space collapsed to single spaces and trimmed. Text either side of an element that is not displayed inline is separated by a space, as it is on the screen, and the text of CSS `::before` and `::after` content is included.

A node whose only content is one run of text shows it on its own line:

```yaml
- paragraph: Line 1 Line 2
```

Otherwise, each run of text is a `- text:` item among the node's children. Text that only repeats a node's name is left out, so a button reads `- button "Sign in"` rather than repeating its label beneath it.

The value of a text input or text area is shown as its text. The content of an element with the `textbox` role, such as a `contenteditable` element, is not, since its name and value describe it.

### Properties

A link shows its URL, and a text box shows its placeholder when the placeholder differs from its name:

```yaml
- link "Orders":
  - /url: /orders
- textbox "Email":
  - /placeholder: you@example.com
```

The data of a `data:` URL is replaced with an ellipsis, keeping its media type.

### Frames

An `<iframe>` or `<frame>` element appears as an `iframe` node with nothing beneath it. A snapshot cannot reach into another document; to include a frame's content, take a snapshot within the frame and combine them, giving each frame's snapshot its own `refPrefix`.

### Quoting

Text, names, and property values are quoted when YAML would otherwise read them as something else: values that are empty, have white space at either end, begin with a character such as `-`, `@`, `[`, `#`, or a quote, contain `: ` or ` #`, contain control characters, or read as a number, a Boolean, or `null`. Values are quoted in double quotes with escapes; a line whose key needs quoting is quoted in single quotes, with a single quote written twice:

```yaml
- text: "123"
- link "Top":
  - /url: "#"
- 'button "Note: read first"'
```

## Refs

Every node in a snapshot has a ref, an identifier such as `e7` for the element it describes. A snapshot's `references` list gives the element for each ref, so a tool that reads the text can act on the element a line describes:

```typescript
const snapshot = generator.generate(document.body);
const button = snapshot.references.find((reference) => reference.ref === 'e10')?.element;
```

An element keeps its ref in every snapshot taken by the same `AriaSnapshotGenerator`, so successive snapshots can be compared line by line: a line whose ref is new describes a new element. Refs are held weakly, so an element that is removed from the page can still be garbage-collected.

Refs identify elements only to the generator that assigned them; they are not stored in the page.

## The Tree

`snapshot.root` holds the same content as the text, as `AriaNode` objects:

| Property | Type | Description |
|----------|------|-------------|
| `role` | `string` | The node's ARIA role; `iframe` for a frame, or `fragment` for the root. |
| `name` | `string` | The accessible name, with white space collapsed; empty if the node has none. |
| `ref` | `string \| undefined` | The node's ref, unless the snapshot has none. |
| `checked` | `boolean \| 'mixed' \| undefined` | Present if the node's role can be checked. |
| `disabled` | `boolean \| undefined` | Present if the node's role can be disabled. |
| `expanded` | `boolean \| undefined` | Present if the node is expandable and says whether it is expanded. |
| `level` | `number \| undefined` | Present if the node has a level. |
| `pressed` | `boolean \| 'mixed' \| undefined` | Present if the node is a button. |
| `selected` | `boolean \| undefined` | Present if the node's role can be selected. |
| `url` | `string \| undefined` | A link's URL. |
| `placeholder` | `string \| undefined` | A text box's placeholder, when it differs from its name. |
| `children` | `Array<AriaNode \| string>` | The node's child nodes and runs of text, in document order. |

A state is present, even when it is `false`, if the node's role supports it, so a plain button has `pressed: false` and `disabled: false`. The text shows only states that are on.

## How Names Are Computed

Browsers compute accessible names inside their own accessibility engines, and pages cannot read the results. Acquiescence therefore computes names itself, following the [Accessible Name and Description Computation](https://w3c.github.io/accname/) and the [HTML Accessibility API Mappings](https://w3c.github.io/html-aam/), adapted from Playwright's implementation. Where browsers agree with each other but not with those specifications, it follows the browsers.

The names in a snapshot can therefore differ from the names a browser reports, for example to a screen reader or to a locator that asks the browser to find elements by role and name. Differences are most likely with:

- CSS generated content, which browsers expose differently;
- controls embedded in a label, such as a text box inside the label of a checkbox;
- chains of `aria-labelledby` references, and references to hidden elements;
- SVG elements, and roles that browsers assign differently, such as `<th>` cells without a `scope` attribute (Acquiescence follows Chromium);
- `<area>` elements, which are not rendered, and so are hidden from the snapshot.

To act on an element from a snapshot, use its ref rather than searching the page again by the role and name the snapshot shows.

## Matching Templates

`AriaSnapshotMatcher.match()` takes a snapshot of an element and matches it against a template written in the snapshot format:

```typescript
import { AriaSnapshotMatcher } from 'acquiescence';

const matcher = new AriaSnapshotMatcher();
const result = matcher.match(document.body, `
  - navigation "Main":
    - link "Orders"
`);

if (!result.matches) {
  console.log(result.actual);
}
```

The result's `actual` is the snapshot's text without refs, to show what was found when the template does not match. `match()` throws an error if the template is not valid.

### Template Syntax

A template is a list of nodes in the snapshot format, nested by indentation, with blank lines and `#` comments allowed. A node is a role, optionally followed by a name and attributes:

| Part | Example | Matches |
|------|---------|---------|
| Role | `- button` | A node with the role, whatever its name and states. |
| Name | `- button "Sign in"` | A node with exactly that name, after white space is collapsed. |
| Regular expression | `- link /Order \d+/` | A node whose name matches the JavaScript regular expression. A slash inside a character class or after a backslash does not end it, and an expression that is not valid is an error. |
| Attribute | `- checkbox [checked]`, `- heading [level=2]` | A node with that state. An attribute without a value means `true`; `[checked=false]` matches an unchecked checkbox. |
| Ref | `[ref=e7]` | Anything: refs are ignored, so a snapshot can be used as a template as it is. |

A node's text and properties are written as in a snapshot:

```yaml
- paragraph: Some text
- region: /Item \d+/
- link:
  - /url: /.*example.com/
- textbox:
  - /placeholder: Email
- list:
  - text: "123"
```

Values may be plain, double-quoted with escapes, or single-quoted with a single quote written twice, and a value can be written as a literal (`|`) or folded (`>`) block on the lines beneath it. A value written between slashes matches as a regular expression, and also matches text that is exactly the value as written; text between slashes that is not a valid regular expression is compared as text.

### Matching Rules

- A template that lists one node matches if any node of the snapshot matches it, at any depth.
- A template that lists several nodes matches if they appear in order among the top-level nodes of the snapshot, or among the children of any one node.
- A node matches if it has the template's role, and the name, states, URL, and placeholder the template gives. Anything the template leaves out is not compared.
- A node's children must contain the children the template lists, in order, with others allowed between them.

A `/children` property changes how a node's children match:

| Value | Children must |
|-------|---------------|
| `contain` | Contain those listed, in order, among others. This is the default. |
| `equal` | Be exactly those listed. Their own children are compared as their own templates say. |
| `deep-equal` | Be exactly those listed, as must the children of every descendant, unless a descendant's template sets `/children: contain`. |

```yaml
- list:
  - /children: equal
  - listitem: One
  - listitem: Two
```

A `/children` property at the top level of a template applies to the whole snapshot.

### Errors

An invalid template raises an error naming the line and showing where on it:

```
Invalid aria snapshot template, line 1: Unknown role "buton"
- buton "Sign in"
  ^
```

### Differences from Playwright

Templates written for Playwright work with Acquiescence, with these exceptions:

- Only the attributes listed above are supported. Playwright's `[active]`, `[invalid]`, `[cursor]`, and `[box]` are errors.
- An unknown role is an error, rather than a node that never matches.
- `[level]` must be a positive whole number.
- A node written as a block value (`- |` followed by the node on the lines beneath it) is not supported.
- Only the parts of YAML that the format uses are supported. Flow collections (`[...]`, `{...}`), anchors, and tags have no special meaning: a value such as `[a, b]` is plain text.
- `[ref=…]` is accepted and ignored.

Snapshots also differ: Acquiescence has a single mode, like Playwright's default, without the generic nodes, cursor information, and bounding boxes that Playwright adds for AI agents.
