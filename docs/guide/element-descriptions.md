# Element Descriptions

An element description gives the facts by which a tool can name an element, such as to write a locator for the element a user clicked: its role and accessible name, its labels, its attributes, its text, and a CSS path. It gives the facts only; which to use, and how, is for the tool to choose.

## Describing an Element

`ElementDescriber.describe()` describes the element a user acting on an element acts on:

```typescript
import { ElementDescriber } from 'acquiescence';

const describer = new ElementDescriber();
const description = describer.describe(clickedElement, { testIdAttribute: 'data-test' });

console.log(description.target.role, description.target.name);
// button Sign in
```

In the browser bundle, the class is `Acquiescence.ElementDescriber`.

The target is the element itself if it takes text, such as an `input`, `textarea`, `select`, or editable element, or else its closest interactive ancestor, if any: a `button`, `select`, `input`, `a`, or an element with the role `button`, `checkbox`, `radio`, or `link`. A click on an icon inside a button describes the button. `getActionTarget()` gives the target alone.

## The Facts

Each element's facts, with white space normalized:

| Property | Holds |
| --- | --- |
| `element` | The element itself |
| `tagName` | The lower-case tag name |
| `role` | The ARIA role, explicit or implicit, or `null` |
| `name` | The accessible name |
| `labels` | The texts of its labels, as `ElementStateInspector.findElementsByLabel` matches them: the elements it is labelled by, its `aria-label`, or its `label` elements; `ElementStateInspector.getElementLabels` returns the same texts, before white space is normalized |
| `placeholder`, `alt`, `title` | Those attributes' values, or `null` |
| `nameAttribute`, `type` | The `name` and `type` attributes' values, as form fields, frames, and inputs have, or `null` |
| `testId` | The value of the test ID attribute, `data-testid` unless `testIdAttribute` says otherwise, or `null` |
| `text` | The rendered text of an HTML element |
| `id` | The ID, or `null` |
| `cssPath` | A selector matching the element alone, within its root, as the document is now |
| `inShadowRoot` | Whether the element is in a shadow root |

The CSS path starts from the element's ID, or its nearest ancestor's, if that ID is unique within the root (the document, or the shadow root the element is in), and names each step down by its tag and, among siblings of the same tag, its position: `#list > li:nth-of-type(2) > a`.

## Ancestors

`ancestors` describes, nearest first, the element's ancestors below the document element that have a test ID, an ID, or a role other than `generic`, `none`, or `presentation`, such as a form, a list item, or a navigation region. A tool can name an element within one of them when the element cannot be named alone. `maxAncestors` sets how many, 3 by default.
