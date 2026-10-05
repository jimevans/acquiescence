import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import ElementDescriber from '../elementDescriber';
import { isNativeDom, testIf } from './testUtilities';

// Naming an element needs rendering, which jsdom does not provide, so most of these tests run only in a browser.
describe('ElementDescriber', () => {
  let describer: ElementDescriber;
  let container: HTMLElement;

  beforeEach(() => {
    describer = new ElementDescriber();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  const element = (selector: string): Element => container.querySelector(selector)!;

  describe('action target', () => {
    test('should be the closest interactive ancestor of an element inside it', () => {
      container.innerHTML = `
        <button id="button"><span id="in-button">Save</span></button>
        <a href="/x" id="link"><b id="in-link">Go</b></a>
        <div role="checkbox" id="checkbox"><i id="in-checkbox"></i></div>
        <div role="radio" id="radio"><i id="in-radio"></i></div>
        <div role="link" id="role-link"><i id="in-role-link"></i></div>
        <div role="button" id="role-button"><i id="in-role-button"></i></div>
        <p id="plain"><span id="in-plain">Text</span></p>`;

      expect(describer.getActionTarget(element('#in-button'))).toBe(element('#button'));
      expect(describer.getActionTarget(element('#in-link'))).toBe(element('#link'));
      expect(describer.getActionTarget(element('#in-checkbox'))).toBe(element('#checkbox'));
      expect(describer.getActionTarget(element('#in-radio'))).toBe(element('#radio'));
      expect(describer.getActionTarget(element('#in-role-link'))).toBe(element('#role-link'));
      expect(describer.getActionTarget(element('#in-role-button'))).toBe(element('#role-button'));
      expect(describer.getActionTarget(element('#in-plain'))).toBe(element('#in-plain'));
    });

    test('should be an element that takes text itself, even inside an interactive element', () => {
      container.innerHTML = '<label><a href="/x"><input id="input"><textarea id="area"></textarea><select id="select"></select></a></label>';

      expect(describer.getActionTarget(element('#input'))).toBe(element('#input'));
      expect(describer.getActionTarget(element('#area'))).toBe(element('#area'));
      expect(describer.getActionTarget(element('#select'))).toBe(element('#select'));
    });

    testIf(isNativeDom(), 'should be an editable element itself', () => {
      container.innerHTML = '<button><div contenteditable="true" id="editor">Edit</div></button>';

      expect(describer.getActionTarget(element('#editor'))).toBe(element('#editor'));
    });

    testIf(isNativeDom(), 'should describe the target and not the element acted on', () => {
      container.innerHTML = '<button id="button"><span id="icon">*</span></button>';

      expect(describer.describe(element('#icon')).target.element).toBe(element('#button'));
    });
  });

  describe('facts', () => {
    testIf(isNativeDom(), 'should give the attributes an element can be named by', () => {
      container.innerHTML = `
        <input id="email" placeholder="you@example.com" title="Email address" data-testid="email-field">
        <img id="logo" alt="Company logo" src="data:,">
        <span>No attributes</span>`;

      const email = describer.describe(element('#email')).target;
      const logo = describer.describe(element('#logo')).target;
      const plain = describer.describe(element('span')).target;

      expect(email).toMatchObject({ tagName: 'input', placeholder: 'you@example.com', title: 'Email address', testId: 'email-field', id: 'email', alt: null });
      expect(logo).toMatchObject({ tagName: 'img', alt: 'Company logo', placeholder: null, title: null, testId: null });
      expect(plain).toMatchObject({ id: null, testId: null, role: null });
    });

    testIf(isNativeDom(), 'should read the test ID from the attribute asked for', () => {
      container.innerHTML = '<button id="go" data-test="go-button" data-testid="other">Go</button>';

      expect(describer.describe(element('#go'), { testIdAttribute: 'data-test' }).target.testId).toBe('go-button');
    });

    testIf(isNativeDom(), 'should give the role and the accessible name', () => {
      container.innerHTML = '<button id="save">  Save\n  changes </button><nav id="nav" aria-label="Main"></nav><div id="generic"></div>';

      expect(describer.describe(element('#save')).target).toMatchObject({ role: 'button', name: 'Save changes' });
      expect(describer.describe(element('#nav')).target).toMatchObject({ role: 'navigation', name: 'Main' });
      expect(describer.describe(element('#generic')).target.name).toBe('');
    });

    testIf(isNativeDom(), 'should give the labels as a label locator reads them', () => {
      container.innerHTML = `
        <label for="first">First   name</label><input id="first">
        <label>Last name <input id="last"></label>
        <input id="aria" aria-label="Search terms">
        <span id="caption">Phone</span><input id="labelled" aria-labelledby="caption">
        <input id="none">`;

      expect(describer.describe(element('#first')).target.labels).toEqual(['First name']);
      expect(describer.describe(element('#last')).target.labels).toEqual(['Last name']);
      expect(describer.describe(element('#aria')).target.labels).toEqual(['Search terms']);
      expect(describer.describe(element('#labelled')).target.labels).toEqual(['Phone']);
      expect(describer.describe(element('#none')).target.labels).toEqual([]);
    });

    testIf(isNativeDom(), 'should give the rendered text', () => {
      container.innerHTML = '<p id="text">Hello,   <b>world</b><span style="display: none"> hidden</span></p>';

      expect(describer.describe(element('#text')).target.text).toBe('Hello, world');
    });

    testIf(isNativeDom(), 'should give no text for an element that is not an HTML element', () => {
      container.innerHTML = '<svg id="icon"><text>Label</text></svg>';

      expect(describer.describe(element('#icon')).target.text).toBe('');
    });

    testIf(isNativeDom(), 'should say whether the element is in a shadow root', () => {
      container.innerHTML = '<div id="host"></div><button id="light">Light</button>';
      const shadowRoot = element('#host').attachShadow({ mode: 'open' });
      shadowRoot.innerHTML = '<p>Before</p><p><button id="shadowed">Shadowed</button></p>';
      const shadowed = shadowRoot.querySelector('#shadowed')!;

      const facts = describer.describe(shadowed).target;

      expect(facts.inShadowRoot).toBe(true);
      expect(facts.cssPath).toBe('#shadowed');
      expect(describer.describe(element('#light')).target.inShadowRoot).toBe(false);
    });
  });

  describe('ancestors', () => {
    testIf(isNativeDom(), 'should describe the ancestors with a test ID, an ID, or a role, nearest first', () => {
      container.innerHTML = `
        <main id="main">
          <div>
            <form aria-label="Sign in" id="form-id">
              <div data-testid="row">
                <div><button id="go">Go</button></div>
              </div>
            </form>
          </div>
        </main>`;

      const ancestors = describer.describe(element('#go'), { maxAncestors: 5 }).ancestors;

      expect(ancestors.map((ancestor) => ancestor.element)).toEqual([element('[data-testid=row]'), element('#form-id'), element('#main')]);
      expect(ancestors[0].testId).toBe('row');
      expect(ancestors[1]).toMatchObject({ role: 'form', name: 'Sign in' });
    });

    testIf(isNativeDom(), 'should describe three ancestors unless asked for another number', () => {
      container.innerHTML = '<nav><ul><li><nav><ul><li><a href="/x" id="deep">Deep</a></li></ul></nav></li></ul></nav>';

      expect(describer.describe(element('#deep')).ancestors).toHaveLength(3);
      expect(describer.describe(element('#deep'), { maxAncestors: 1 }).ancestors).toHaveLength(1);
      expect(describer.describe(element('#deep'), { maxAncestors: 0 }).ancestors).toHaveLength(0);
    });
  });

  describe('CSS path', () => {
    const path = (selector: string): string => describer.describe(element(selector)).target.cssPath;

    testIf(isNativeDom(), 'should be an ID unique in the document', () => {
      container.innerHTML = '<p id="unique">Text</p>';

      expect(path('#unique')).toBe('#unique');
    });

    testIf(isNativeDom(), 'should start from the nearest ancestor with a unique ID, naming each step by its tag and position', () => {
      container.innerHTML = '<section id="list"><p>One</p><p>Two</p><div><span>Only</span></div></section>';
      const second = container.querySelectorAll('p')[1];

      const secondPath = describer.describe(second).target.cssPath;
      const onlyPath = describer.describe(element('span')).target.cssPath;

      expect(secondPath).toBe('#list > p:nth-of-type(2)');
      expect(onlyPath).toBe('#list > div > span');
      expect(document.querySelector(secondPath)).toBe(second);
    });

    testIf(isNativeDom(), 'should not start from an ID another element shares', () => {
      container.innerHTML = '<div id="twice"><p>Target</p></div><div id="twice"></div>';
      const target = element('p');

      const targetPath = describer.describe(target).target.cssPath;

      expect(targetPath.startsWith('html > body > ')).toBe(true);
      expect(document.querySelector(targetPath)).toBe(target);
    });

    test.skipIf(!isNativeDom()).each([
      ['1st', '#\\31 st'],
      ['-2nd', '#-\\32 nd'],
      ['-', '#\\-'],
      ['a.b c', '#a\\.b\\ c'],
      ['under_score-dash', '#under_score-dash'],
      ['café', '#café'],
      ['tab\there', '#tab\\9 here'],
    ])('should escape the ID %j', (id, expected) => {
      const target = document.createElement('p');
      target.id = id;
      container.appendChild(target);

      const targetPath = describer.describe(target).target.cssPath;

      expect(targetPath).toBe(expected);
      expect(document.querySelector(targetPath)).toBe(target);
    });

    // A selector's NUL becomes U+FFFD, so it matches no ID with a NUL.
    testIf(isNativeDom(), 'should not start from an ID no selector can match', () => {
      const target = document.createElement('p');
      target.id = 'nul\u0000here';
      container.appendChild(target);

      const targetPath = describer.describe(target).target.cssPath;

      expect(targetPath.startsWith('html > body > ')).toBe(true);
      expect(document.querySelector(targetPath)).toBe(target);
    });
  });
});
