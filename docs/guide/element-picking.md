# Element Picking

An element picker lets a user pick an element in a document with the mouse, such as a test generator asking which element to assert on. It highlights the element under the pointer and reports the element the user clicks, keeping the page from seeing that click. It answers only to the events the browser raises for real input, and leaves out the events a script raises.

## Picking

`ElementPicker` reports each element picked to the function it is given:

```typescript
import { ElementDescriber, ElementPicker } from 'acquiescence';

const describer = new ElementDescriber();
const picker = new ElementPicker((element) => {
  const { target } = describer.describe(element);
  console.log(target.role, target.name);
}, { resolve: (element) => describer.getActionTarget(element) });

picker.start(document);
// ... the user clicks the icon inside the "Sign in" button ...
// button Sign in
picker.stop();
```

In the browser bundle, the class is `Acquiescence.ElementPicker`.

`start()` picks in one document, stopping any picking already started; a page's frames each have their own document, and their own picker. The user can pick as many elements as they like until `stop()`.

For an element in an open shadow root, the element picked is that element, not its host.

## The Highlight

The highlight is a box over the element, drawn in the shadow root of an `acquiescence-highlight` element that `start()` adds to the document element and `stop()` removes. It does not take the pointer, so the element under it is still the one picked. The box follows the element when the document or an element in it scrolls, and is hidden when the element is removed or the pointer is over an ignored element.

## What the Page Sees

While picking, the page sees none of the mouse events for a pick: the pointer and mouse button events, `click`, `dblclick`, `auxclick`, and `contextmenu`. A click on a link does not follow it. The pointer's movement still reaches the page, so hover styles still show.

## Choosing the Element Picked

The `resolve` option gives the element highlighted and picked for the element under the pointer. `ElementDescriber.getActionTarget` gives the element a user acts on, such as a button for the icon inside it.

## Leaving Out a Tool's Own Elements

The `ignore` option leaves out the elements it returns `true` for, such as a tool's own toolbar. They are not highlighted or picked, and their events reach them as usual, so the toolbar's buttons still work:

```typescript
const picker = new ElementPicker(report, {
  ignore: (element) => element.closest('[data-recorder-toolbar]') !== null,
});
```
