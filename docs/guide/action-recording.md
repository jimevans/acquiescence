# Action Recording

An action recorder records the actions a user takes in a document, as they take them, so that a tool can write them down, such as a test generator writing the steps of a test. It records from the events the browser raises for real input, and leaves out the events a script raises.

## Recording

`ActionRecorder` reports each action to the function it is given:

```typescript
import { ActionRecorder, ElementDescriber } from 'acquiescence';

const describer = new ElementDescriber();
const recorder = new ActionRecorder((action) => {
  const { target } = describer.describe(action.element);
  console.log(action.kind, target.role, target.name);
});

recorder.start(document);
// ... the user clicks "Sign in" ...
// click button Sign in
recorder.stop();
```

In the browser bundle, the class is `Acquiescence.ActionRecorder`.

`start()` records one document, stopping any recording already started; a page's frames each have their own document, and their own recorder. `stop()` stops recording.

## Actions

Each action has a `kind` and the `element` the event was aimed at. For an element in an open shadow root, that is the element itself, not its host.

| Kind | Recorded for | Also has |
| --- | --- | --- |
| `click` | A click with a mouse button | `button` (`left`, `middle`, or `right`), `clickCount` (2 for the second click of a double click), `modifiers` |
| `check`, `uncheck` | A checkbox or radio button checked or unchecked, with the mouse or the keyboard | |
| `fill` | Text entered into an input, a text area, or an editable element | `value`, the whole value after the change |
| `press` | A key that is not typing | `key`, as `KeyboardEvent.key` gives it, and `modifiers` |
| `select` | Options chosen in a select | `values`, the chosen options' values |
| `setInputFiles` | Files chosen for a file input | `files`, the files' names |

`modifiers` lists the modifier keys held: `Alt`, `Control`, `Meta`, and `Shift`.

Each action is recorded once, as what it did:

- A click on a checkbox, a radio button, a select, or a file input, or on the label of a checkbox or radio button, is recorded as the check, the choice, or the files, not as a click.
- A button activated with the keyboard is recorded as the key pressed, not as a click.
- Typing into an element that takes text is recorded as `fill`, once for each change: characters, Backspace and Delete, and Enter where it makes a new line. A key with Control, Alt, or Meta held, and a key that types no character, such as Enter in an input or Tab, is a `press`.
- A character key aimed at an element that takes no text, such as a keyboard shortcut, is a `press`.
- The keys that change a checkbox, a radio button, or a select's choice, such as Space and the arrow keys, are recorded as the change, not as presses.
- Modifier keys pressed alone are not recorded.

## Leaving Out a Tool's Own Elements

The `ignore` option leaves out the events aimed at elements it returns `true` for, such as a recording tool's own toolbar:

```typescript
const recorder = new ActionRecorder(report, {
  ignore: (element) => element.closest('[data-recorder-toolbar]') !== null,
});
```
