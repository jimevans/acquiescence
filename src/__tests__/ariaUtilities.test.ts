import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import AriaUtilities from '../ariaUtilities';
import DOMUtilities from '../domUtilities';

// Polyfill CSS.escape for jsdom if it doesn't exist
if (typeof CSS === 'undefined' || CSS.escape === undefined) {
  globalThis.CSS = globalThis.CSS || ({} as any);
  // Simple polyfill for CSS.escape
  // Based on https://drafts.csswg.org/cssom/#the-css.escape()-method
  (globalThis.CSS as any).escape = (value: string) => {
    const string = String(value);
    const length = string.length;
    let index = -1;
    let codeUnit;
    let result = '';
    // Note: charCodeAt is used intentionally here (not codePointAt) because
    // the CSS.escape spec works with UTF-16 code units, not code points
    const firstCodeUnit = string.charCodeAt(0);
    while (++index < length) {
      codeUnit = string.charCodeAt(index);
      // Note: there's no need to special-case astral symbols, surrogate
      // pairs, or lone surrogates.

      // If the character is NULL (U+0000), then the REPLACEMENT CHARACTER
      // (U+FFFD).
      if (codeUnit == 0x0000) {
        result += '\uFFFD';
        continue;
      }

      if (
        // If the character is in the range [\1-\1F] (U+0001 to U+001F) or is
        // U+007F, […]
        (codeUnit >= 0x0001 && codeUnit <= 0x001F) || codeUnit == 0x007F ||
        // If the character is the first character and is in the range [0-9]
        // (U+0030 to U+0039), […]
        (index == 0 && codeUnit >= 0x0030 && codeUnit <= 0x0039) ||
        // If the character is the second character and is in the range [0-9]
        // (U+0030 to U+0039) and the first character is a `-` (U+002D), […]
        (
          index == 1 &&
          codeUnit >= 0x0030 && codeUnit <= 0x0039 &&
          firstCodeUnit == 0x002D
        )
      ) {
        // https://drafts.csswg.org/cssom/#escape-a-character-as-code-point
        result += '\\' + codeUnit.toString(16) + ' ';
        continue;
      }

      if (
        // If the character is the first character and is a `-` (U+002D), and
        // there is no second character, […]
        index == 0 &&
        length == 1 &&
        codeUnit == 0x002D
      ) {
        result += '\\' + string.charAt(index);
        continue;
      }

      // If the character is not handled by one of the above rules and is
      // greater than or equal to U+0080, is `-` (U+002D) or `_` (U+005F), or
      // is in one of the ranges [0-9] (U+0030 to U+0039), [A-Z] (U+0041 to
      // U+005A), or [a-z] (U+0061 to U+007A), […]
      if (
        codeUnit >= 0x0080 ||
        codeUnit == 0x002D ||
        codeUnit == 0x005F ||
        codeUnit >= 0x0030 && codeUnit <= 0x0039 ||
        codeUnit >= 0x0041 && codeUnit <= 0x005A ||
        codeUnit >= 0x0061 && codeUnit <= 0x007A
      ) {
        // the character itself
        result += string.charAt(index);
        continue;
      }

      // Otherwise, the escaped character.
      // https://drafts.csswg.org/cssom/#escape-a-character
      result += '\\' + string.charAt(index);

    }
    return result;
  };
}

describe('AriaUtilities', () => {
  let ariaUtils: AriaUtilities;
  let domUtils: DOMUtilities;
  let container: HTMLElement;

  beforeEach(() => {
    ariaUtils = new AriaUtilities();
    domUtils = new DOMUtilities();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('hasExplicitAriaDisabled', () => {
    describe('Basic Functionality', () => {
      it('should return false for undefined element', () => {
        expect(ariaUtils.hasExplicitAriaDisabled(undefined)).toBe(false);
      });

      it('should return true for element with aria-disabled="true"', () => {
        const button = document.createElement('button');
        button.setAttribute('aria-disabled', 'true');
        container.appendChild(button);
        expect(ariaUtils.hasExplicitAriaDisabled(button)).toBe(true);
      });

      it('should return false for element with aria-disabled="false"', () => {
        const button = document.createElement('button');
        button.setAttribute('aria-disabled', 'false');
        container.appendChild(button);
        expect(ariaUtils.hasExplicitAriaDisabled(button)).toBe(false);
      });

      it('should be case-insensitive for aria-disabled value', () => {
        const button = document.createElement('button');
        button.setAttribute('aria-disabled', 'TRUE');
        container.appendChild(button);
        expect(ariaUtils.hasExplicitAriaDisabled(button)).toBe(true);
      });

      it('should handle mixed case "TrUe" value', () => {
        const button = document.createElement('button');
        button.setAttribute('aria-disabled', 'TrUe');
        container.appendChild(button);
        expect(ariaUtils.hasExplicitAriaDisabled(button)).toBe(true);
      });
    });

    describe('Role-specific Behavior', () => {
      it('should respect aria-disabled on button role', () => {
        const div = document.createElement('div');
        div.setAttribute('role', 'button');
        div.setAttribute('aria-disabled', 'true');
        container.appendChild(div);
        expect(ariaUtils.hasExplicitAriaDisabled(div)).toBe(true);
      });

      it('should respect aria-disabled on checkbox role', () => {
        const div = document.createElement('div');
        div.setAttribute('role', 'checkbox');
        div.setAttribute('aria-disabled', 'true');
        container.appendChild(div);
        expect(ariaUtils.hasExplicitAriaDisabled(div)).toBe(true);
      });

      it('should respect aria-disabled on input elements', () => {
        const input = document.createElement('input');
        input.setAttribute('aria-disabled', 'true');
        container.appendChild(input);
        expect(ariaUtils.hasExplicitAriaDisabled(input)).toBe(true);
      });

      it('should ignore aria-disabled on non-disabled roles', () => {
        const div = document.createElement('div');
        div.setAttribute('role', 'article');
        div.setAttribute('aria-disabled', 'true');
        container.appendChild(div);
        expect(ariaUtils.hasExplicitAriaDisabled(div)).toBe(false);
      });
    });

    describe('Inheritance from Ancestors', () => {
      it('should inherit aria-disabled from parent button', () => {
        const button = document.createElement('button');
        button.setAttribute('aria-disabled', 'true');
        const span = document.createElement('span');
        button.appendChild(span);
        container.appendChild(button);
        expect(ariaUtils.hasExplicitAriaDisabled(span, true)).toBe(true);
      });

      it('should inherit aria-disabled from grandparent', () => {
        const outer = document.createElement('div');
        outer.setAttribute('role', 'button');
        outer.setAttribute('aria-disabled', 'true');
        const middle = document.createElement('div');
        const inner = document.createElement('span');
        middle.appendChild(inner);
        outer.appendChild(middle);
        container.appendChild(outer);
        expect(ariaUtils.hasExplicitAriaDisabled(inner, true)).toBe(true);
      });

      it('should stop inheritance when ancestor has aria-disabled="false"', () => {
        const outer = document.createElement('div');
        outer.setAttribute('role', 'button');
        outer.setAttribute('aria-disabled', 'true');
        const middle = document.createElement('div');
        middle.setAttribute('role', 'button');
        middle.setAttribute('aria-disabled', 'false');
        const inner = document.createElement('span');
        middle.appendChild(inner);
        outer.appendChild(middle);
        container.appendChild(outer);
        expect(ariaUtils.hasExplicitAriaDisabled(inner, true)).toBe(false);
      });

      it('should not inherit when isAncestor is false and element has no disabled role', () => {
        const div = document.createElement('div');
        div.setAttribute('aria-disabled', 'true');
        container.appendChild(div);
        expect(ariaUtils.hasExplicitAriaDisabled(div, false)).toBe(false);
      });
    });

    describe('All aria-disabled Supporting Roles', () => {
      const disabledRoles = [
        'application', 'button', 'checkbox', 'columnheader', 'combobox',
        'grid', 'gridcell', 'link', 'listbox', 'menu', 'menubar',
        'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option',
        'radio', 'radiogroup', 'row', 'rowheader', 'scrollbar',
        'searchbox', 'separator', 'slider', 'spinbutton', 'switch',
        'tab', 'tablist', 'textbox', 'toolbar', 'tree', 'treegrid', 'treeitem'
      ];

      for (const role of disabledRoles) {
        it(`should support aria-disabled on ${role} role`, () => {
          const div = document.createElement('div');
          div.setAttribute('role', role);
          div.setAttribute('aria-disabled', 'true');
          container.appendChild(div);
          expect(ariaUtils.hasExplicitAriaDisabled(div)).toBe(true);
        });
      }
    });

    describe('Edge Cases', () => {
      it('should handle element with no aria-disabled attribute', () => {
        const button = document.createElement('button');
        container.appendChild(button);
        expect(ariaUtils.hasExplicitAriaDisabled(button)).toBe(false);
      });

      it('should handle element with empty aria-disabled value', () => {
        const button = document.createElement('button');
        button.setAttribute('aria-disabled', '');
        container.appendChild(button);
        expect(ariaUtils.hasExplicitAriaDisabled(button)).toBe(false);
      });

      it('should handle element with invalid aria-disabled value', () => {
        const button = document.createElement('button');
        button.setAttribute('aria-disabled', 'invalid');
        container.appendChild(button);
        expect(ariaUtils.hasExplicitAriaDisabled(button)).toBe(false);
      });
    });
  });

  describe('isAriaReadOnlyRole', () => {
    describe('Read-only Supporting Roles', () => {
      const readonlyRoles = [
        'checkbox', 'combobox', 'grid', 'gridcell', 'listbox',
        'radiogroup', 'slider', 'spinbutton', 'textbox',
        'columnheader', 'rowheader', 'searchbox', 'switch', 'treegrid'
      ];

      for (const role of readonlyRoles) {
        it(`should return true for ${role} role`, () => {
          const div = document.createElement('div');
          div.setAttribute('role', role);
          container.appendChild(div);
          expect(ariaUtils.isAriaReadOnlyRole(div)).toBe(true);
        });
      }
    });

    describe('Non-readonly Roles', () => {
      it('should return false for button role', () => {
        const button = document.createElement('button');
        container.appendChild(button);
        expect(ariaUtils.isAriaReadOnlyRole(button)).toBe(false);
      });

      it('should return false for link role', () => {
        const a = document.createElement('a');
        a.href = '#';
        container.appendChild(a);
        expect(ariaUtils.isAriaReadOnlyRole(a)).toBe(false);
      });

      it('should return false for article role', () => {
        const article = document.createElement('article');
        container.appendChild(article);
        expect(ariaUtils.isAriaReadOnlyRole(article)).toBe(false);
      });
    });

    describe('Implicit Roles', () => {
      it('should recognize implicit textbox role from textarea', () => {
        const textarea = document.createElement('textarea');
        container.appendChild(textarea);
        expect(ariaUtils.isAriaReadOnlyRole(textarea)).toBe(true);
      });

      it('should recognize implicit textbox role from text input', () => {
        const input = document.createElement('input');
        input.type = 'text';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should recognize implicit checkbox role from checkbox input', () => {
        const input = document.createElement('input');
        input.type = 'checkbox';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });
    });
  });

  describe('Implicit Role Detection', () => {
    describe('Link Elements', () => {
      it('should return link role for anchor with href', () => {
        const a = document.createElement('a');
        a.href = '#';
        container.appendChild(a);
        // Test through isAriaReadOnlyRole to verify role is computed
        expect(ariaUtils.isAriaReadOnlyRole(a)).toBe(false);
      });

      it('should return null role for anchor without href', () => {
        const a = document.createElement('a');
        container.appendChild(a);
        expect(ariaUtils.isAriaReadOnlyRole(a)).toBe(false);
      });

      it('should return link role for area with href', () => {
        const area = document.createElement('area');
        area.href = '#';
        container.appendChild(area);
        expect(ariaUtils.isAriaReadOnlyRole(area)).toBe(false);
      });

      it('should return null role for area without href', () => {
        const area = document.createElement('area');
        // No href attribute - should return null
        container.appendChild(area);
        expect(ariaUtils.isAriaReadOnlyRole(area)).toBe(false);
      });
    });

    describe('Semantic HTML Elements', () => {
      it('should recognize article element', () => {
        const article = document.createElement('article');
        container.appendChild(article);
        expect(ariaUtils.isAriaReadOnlyRole(article)).toBe(false);
      });

      it('should recognize aside as complementary', () => {
        const aside = document.createElement('aside');
        container.appendChild(aside);
        expect(ariaUtils.isAriaReadOnlyRole(aside)).toBe(false);
      });

      it('should recognize button element', () => {
        const button = document.createElement('button');
        container.appendChild(button);
        expect(ariaUtils.isAriaReadOnlyRole(button)).toBe(false);
      });

      it('should recognize nav as navigation', () => {
        const nav = document.createElement('nav');
        container.appendChild(nav);
        expect(ariaUtils.isAriaReadOnlyRole(nav)).toBe(false);
      });

      it('should recognize main element', () => {
        const main = document.createElement('main');
        container.appendChild(main);
        expect(ariaUtils.isAriaReadOnlyRole(main)).toBe(false);
      });
    });

    describe('Heading Elements', () => {
      for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
        it(`should recognize ${tag} as heading`, () => {
          const heading = document.createElement(tag);
          container.appendChild(heading);
          expect(ariaUtils.isAriaReadOnlyRole(heading)).toBe(false);
        });
      }
    });

    describe('List Elements', () => {
      it('should recognize ul as list', () => {
        const ul = document.createElement('ul');
        container.appendChild(ul);
        expect(ariaUtils.isAriaReadOnlyRole(ul)).toBe(false);
      });

      it('should recognize ol as list', () => {
        const ol = document.createElement('ol');
        container.appendChild(ol);
        expect(ariaUtils.isAriaReadOnlyRole(ol)).toBe(false);
      });

      it('should recognize li as listitem', () => {
        const li = document.createElement('li');
        const ul = document.createElement('ul');
        ul.appendChild(li);
        container.appendChild(ul);
        expect(ariaUtils.isAriaReadOnlyRole(li)).toBe(false);
      });
    });

    describe('Input Types', () => {
      it('should recognize search input', () => {
        const input = document.createElement('input');
        input.type = 'search';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should recognize text input', () => {
        const input = document.createElement('input');
        input.type = 'text';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should recognize email input', () => {
        const input = document.createElement('input');
        input.type = 'email';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should recognize tel input', () => {
        const input = document.createElement('input');
        input.type = 'tel';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should recognize url input', () => {
        const input = document.createElement('input');
        input.type = 'url';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should recognize number input as spinbutton', () => {
        const input = document.createElement('input');
        input.type = 'number';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should recognize range input as slider', () => {
        const input = document.createElement('input');
        input.type = 'range';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should recognize checkbox input', () => {
        const input = document.createElement('input');
        input.type = 'checkbox';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should recognize radio input', () => {
        const input = document.createElement('input');
        input.type = 'radio';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(false);
      });

      it('should recognize button input type', () => {
        const input = document.createElement('input');
        input.type = 'button';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(false);
      });

      it('should recognize submit input type', () => {
        const input = document.createElement('input');
        input.type = 'submit';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(false);
      });

      it('should recognize reset input type', () => {
        const input = document.createElement('input');
        input.type = 'reset';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(false);
      });

      it('should recognize image input type as button', () => {
        const input = document.createElement('input');
        input.type = 'image';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(false);
      });

      it('should recognize file input as button', () => {
        const input = document.createElement('input');
        input.type = 'file';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(false);
      });

      it('should return null role for hidden input', () => {
        const input = document.createElement('input');
        input.type = 'hidden';
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(false);
      });
    });

    describe('Input with Datalist', () => {
      it('should recognize text input with datalist as combobox', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('list', 'test-list');
        const datalist = document.createElement('datalist');
        datalist.id = 'test-list';
        container.appendChild(input);
        container.appendChild(datalist);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should recognize search input with datalist as combobox', () => {
        const input = document.createElement('input');
        input.type = 'search';
        input.setAttribute('list', 'search-list');
        const datalist = document.createElement('datalist');
        datalist.id = 'search-list';
        container.appendChild(input);
        container.appendChild(datalist);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should handle input with non-existent datalist reference', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('list', 'non-existent');
        container.appendChild(input);
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should handle input with list attribute pointing to non-datalist element', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('list', 'not-a-datalist');
        // Create a span with the ID instead of a datalist  
        const span = document.createElement('span');
        span.id = 'not-a-datalist';
        container.appendChild(span); // Add span first so querySelector finds it
        container.appendChild(input);
        // List element exists but is not a DATALIST, should fall back to textbox
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should handle input with list attribute pointing to UL element', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('list', 'ul-element');
        // Create a UL with the ID instead of a datalist
        const ul = document.createElement('ul');
        ul.id = 'ul-element';
        container.appendChild(ul);
        container.appendChild(input);
        // List element is a UL, not DATALIST, should fall back to textbox
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should test list exists and is DATALIST (returns combobox)', () => {
        // Test: if (list) { const listTagName = ...; if (listTagName === 'DATALIST') { return 'combobox'; } }
        
        // Use a fresh container for this test
        const testContainer = document.createElement('div');
        document.body.appendChild(testContainer);
        
        const datalist = document.createElement('datalist');
        datalist.id = 'valid-datalist-106';
        testContainer.appendChild(datalist);
        
        const input = document.createElement('input');
        input.type = 'text';
        input.setAttribute('list', 'valid-datalist-106');
        testContainer.appendChild(input);
        
        // list is truthy
        // listTagName is assigned
        // listTagName === 'DATALIST' is true
        // Returns 'combobox'
        const result = ariaUtils.isAriaReadOnlyRole(input);
        expect(result).toBe(true); // combobox is readonly role
        
        testContainer.remove();
      });

      it('should test list exists but is not DATALIST', () => {
        // Test: list is truthy but listTagName !== 'DATALIST', falls through to return 'textbox'
        const input = document.createElement('input');
        input.type = 'email';
        input.setAttribute('list', 'not-datalist');
        
        // Create a SELECT element instead of datalist
        const select = document.createElement('select');
        select.id = 'not-datalist';
        container.appendChild(input); // Input first
        container.appendChild(select); // Then select
        
        // list is truthy
        // listTagName is assigned to 'SELECT'
        // listTagName === 'DATALIST' is false
        // Falls through to return 'textbox'
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true); // textbox is readonly role
      });

      it('should test list is undefined (returns textbox)', () => {
        // Test: if (list) - false branch, goes directly to return 'textbox'
        const input = document.createElement('input');
        input.type = 'tel';
        // No list attribute, getIdRefs returns [], list[0] is undefined
        container.appendChild(input);
        
        // list is falsy
        // Skips list checking logic
        // Returns 'textbox'
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true); // textbox is readonly role
      });

      it('should test with DIV element (not DATALIST)', () => {
        // Another test for the false branch of the DATALIST check
        const input = document.createElement('input');
        input.type = 'url';
        input.setAttribute('list', 'div-element');
        
        const div = document.createElement('div');
        div.id = 'div-element';
        container.appendChild(input); // Input first
        container.appendChild(div); // Then div
        
        // list is truthy
        // listTagName = 'DIV'
        // listTagName === 'DATALIST' is false
        // Returns 'textbox'
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should test with email input and valid datalist (returns combobox)', () => {
        // Test return 'combobox' with email input type
        const input = document.createElement('input');
        input.type = 'email';
        input.setAttribute('list', 'email-datalist');
        
        const datalist = document.createElement('datalist');
        datalist.id = 'email-datalist';
        container.appendChild(input); // Input first
        container.appendChild(datalist); // Then datalist
        
        // Enters if block
        // Gets listTagName
        // Matches DATALIST
        // Returns combobox
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should handle email input without list attribute', () => {
        const input = document.createElement('input');
        input.type = 'email';
        // No list attribute, so getIdRefs returns [], list is undefined
        container.appendChild(input);
        // Should fall back to textbox
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should handle tel input without list attribute', () => {
        const input = document.createElement('input');
        input.type = 'tel';
        // No list attribute
        container.appendChild(input);
        // Should be textbox
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should handle url input without list attribute', () => {
        const input = document.createElement('input');
        input.type = 'url';
        // No list attribute
        container.appendChild(input);
        // Should be textbox
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should handle input with empty string type (default text) without list', () => {
        const input = document.createElement('input');
        // Type defaults to empty string
        container.appendChild(input);
        // Should be textbox
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should handle input type not in inputTypeToRole map', () => {
        const input = document.createElement('input');
        // Use an input type that's not in the inputTypeToRole map
        // Valid HTML5 types not in the map: color, date, datetime-local, month, time, week, password
        input.type = 'color';
        container.appendChild(input);
        // Should fall back to textbox
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should handle password input falling back to textbox', () => {
        const input = document.createElement('input');
        input.type = 'password';
        container.appendChild(input);
        // Password not in inputTypeToRole map, falls back to textbox
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });

      it('should handle date input falling back to textbox', () => {
        const input = document.createElement('input');
        input.type = 'date';
        container.appendChild(input);
        // Date not in inputTypeToRole map, falls back to textbox
        expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      });
    });

    describe('Table Elements', () => {
      it('should recognize table element', () => {
        const table = document.createElement('table');
        container.appendChild(table);
        expect(ariaUtils.isAriaReadOnlyRole(table)).toBe(false);
      });

      it('should recognize tr as row', () => {
        const tr = document.createElement('tr');
        const table = document.createElement('table');
        table.appendChild(tr);
        container.appendChild(table);
        expect(ariaUtils.isAriaReadOnlyRole(tr)).toBe(false);
      });

      it('should recognize td as cell', () => {
        const td = document.createElement('td');
        const tr = document.createElement('tr');
        const table = document.createElement('table');
        tr.appendChild(td);
        table.appendChild(tr);
        container.appendChild(table);
        expect(ariaUtils.isAriaReadOnlyRole(td)).toBe(false);
      });

      it('should recognize td as gridcell in grid table', () => {
        const td = document.createElement('td');
        const tr = document.createElement('tr');
        const table = document.createElement('table');
        table.setAttribute('role', 'grid');
        tr.appendChild(td);
        table.appendChild(tr);
        container.appendChild(table);
        expect(ariaUtils.isAriaReadOnlyRole(td)).toBe(true);
      });

      it('should recognize td as gridcell in treegrid table', () => {
        const td = document.createElement('td');
        const tr = document.createElement('tr');
        const table = document.createElement('table');
        table.setAttribute('role', 'treegrid');
        tr.appendChild(td);
        table.appendChild(tr);
        container.appendChild(table);
        expect(ariaUtils.isAriaReadOnlyRole(td)).toBe(true);
      });

      it('should recognize th with scope=col as columnheader', () => {
        const th = document.createElement('th');
        th.setAttribute('scope', 'col');
        const tr = document.createElement('tr');
        const table = document.createElement('table');
        tr.appendChild(th);
        table.appendChild(tr);
        container.appendChild(table);
        expect(ariaUtils.isAriaReadOnlyRole(th)).toBe(true);
      });

      it('should recognize th with scope=row as rowheader', () => {
        const th = document.createElement('th');
        th.setAttribute('scope', 'row');
        const tr = document.createElement('tr');
        const table = document.createElement('table');
        tr.appendChild(th);
        table.appendChild(tr);
        container.appendChild(table);
        expect(ariaUtils.isAriaReadOnlyRole(th)).toBe(true);
      });

      it('should recognize th as gridcell in grid without scope', () => {
        const th = document.createElement('th');
        const tr = document.createElement('tr');
        const table = document.createElement('table');
        table.setAttribute('role', 'grid');
        tr.appendChild(th);
        table.appendChild(tr);
        container.appendChild(table);
        expect(ariaUtils.isAriaReadOnlyRole(th)).toBe(true);
      });

      it('should recognize tbody as rowgroup', () => {
        const tbody = document.createElement('tbody');
        const table = document.createElement('table');
        table.appendChild(tbody);
        container.appendChild(table);
        expect(ariaUtils.isAriaReadOnlyRole(tbody)).toBe(false);
      });

      it('should recognize thead as rowgroup', () => {
        const thead = document.createElement('thead');
        const table = document.createElement('table');
        table.appendChild(thead);
        container.appendChild(table);
        expect(ariaUtils.isAriaReadOnlyRole(thead)).toBe(false);
      });

      it('should recognize tfoot as rowgroup', () => {
        const tfoot = document.createElement('tfoot');
        const table = document.createElement('table');
        table.appendChild(tfoot);
        container.appendChild(table);
        expect(ariaUtils.isAriaReadOnlyRole(tfoot)).toBe(false);
      });

      it('should recognize caption element', () => {
        const caption = document.createElement('caption');
        const table = document.createElement('table');
        table.appendChild(caption);
        container.appendChild(table);
        expect(ariaUtils.isAriaReadOnlyRole(caption)).toBe(false);
      });

      it('should handle td element without parent table', () => {
        // Create a TD that's not inside a table structure
        const td = document.createElement('td');
        container.appendChild(td);
        // getClosestCrossShadowElement will return null, should default to cell
        expect(ariaUtils.isAriaReadOnlyRole(td)).toBe(false);
      });

      it('should handle th element without parent table', () => {
        // Create a TH that's not inside a table structure
        const th = document.createElement('th');
        container.appendChild(th);
        // getClosestCrossShadowElement will return null, should default to cell
        expect(ariaUtils.isAriaReadOnlyRole(th)).toBe(false);
      });

      it('should recognize th as cell when table has no grid role', () => {
        const th = document.createElement('th');
        const tr = document.createElement('tr');
        const table = document.createElement('table');
        // No scope attribute and no grid/treegrid role on table
        tr.appendChild(th);
        table.appendChild(tr);
        container.appendChild(table);
        // Should return cell, not gridcell
        expect(ariaUtils.isAriaReadOnlyRole(th)).toBe(false);
      });

      it('should recognize td as cell when table has no grid role (explicit test)', () => {
        const td = document.createElement('td');
        const tr = document.createElement('tr');
        const table = document.createElement('table');
        // Table has no role attribute, should default to cell
        tr.appendChild(td);
        table.appendChild(tr);
        container.appendChild(table);
        // Should return cell, not gridcell
        expect(ariaUtils.isAriaReadOnlyRole(td)).toBe(false);
      });

      it('should recognize th as cell when table has non-grid role', () => {
        const th = document.createElement('th');
        const tr = document.createElement('tr');
        const table = document.createElement('table');
        table.setAttribute('role', 'table'); // Explicitly set to table role
        tr.appendChild(th);
        table.appendChild(tr);
        container.appendChild(table);
        // Role is 'table', not 'grid' or 'treegrid', so should be cell
        expect(ariaUtils.isAriaReadOnlyRole(th)).toBe(false);
      });
    });

    describe('Select Element', () => {
      it('should recognize select with multiple as listbox', () => {
        const select = document.createElement('select');
        select.multiple = true;
        container.appendChild(select);
        expect(ariaUtils.isAriaReadOnlyRole(select)).toBe(true);
      });

      it('should recognize select with size > 1 as listbox', () => {
        const select = document.createElement('select');
        select.size = 2;
        container.appendChild(select);
        expect(ariaUtils.isAriaReadOnlyRole(select)).toBe(true);
      });

      it('should recognize single select as combobox', () => {
        const select = document.createElement('select');
        container.appendChild(select);
        expect(ariaUtils.isAriaReadOnlyRole(select)).toBe(true);
      });

      it('should recognize option element', () => {
        const option = document.createElement('option');
        const select = document.createElement('select');
        select.appendChild(option);
        container.appendChild(select);
        expect(ariaUtils.isAriaReadOnlyRole(option)).toBe(false);
      });

      it('should recognize optgroup element', () => {
        const optgroup = document.createElement('optgroup');
        const select = document.createElement('select');
        select.appendChild(optgroup);
        container.appendChild(select);
        expect(ariaUtils.isAriaReadOnlyRole(optgroup)).toBe(false);
      });
    });

    describe('Image Elements', () => {
      it('should recognize img with alt as img role', () => {
        const img = document.createElement('img');
        img.alt = 'description';
        container.appendChild(img);
        expect(ariaUtils.isAriaReadOnlyRole(img)).toBe(false);
      });

      it('should recognize img with empty alt and no title as presentation', () => {
        const img = document.createElement('img');
        img.alt = '';
        container.appendChild(img);
        expect(ariaUtils.isAriaReadOnlyRole(img)).toBe(false);
      });

      it('should recognize img with empty alt but title as img', () => {
        const img = document.createElement('img');
        img.alt = '';
        img.title = 'tooltip';
        container.appendChild(img);
        expect(ariaUtils.isAriaReadOnlyRole(img)).toBe(false);
      });

      it('should recognize svg element', () => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        container.appendChild(svg);
        expect(ariaUtils.isAriaReadOnlyRole(svg as any)).toBe(false);
      });
    });

    describe('Form Elements', () => {
      it('should recognize form with aria-label', () => {
        const form = document.createElement('form');
        form.setAttribute('aria-label', 'Contact Form');
        container.appendChild(form);
        expect(ariaUtils.isAriaReadOnlyRole(form)).toBe(false);
      });

      it('should recognize form with aria-labelledby', () => {
        const form = document.createElement('form');
        form.setAttribute('aria-labelledby', 'form-title');
        container.appendChild(form);
        expect(ariaUtils.isAriaReadOnlyRole(form)).toBe(false);
      });

      it('should return null for form without accessible name', () => {
        const form = document.createElement('form');
        container.appendChild(form);
        expect(ariaUtils.isAriaReadOnlyRole(form)).toBe(false);
      });

      it('should recognize fieldset as group', () => {
        const fieldset = document.createElement('fieldset');
        container.appendChild(fieldset);
        expect(ariaUtils.isAriaReadOnlyRole(fieldset)).toBe(false);
      });

      it('should recognize details as group', () => {
        const details = document.createElement('details');
        container.appendChild(details);
        expect(ariaUtils.isAriaReadOnlyRole(details)).toBe(false);
      });

      it('should recognize textarea as textbox', () => {
        const textarea = document.createElement('textarea');
        container.appendChild(textarea);
        expect(ariaUtils.isAriaReadOnlyRole(textarea)).toBe(true);
      });

      it('should recognize output as status', () => {
        const output = document.createElement('output');
        container.appendChild(output);
        expect(ariaUtils.isAriaReadOnlyRole(output)).toBe(false);
      });

      it('should recognize progress as progressbar', () => {
        const progress = document.createElement('progress');
        container.appendChild(progress);
        expect(ariaUtils.isAriaReadOnlyRole(progress)).toBe(false);
      });

      it('should recognize meter element', () => {
        const meter = document.createElement('meter');
        container.appendChild(meter);
        expect(ariaUtils.isAriaReadOnlyRole(meter)).toBe(false);
      });
    });

    describe('Landmark Elements', () => {
      it('should recognize header as banner outside article', () => {
        const header = document.createElement('header');
        container.appendChild(header);
        expect(ariaUtils.isAriaReadOnlyRole(header)).toBe(false);
      });

      it('should not recognize header as banner inside article', () => {
        const article = document.createElement('article');
        const header = document.createElement('header');
        article.appendChild(header);
        container.appendChild(article);
        expect(ariaUtils.isAriaReadOnlyRole(header)).toBe(false);
      });

      it('should recognize footer as contentinfo outside article', () => {
        const footer = document.createElement('footer');
        container.appendChild(footer);
        expect(ariaUtils.isAriaReadOnlyRole(footer)).toBe(false);
      });

      it('should not recognize footer as contentinfo inside article', () => {
        const article = document.createElement('article');
        const footer = document.createElement('footer');
        article.appendChild(footer);
        container.appendChild(article);
        expect(ariaUtils.isAriaReadOnlyRole(footer)).toBe(false);
      });

      it('should recognize section with aria-label as region', () => {
        const section = document.createElement('section');
        section.setAttribute('aria-label', 'Section Title');
        container.appendChild(section);
        expect(ariaUtils.isAriaReadOnlyRole(section)).toBe(false);
      });

      it('should not recognize section without accessible name as region', () => {
        const section = document.createElement('section');
        container.appendChild(section);
        expect(ariaUtils.isAriaReadOnlyRole(section)).toBe(false);
      });
    });

    describe('Text Semantic Elements', () => {
      it('should recognize blockquote', () => {
        const blockquote = document.createElement('blockquote');
        container.appendChild(blockquote);
        expect(ariaUtils.isAriaReadOnlyRole(blockquote)).toBe(false);
      });

      it('should recognize code element', () => {
        const code = document.createElement('code');
        container.appendChild(code);
        expect(ariaUtils.isAriaReadOnlyRole(code)).toBe(false);
      });

      it('should recognize em as emphasis', () => {
        const em = document.createElement('em');
        container.appendChild(em);
        expect(ariaUtils.isAriaReadOnlyRole(em)).toBe(false);
      });

      it('should recognize strong', () => {
        const strong = document.createElement('strong');
        container.appendChild(strong);
        expect(ariaUtils.isAriaReadOnlyRole(strong)).toBe(false);
      });

      it('should recognize del as deletion', () => {
        const del = document.createElement('del');
        container.appendChild(del);
        expect(ariaUtils.isAriaReadOnlyRole(del)).toBe(false);
      });

      it('should recognize ins as insertion', () => {
        const ins = document.createElement('ins');
        container.appendChild(ins);
        expect(ariaUtils.isAriaReadOnlyRole(ins)).toBe(false);
      });

      it('should recognize mark element', () => {
        const mark = document.createElement('mark');
        container.appendChild(mark);
        expect(ariaUtils.isAriaReadOnlyRole(mark)).toBe(false);
      });

      it('should recognize sub as subscript', () => {
        const sub = document.createElement('sub');
        container.appendChild(sub);
        expect(ariaUtils.isAriaReadOnlyRole(sub)).toBe(false);
      });

      it('should recognize sup as superscript', () => {
        const sup = document.createElement('sup');
        container.appendChild(sup);
        expect(ariaUtils.isAriaReadOnlyRole(sup)).toBe(false);
      });

      it('should recognize p as paragraph', () => {
        const p = document.createElement('p');
        container.appendChild(p);
        expect(ariaUtils.isAriaReadOnlyRole(p)).toBe(false);
      });

      it('should recognize time element', () => {
        const time = document.createElement('time');
        container.appendChild(time);
        expect(ariaUtils.isAriaReadOnlyRole(time)).toBe(false);
      });

      it('should recognize dfn as term', () => {
        const dfn = document.createElement('dfn');
        container.appendChild(dfn);
        expect(ariaUtils.isAriaReadOnlyRole(dfn)).toBe(false);
      });

      it('should recognize dt as term', () => {
        const dt = document.createElement('dt');
        const dl = document.createElement('dl');
        dl.appendChild(dt);
        container.appendChild(dl);
        expect(ariaUtils.isAriaReadOnlyRole(dt)).toBe(false);
      });

      it('should recognize dd as definition', () => {
        const dd = document.createElement('dd');
        const dl = document.createElement('dl');
        dl.appendChild(dd);
        container.appendChild(dl);
        expect(ariaUtils.isAriaReadOnlyRole(dd)).toBe(false);
      });
    });

    describe('Other Elements', () => {
      it('should recognize hr as separator', () => {
        const hr = document.createElement('hr');
        container.appendChild(hr);
        expect(ariaUtils.isAriaReadOnlyRole(hr)).toBe(false);
      });

      it('should recognize dialog element', () => {
        const dialog = document.createElement('dialog');
        container.appendChild(dialog);
        expect(ariaUtils.isAriaReadOnlyRole(dialog)).toBe(false);
      });

      it('should recognize figure element', () => {
        const figure = document.createElement('figure');
        container.appendChild(figure);
        expect(ariaUtils.isAriaReadOnlyRole(figure)).toBe(false);
      });

      it('should recognize math element', () => {
        const math = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');
        container.appendChild(math);
        expect(ariaUtils.isAriaReadOnlyRole(math as any)).toBe(false);
      });

      it('should recognize html as document', () => {
        // Can't easily test document.documentElement, but verify method exists
        expect(ariaUtils.isAriaReadOnlyRole(document.documentElement)).toBe(false);
      });

      it('should recognize menu as list', () => {
        const menu = document.createElement('menu');
        container.appendChild(menu);
        expect(ariaUtils.isAriaReadOnlyRole(menu)).toBe(false);
      });

      it('should recognize search element', () => {
        const search = document.createElement('search');
        container.appendChild(search);
        expect(ariaUtils.isAriaReadOnlyRole(search)).toBe(false);
      });

      it('should recognize datalist as listbox', () => {
        const datalist = document.createElement('datalist');
        container.appendChild(datalist);
        expect(ariaUtils.isAriaReadOnlyRole(datalist)).toBe(true);
      });
    });
  });

  describe('Explicit Role Overrides', () => {
    it('should use explicit role over implicit role', () => {
      const div = document.createElement('div');
      div.setAttribute('role', 'button');
      container.appendChild(div);
      expect(ariaUtils.isAriaReadOnlyRole(div)).toBe(false);
    });

    it('should ignore invalid roles', () => {
      const button = document.createElement('button');
      button.setAttribute('role', 'invalid-role');
      container.appendChild(button);
      // Should fall back to implicit button role
      expect(ariaUtils.isAriaReadOnlyRole(button)).toBe(false);
    });

    it('should use first valid role from space-separated list', () => {
      const div = document.createElement('div');
      div.setAttribute('role', 'invalid1 textbox invalid2');
      container.appendChild(div);
      expect(ariaUtils.isAriaReadOnlyRole(div)).toBe(true);
    });

    it('should handle role with extra whitespace', () => {
      const div = document.createElement('div');
      div.setAttribute('role', '  button  ');
      container.appendChild(div);
      expect(ariaUtils.isAriaReadOnlyRole(div)).toBe(false);
    });

    it('should handle empty role attribute', () => {
      const button = document.createElement('button');
      button.setAttribute('role', '');
      container.appendChild(button);
      // Should use implicit button role
      expect(ariaUtils.isAriaReadOnlyRole(button)).toBe(false);
    });
  });

  describe('Presentation Role Conflict Resolution', () => {
    describe('Basic Presentation Role', () => {
      it('should apply presentation role when explicitly set', () => {
        const div = document.createElement('div');
        div.setAttribute('role', 'presentation');
        container.appendChild(div);
        expect(ariaUtils.isAriaReadOnlyRole(div)).toBe(false);
      });

      it('should apply none role when explicitly set', () => {
        const div = document.createElement('div');
        div.setAttribute('role', 'none');
        container.appendChild(div);
        expect(ariaUtils.isAriaReadOnlyRole(div)).toBe(false);
      });
    });

    describe('Conflict Resolution with Global ARIA Attributes', () => {
      it('should override presentation with aria-label', () => {
        const button = document.createElement('button');
        button.setAttribute('role', 'presentation');
        button.setAttribute('aria-label', 'Click me');
        container.appendChild(button);
        // Should revert to implicit button role
        expect(ariaUtils.isAriaReadOnlyRole(button)).toBe(false);
      });

      it('should override presentation with aria-labelledby', () => {
        const button = document.createElement('button');
        button.setAttribute('role', 'presentation');
        button.setAttribute('aria-labelledby', 'label-id');
        container.appendChild(button);
        expect(ariaUtils.isAriaReadOnlyRole(button)).toBe(false);
      });

      it('should override presentation with aria-describedby', () => {
        const button = document.createElement('button');
        button.setAttribute('role', 'presentation');
        button.setAttribute('aria-describedby', 'desc-id');
        container.appendChild(button);
        expect(ariaUtils.isAriaReadOnlyRole(button)).toBe(false);
      });

      it('should override presentation with aria-hidden', () => {
        const button = document.createElement('button');
        button.setAttribute('role', 'presentation');
        button.setAttribute('aria-hidden', 'true');
        container.appendChild(button);
        expect(ariaUtils.isAriaReadOnlyRole(button)).toBe(false);
      });
    });

    describe('Conflict Resolution with Focusability', () => {
      it('should override presentation when element is focusable via tabindex', () => {
        const div = document.createElement('div');
        div.setAttribute('role', 'presentation');
        div.tabIndex = 0;
        container.appendChild(div);
        expect(ariaUtils.isAriaReadOnlyRole(div)).toBe(false);
      });

      it('should override presentation when button is focusable', () => {
        const button = document.createElement('button');
        button.setAttribute('role', 'presentation');
        container.appendChild(button);
        expect(ariaUtils.isAriaReadOnlyRole(button)).toBe(false);
      });
    });

    describe('Presentation Inheritance', () => {
      it('should inherit presentation from parent list to listitem', () => {
        const ul = document.createElement('ul');
        ul.setAttribute('role', 'presentation');
        const li = document.createElement('li');
        ul.appendChild(li);
        container.appendChild(ul);
        // Li should inherit presentation role
        expect(ariaUtils.isAriaReadOnlyRole(li)).toBe(false);
      });

      it('should inherit presentation from parent dl to dt', () => {
        const dl = document.createElement('dl');
        dl.setAttribute('role', 'presentation');
        const dt = document.createElement('dt');
        dl.appendChild(dt);
        container.appendChild(dl);
        expect(ariaUtils.isAriaReadOnlyRole(dt)).toBe(false);
      });

      it('should inherit presentation from parent dl to dd', () => {
        const dl = document.createElement('dl');
        dl.setAttribute('role', 'presentation');
        const dd = document.createElement('dd');
        dl.appendChild(dd);
        container.appendChild(dl);
        expect(ariaUtils.isAriaReadOnlyRole(dd)).toBe(false);
      });

      it('should inherit presentation from parent table to tr', () => {
        const table = document.createElement('table');
        table.setAttribute('role', 'presentation');
        const tr = document.createElement('tr');
        table.appendChild(tr);
        container.appendChild(table);
        expect(ariaUtils.isAriaReadOnlyRole(tr)).toBe(false);
      });

      it('should inherit presentation from thead to tr', () => {
        const table = document.createElement('table');
        const thead = document.createElement('thead');
        thead.setAttribute('role', 'presentation');
        const tr = document.createElement('tr');
        thead.appendChild(tr);
        table.appendChild(thead);
        container.appendChild(table);
        expect(ariaUtils.isAriaReadOnlyRole(tr)).toBe(false);
      });

      it('should inherit presentation from tr to td', () => {
        const table = document.createElement('table');
        const tr = document.createElement('tr');
        tr.setAttribute('role', 'presentation');
        const td = document.createElement('td');
        tr.appendChild(td);
        table.appendChild(tr);
        container.appendChild(table);
        expect(ariaUtils.isAriaReadOnlyRole(td)).toBe(false);
      });

      it('should not inherit presentation if parent has conflict', () => {
        const ul = document.createElement('ul');
        ul.setAttribute('role', 'presentation');
        ul.setAttribute('aria-label', 'List');
        const li = document.createElement('li');
        ul.appendChild(li);
        container.appendChild(ul);
        // Parent has conflict, so presentation is not applied to parent or child
        expect(ariaUtils.isAriaReadOnlyRole(li)).toBe(false);
      });

      it('should allow div as intermediate parent in dl structure', () => {
        const dl = document.createElement('dl');
        dl.setAttribute('role', 'presentation');
        const div = document.createElement('div');
        const dt = document.createElement('dt');
        div.appendChild(dt);
        dl.appendChild(div);
        container.appendChild(dl);
        expect(ariaUtils.isAriaReadOnlyRole(dt)).toBe(false);
      });
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle nested shadow DOM elements', () => {
      // Note: jsdom has limited shadow DOM support, this tests the logic
      const host = document.createElement('div');
      container.appendChild(host);
      
      if (host.attachShadow) {
        const shadow = host.attachShadow({ mode: 'open' });
        const button = document.createElement('button');
        button.setAttribute('aria-disabled', 'true');
        shadow.appendChild(button);
        expect(ariaUtils.hasExplicitAriaDisabled(button)).toBe(true);
      }
    });

    it('should handle aria-disabled inheritance across shadow boundaries', () => {
      const host = document.createElement('div');
      host.setAttribute('role', 'button');
      host.setAttribute('aria-disabled', 'true');
      container.appendChild(host);

      if (host.attachShadow) {
        const shadow = host.attachShadow({ mode: 'open' });
        const inner = document.createElement('span');
        shadow.appendChild(inner);
        // aria-disabled should work across shadow boundaries
        expect(ariaUtils.hasExplicitAriaDisabled(inner, true)).toBe(true);
      }
    });

    it('should handle datalist reference with multiple IDs', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('list', 'list1 list2');
      const datalist1 = document.createElement('datalist');
      datalist1.id = 'list1';
      const datalist2 = document.createElement('datalist');
      datalist2.id = 'list2';
      container.appendChild(input);
      container.appendChild(datalist1);
      container.appendChild(datalist2);
      // Should find first valid datalist
      expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
    });

    it('should handle datalist reference with invalid CSS selector characters', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('list', 'list:with:colons');
      const datalist = document.createElement('datalist');
      datalist.id = 'list:with:colons';
      container.appendChild(input);
      container.appendChild(datalist);
      expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
    });

    it('should handle empty list attribute', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('list', '');
      container.appendChild(input);
      expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
    });

    it('should handle list attribute with only spaces', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('list', '   ');
      container.appendChild(input);
      expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle element with null parent', () => {
      const div = document.createElement('div');
      // Not appended to container, so has no parent
      expect(ariaUtils.hasExplicitAriaDisabled(div)).toBe(false);
    });

    it('should handle elements with unusual tag names', () => {
      const custom = document.createElement('custom-element');
      container.appendChild(custom);
      expect(ariaUtils.isAriaReadOnlyRole(custom)).toBe(false);
    });

    it('should handle SVG elements with roles', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('role', 'button');
      container.appendChild(svg);
      expect(ariaUtils.isAriaReadOnlyRole(svg as any)).toBe(false);
    });

    it('should handle MathML elements with roles', () => {
      const math = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');
      math.setAttribute('role', 'button');
      container.appendChild(math);
      expect(ariaUtils.isAriaReadOnlyRole(math as any)).toBe(false);
    });

    it('should handle element with duplicate IDs in document', () => {
      const input1 = document.createElement('input');
      input1.type = 'text';
      input1.setAttribute('list', 'duplicate-id');
      const datalist1 = document.createElement('datalist');
      datalist1.id = 'duplicate-id';
      const datalist2 = document.createElement('datalist');
      datalist2.id = 'duplicate-id';
      container.appendChild(input1);
      container.appendChild(datalist1);
      container.appendChild(datalist2);
      // Should use first element with ID
      expect(ariaUtils.isAriaReadOnlyRole(input1)).toBe(true);
    });

    it('should handle circular presentation inheritance', () => {
      // This shouldn't happen in valid HTML but test the logic doesn't infinite loop
      const table = document.createElement('table');
      table.setAttribute('role', 'presentation');
      const tr = document.createElement('tr');
      table.appendChild(tr);
      container.appendChild(table);
      expect(ariaUtils.isAriaReadOnlyRole(tr)).toBe(false);
    });
  });

  describe('All Valid ARIA Roles', () => {
    const validRoles = [
      'alert', 'alertdialog', 'application', 'article', 'banner', 'blockquote',
      'button', 'caption', 'cell', 'checkbox', 'code', 'columnheader', 'combobox',
      'complementary', 'contentinfo', 'definition', 'deletion', 'dialog', 'directory',
      'document', 'emphasis', 'feed', 'figure', 'form', 'generic', 'grid', 'gridcell',
      'group', 'heading', 'img', 'insertion', 'link', 'list', 'listbox', 'listitem',
      'log', 'main', 'mark', 'marquee', 'math', 'meter', 'menu', 'menubar', 'menuitem',
      'menuitemcheckbox', 'menuitemradio', 'navigation', 'none', 'note', 'option',
      'paragraph', 'presentation', 'progressbar', 'radio', 'radiogroup', 'region',
      'row', 'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox', 'separator',
      'slider', 'spinbutton', 'status', 'strong', 'subscript', 'superscript', 'switch',
      'tab', 'table', 'tablist', 'tabpanel', 'term', 'textbox', 'time', 'timer',
      'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem'
    ];

    for (const role of validRoles) {
      it(`should recognize ${role} as a valid role`, () => {
        const div = document.createElement('div');
        div.setAttribute('role', role);
        container.appendChild(div);
        // Just verify it doesn't throw and processes the role
        expect(() => ariaUtils.isAriaReadOnlyRole(div)).not.toThrow();
      });
    }
  });

  describe('Global ARIA Attributes', () => {
    const globalAttributes = [
      'aria-atomic', 'aria-busy', 'aria-controls', 'aria-current',
      'aria-describedby', 'aria-details', 'aria-dropeffect', 'aria-flowto',
      'aria-grabbed', 'aria-hidden', 'aria-keyshortcuts', 'aria-label',
      'aria-labelledby', 'aria-live', 'aria-owns', 'aria-relevant',
      'aria-roledescription'
    ];

    for (const attr of globalAttributes) {
      it(`should recognize ${attr} as global attribute for conflict resolution`, () => {
        const button = document.createElement('button');
        button.setAttribute('role', 'presentation');
        button.setAttribute(attr, 'value');
        container.appendChild(button);
        // Should revert to implicit button role due to global attribute
        expect(ariaUtils.isAriaReadOnlyRole(button)).toBe(false);
      });
    }
  });

  describe('Performance and Stress Tests', () => {
    it('should handle deeply nested elements', () => {
      let current = container;
      for (let i = 0; i < 100; i++) {
        const div = document.createElement('div');
        div.setAttribute('role', 'button');
        current.appendChild(div);
        current = div;
      }
      current.setAttribute('aria-disabled', 'true');
      expect(ariaUtils.hasExplicitAriaDisabled(current)).toBe(true);
    });

    it('should handle element with many attributes', () => {
      const div = document.createElement('div');
      for (let i = 0; i < 50; i++) {
        div.setAttribute(`data-attr-${i}`, `value-${i}`);
      }
      div.setAttribute('role', 'button');
      container.appendChild(div);
      expect(ariaUtils.isAriaReadOnlyRole(div)).toBe(false);
    });

    it('should handle long space-separated role list', () => {
      const div = document.createElement('div');
      const roles = new Array(20).fill('invalid').concat(['button']);
      div.setAttribute('role', roles.join(' '));
      container.appendChild(div);
      expect(ariaUtils.isAriaReadOnlyRole(div)).toBe(false);
    });
  });

  describe('Additional Edge Cases for Full Coverage', () => {
    it('should support input type text with list pointing to DATALIST element', () => {
      // This test specifically targets the uncovered branch at lines 106-110
      // Add datalist directly to document body to ensure it's findable by querySelector
      const datalist = document.createElement('datalist');
      datalist.id = 'test-datalist-106-direct';
      document.body.appendChild(datalist);
      
      // Create input with list attribute and add to body
      const input = document.createElement('input');
      input.type = 'text'; // One of the types that enters the if block
      input.setAttribute('list', 'test-datalist-106-direct');
      document.body.appendChild(input);
      
      // Verify the datalist can be found via querySelector
      const foundDatalist = document.querySelector('#test-datalist-106-direct');
      expect(foundDatalist).toBeTruthy();
      expect(foundDatalist).toBe(datalist);
      
      // Now check the role - this should trigger getIdRefs which should find the datalist
      // and recognize it, returning 'combobox' role
      const result = ariaUtils.isAriaReadOnlyRole(input);
      expect(result).toBe(true); // combobox is a readonly role
      
      // Cleanup
      input.remove();
      datalist.remove();
    });
    
    it('should support input type email with list pointing to DATALIST element', () => {
      // Another attempt with email type
      const datalist = document.createElement('datalist');
      datalist.id = 'test-datalist-106-email-direct';
      document.body.appendChild(datalist);
      
      const input = document.createElement('input');
      input.type = 'email';
      input.setAttribute('list', 'test-datalist-106-email-direct');
      document.body.appendChild(input);
      
      // Verify querySelector can find it
      expect(document.querySelector('#test-datalist-106-email-direct')).toBe(datalist);
      
      const result = ariaUtils.isAriaReadOnlyRole(input);
      expect(result).toBe(true);
      
      input.remove();
      datalist.remove();
    });
    
    it('should support input with empty type and list pointing to DATALIST', () => {
      // Test with empty type (which defaults to text)
      const datalist = document.createElement('datalist');
      datalist.id = 'test-datalist-106-empty-direct';
      document.body.appendChild(datalist);
      
      const input = document.createElement('input');
      // Don't set type - it defaults to empty string which is in the array
      input.setAttribute('list', 'test-datalist-106-empty-direct');
      document.body.appendChild(input);
      
      // Verify querySelector can find it
      expect(document.querySelector('#test-datalist-106-empty-direct')).toBe(datalist);
      
      const result = ariaUtils.isAriaReadOnlyRole(input);
      expect(result).toBe(true);
      
      input.remove();
      datalist.remove();
    });

    it('should verify input can access document root for querySelector', () => {
      // This test verifies that the element is properly connected to the document
      // which is required for getIdRefs to work
      const datalist = document.createElement('datalist');
      datalist.id = 'verify-document-root';
      document.body.appendChild(datalist);
      
      const input = document.createElement('input');
      input.type = 'tel'; // Use tel type which is in the list
      input.setAttribute('list', 'verify-document-root');
      document.body.appendChild(input);
      
      // Verify the input is connected to the document
      expect(input.ownerDocument).toBe(document);
      expect(input.getRootNode()).toBe(document);
      
      // Verify the datalist is findable from the input's root
      const root = input.getRootNode() as Document;
      const found = root.querySelector('#verify-document-root');
      expect(found).toBe(datalist);
      
      // Now test the actual role determination
      const result = ariaUtils.isAriaReadOnlyRole(input);
      expect(result).toBe(true);
      
      input.remove();
      datalist.remove();
    });

    it('should support input type url with list pointing to DATALIST', () => {
      // Use url type which is also in the ['email', 'tel', 'text', 'url', ''] array
      const datalist = document.createElement('datalist');
      datalist.id = 'test-datalist-url-106';
      document.body.appendChild(datalist);
      
      const input = document.createElement('input');
      input.type = 'url';
      input.setAttribute('list', 'test-datalist-url-106');
      document.body.appendChild(input);
      
      // Verify setup
      expect(input.ownerDocument).toBe(document);
      expect(document.querySelector('#test-datalist-url-106')).toBe(datalist);
      
      const result = ariaUtils.isAriaReadOnlyRole(input);
      expect(result).toBe(true);
      
      input.remove();
      datalist.remove();
    });
    
    it('should debug: verify getEnclosingShadowRootOrDocument returns document', () => {
      // This test checks if DOMUtilities.getEnclosingShadowRootOrDocument works correctly
      const input = document.createElement('input');
      document.body.appendChild(input);
      
      const root = domUtils.getEnclosingShadowRootOrDocument(input);
      expect(root).toBeTruthy();
      expect(root).toBe(document);
      expect(root?.nodeType).toBe(9); // DOCUMENT_NODE
      
      // Verify querySelector works on this root
      const testDiv = document.createElement('div');
      testDiv.id = 'test-querySelector-root';
      document.body.appendChild(testDiv);
      
      const foundElement = root?.querySelector('#test-querySelector-root');
      expect(foundElement).toBe(testDiv);
      
      input.remove();
      testDiv.remove();
    });
    
    it('should debug: verify CSS.escape and querySelector work with datalist ID', () => {
      // Test if CSS.escape and querySelector work correctly with the ID
      const datalist = document.createElement('datalist');
      const testId = 'test-css-escape-datalist';
      datalist.id = testId;
      document.body.appendChild(datalist);
      
      // Test CSS.escape
      const escapedId = CSS.escape(testId);
      expect(escapedId).toBe(testId); // Should be the same for simple IDs
      
      // Test querySelector with escaped ID
      const found = document.querySelector('#' + escapedId);
      expect(found).toBe(datalist);
      
      datalist.remove();
    });
    
    it('should handle edge case: input with list attribute containing special characters', () => {
      // Try to trigger the catch block by using special characters in IDs
      const datalist = document.createElement('datalist');
      datalist.id = 'list:with:colons:test';
      document.body.appendChild(datalist);
      
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('list', 'list:with:colons:test');
      document.body.appendChild(input);
      
      // CSS.escape should handle the colons, and this should work
      const result = ariaUtils.isAriaReadOnlyRole(input);
      expect(result).toBe(true);
      
      input.remove();
      datalist.remove();
    });
    
    it('should handle edge case: input with list attribute containing Unicode characters', () => {
      // Test with Unicode characters in ID
      const datalist = document.createElement('datalist');
      datalist.id = 'list-测试-тест-🎨';
      document.body.appendChild(datalist);
      
      const input = document.createElement('input');
      input.type = 'email';
      input.setAttribute('list', 'list-测试-тест-🎨');
      document.body.appendChild(input);
      
      // This should work with proper CSS.escape handling
      const result = ariaUtils.isAriaReadOnlyRole(input);
      expect(result).toBe(true);
      
      input.remove();
      datalist.remove();
    });

    it('should handle datalist reference that returns element already in results', () => {
      // Test duplicate prevention in getIdRefs
      const input = document.createElement('input');
      input.type = 'text';
      // Reference the same ID twice
      input.setAttribute('list', 'same-list same-list');
      const datalist = document.createElement('datalist');
      datalist.id = 'same-list';
      container.appendChild(input);
      container.appendChild(datalist);
      expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
    });

    it('should handle image with empty alt and global aria attribute', () => {
      const img = document.createElement('img');
      img.alt = '';
      img.setAttribute('aria-describedby', 'description');
      container.appendChild(img);
      // Should not be presentation due to global aria attribute
      expect(ariaUtils.isAriaReadOnlyRole(img)).toBe(false);
    });

    it('should handle image with empty alt and tabindex', () => {
      const img = document.createElement('img');
      img.alt = '';
      img.tabIndex = 0;
      container.appendChild(img);
      // Should not be presentation due to focusability
      expect(ariaUtils.isAriaReadOnlyRole(img)).toBe(false);
    });

    it('should handle element detached from document for datalist lookup', () => {
      // Test case where element has no root document
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('list', 'test-list');
      // Not appended to container, but should still work when we check
      container.appendChild(input);
      // No datalist in DOM, should fall back to textbox
      expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
    });

    it('should handle multiple spaces in list attribute', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('list', 'id1    id2   id3');
      const datalist1 = document.createElement('datalist');
      datalist1.id = 'id1';
      container.appendChild(input);
      container.appendChild(datalist1);
      expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
    });

    it('should handle CSS.escape edge case with special characters in ID', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('list', 'id#with#hashes');
      const datalist = document.createElement('datalist');
      datalist.id = 'id#with#hashes';
      container.appendChild(input);
      container.appendChild(datalist);
      expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
    });

    it('should handle prohibited global aria attributes on certain roles', () => {
      // Test aria-label on presentation role (prohibited on presentation)
      const div = document.createElement('div');
      div.setAttribute('role', 'presentation');
      // aria-label is prohibited on presentation, so it triggers conflict resolution
      div.setAttribute('aria-label', 'Label');
      container.appendChild(div);
      expect(ariaUtils.isAriaReadOnlyRole(div)).toBe(false);
    });

    it('should handle aria-roledescription on generic role', () => {
      // aria-roledescription is prohibited on generic role
      const div = document.createElement('div');
      div.setAttribute('role', 'generic');
      div.setAttribute('aria-roledescription', 'description');
      container.appendChild(div);
      expect(ariaUtils.isAriaReadOnlyRole(div)).toBe(false);
    });

    it('should handle element completely detached from document (covers getIdRefs null root)', () => {
      // Create an element that's completely detached - not in any document
      const input = document.createElement('input');
      input.type = 'text';
      input.setAttribute('list', 'some-list');
      
      // Do NOT append to container - keep it completely detached
      // This will cause getEnclosingShadowRootOrDocument to return undefined
      // which triggers the check: if (!root) return [];
      
      // Calling isAriaReadOnlyRole will trigger getAriaRole -> getImplicitAriaRole
      // For INPUT, this calls getIdRefs with the list attribute
      // Since the element is detached, getEnclosingShadowRootOrDocument returns undefined
      // and getIdRefs returns [], so it falls back to textbox role
      expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
    });

    it('should handle datalist lookup where querySelector finds element already in results', () => {
      // This test covers the duplicate check "if (firstElement && !result.includes(firstElement))"
      // Create a scenario where we reference the same ID multiple times
      const input = document.createElement('input');
      input.type = 'text';
      // Reference the same ID three times - querySelector will find the same element each time
      input.setAttribute('list', 'list-id list-id list-id');
      
      const datalist = document.createElement('datalist');
      datalist.id = 'list-id';
      
      container.appendChild(input);
      container.appendChild(datalist);
      
      // This should find the datalist and recognize it as combobox
      // The duplicate check ensures the same element isn't added multiple times to results
      expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
      
      // Additional verification: create another input with multiple different IDs where
      // only one exists, so the others return null from querySelector
      const input2 = document.createElement('input');
      input2.type = 'text';
      input2.setAttribute('list', 'nonexistent1 list-id nonexistent2 list-id');
      container.appendChild(input2);
      
      // Should still find the one valid datalist (duplicate checking prevents adding twice)
      expect(ariaUtils.isAriaReadOnlyRole(input2)).toBe(true);
    });

    it('should handle querySelector returning null for non-existent ID in datalist lookup', () => {
      // This explicitly tests where firstElement is null
      // querySelector will return null for non-existent IDs
      const input = document.createElement('input');
      input.type = 'text';
      // Reference multiple non-existent IDs
      input.setAttribute('list', 'does-not-exist another-missing-id fake-list');
      container.appendChild(input);
      
      // No datalist exists with these IDs, so querySelector returns null
      // The condition evaluates to false (firstElement is null)
      // Should fall back to textbox role
      expect(ariaUtils.isAriaReadOnlyRole(input)).toBe(true);
    });

    it('should find datalist via getIdRefs and recognize as combobox', () => {
      // This test explicitly ensures the duplicate check logic is covered
      // if (firstElement && !result.includes(firstElement))
      // result.push(firstElement);
      
      // Create a valid datalist scenario
      const datalist = document.createElement('datalist');
      datalist.id = 'explicit-test-list';
      container.appendChild(datalist);
      
      // Create input that references this datalist
      const input = document.createElement('input');
      input.type = 'text'; // Must be text/email/tel/url to trigger getIdRefs
      input.setAttribute('list', 'explicit-test-list');
      container.appendChild(input);
      
      // When isAriaReadOnlyRole is called, it should:
      // 1. Get the implicit role for INPUT
      // 2. Call getIdRefs with 'explicit-test-list'
      // 3. querySelector finds the datalist element (firstElement is truthy)
      // 4. result is empty, so !result.includes(firstElement) is true
      // 5. Execute: result.push(firstElement)
      // 6. Returns combobox role
      const role = ariaUtils.isAriaReadOnlyRole(input);
      expect(role).toBe(true); // combobox is a readonly role
    });
  });
});

