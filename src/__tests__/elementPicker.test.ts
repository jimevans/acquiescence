import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import ElementPicker from '../elementPicker';
import { isNativeDom, testIf } from './testUtilities';

// Only the browser raises trusted events, from real input, which these tests drive through WebDriver.
describe('ElementPicker', () => {
  const pageEvents = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu'];

  let container: HTMLElement;
  let picked: Element[];
  let seen: string[];
  let picker: ElementPicker;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    picked = [];
    seen = [];
    for (const type of pageEvents) {
      container.addEventListener(type, () => seen.push(type));
    }

    picker = new ElementPicker((element) => picked.push(element), { ignore: (element) => element.closest('[data-ignored]') !== null });
    picker.start(document);
  });

  afterEach(() => {
    picker.stop();
    container.remove();
  });

  const element = (selector: string): HTMLElement => container.querySelector<HTMLElement>(selector)!;

  const userEvent = async () => (await import('vitest/browser')).userEvent;

  const highlights = (): HTMLElement[] => Array.from(document.querySelectorAll('acquiescence-highlight'), (host) => host.shadowRoot!.firstElementChild as HTMLElement);

  // The highlight's box, or null when it is hidden.
  const highlightBox = (): number[] | null => {
    const box = highlights()[0];
    if (box.style.display === 'none') {
      return null;
    }

    const rect = box.getBoundingClientRect();
    return [rect.left, rect.top, rect.width, rect.height];
  };

  const box = (target: Element): number[] => {
    const rect = target.getBoundingClientRect();
    return [rect.left, rect.top, rect.width, rect.height];
  };

  describe('highlighting', () => {
    testIf(isNativeDom(), 'should highlight the element under the pointer as it moves', async () => {
      container.innerHTML = '<button id="first">First</button><p id="second" style="width: 200px">Second</p>';
      const user = await userEvent();

      await user.hover(element('#first'));
      expect(highlightBox()).toEqual(box(element('#first')));
      await user.hover(element('#second'));

      expect(highlightBox()).toEqual(box(element('#second')));
    });

    testIf(isNativeDom(), 'should follow the highlighted element when its document scrolls, and hide when it is removed', async () => {
      container.innerHTML = '<div id="scroller" style="height: 100px; overflow: auto"><p id="target" style="margin-top: 60px">Target</p><div style="height: 400px"></div></div>';
      await (await userEvent()).hover(element('#target'));
      const target = element('#target');

      const scrolled = new Promise((resolve) => element('#scroller').addEventListener('scroll', resolve, { once: true }));
      element('#scroller').scrollTop = 40;
      await scrolled;
      expect(highlightBox()).toEqual(box(target));
      target.remove();
      const scrolledAgain = new Promise((resolve) => element('#scroller').addEventListener('scroll', resolve, { once: true }));
      element('#scroller').scrollTop = 0;
      await scrolledAgain;

      expect(highlightBox()).toBeNull();
    });

    testIf(isNativeDom(), 'should highlight and pick the element the resolve option gives', async () => {
      container.innerHTML = '<button id="go"><span id="icon">*</span></button>';
      const user = await userEvent();
      picker.stop();
      const resolving = new ElementPicker((element) => picked.push(element), { resolve: (element) => element.closest('button') ?? element });
      resolving.start(document);

      await user.hover(element('#icon'));
      expect(highlightBox()).toEqual(box(element('#go')));
      await user.click(element('#icon'));
      resolving.stop();

      expect(picked).toEqual([element('#go')]);
    });
  });

  describe('picking', () => {
    testIf(isNativeDom(), 'should report the element clicked, and keep the page from seeing the mouse', async () => {
      container.innerHTML = '<a href="#followed" id="link">Link</a>';
      const user = await userEvent();

      await user.click(element('#link'));
      await user.dblClick(element('#link'));
      await user.click(element('#link'), { button: 'right' });
      await user.click(element('#link'), { button: 'middle' });

      expect(picked).toEqual([element('#link'), element('#link'), element('#link')]);
      expect(seen).toEqual([]);
      expect(location.hash).not.toBe('#followed');
    });

    testIf(isNativeDom(), 'should pick an element in an open shadow root as that element', async () => {
      container.innerHTML = '<div id="host"></div>';
      const shadowRoot = element('#host').attachShadow({ mode: 'open' });
      shadowRoot.innerHTML = '<button id="inner">Inner</button>';
      const inner = shadowRoot.querySelector('#inner')!;

      await (await userEvent()).click(inner);

      expect(picked).toEqual([inner]);
    });

    testIf(isNativeDom(), 'should leave elements the options ignore to the page, and not highlight them', async () => {
      container.innerHTML = '<button id="go">Go</button><div data-ignored><button id="tool">Tool</button></div>';
      const user = await userEvent();

      await user.hover(element('#go'));
      await user.click(element('#tool'));

      expect(highlightBox()).toBeNull();
      expect(picked).toEqual([]);
      expect(seen).toEqual(['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
    });
    testIf(isNativeDom(), 'should ignore nothing unless asked', async () => {
      container.innerHTML = '<div data-ignored><button id="tool">Tool</button></div>';
      picker.stop();
      const plain = new ElementPicker((element) => picked.push(element));
      plain.start(document);

      await (await userEvent()).click(element('#tool'));
      plain.stop();

      expect(picked).toEqual([element('#tool')]);
    });
  });

  describe('starting and stopping', () => {
    test('should leave out events raised by a script', () => {
      container.innerHTML = '<button id="go">Go</button>';

      element('#go').dispatchEvent(new Event('pointermove', { bubbles: true }));
      element('#go').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      element('#go').click();

      expect(highlightBox()).toBeNull();
      expect(picked).toEqual([]);
      expect(seen).toEqual(['mousedown', 'click']);
    });

    test('should draw one highlight, and remove it when stopped', () => {
      picker.start(document);

      expect(highlights()).toHaveLength(1);
      picker.stop();
      picker.stop();

      expect(highlights()).toHaveLength(0);
    });

    testIf(isNativeDom(), 'should leave the page its clicks once stopped', async () => {
      container.innerHTML = '<button id="go">Go</button>';
      picker.stop();

      await (await userEvent()).click(element('#go'));

      expect(picked).toEqual([]);
      expect(seen).toContain('click');
    });
  });
});
