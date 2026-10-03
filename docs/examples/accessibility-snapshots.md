# Accessibility Snapshot Examples

These examples use `AriaSnapshotGenerator` and `AriaSnapshotMatcher`, which the [Accessibility Snapshots guide](/guide/accessibility-snapshots) describes in full. They run in the page, as code bundled with an application or test, or injected through the browser bundle.

## Asserting the Structure of a Page

A test can wait for part of a page to match a template, with `TimeoutWaiter` polling until it does:

```typescript
import { AriaSnapshotMatcher, TimeoutWaiter } from 'acquiescence';

const matcher = new AriaSnapshotMatcher();

async function expectSnapshot(root: Element, template: string, timeout = 5000): Promise<void> {
  // Matching once first reports an invalid template at once, rather than as a timeout.
  let result = matcher.match(root, template);
  if (result.matches) {
    return;
  }
  const waiter = new TimeoutWaiter(() => {
    result = matcher.match(root, template);
    return result.matches;
  }, timeout, [100]);
  try {
    await waiter.waitForCondition();
  } catch {
    throw new Error(`The snapshot did not match.\nExpected:\n${template}\nActual:\n${result.actual}`);
  }
}

await expectSnapshot(document.body, `
  - navigation "Main":
    - link "Home"
    - link "Orders"
  - main:
    - form "Sign in":
      - textbox "Email"
      - button "Sign in"
`);
```

The template lists only what the test cares about. The form's other content, such as its checkbox and label text, does not have to be listed, because children match if they contain the listed nodes in order. Nodes listed side by side must be siblings in the snapshot, though, which is why the form is listed inside `main`.

## Exact and Partial Matches

To require exactly the listed children, and no others, use `/children: equal`:

```typescript
matcher.match(document.body, `
  - navigation "Main":
    - /children: equal
    - link "Home"
    - link "Orders"
`).matches; // true: the navigation has exactly these two links

matcher.match(document.body, `
  - navigation "Main":
    - /children: equal
    - link "Orders"
`).matches; // false: the navigation also has a Home link
```

Names and text that change, such as counts or dates, can be matched with regular expressions:

```typescript
matcher.match(document.body, `
  - banner:
    - heading /Welcome, \\w+/
  - navigation:
    - link /Or.*s/
`).matches; // true
```

## Acting on a Snapshot

An agent that reads a snapshot's text answers with a ref, which the snapshot's `references` turn back into the element:

```typescript
import { AriaSnapshotGenerator, ElementStateInspector } from 'acquiescence';

const generator = new AriaSnapshotGenerator();
const inspector = new ElementStateInspector();

const snapshot = generator.generate(document.body);
const ref = await chooseRef(snapshot.text); // For example, 'e10' for the line '- button "Sign in" [ref=e10]'.

const element = snapshot.references.find((reference) => reference.ref === ref)?.element;
if (!element) {
  throw new Error(`The snapshot has no ref ${ref}`);
}
await inspector.waitForInteractionReady(element, 'click', 5000);
(element as HTMLElement).click();
```

Acting on the ref, rather than searching the page again for the role and name the agent read, finds exactly the element the line describes, even when another element has the same role and name.

## Seeing What Changed

Because an element keeps its ref across snapshots from the same generator, comparing two snapshots shows which elements are new:

```typescript
const before = new Set(generator.generate(document.body).references.map((reference) => reference.ref));

document.querySelector('button')!.click();

const added = generator.generate(document.body).references.filter((reference) => !before.has(reference.ref));
console.log(added.map((reference) => reference.element));
```

## Snapshots of Frames

A snapshot shows a frame as an `iframe` node without its content. For a frame whose document the page can reach, take its snapshot separately, with a prefix that keeps its refs apart from the page's:

```typescript
const frame = document.querySelector('iframe')!;
const page = generator.generate(document.body);
const framed = generator.generate(frame.contentDocument!.body, { refPrefix: 'f1' });

console.log(page.text);   // Includes the line '- iframe [ref=…]'.
console.log(framed.text); // The frame's content, with refs such as f1e14.
```

## Snapshots Without Refs

For logs, or for comparing with a stored snapshot, leave the refs out:

```typescript
console.log(generator.generate(document.querySelector('main')!, { refs: false }).text);
```

```yaml
- main:
  - form "Sign in":
    - text: Email
    - textbox "Email":
      - /placeholder: you@example.com
    - checkbox "Remember me" [checked]
    - text: Remember me
    - button "Sign in"
  - paragraph:
    - text: Need an account?
    - link "Join":
      - /url: /join
```
