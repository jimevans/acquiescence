import { describe, expect, beforeEach, afterEach } from 'vitest';
import AriaSnapshotMatcher from '../ariaSnapshotMatcher';
import { isNativeDom, testIf } from './testUtilities';

// Matching takes a snapshot, which depends on rendering that jsdom does not provide, so these tests run only in a browser.
describe('AriaSnapshotMatcher', () => {
  let matcher: AriaSnapshotMatcher;
  let container: HTMLElement;

  beforeEach(() => {
    matcher = new AriaSnapshotMatcher();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  const matches = (html: string, template: string): boolean => {
    container.innerHTML = html;
    return matcher.match(container, template).matches;
  };

  describe('nodes and names', () => {
    testIf(isNativeDom(), 'should match a node anywhere in the snapshot', () => {
      expect(matches('<h1>title</h1>', '- heading "title"')).toBe(true);
      expect(matches('<h1>title</h1><h1>title 2</h1>', '- heading "title 2"')).toBe(true);
      expect(matches('<div><h1>title</h1></div>', '- heading')).toBe(true);
      expect(matches('<h1>title</h1>', '- heading "wrong"')).toBe(false);
      expect(matches('<h1>title</h1>', '- button')).toBe(false);
    });

    testIf(isNativeDom(), 'should match several nodes, and nested ones, in order', () => {
      const html = '<h1>Microsoft</h1><div>Open source projects</div><ul><li><a href="about:blank">Playwright</a></li></ul>';
      expect(matches(html, `
        - heading "Microsoft"
        - text: Open source projects
        - list:
          - listitem:
            - link "Playwright"
      `)).toBe(true);
      expect(matches(html, `
        - list
        - heading "Microsoft"
      `)).toBe(false);
    });

    testIf(isNativeDom(), 'should match names with regular expressions', () => {
      expect(matches('<h1>Issues 12</h1>', '- heading /Issues \\d+/')).toBe(true);
      expect(matches('<h1>Issues 1/2</h1>', '- heading /Issues 1[/]2/')).toBe(true);
      expect(matches('<h1>Issues 1]]2</h1>', '- heading /Issues 1[\\]]]2/')).toBe(true);
      expect(matches('<button>Click: me</button>', '- \'button /Click: me/\'')).toBe(true);
      expect(matches('<h1>Issues</h1>', '- heading /Issues \\d+/')).toBe(false);
      expect(matches('<nav><a href="#"></a></nav>', '- navigation /.*/')).toBe(false);
    });

    testIf(isNativeDom(), 'should match names with escaped characters', () => {
      expect(matches('<button>Click " me</button>', '- button "Click \\" me"')).toBe(true);
      expect(matches('<button>Click \\ me</button>', '- button "Click \\\\ me"')).toBe(true);
      expect(matches('<button>Click \' me</button>', '- \'button "Click \'\' me"\'')).toBe(true);
      expect(matches('<h1>heading "name" [level=1]</h1>', '- heading "heading \\"name\\" [level=1]" [level=1]')).toBe(true);
    });
  });

  describe('states', () => {
    testIf(isNativeDom(), 'should match the states a template gives, and ignore those it does not', () => {
      const html = '<input type="checkbox" checked><button aria-pressed="mixed" disabled>Toggle</button><h2>Title</h2><div role="tab" aria-selected="true" aria-expanded="true">Tab</div>';
      expect(matches(html, '- checkbox [checked]')).toBe(true);
      expect(matches(html, '- checkbox [checked=false]')).toBe(false);
      expect(matches(html, '- button [pressed=mixed] [disabled]')).toBe(true);
      expect(matches(html, '- button [pressed=true]')).toBe(false);
      expect(matches(html, '- heading [level=2]')).toBe(true);
      expect(matches(html, '- heading [level=3]')).toBe(false);
      expect(matches(html, '- tab [selected] [expanded]')).toBe(true);
      expect(matches(html, '- tab [selected=false]')).toBe(false);
      expect(matches('<button>Go</button>', '- button [disabled=false] [pressed=false]')).toBe(true);
    });

    testIf(isNativeDom(), 'should ignore refs', () => {
      expect(matches('<button>Go</button>', '- button "Go" [ref=e999]')).toBe(true);
    });
  });

  describe('text and properties', () => {
    testIf(isNativeDom(), 'should match text exactly, normalized, or with a regular expression', () => {
      const html = '<ul aria-label="my list"><li>one</li><li>two</li></ul><p>Line 1 Line 2</p><div role="region">Item 42</div>';
      expect(matches(html, `
        - list "my list":
          - listitem: "one"
          - listitem: two
      `)).toBe(true);
      expect(matches(html, `
        - paragraph: |
            Line 1
            Line 2
      `)).toBe(true);
      expect(matches(html, '- region: /Item \\d+/')).toBe(true);
      expect(matches(html, '- region: /Item \\d+ more/')).toBe(false);
      expect(matches(html, '- listitem: three')).toBe(false);
      expect(matches(html, '- text: "  "')).toBe(true);
    });

    testIf(isNativeDom(), 'should treat text between slashes that is not a valid regular expression as text', () => {
      expect(matches('<p>/a(/</p>', '- paragraph: /a(/')).toBe(true);
      expect(matches('<p>abc</p>', '- paragraph: /a(/')).toBe(false);
      expect(matches('<p>/</p>', '- paragraph: /')).toBe(true);
    });

    testIf(isNativeDom(), 'should match URLs and placeholders', () => {
      const html = '<a href="https://example.com">Link</a><input aria-label="Email" placeholder="you@example.com">';
      expect(matches(html, `
        - link:
          - /url: /.*example.com/
      `)).toBe(true);
      expect(matches(html, `
        - link:
          - /url: https://other.com
      `)).toBe(false);
      expect(matches(html, `
        - textbox "Email":
          - /placeholder: you@example.com
      `)).toBe(true);
      expect(matches('<input aria-label="Name">', `
        - textbox:
          - /placeholder: anything
      `)).toBe(false);
    });
  });

  describe('children modes', () => {
    const list = '<ul><li>One</li><li>Two</li><li>Three</li></ul>';
    const nested = '<ul><li><ul><li>1.1</li><li>1.2</li></ul></li></ul>';

    testIf(isNativeDom(), 'should let children contain the listed ones in order by default', () => {
      expect(matches(list, `
        - list:
          - listitem: One
          - listitem: Three
      `)).toBe(true);
      expect(matches(list, `
        - list:
          - listitem: Three
          - listitem: One
      `)).toBe(false);
    });

    testIf(isNativeDom(), 'should require exactly the listed children when equal', () => {
      expect(matches(list, `
        - list:
          - /children: equal
          - listitem: One
          - listitem: Three
      `)).toBe(false);
      expect(matches(nested, `
        - list:
          - /children: equal
          - listitem:
            - list:
              - listitem: "1.1"
      `)).toBe(true);
    });

    testIf(isNativeDom(), 'should require exactly the listed descendants when deep-equal, unless a node restores contain', () => {
      expect(matches(nested, `
        - list:
          - /children: deep-equal
          - listitem:
            - list:
              - listitem: "1.1"
      `)).toBe(false);
      expect(matches(nested, `
        - list:
          - /children: deep-equal
          - listitem:
            - list:
              - /children: contain
              - listitem: "1.1"
      `)).toBe(true);
      expect(matches(nested, `
        - /children: deep-equal
        - list
      `)).toBe(false);
    });

    testIf(isNativeDom(), 'should match text children exactly when deep-equal', () => {
      expect(matches('<section><div role="progressbar" aria-label="Alpha Beta" aria-valuenow="7"><span>Alpha</span> <span>7</span></div></section>', `
        - /children: deep-equal
        - progressbar "Alpha Beta": Alpha 7
      `)).toBe(true);
    });
  });

  describe('results', () => {
    testIf(isNativeDom(), 'should return the snapshot without refs as the actual text', () => {
      container.innerHTML = '<h1>title</h1><button>Go</button>';
      expect(matcher.match(container, '- heading "wrong"')).toEqual({
        matches: false,
        actual: '- heading "title" [level=1]\n- button "Go"',
      });
    });

    testIf(isNativeDom(), 'should throw for a template that is not valid', () => {
      expect(() => matcher.match(container, '- buton')).toThrow('Unknown role "buton"');
    });
  });
});
