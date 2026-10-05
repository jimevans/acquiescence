# DOM Snapshots

A DOM snapshot records a document as it is at one moment, so that a trace viewer can show it again later: its elements and text, without scripts or event handlers, and with the state that attributes do not show. Acquiescence writes snapshots in the format of the frame snapshots in [Playwright's traces](https://playwright.dev/docs/trace-viewer), so that a tool writing such traces can use them, and Playwright's trace viewer can show them.

## Taking a Snapshot

`DomSnapshotGenerator.generate()` takes a snapshot of a document.

```typescript
import { DomSnapshotGenerator } from 'acquiescence';

const generator = new DomSnapshotGenerator();
const snapshot = generator.generate(document, {
  target: document.querySelector('#save') ?? undefined,
  frameSource: (frame) => `/snapshot/${frame.name}`,
});
```

In the browser bundle, the class is `Acquiescence.DomSnapshotGenerator`.

The snapshot holds:

| Property | Holds |
| --- | --- |
| `html` | The document element, as a tree of nodes |
| `doctype` | The document type's name, such as `html`, if the document has one |
| `viewport` | The window's viewport size, in CSS pixels |
| `url` | The document's URL |
| `wallTime` | When the snapshot was taken, in milliseconds since the epoch |
| `collectionTime` | How long the snapshot took, in milliseconds |

## The Format

Each node is a string, for a text node, or an array of an element's name, its attributes, and its children:

```json
["DIV", { "class": "card" }, ["H2", {}, "Orders"], "3 open", ["BR"]]
```

An element with neither attributes nor children has only its name. Names are the DOM's node names: upper case for HTML elements, and as written for SVG and MathML.

The snapshot leaves out what could act on the viewer when the snapshot is shown, or that is never shown:

- `script` and `noscript` elements, comments, preloads and prefetches, and frames in the head
- `meta` elements that refresh the page, set cookies, or set a content security policy
- the values of event handler attributes, such as `onclick`, which are kept but emptied
- `javascript:` and `vbscript:` URLs in the `src` and `srcset` of images, the `srcset` of `source` elements, and the `href` of `link` elements
- the `integrity` of `link` elements, and the content of frames, which have snapshots of their own

The head starts with a `base` element giving the document's base URL, so that relative URLs resolve when the snapshot is shown from another URL. A `meta` charset is given as UTF-8.

## State

State that the DOM's attributes do not show is recorded in attributes of the snapshot's own:

| Attribute | Records |
| --- | --- |
| `__playwright_value_` | The value of an `input` or `textarea` |
| `__playwright_checked_` | Whether a checkbox or radio button is checked |
| `__playwright_selected_` | Whether an `option` is selected |
| `__playwright_scroll_top_`, `__playwright_scroll_left_` | An element's scroll position, when not zero |
| `__playwright_popover_open_` | That a popover is open |
| `__playwright_dialog_open_` | That a dialog is open: `modal`, or `true` |
| `__playwright_bounding_rect__` | The bounds of a `canvas`, `iframe`, or `frame` |
| `__playwright_current_src__` | The source an `img` chose |
| `__playwright_custom_elements__` | On the body, the names of the custom elements defined |
| `__playwright_target__` | The element given as the `target` option |

An open shadow root is the first child of its host, as a `template` with `__playwright_shadow_root_`. A stylesheet that the document or a shadow root adopted is a `template` with `__playwright_style_sheet_` holding its rules, after the other children. A `style` element whose rules script added, as CSS-in-JS libraries do, holds those rules as its text. A closed shadow root, and a change that script made to a linked stylesheet, are not recorded.

## Frames

The content of an `iframe` or `frame` is not part of its document's snapshot: take a snapshot of the frame's own document. The `frameSource` option gives each frame's `src` in the snapshot, which a trace viewer uses to find that snapshot; without it, frames have an empty `src`.
