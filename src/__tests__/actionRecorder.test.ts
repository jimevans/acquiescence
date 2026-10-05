import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import ActionRecorder from '../actionRecorder';
import type { RecordedAction } from '../actionRecorder';
import { isNativeDom, testIf } from './testUtilities';

// Only the browser raises trusted events, from real input, which these tests drive through WebDriver.
describe('ActionRecorder', () => {
  let container: HTMLElement;
  let actions: RecordedAction[];
  let recorder: ActionRecorder;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    actions = [];
    recorder = new ActionRecorder((action) => actions.push(action), { ignore: (element) => element.closest('[data-ignored]') !== null });
    recorder.start(document);
  });

  afterEach(() => {
    recorder.stop();
    container.remove();
  });

  const element = <T extends Element = HTMLElement>(selector: string): T => container.querySelector<T>(selector)!;

  const userEvent = async () => (await import('vitest/browser')).userEvent;

  // Each action without its element, which is checked apart.
  const kinds = (): string[] => actions.map((action) => JSON.stringify({ ...action, element: undefined }));

  describe('clicks', () => {
    testIf(isNativeDom(), 'should record a click with its button and count', async () => {
      container.innerHTML = '<button id="go">Go</button>';
      const user = await userEvent();

      await user.click(element('#go'));
      await user.dblClick(element('#go'));
      await user.click(element('#go'), { button: 'middle' });
      await user.click(element('#go'), { button: 'right' });

      expect(kinds()).toEqual([
        JSON.stringify({ kind: 'click', button: 'left', clickCount: 1, modifiers: [] }),
        JSON.stringify({ kind: 'click', button: 'left', clickCount: 1, modifiers: [] }),
        JSON.stringify({ kind: 'click', button: 'left', clickCount: 2, modifiers: [] }),
        JSON.stringify({ kind: 'click', button: 'middle', clickCount: 1, modifiers: [] }),
        JSON.stringify({ kind: 'click', button: 'right', clickCount: 1, modifiers: [] }),
      ]);
      expect(actions.every((action) => action.element === element('#go'))).toBe(true);
    });

    testIf(isNativeDom(), 'should record a click on an element in an open shadow root as that element', async () => {
      container.innerHTML = '<div id="host"></div>';
      const shadowRoot = element('#host').attachShadow({ mode: 'open' });
      shadowRoot.innerHTML = '<button id="inner">Inner</button>';
      const inner = shadowRoot.querySelector('#inner')!;

      await (await userEvent()).click(inner);

      expect(actions.map((action) => action.element)).toEqual([inner]);
    });

    testIf(isNativeDom(), 'should record a button activated by the keyboard as its key, not as a click', async () => {
      container.innerHTML = '<button id="go">Go</button>';
      element('#go').focus();

      await (await userEvent()).keyboard('{Enter}');

      expect(kinds()).toEqual([JSON.stringify({ kind: 'press', key: 'Enter', modifiers: [] })]);
    });
  });

  describe('checkboxes and radio buttons', () => {
    testIf(isNativeDom(), 'should record what a click changes, with the mouse or on a label', async () => {
      container.innerHTML = '<input type="checkbox" id="agree"><label for="agree" id="label">Agree</label><input type="radio" name="size" id="small">';
      const user = await userEvent();

      await user.click(element('#agree'));
      await user.click(element('#label'));
      await user.click(element('#small'));

      expect(actions.map((action) => `${action.kind}:${action.element.id}`)).toEqual(['check:agree', 'uncheck:agree', 'check:small']);
    });

    testIf(isNativeDom(), 'should record what the keyboard changes, and not the keys that change it', async () => {
      container.innerHTML = '<input type="checkbox" id="agree"><input type="radio" name="size" id="small" checked><input type="radio" name="size" id="large">';
      const user = await userEvent();
      element('#agree').focus();

      await user.keyboard(' ');
      element('#small').focus();
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{Tab}');

      expect(actions.map((action) => action.kind === 'press' ? `press:${action.key}` : `${action.kind}:${action.element.id}`)).toEqual(['check:agree', 'check:large', 'press:Tab']);
    });
  });

  describe('text', () => {
    testIf(isNativeDom(), 'should record typing as the field value, and other keys as presses', async () => {
      container.innerHTML = '<input id="name"><textarea id="notes"></textarea>';
      const user = await userEvent();

      await user.type(element('#name'), 'Ad');
      await user.keyboard('{Backspace}');
      await user.keyboard('{Control>}a{/Control}');
      await user.keyboard('{Enter}');
      await user.type(element('#notes'), 'a{Enter}b');

      expect(actions.map((action) => action.kind === 'fill' ? `fill:${action.element.id}:${JSON.stringify(action.value)}` : action.kind === 'press' ? `press:${action.key}:${action.modifiers.join('+')}` : action.kind)).toEqual([
        'click',
        'fill:name:"A"',
        'fill:name:"Ad"',
        'fill:name:"A"',
        'press:a:Control',
        'press:Enter:',
        'click',
        'fill:notes:"a"',
        'fill:notes:"a\\n"',
        'fill:notes:"a\\nb"',
      ]);
    });

    testIf(isNativeDom(), 'should record typing in an editable element as its text', async () => {
      container.innerHTML = '<div id="editor" contenteditable="true"></div>';

      await (await userEvent()).type(element('#editor'), 'Hi');

      expect(actions.filter((action) => action.kind === 'fill').map((action) => action.kind === 'fill' && action.value)).toEqual(['H', 'Hi']);
    });

    testIf(isNativeDom(), 'should record the modifier keys held for a key', async () => {
      container.innerHTML = '<div id="board" tabindex="0">Board</div>';
      element('#board').focus();

      await (await userEvent()).keyboard('{Alt>}{Command>}{Shift>}{Enter}{/Shift}{/Command}{/Alt}');

      expect(kinds()).toEqual([JSON.stringify({ kind: 'press', key: 'Enter', modifiers: ['Alt', 'Meta', 'Shift'] })]);
    });

    testIf(isNativeDom(), 'should record a character key aimed at an element that takes no text, and not a modifier alone', async () => {
      container.innerHTML = '<div id="board" tabindex="0">Board</div><input type="button" id="action" value="Act">';
      const user = await userEvent();
      element('#board').focus();

      await user.keyboard('j');
      await user.keyboard('{Shift}');
      element('#action').focus();
      await user.keyboard('k');

      expect(actions.map((action) => action.kind === 'press' && `${action.element.id}:${action.key}`)).toEqual(['board:j', 'action:k']);
    });
  });

  describe('choices', () => {
    // Typing an option's first letter chooses it, with real input; a driver's choosing by option, in Chrome, is a script's.
    testIf(isNativeDom(), 'should record the option chosen in a select, and not the key that chose it', async () => {
      container.innerHTML = '<select id="size"><option value="s">Small</option><option value="l">Large</option></select>';
      element('#size').focus();

      await (await userEvent()).keyboard('L');

      expect(kinds()).toEqual([JSON.stringify({ kind: 'select', values: ['l'] })]);
    });

    // Whether these keys change a closed select's choice depends on the platform; where they do, the change is recorded.
    testIf(isNativeDom(), 'should not record the keys that move a select\'s choice, but other keys', async () => {
      container.innerHTML = '<select id="size"><option value="s">Small</option><option value="l">Large</option></select>';
      const user = await userEvent();
      element('#size').focus();

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{End}');
      await user.keyboard('x');
      await user.keyboard('{Tab}');

      expect(actions.filter((action) => action.kind === 'press').map((action) => action.kind === 'press' && action.key)).toEqual(['Tab']);
    });

    // WebDriver's file upload, which the test needs, exists only in Chrome.
    testIf(isNativeDom() && !navigator.userAgent.includes('Firefox'), 'should record the files chosen for a file input by their names', async () => {
      container.innerHTML = '<input type="file" id="file">';

      await (await userEvent()).upload(element('#file'), 'README.md');

      expect(kinds()).toEqual([JSON.stringify({ kind: 'setInputFiles', files: ['README.md'] })]);
    });
  });

  describe('what is left out', () => {
    test('should leave out events raised by a script', () => {
      container.innerHTML = '<button id="go">Go</button><input id="name"><select id="size"><option>A</option></select>';

      element('#go').click();
      element('#name').dispatchEvent(new Event('input', { bubbles: true }));
      element('#name').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      element('#size').dispatchEvent(new Event('change', { bubbles: true }));

      expect(actions).toEqual([]);
    });

    testIf(isNativeDom(), 'should leave out events aimed at elements the options ignore', async () => {
      container.innerHTML = '<div data-ignored><button id="tool">Tool</button></div>';

      await (await userEvent()).click(element('#tool'));

      expect(actions).toEqual([]);
    });

    testIf(isNativeDom(), 'should ignore nothing unless asked', async () => {
      container.innerHTML = '<div data-ignored><button id="tool">Tool</button></div>';
      const unfiltered: RecordedAction[] = [];
      const plain = new ActionRecorder((action) => unfiltered.push(action));
      plain.start(document);

      await (await userEvent()).click(element('#tool'));
      plain.stop();

      expect(unfiltered.map((action) => action.element)).toEqual([element('#tool')]);
    });

    testIf(isNativeDom(), 'should record nothing once stopped, and only the document last started', async () => {
      container.innerHTML = '<button id="go">Go</button><iframe id="frame" srcdoc="<button>In frame</button>"></iframe>';
      const user = await userEvent();
      await new Promise((resolve) => element<HTMLIFrameElement>('#frame').addEventListener('load', resolve, { once: true }));
      const frameDocument = element<HTMLIFrameElement>('#frame').contentDocument!;

      recorder.start(frameDocument);
      await user.click(element('#go'));
      recorder.stop();
      recorder.stop();
      await user.click(element('#go'));

      expect(actions).toEqual([]);
    });
  });
});
