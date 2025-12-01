import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import NodePreviewer from '../nodePreviewer';

describe('NodePreviewer', () => {
  let previewer: NodePreviewer;
  let container: HTMLElement;

  beforeEach(() => {
    previewer = new NodePreviewer();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove()
  });

  describe('previewNode', () => {
    describe('Text Nodes', () => {
      it('should preview simple text nodes', () => {
        const textNode = document.createTextNode('Hello World');
        expect(previewer.previewNode(textNode)).toBe('#text=Hello World');
      });

      it('should preview empty text nodes', () => {
        const textNode = document.createTextNode('');
        expect(previewer.previewNode(textNode)).toBe('#text=');
      });

      it('should replace newlines with ↵ in text nodes', () => {
        const textNode = document.createTextNode('Line 1\nLine 2');
        expect(previewer.previewNode(textNode)).toBe('#text=Line 1↵Line 2');
      });

      it('should replace tabs with ⇆ in text nodes', () => {
        const textNode = document.createTextNode('Tab\there');
        expect(previewer.previewNode(textNode)).toBe('#text=Tab⇆here');
      });

      it('should handle text nodes with null nodeValue', () => {
        const textNode = document.createTextNode('test');
        // Force nodeValue to be null to test the ?? fallback
        Object.defineProperty(textNode, 'nodeValue', {
          get: () => null,
          configurable: true
        });
        expect(previewer.previewNode(textNode)).toBe('#text=');
      });
    });

    describe('Auto-closing Tags', () => {
      it('should format self-closing tags correctly', () => {
        const img = document.createElement('img');
        img.setAttribute('src', 'test.jpg');
        img.setAttribute('alt', 'Test');
        const preview = previewer.previewNode(img);
        expect(preview).toMatch(/<img.*\/>/);
        expect(preview).toContain('src="test.jpg"');
        expect(preview).toContain('alt="Test"');
      });

      it('should handle BR tags as self-closing', () => {
        const br = document.createElement('br');
        expect(previewer.previewNode(br)).toBe('<br/>');
      });

      it('should handle INPUT tags as self-closing', () => {
        const input = document.createElement('input');
        input.type = 'text';
        const preview = previewer.previewNode(input);
        expect(preview).toMatch(/<input.*\/>/);
        expect(preview).toContain('type="text"');
      });

      it('should handle HR tags as self-closing', () => {
        const hr = document.createElement('hr');
        expect(previewer.previewNode(hr)).toBe('<hr/>');
      });

      it('should handle LINK tags as self-closing', () => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        const preview = previewer.previewNode(link);
        expect(preview).toMatch(/<link.*\/>/);
      });
    });

    describe('Element Attributes', () => {
      it('should include regular attributes', () => {
        const div = document.createElement('div');
        div.id = 'test';
        const preview = previewer.previewNode(div);
        expect(preview).toContain('id="test"');
      });

      it('should exclude style attributes', () => {
        const div = document.createElement('div');
        div.style.color = 'red';
        div.id = 'test';
        const preview = previewer.previewNode(div);
        expect(preview).not.toContain('style');
        expect(preview).toContain('id="test"');
      });

      it('should sort attributes by length', () => {
        const div = document.createElement('div');
        div.setAttribute('data-very-long-attribute', 'value');
        div.id = 'x';
        const preview = previewer.previewNode(div);
        const idIndex = preview.indexOf('id=');
        const dataIndex = preview.indexOf('data-very-long');
        expect(idIndex).toBeLessThan(dataIndex);
      });

      it('should format boolean attributes without values', () => {
        const input = document.createElement('input');
        input.setAttribute('disabled', '');
        const preview = previewer.previewNode(input);
        expect(preview).toMatch(/disabled(?![="])/);
      });

      it('should format checked boolean attribute without value', () => {
        const input = document.createElement('input');
        input.setAttribute('checked', '');
        const preview = previewer.previewNode(input);
        expect(preview).toMatch(/checked(?![="])/);
      });

      it('should format selected boolean attribute without value', () => {
        const option = document.createElement('option');
        option.setAttribute('selected', '');
        const preview = previewer.previewNode(option);
        expect(preview).toContain('selected');
      });

      it('should format boolean attributes with actual values normally', () => {
        const input = document.createElement('input');
        input.setAttribute('disabled', 'true');
        const preview = previewer.previewNode(input);
        expect(preview).toContain('disabled="true"');
      });

      it('should truncate long attribute text with ellipsis', () => {
        const div = document.createElement('div');
        const longValue = 'a'.repeat(600);
        div.setAttribute('data-test', longValue);
        const preview = previewer.previewNode(div);
        expect(preview).toContain('…');
        expect(preview.length).toBeLessThan(longValue.length + 100);
      });

      it('should handle attributes at exactly the 500 character cap', () => {
        const div = document.createElement('div');
        // Total attr string is ' data-test="' + value + '"' = 14 + value
        // So for exactly 500 chars total, value needs to be 486 chars
        div.setAttribute('data-test', 'a'.repeat(486));
        const preview = previewer.previewNode(div);
        // Should not truncate at exactly 500 chars
        expect(preview).not.toContain('…');
      });

      it('should handle attributes just over the 500 character cap', () => {
        const div = document.createElement('div');
        // For over 500 chars, make value 488 chars (total = 501)
        div.setAttribute('data-test', 'a'.repeat(488));
        const preview = previewer.previewNode(div);
        // Should truncate at 501 chars
        expect(preview).toContain('…');
      });

      it('should handle multiple attributes', () => {
        const div = document.createElement('div');
        div.id = 'test';
        div.className = 'my-class';
        div.setAttribute('data-value', '123');
        const preview = previewer.previewNode(div);
        expect(preview).toContain('id="test"');
        expect(preview).toContain('class="my-class"');
        expect(preview).toContain('data-value="123"');
      });

      it('should handle elements with attributes.item() returning null', () => {
        const div = document.createElement('div');
        div.id = 'test';
        
        // Mock attributes to simulate a case where item() could return null
        const originalAttributes = div.attributes;
        const mockAttributes = {
          length: 2,
          item: (index: number) => {
            if (index === 0) return null; // Return null for first item
            if (index === 1) return originalAttributes.item(0); // Return actual attribute
            return null;
          }
        };
        
        Object.defineProperty(div, 'attributes', {
          get: () => mockAttributes,
          configurable: true
        });
        
        const preview = previewer.previewNode(div);
        // Should still process the valid attribute and skip the null one
        expect(preview).toContain('id="test"');
      });
    });

    describe('Element Content', () => {
      it('should show text content for elements with only text children (≤5)', () => {
        const div = document.createElement('div');
        div.textContent = 'Hello';
        const preview = previewer.previewNode(div);
        expect(preview).toBe('<div>Hello</div>');
      });

      it('should show text content for elements with up to 5 text nodes', () => {
        const div = document.createElement('div');
        for (let i = 0; i < 5; i++) {
          div.appendChild(document.createTextNode(`Text${i} `));
        }
        const preview = previewer.previewNode(div);
        expect(preview).not.toContain('…');
        expect(preview).toContain('Text0');
      });

      it('should handle exactly 5 text nodes (boundary test)', () => {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode('One'));
        div.appendChild(document.createTextNode('Two'));
        div.appendChild(document.createTextNode('Three'));
        div.appendChild(document.createTextNode('Four'));
        div.appendChild(document.createTextNode('Five'));
        const preview = previewer.previewNode(div);
        // Should show text (onlyText=true since all are text nodes and count=5)
        expect(preview).toContain('OneTwoThreeFourFive');
        expect(preview).not.toContain('…');
      });

      it('should show ellipsis for elements with mixed children', () => {
        const div = document.createElement('div');
        div.innerHTML = '<span>Child</span>Text';
        const preview = previewer.previewNode(div);
        expect(preview).toContain('…');
      });

      it('should show ellipsis for elements with more than 5 text children', () => {
        const div = document.createElement('div');
        for (let i = 0; i < 6; i++) {
          div.appendChild(document.createTextNode(`Text ${i}`));
        }
        const preview = previewer.previewNode(div);
        expect(preview).toContain('…');
      });

      it('should show ellipsis for exactly 6 text children (just over boundary)', () => {
        const div = document.createElement('div');
        for (let i = 0; i < 6; i++) {
          div.appendChild(document.createTextNode(`T${i}`));
        }
        const preview = previewer.previewNode(div);
        // children.length = 6 > 5, so onlyText stays false, shows ellipsis
        expect(preview).toContain('…');
        expect(preview).not.toContain('T0T1T2T3T4T5');
      });

      it('should show empty content for empty elements', () => {
        const div = document.createElement('div');
        expect(previewer.previewNode(div)).toBe('<div></div>');
      });

      it('should handle elements with only empty text nodes', () => {
        const div = document.createElement('div');
        // Add text nodes that are empty strings (tests onlyText=true with falsy textContent)
        div.appendChild(document.createTextNode(''));
        div.appendChild(document.createTextNode(''));
        const preview = previewer.previewNode(div);
        expect(preview).toBe('<div></div>');
      });

      it('should handle elements with exactly one empty text node', () => {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(''));
        const preview = previewer.previewNode(div);
        expect(preview).toBe('<div></div>');
      });

      it('should handle element with single text node containing only whitespace', () => {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode('   '));
        const preview = previewer.previewNode(div);
        // textContent = '   ' which is truthy, so should show the whitespace
        expect(preview).toContain('   ');
        expect(preview).toBe('<div>   </div>');
      });

      it('should handle element with 1 non-text child (tests children.length check)', () => {
        const div = document.createElement('div');
        const span = document.createElement('span');
        div.appendChild(span);
        // children.length = 1 (<=5), but not all text, so onlyText=false, children.length > 0
        const preview = previewer.previewNode(div);
        expect(preview).toContain('…');
      });

      it('should handle element with exactly 5 mixed children', () => {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode('text1'));
        div.appendChild(document.createElement('span'));
        div.appendChild(document.createTextNode('text2'));
        div.appendChild(document.createElement('br'));
        div.appendChild(document.createTextNode('text3'));
        // children.length = 5 (<=5), mixed types, onlyText=false, shows ellipsis
        const preview = previewer.previewNode(div);
        expect(preview).toContain('…');
      });

      it('should handle element where first child is non-text', () => {
        const div = document.createElement('div');
        div.appendChild(document.createElement('span'));
        div.appendChild(document.createTextNode('text'));
        // First child breaks onlyText immediately
        const preview = previewer.previewNode(div);
        expect(preview).toContain('…');
      });

      it('should handle element where last child is non-text', () => {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode('text'));
        div.appendChild(document.createElement('span'));
        // Last child breaks onlyText after checking first
        const preview = previewer.previewNode(div);
        expect(preview).toContain('…');
      });

      it('should handle element with 3 text nodes then 1 non-text (mid-loop break)', () => {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode('one'));
        div.appendChild(document.createTextNode('two'));
        div.appendChild(document.createTextNode('three'));
        div.appendChild(document.createElement('span'));
        // onlyText breaks on 4th iteration
        const preview = previewer.previewNode(div);
        expect(preview).toContain('…');
      });

      it('should truncate long text content', () => {
        const div = document.createElement('div');
        div.textContent = 'a'.repeat(100);
        const preview = previewer.previewNode(div);
        expect(preview).toContain('…');
        expect(preview.length).toBeLessThan(200);
      });

      it('should handle text content at exactly 50 characters', () => {
        const div = document.createElement('div');
        div.textContent = 'a'.repeat(50);
        const preview = previewer.previewNode(div);
        // Should not truncate at exactly 50 chars
        expect(preview).not.toContain('…');
        expect(preview).toContain('a'.repeat(50));
      });

      it('should handle text content at 51 characters', () => {
        const div = document.createElement('div');
        div.textContent = 'a'.repeat(51);
        const preview = previewer.previewNode(div);
        // Should truncate over 50 chars
        expect(preview).toContain('…');
      });

      it('should replace newlines in element content', () => {
        const div = document.createElement('div');
        div.textContent = 'Line1\nLine2';
        const preview = previewer.previewNode(div);
        expect(preview).toContain('↵');
      });

      it('should replace tabs in element content', () => {
        const div = document.createElement('div');
        div.textContent = 'Tab1\tTab2';
        const preview = previewer.previewNode(div);
        expect(preview).toContain('⇆');
      });
    });

    describe('Complex Elements', () => {
      it('should handle nested elements', () => {
        const outer = document.createElement('div');
        outer.id = 'outer';
        const inner = document.createElement('span');
        inner.textContent = 'Inner';
        outer.appendChild(inner);
        const preview = previewer.previewNode(outer);
        expect(preview).toContain('id="outer"');
        expect(preview).toContain('…');
      });

      it('should handle elements with classes', () => {
        const div = document.createElement('div');
        div.className = 'test-class another-class';
        const preview = previewer.previewNode(div);
        expect(preview).toContain('class="test-class another-class"');
      });

      it('should handle buttons with text', () => {
        const button = document.createElement('button');
        button.textContent = 'Click Me';
        const preview = previewer.previewNode(button);
        expect(preview).toBe('<button>Click Me</button>');
      });

      it('should handle anchor tags', () => {
        const anchor = document.createElement('a');
        anchor.href = 'https://example.com';
        anchor.textContent = 'Link';
        const preview = previewer.previewNode(anchor);
        expect(preview).toContain('href="https://example.com"');
        expect(preview).toContain('Link');
      });
    });

    describe('Edge Cases', () => {
      it('should handle comment nodes', () => {
        const comment = document.createComment('This is a comment');
        const preview = previewer.previewNode(comment);
        expect(preview).toMatch(/<#comment.*\/>/);
      });

      it('should handle elements with special characters in attributes', () => {
        const div = document.createElement('div');
        div.setAttribute('data-test', 'value"with"quotes');
        const preview = previewer.previewNode(div);
        expect(preview).toContain('data-test=');
        expect(preview).toContain('value"with"quotes');
      });

      it('should handle unicode characters in text content', () => {
        const div = document.createElement('div');
        div.textContent = '🚀 Unicode';
        const preview = previewer.previewNode(div);
        expect(preview).toContain('🚀 Unicode');
      });

      it('should handle unicode characters in attributes', () => {
        const div = document.createElement('div');
        div.setAttribute('data-emoji', '🚀');
        const preview = previewer.previewNode(div);
        expect(preview).toContain('🚀');
      });

      it('should handle strings where UTF-16 length exceeds cap but character count does not', () => {
        const div = document.createElement('div');
        // Create a string with emojis (surrogate pairs) where .length > 50 but [...str].length <= 50
        // Each emoji is 2 UTF-16 code units but 1 character when spread
        // 26 emojis = 52 in .length but 26 in [...str].length
        const emojis = '😀'.repeat(26); // .length = 52, [...].length = 26
        div.textContent = emojis;
        const preview = previewer.previewNode(div);
        // Should successfully preview without errors and contain the emojis
        expect(preview).toContain('<div>');
        expect(preview).toContain('😀');
        expect(preview).toContain('</div>');
        // Verify it didn't truncate (since char count is within limit)
        expect(preview).not.toContain('…');
      });

      it('should handle very long element names', () => {
        const customElement = document.createElement('my-very-long-custom-element-name');
        const preview = previewer.previewNode(customElement);
        expect(preview).toContain('my-very-long-custom-element-name');
      });

      it('should handle elements with no children but whitespace', () => {
        const div = document.createElement('div');
        div.textContent = '   ';
        const preview = previewer.previewNode(div);
        expect(preview).toContain('   ');
      });

      it('should handle readonly boolean attribute', () => {
        const input = document.createElement('input');
        input.setAttribute('readonly', '');
        const preview = previewer.previewNode(input);
        expect(preview).toMatch(/readonly(?![="])/);
      });

      it('should handle multiple boolean attribute', () => {
        const select = document.createElement('select');
        select.setAttribute('multiple', '');
        const preview = previewer.previewNode(select);
        expect(preview).toMatch(/multiple(?![="])/);
      });
    });

    describe('Private Method Edge Cases', () => {
      it('should handle trimString with default suffix parameter', () => {
        // Access private method to test the default parameter branch
        const trimString = (previewer as any).trimString.bind(previewer);
        
        // Test with only 2 parameters (uses default suffix='')
        const result1 = trimString('short', 10);
        expect(result1).toBe('short');
        
        // Test trimming with default suffix
        const result2 = trimString('verylongstring', 5);
        expect(result2).toBe('veryl');
      });

      it('should handle trimString with explicit suffix', () => {
        const trimString = (previewer as any).trimString.bind(previewer);
        
        // Test with explicit suffix
        const result = trimString('verylongstring', 5, '...');
        expect(result).toBe('ve...');
      });
    });

    describe('Real-world Scenarios', () => {
      it('should handle a typical form input', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.name = 'username';
        input.placeholder = 'Enter username';
        input.required = true;
        const preview = previewer.previewNode(input);
        expect(preview).toContain('type="text"');
        expect(preview).toContain('name="username"');
        expect(preview).toContain('placeholder="Enter username"');
      });

      it('should handle a card component structure', () => {
        const card = document.createElement('div');
        card.className = 'card';
        const title = document.createElement('h2');
        title.textContent = 'Card Title';
        card.appendChild(title);
        const preview = previewer.previewNode(card);
        expect(preview).toContain('class="card"');
        expect(preview).toContain('…');
      });

      it('should handle an image with all common attributes', () => {
        const img = document.createElement('img');
        img.src = 'image.jpg';
        img.alt = 'Description';
        img.width = 100;
        img.height = 100;
        const preview = previewer.previewNode(img);
        expect(preview).toMatch(/<img.*\/>/);
        expect(preview).toContain('src="image.jpg"');
        expect(preview).toContain('alt="Description"');
      });

      it('should handle a navigation link', () => {
        const nav = document.createElement('nav');
        const link = document.createElement('a');
        link.href = '/home';
        link.textContent = 'Home';
        nav.appendChild(link);
        const navPreview = previewer.previewNode(nav);
        expect(navPreview).toContain('…');
      });
    });
  });
});

