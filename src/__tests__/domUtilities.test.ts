import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import DOMUtilities from '../domUtilities';
import { isNativeDom, testIf } from './testUtilities';

describe('DOMUtilities', () => {
  let domUtils: DOMUtilities;
  let container: HTMLElement;

  beforeEach(() => {
    domUtils = new DOMUtilities();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('getNormalizedElementTagName', () => {
    it('should return uppercase tag name for standard elements', () => {
      const div = document.createElement('div');
      expect(domUtils.getNormalizedElementTagName(div)).toBe('DIV');
    });

    it('should return uppercase tag name for button elements', () => {
      const button = document.createElement('button');
      expect(domUtils.getNormalizedElementTagName(button)).toBe('BUTTON');
    });

    it('should return FORM for form elements', () => {
      const form = document.createElement('form');
      expect(domUtils.getNormalizedElementTagName(form)).toBe('FORM');
    });

    it('should return FORM even when form has a named input called tagName', () => {
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.name = 'tagName';
      form.appendChild(input);
      expect(domUtils.getNormalizedElementTagName(form)).toBe('FORM');
    });

    it('should return FORM when form is in DOM with named input tagName', () => {
      // Test HTMLFormElement check when tagName property is shadowed
      const form = document.createElement('form');
      const input = document.createElement('input');
      input.name = 'tagName';
      input.value = 'test';
      form.appendChild(input);
      container.appendChild(form);
      
      // In browsers, form.tagName might return the input element when accessed
      // but the code handles this by checking instanceof HTMLFormElement
      expect(domUtils.getNormalizedElementTagName(form)).toBe('FORM');
    });

    it('should handle form with multiple shadowing named inputs', () => {
      // Test with form that has multiple properties shadowed
      const form = document.createElement('form');
      const tagNameInput = document.createElement('input');
      tagNameInput.name = 'tagName';
      const methodInput = document.createElement('input');
      methodInput.name = 'method';
      form.appendChild(tagNameInput);
      form.appendChild(methodInput);
      container.appendChild(form);
      expect(domUtils.getNormalizedElementTagName(form)).toBe('FORM');
    });

    it('should handle form element when tagName property is overridden', () => {
      // Test the instanceof HTMLFormElement check
      // Create a real form but mock its tagName property to not be a string
      const form = document.createElement('form');
      container.appendChild(form);
      
      // Override the tagName property to return a non-string value
      Object.defineProperty(form, 'tagName', {
        get() {
          // Return an input element (simulating the named input scenario)
          const input = document.createElement('input');
          return input;
        },
        configurable: true
      });
      
      // Should still return 'FORM' because of instanceof check
      expect(domUtils.getNormalizedElementTagName(form)).toBe('FORM');
    });

    it('should handle mocked element with non-string tagName fallback', () => {
      // Test fallback case for element where tagName is not a string
      // This is defensive code for edge cases
      const mockElement = {
        tagName: { toString: () => 'mock-element', toUpperCase: () => 'MOCK-ELEMENT' }
      } as unknown as Element;
      
      // This tests the final fallback
      expect(domUtils.getNormalizedElementTagName(mockElement)).toBe('MOCK-ELEMENT');
    });

    it('should handle SVG elements correctly', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      expect(domUtils.getNormalizedElementTagName(svg)).toBe('SVG');
    });

    it('should handle SVG child elements correctly', () => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      expect(domUtils.getNormalizedElementTagName(circle)).toBe('CIRCLE');
    });
  });

  describe('hasTabIndex', () => {
    it('should return true for element with tabindex="0"', () => {
      const div = document.createElement('div');
      div.setAttribute('tabindex', '0');
      expect(domUtils.hasTabIndex(div)).toBe(true);
    });

    it('should return true for element with tabindex="1"', () => {
      const div = document.createElement('div');
      div.setAttribute('tabindex', '1');
      expect(domUtils.hasTabIndex(div)).toBe(true);
    });

    it('should return true for element with tabindex="-1"', () => {
      const div = document.createElement('div');
      div.setAttribute('tabindex', '-1');
      expect(domUtils.hasTabIndex(div)).toBe(true);
    });

    it('should return false for element without tabindex', () => {
      const div = document.createElement('div');
      expect(domUtils.hasTabIndex(div)).toBe(false);
    });

    it('should return false for element with non-numeric tabindex', () => {
      const div = document.createElement('div');
      div.setAttribute('tabindex', 'invalid');
      expect(domUtils.hasTabIndex(div)).toBe(false);
    });

    it('should return true for element with empty tabindex', () => {
      // Empty string converts to 0 via Number()
      const div = document.createElement('div');
      div.setAttribute('tabindex', '');
      expect(domUtils.hasTabIndex(div)).toBe(true);
    });

    it('should return true for element with tabindex="0.0"', () => {
      const div = document.createElement('div');
      div.setAttribute('tabindex', '0.0');
      expect(domUtils.hasTabIndex(div)).toBe(true);
    });

    it('should return true for element with tabindex with leading/trailing spaces', () => {
      const div = document.createElement('div');
      div.setAttribute('tabindex', ' 0 ');
      expect(domUtils.hasTabIndex(div)).toBe(true);
    });
  });

  describe('isNativelyDisabled', () => {
    describe('Button Elements', () => {
      it('should return true for disabled button', () => {
        const button = document.createElement('button');
        button.disabled = true;
        expect(domUtils.isNativelyDisabled(button)).toBe(true);
      });

      it('should return false for enabled button', () => {
        const button = document.createElement('button');
        expect(domUtils.isNativelyDisabled(button)).toBe(false);
      });
    });

    describe('Input Elements', () => {
      it('should return true for disabled input', () => {
        const input = document.createElement('input');
        input.disabled = true;
        expect(domUtils.isNativelyDisabled(input)).toBe(true);
      });

      it('should return false for enabled input', () => {
        const input = document.createElement('input');
        expect(domUtils.isNativelyDisabled(input)).toBe(false);
      });
    });

    describe('Select Elements', () => {
      it('should return true for disabled select', () => {
        const select = document.createElement('select');
        select.disabled = true;
        expect(domUtils.isNativelyDisabled(select)).toBe(true);
      });

      it('should return false for enabled select', () => {
        const select = document.createElement('select');
        expect(domUtils.isNativelyDisabled(select)).toBe(false);
      });
    });

    describe('Textarea Elements', () => {
      it('should return true for disabled textarea', () => {
        const textarea = document.createElement('textarea');
        textarea.disabled = true;
        expect(domUtils.isNativelyDisabled(textarea)).toBe(true);
      });

      it('should return false for enabled textarea', () => {
        const textarea = document.createElement('textarea');
        expect(domUtils.isNativelyDisabled(textarea)).toBe(false);
      });
    });

    describe('Option Elements', () => {
      it('should return true for disabled option', () => {
        const option = document.createElement('option');
        option.disabled = true;
        expect(domUtils.isNativelyDisabled(option)).toBe(true);
      });

      it('should return false for enabled option', () => {
        const option = document.createElement('option');
        expect(domUtils.isNativelyDisabled(option)).toBe(false);
      });

      testIf(isNativeDom(), 'should return true for option inside disabled optgroup', () => {
        // Note: jsdom doesn't properly support closest() with [DISABLED] attribute selectors for optgroup elements
        // This test is skipped but the functionality works correctly in real browsers
        const select = document.createElement('select');
        const optgroup = document.createElement('optgroup');
        optgroup.setAttribute('disabled', '');
        const option = document.createElement('option');
        optgroup.appendChild(option);
        select.appendChild(optgroup);
        container.appendChild(select);
        expect(domUtils.isNativelyDisabled(option)).toBe(true);
      });

      it('should return false for option inside enabled optgroup', () => {
        const select = document.createElement('select');
        const optgroup = document.createElement('optgroup');
        const option = document.createElement('option');
        optgroup.appendChild(option);
        select.appendChild(optgroup);
        container.appendChild(select);
        expect(domUtils.isNativelyDisabled(option)).toBe(false);
      });

      testIf(isNativeDom(), 'should return true for enabled option inside disabled optgroup', () => {
        // Note: jsdom doesn't properly support closest() with [DISABLED] attribute selectors for optgroup elements
        const select = document.createElement('select');
        const optgroup = document.createElement('optgroup');
        optgroup.setAttribute('disabled', '');
        const option = document.createElement('option');
        optgroup.appendChild(option);
        select.appendChild(optgroup);
        container.appendChild(select);
        expect(domUtils.isNativelyDisabled(option)).toBe(true);
      });
    });

    describe('OptGroup Elements', () => {
      it('should return true for disabled optgroup', () => {
        const optgroup = document.createElement('optgroup');
        optgroup.disabled = true;
        expect(domUtils.isNativelyDisabled(optgroup)).toBe(true);
      });

      it('should return false for enabled optgroup', () => {
        const optgroup = document.createElement('optgroup');
        expect(domUtils.isNativelyDisabled(optgroup)).toBe(false);
      });
    });

    describe('Fieldset Elements', () => {
      it('should return true for input inside disabled fieldset (using mock)', () => {
        // This test bypasses jsdom's limitation by mocking the closest method
        // to test the fieldset disabled logic
        const form = document.createElement('form');
        const fieldset = document.createElement('fieldset');
        fieldset.setAttribute('disabled', '');
        const input = document.createElement('input');
        fieldset.appendChild(input);
        form.appendChild(fieldset);
        container.appendChild(form);

        // Mock the closest method to return the fieldset (bypassing jsdom limitation)
        const originalClosest = input.closest.bind(input);
        input.closest = function(selector: string) {
          if (selector === 'FIELDSET[DISABLED]') {
            return fieldset;
          }
          return originalClosest(selector);
        } as typeof input.closest;

        // This will now execute the fieldset check since closest returns a non-null fieldset
        expect(domUtils.isNativelyDisabled(input)).toBe(true);

        // Restore original method
        input.closest = originalClosest;
      });

      it('should return false for input inside legend of disabled fieldset (using mock)', () => {
        // This test specifically targets the legendElement.contains check
        const form = document.createElement('form');
        const fieldset = document.createElement('fieldset');
        fieldset.setAttribute('disabled', '');
        const legend = document.createElement('legend');
        const input = document.createElement('input');
        legend.appendChild(input);
        fieldset.appendChild(legend);
        form.appendChild(fieldset);
        container.appendChild(form);

        // Mock the closest method
        const originalClosest = input.closest.bind(input);
        input.closest = function(selector: string) {
          if (selector === 'FIELDSET[DISABLED]') {
            return fieldset;
          }
          return originalClosest(selector);
        } as typeof input.closest;

        // This executes the legend check:
        // - querySelector finds the legend
        // - legendElement.contains(element) returns true, so !true = false
        expect(domUtils.isNativelyDisabled(input)).toBe(false);

        // Restore original method
        input.closest = originalClosest;
      });

      testIf(isNativeDom(), 'should return true for input inside disabled fieldset', () => {
        // Note: jsdom doesn't properly support closest() with [DISABLED] attribute selectors for fieldset elements
        const form = document.createElement('form');
        const fieldset = document.createElement('fieldset');
        fieldset.setAttribute('disabled', '');
        const input = document.createElement('input');
        fieldset.appendChild(input);
        form.appendChild(fieldset);
        container.appendChild(form);
        expect(domUtils.isNativelyDisabled(input)).toBe(true);
      });

      it('should return false for input inside enabled fieldset', () => {
        const form = document.createElement('form');
        const fieldset = document.createElement('fieldset');
        const input = document.createElement('input');
        fieldset.appendChild(input);
        form.appendChild(fieldset);
        container.appendChild(form);
        expect(domUtils.isNativelyDisabled(input)).toBe(false);
      });

      it('should return false for input inside legend of disabled fieldset', () => {
        const form = document.createElement('form');
        const fieldset = document.createElement('fieldset');
        fieldset.setAttribute('disabled', '');
        const legend = document.createElement('legend');
        const input = document.createElement('input');
        legend.appendChild(input);
        fieldset.appendChild(legend);
        form.appendChild(fieldset);
        container.appendChild(form);
        expect(domUtils.isNativelyDisabled(input)).toBe(false);
      });

      testIf(isNativeDom(), 'should return true for input after legend in disabled fieldset', () => {
        // Note: jsdom doesn't properly support closest() with [DISABLED] attribute selectors for fieldset elements
        const form = document.createElement('form');
        const fieldset = document.createElement('fieldset');
        fieldset.setAttribute('disabled', '');
        const legend = document.createElement('legend');
        const input = document.createElement('input');
        fieldset.appendChild(legend);
        fieldset.appendChild(input);
        form.appendChild(fieldset);
        container.appendChild(form);
        expect(domUtils.isNativelyDisabled(input)).toBe(true);
      });

      it('should return false for input in nested legend of disabled fieldset', () => {
        const form = document.createElement('form');
        const fieldset = document.createElement('fieldset');
        fieldset.setAttribute('disabled', '');
        const legend = document.createElement('legend');
        const div = document.createElement('div');
        const input = document.createElement('input');
        div.appendChild(input);
        legend.appendChild(div);
        fieldset.appendChild(legend);
        form.appendChild(fieldset);
        container.appendChild(form);
        expect(domUtils.isNativelyDisabled(input)).toBe(false);
      });

      testIf(isNativeDom(), 'should handle button in disabled fieldset', () => {
        // Note: jsdom doesn't properly support closest() with [DISABLED] attribute selectors for fieldset elements
        const form = document.createElement('form');
        const fieldset = document.createElement('fieldset');
        fieldset.setAttribute('disabled', '');
        const button = document.createElement('button');
        fieldset.appendChild(button);
        form.appendChild(fieldset);
        container.appendChild(form);
        expect(domUtils.isNativelyDisabled(button)).toBe(true);
      });

      testIf(isNativeDom(), 'should handle select in disabled fieldset', () => {
        // Note: jsdom doesn't properly support closest() with [DISABLED] attribute selectors for fieldset elements
        const form = document.createElement('form');
        const fieldset = document.createElement('fieldset');
        fieldset.setAttribute('disabled', '');
        const select = document.createElement('select');
        fieldset.appendChild(select);
        form.appendChild(fieldset);
        container.appendChild(form);
        expect(domUtils.isNativelyDisabled(select)).toBe(true);
      });

      testIf(isNativeDom(), 'should handle textarea in disabled fieldset', () => {
        // Note: jsdom doesn't properly support closest() with [DISABLED] attribute selectors for fieldset elements
        const form = document.createElement('form');
        const fieldset = document.createElement('fieldset');
        fieldset.setAttribute('disabled', '');
        const textarea = document.createElement('textarea');
        fieldset.appendChild(textarea);
        form.appendChild(fieldset);
        container.appendChild(form);
        expect(domUtils.isNativelyDisabled(textarea)).toBe(true);
      });
    });

    describe('Non-form Elements', () => {
      it('should return false for div', () => {
        const div = document.createElement('div');
        expect(domUtils.isNativelyDisabled(div)).toBe(false);
      });

      it('should return false for span', () => {
        const span = document.createElement('span');
        expect(domUtils.isNativelyDisabled(span)).toBe(false);
      });

      it('should return false for anchor', () => {
        const anchor = document.createElement('a');
        expect(domUtils.isNativelyDisabled(anchor)).toBe(false);
      });

      it('should return false for div with disabled attribute', () => {
        const div = document.createElement('div');
        div.setAttribute('disabled', '');
        expect(domUtils.isNativelyDisabled(div)).toBe(false);
      });
    });
  });

  describe('isFocusable', () => {
    describe('Natively Focusable Elements', () => {
      it('should return true for button', () => {
        const button = document.createElement('button');
        expect(domUtils.isFocusable(button)).toBe(true);
      });

      it('should return false for disabled button', () => {
        const button = document.createElement('button');
        button.disabled = true;
        expect(domUtils.isFocusable(button)).toBe(false);
      });

      it('should return true for select', () => {
        const select = document.createElement('select');
        expect(domUtils.isFocusable(select)).toBe(true);
      });

      it('should return true for textarea', () => {
        const textarea = document.createElement('textarea');
        expect(domUtils.isFocusable(textarea)).toBe(true);
      });

      it('should return true for details', () => {
        const details = document.createElement('details');
        expect(domUtils.isFocusable(details)).toBe(true);
      });

      it('should return true for visible input', () => {
        const input = document.createElement('input');
        input.type = 'text';
        expect(domUtils.isFocusable(input)).toBe(true);
      });

      it('should return false for hidden input', () => {
        const input = document.createElement('input');
        input.type = 'hidden';
        // The code checks the .hidden property, not the type
        Object.defineProperty(input, 'hidden', { value: true, writable: true });
        expect(domUtils.isFocusable(input)).toBe(false);
      });

      it('should return true for anchor with href', () => {
        const anchor = document.createElement('a');
        anchor.href = 'https://example.com';
        expect(domUtils.isFocusable(anchor)).toBe(true);
      });

      it('should return false for anchor without href', () => {
        const anchor = document.createElement('a');
        expect(domUtils.isFocusable(anchor)).toBe(false);
      });

      it('should return true for anchor with empty href', () => {
        const anchor = document.createElement('a');
        anchor.href = '';
        expect(domUtils.isFocusable(anchor)).toBe(true);
      });

      it('should return true for area with href', () => {
        const area = document.createElement('area');
        area.href = 'https://example.com';
        expect(domUtils.isFocusable(area)).toBe(true);
      });

      it('should return false for area without href', () => {
        const area = document.createElement('area');
        expect(domUtils.isFocusable(area)).toBe(false);
      });
    });

    describe('Elements with TabIndex', () => {
      it('should return true for div with tabindex="0"', () => {
        const div = document.createElement('div');
        div.setAttribute('tabindex', '0');
        expect(domUtils.isFocusable(div)).toBe(true);
      });

      it('should return true for div with tabindex="-1"', () => {
        const div = document.createElement('div');
        div.setAttribute('tabindex', '-1');
        expect(domUtils.isFocusable(div)).toBe(true);
      });

      it('should return true for span with tabindex="1"', () => {
        const span = document.createElement('span');
        span.setAttribute('tabindex', '1');
        expect(domUtils.isFocusable(span)).toBe(true);
      });

      it('should return false for div without tabindex', () => {
        const div = document.createElement('div');
        expect(domUtils.isFocusable(div)).toBe(false);
      });

      it('should return false for disabled button with tabindex', () => {
        const button = document.createElement('button');
        button.disabled = true;
        button.setAttribute('tabindex', '0');
        expect(domUtils.isFocusable(button)).toBe(false);
      });
    });

    describe('Input Types', () => {
      it('should return true for text input', () => {
        const input = document.createElement('input');
        input.type = 'text';
        expect(domUtils.isFocusable(input)).toBe(true);
      });

      it('should return true for checkbox input', () => {
        const input = document.createElement('input');
        input.type = 'checkbox';
        expect(domUtils.isFocusable(input)).toBe(true);
      });

      it('should return true for radio input', () => {
        const input = document.createElement('input');
        input.type = 'radio';
        expect(domUtils.isFocusable(input)).toBe(true);
      });

      it('should return true for submit input', () => {
        const input = document.createElement('input');
        input.type = 'submit';
        expect(domUtils.isFocusable(input)).toBe(true);
      });

      it('should return true for button input', () => {
        const input = document.createElement('input');
        input.type = 'button';
        expect(domUtils.isFocusable(input)).toBe(true);
      });

      it('should return false for hidden input', () => {
        const input = document.createElement('input');
        input.type = 'hidden';
        // The code checks the .hidden property, not the type
        Object.defineProperty(input, 'hidden', { value: true, writable: true });
        expect(domUtils.isFocusable(input)).toBe(false);
      });

      it('should return false for disabled text input', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.disabled = true;
        expect(domUtils.isFocusable(input)).toBe(false);
      });
    });

    describe('Fieldset Disabled Inheritance', () => {
      testIf(isNativeDom(), 'should return false for input in disabled fieldset', () => {
        // Note: jsdom doesn't properly support closest() with [DISABLED] attribute selectors for fieldset elements
        const form = document.createElement('form');
        const fieldset = document.createElement('fieldset');
        fieldset.setAttribute('disabled', '');
        const input = document.createElement('input');
        fieldset.appendChild(input);
        form.appendChild(fieldset);
        container.appendChild(form);
        expect(domUtils.isFocusable(input)).toBe(false);
      });

      it('should return true for input in legend of disabled fieldset', () => {
        const form = document.createElement('form');
        const fieldset = document.createElement('fieldset');
        fieldset.setAttribute('disabled', '');
        const legend = document.createElement('legend');
        const input = document.createElement('input');
        legend.appendChild(input);
        fieldset.appendChild(legend);
        form.appendChild(fieldset);
        container.appendChild(form);
        expect(domUtils.isFocusable(input)).toBe(true);
      });
    });
  });

  describe('getParentElementOrShadowHost', () => {
    it('should return parent element for standard DOM', () => {
      const parent = document.createElement('div');
      const child = document.createElement('span');
      parent.appendChild(child);
      expect(domUtils.getParentElementOrShadowHost(child)).toBe(parent);
    });

    it('should return undefined for element without parent', () => {
      const element = document.createElement('div');
      expect(domUtils.getParentElementOrShadowHost(element)).toBeUndefined();
    });

    it('should return undefined for detached element', () => {
      const element = document.createElement('div');
      expect(domUtils.getParentElementOrShadowHost(element)).toBeUndefined();
    });

    it('should return shadow host for element in shadow root', () => {
      const host = document.createElement('div');
      container.appendChild(host);
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const shadowChild = document.createElement('span');
      shadowRoot.appendChild(shadowChild);
      expect(domUtils.getParentElementOrShadowHost(shadowChild)).toBe(host);
    });

    it('should return parent element inside shadow DOM', () => {
      const host = document.createElement('div');
      container.appendChild(host);
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const parent = document.createElement('div');
      const child = document.createElement('span');
      parent.appendChild(child);
      shadowRoot.appendChild(parent);
      expect(domUtils.getParentElementOrShadowHost(child)).toBe(parent);
    });
  });

  describe('getEnclosingShadowRootOrDocument', () => {
    it('should return document for element in main DOM', () => {
      const element = document.createElement('div');
      container.appendChild(element);
      expect(domUtils.getEnclosingShadowRootOrDocument(element)).toBe(document);
    });

    it('should return shadow root for element in shadow DOM', () => {
      const host = document.createElement('div');
      container.appendChild(host);
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const element = document.createElement('span');
      shadowRoot.appendChild(element);
      expect(domUtils.getEnclosingShadowRootOrDocument(element)).toBe(shadowRoot);
    });

    it('should return shadow root for nested element in shadow DOM', () => {
      const host = document.createElement('div');
      container.appendChild(host);
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const parent = document.createElement('div');
      const child = document.createElement('span');
      parent.appendChild(child);
      shadowRoot.appendChild(parent);
      expect(domUtils.getEnclosingShadowRootOrDocument(child)).toBe(shadowRoot);
    });

    it('should return undefined for detached element', () => {
      const element = document.createElement('div');
      expect(domUtils.getEnclosingShadowRootOrDocument(element)).toBeUndefined();
    });

    it('should handle deeply nested element', () => {
      const level1 = document.createElement('div');
      const level2 = document.createElement('div');
      const level3 = document.createElement('div');
      const level4 = document.createElement('div');
      container.appendChild(level1);
      level1.appendChild(level2);
      level2.appendChild(level3);
      level3.appendChild(level4);
      expect(domUtils.getEnclosingShadowRootOrDocument(level4)).toBe(document);
    });
  });

  describe('getEnclosingShadowHost', () => {
    it('should return undefined for element in main DOM', () => {
      const element = document.createElement('div');
      container.appendChild(element);
      expect(domUtils.getEnclosingShadowHost(element)).toBeUndefined();
    });

    it('should return shadow host for element in shadow root', () => {
      const host = document.createElement('div');
      container.appendChild(host);
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const element = document.createElement('span');
      shadowRoot.appendChild(element);
      expect(domUtils.getEnclosingShadowHost(element)).toBe(host);
    });

    it('should return shadow host for nested element in shadow root', () => {
      const host = document.createElement('div');
      container.appendChild(host);
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const parent = document.createElement('div');
      const child = document.createElement('span');
      parent.appendChild(child);
      shadowRoot.appendChild(parent);
      expect(domUtils.getEnclosingShadowHost(child)).toBe(host);
    });

    it('should return undefined for detached element', () => {
      const element = document.createElement('div');
      expect(domUtils.getEnclosingShadowHost(element)).toBeUndefined();
    });

    it('should navigate to top of subtree before checking for shadow host', () => {
      const host = document.createElement('div');
      container.appendChild(host);
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const parent = document.createElement('div');
      const grandparent = document.createElement('div');
      const child = document.createElement('span');
      grandparent.appendChild(parent);
      parent.appendChild(child);
      shadowRoot.appendChild(grandparent);
      expect(domUtils.getEnclosingShadowHost(child)).toBe(host);
    });
  });

  describe('getClosestCrossShadowElement', () => {
    it('should find closest element in same tree', () => {
      const parent = document.createElement('div');
      parent.className = 'target';
      const child = document.createElement('span');
      parent.appendChild(child);
      container.appendChild(parent);
      expect(domUtils.getClosestCrossShadowElement(child, '.target')).toBe(parent);
    });

    it('should return the element itself if it matches', () => {
      const element = document.createElement('div');
      element.className = 'target';
      container.appendChild(element);
      expect(domUtils.getClosestCrossShadowElement(element, '.target')).toBe(element);
    });

    it('should cross shadow boundaries', () => {
      const host = document.createElement('div');
      host.className = 'target';
      container.appendChild(host);
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const shadowElement = document.createElement('span');
      shadowRoot.appendChild(shadowElement);
      expect(domUtils.getClosestCrossShadowElement(shadowElement, '.target')).toBe(host);
    });

    it('should return undefined if no match found', () => {
      const element = document.createElement('div');
      container.appendChild(element);
      expect(domUtils.getClosestCrossShadowElement(element, '.nonexistent')).toBeUndefined();
    });

    it('should respect scope parameter', () => {
      const grandparent = document.createElement('div');
      grandparent.className = 'target';
      const parent = document.createElement('div');
      const child = document.createElement('span');
      container.appendChild(grandparent);
      grandparent.appendChild(parent);
      parent.appendChild(child);
      
      // scope is parent, so shouldn't find grandparent
      expect(domUtils.getClosestCrossShadowElement(child, '.target', parent)).toBeUndefined();
    });

    it('should find element when scope contains it', () => {
      const grandparent = document.createElement('div');
      const parent = document.createElement('div');
      parent.className = 'target';
      const child = document.createElement('span');
      container.appendChild(grandparent);
      grandparent.appendChild(parent);
      parent.appendChild(child);
      
      expect(domUtils.getClosestCrossShadowElement(child, '.target', grandparent)).toBe(parent);
    });

    it('should return scope if it matches', () => {
      const parent = document.createElement('div');
      parent.className = 'target';
      const child = document.createElement('span');
      parent.appendChild(child);
      container.appendChild(parent);
      
      expect(domUtils.getClosestCrossShadowElement(child, '.target', parent)).toBe(parent);
    });

    it('should handle undefined element', () => {
      expect(domUtils.getClosestCrossShadowElement(undefined, '.target')).toBeUndefined();
    });

    it('should handle nested shadow DOMs', () => {
      const outerHost = document.createElement('div');
      outerHost.className = 'outer-target';
      container.appendChild(outerHost);
      const outerShadow = outerHost.attachShadow({ mode: 'open' });
      
      const innerHost = document.createElement('div');
      innerHost.className = 'inner-target';
      outerShadow.appendChild(innerHost);
      const innerShadow = innerHost.attachShadow({ mode: 'open' });
      
      const deepElement = document.createElement('span');
      innerShadow.appendChild(deepElement);
      
      expect(domUtils.getClosestCrossShadowElement(deepElement, '.inner-target')).toBe(innerHost);
      expect(domUtils.getClosestCrossShadowElement(deepElement, '.outer-target')).toBe(outerHost);
    });

    it('should handle complex CSS selectors', () => {
      const parent = document.createElement('div');
      parent.setAttribute('data-test', 'value');
      const child = document.createElement('span');
      parent.appendChild(child);
      container.appendChild(parent);
      expect(domUtils.getClosestCrossShadowElement(child, '[data-test="value"]')).toBe(parent);
    });

    it('should handle ID selectors', () => {
      const parent = document.createElement('div');
      parent.id = 'my-id';
      const child = document.createElement('span');
      parent.appendChild(child);
      container.appendChild(parent);
      expect(domUtils.getClosestCrossShadowElement(child, '#my-id')).toBe(parent);
    });
  });

  describe('Edge Cases and Integration', () => {
    testIf(isNativeDom(), 'should handle multiple levels of nested fieldsets', () => {
      // Note: jsdom doesn't properly support closest() with [DISABLED] attribute selectors for fieldset elements
      const form = document.createElement('form');
      const outerFieldset = document.createElement('fieldset');
      outerFieldset.setAttribute('disabled', '');
      const innerFieldset = document.createElement('fieldset');
      const input = document.createElement('input');
      innerFieldset.appendChild(input);
      outerFieldset.appendChild(innerFieldset);
      form.appendChild(outerFieldset);
      container.appendChild(form);
      expect(domUtils.isNativelyDisabled(input)).toBe(true);
    });

    it('should handle custom elements', () => {
      const customElement = document.createElement('custom-element');
      expect(domUtils.getNormalizedElementTagName(customElement)).toBe('CUSTOM-ELEMENT');
    });

    it('should handle elements with uppercase tag names', () => {
      const div = document.createElement('DIV');
      expect(domUtils.getNormalizedElementTagName(div)).toBe('DIV');
    });

    testIf(isNativeDom(), 'should handle option in disabled optgroup', () => {
      // Note: jsdom doesn't properly support closest() with [DISABLED] attribute selectors for optgroup elements
      const select = document.createElement('select');
      const optgroup = document.createElement('optgroup');
      optgroup.setAttribute('disabled', '');
      const option = document.createElement('option');
      optgroup.appendChild(option);
      select.appendChild(optgroup);
      container.appendChild(select);
      expect(domUtils.isNativelyDisabled(option)).toBe(true);
    });

    it('should properly determine focusability chain', () => {
      // Natively focusable, not disabled
      const button = document.createElement('button');
      expect(domUtils.isFocusable(button)).toBe(true);
      
      // Not natively focusable, but has tabindex
      const div = document.createElement('div');
      div.setAttribute('tabindex', '0');
      expect(domUtils.isFocusable(div)).toBe(true);
      
      // Neither natively focusable nor has tabindex
      const span = document.createElement('span');
      expect(domUtils.isFocusable(span)).toBe(false);
    });

    it('should handle tabindex edge case with special characters', () => {
      const div = document.createElement('div');
      div.setAttribute('tabindex', '1.5e2');
      expect(domUtils.hasTabIndex(div)).toBe(true);
    });

    it('should handle forms with multiple named inputs', () => {
      const form = document.createElement('form');
      const input1 = document.createElement('input');
      input1.name = 'tagName';
      const input2 = document.createElement('input');
      input2.name = 'method';
      form.appendChild(input1);
      form.appendChild(input2);
      container.appendChild(form);
      expect(domUtils.getNormalizedElementTagName(form)).toBe('FORM');
    });

    it('should handle detached shadow root scenario', () => {
      const host = document.createElement('div');
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const element = document.createElement('span');
      shadowRoot.appendChild(element);
      // Don't append host to container - it's detached
      expect(domUtils.getEnclosingShadowHost(element)).toBe(host);
    });
  });
});

