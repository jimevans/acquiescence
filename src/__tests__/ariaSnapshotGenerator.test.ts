import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import AriaSnapshotGenerator from '../ariaSnapshotGenerator';
import AriaSnapshotRenderer from '../ariaSnapshotRenderer';
import { isNativeDom, testIf } from './testUtilities';

// Snapshots depend on rendering, which jsdom does not provide, so most of these tests run only in a browser.
describe('AriaSnapshotGenerator', () => {
  let generator: AriaSnapshotGenerator;
  let container: HTMLElement;

  beforeEach(() => {
    generator = new AriaSnapshotGenerator();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  // Removes the indentation shared by the lines of a template literal, and its first and last lines.
  const unindent = (text: string): string => {
    const lines = text.split('\n').slice(1, -1);
    const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => /^ */.exec(line)![0].length));
    return lines.map((line) => line.slice(indent)).join('\n');
  };

  const snapshotText = (html: string): string => {
    container.innerHTML = html;
    return generator.generate(container, { refs: false }).text;
  };

  describe('structure', () => {
    testIf(isNativeDom(), 'should snapshot headings with their level', () => {
      expect(snapshotText('<h1>title</h1><h2>title 2</h2>')).toBe(unindent(`
        - heading "title" [level=1]
        - heading "title 2" [level=2]
      `));
    });

    testIf(isNativeDom(), 'should nest children under named and unnamed nodes', () => {
      expect(snapshotText('<ul aria-label="my list"><li>one</li><li>two</li></ul><ul><li><a href="about:blank">link</a></li></ul>')).toBe(unindent(`
        - list "my list":
          - listitem: one
          - listitem: two
        - list:
          - listitem:
            - link "link":
              - /url: about:blank
      `));
    });

    testIf(isNativeDom(), 'should include the root element when it has a role', () => {
      container.innerHTML = '<nav><a href="/">Home</a></nav>';
      expect(generator.generate(container.firstElementChild!, { refs: false }).text).toBe(unindent(`
        - navigation:
          - link "Home":
            - /url: /
      `));
    });

    testIf(isNativeDom(), 'should leave out elements without a role, and generic and presentational ones, keeping their content', () => {
      expect(snapshotText('<div><span><button>Go</button></span></div><ul><li role="presentation">hello</li><li role="none">world</li></ul><div role="generic"><h3>In generic</h3></div>')).toBe(unindent(`
        - button "Go"
        - list: hello world
        - heading "In generic" [level=3]
      `));
    });

    testIf(isNativeDom(), 'should leave out hidden elements and their descendants', () => {
      expect(snapshotText(`
        <p><span>hello</span><span aria-hidden="true">world</span></p>
        <div style="visibility: hidden"><div style="visibility: visible"><button>Invisible</button></div></div>
        <div aria-hidden="true"><div aria-hidden="false"><button>Aria hidden</button></div></div>
        <details><summary>Summary</summary><div>Details</div></details>
      `)).toBe(unindent(`
        - paragraph: hello
        - group: Summary
      `));
    });

    testIf(isNativeDom(), 'should follow aria-owns, and not visit an element twice', () => {
      expect(snapshotText(`
        <a href="about:blank" aria-owns="input p"><div role="region">Link 1</div></a>
        <a href="about:blank" aria-owns="input p"><div role="region">Link 2</div></a>
        <input id="input" value="Value">
        <p id="p">Paragraph</p>
        <a href="about:blank" id="parent"><div role="region" aria-owns="parent">Hello</div></a>
      `)).toBe(unindent(`
        - link "Link 1 Value Paragraph":
          - /url: about:blank
          - region: Link 1
          - textbox: Value
          - paragraph: Paragraph
        - link "Link 2 Value Paragraph":
          - /url: about:blank
          - region: Link 2
        - link "Hello":
          - /url: about:blank
          - region: Hello
      `));
    });

    testIf(isNativeDom(), 'should show iframes and frames without their content, unless they are hidden', () => {
      container.innerHTML = '<iframe srcdoc="<button>Inside</button>"></iframe><iframe style="display: none"></iframe>';
      const frame = document.createElement('frame');
      container.appendChild(frame);
      expect(generator.generate(container, { refs: false }).text).toBe(unindent(`
        - iframe
        - iframe
      `));
    });

    test('should be empty for an element in a document without a window', () => {
      const detached = document.implementation.createHTMLDocument('');
      detached.body.innerHTML = '<button>Go</button>';
      const snapshot = generator.generate(detached.body);
      expect(snapshot.text).toBe('');
      expect(snapshot.root).toEqual({ role: 'fragment', name: '', children: [] });
    });
  });

  describe('text', () => {
    testIf(isNativeDom(), 'should show text between nodes, merging runs and separating block elements', () => {
      expect(snapshotText(`
        <h1>Microsoft</h1><div>Open source projects</div>
        <section><span>One</span> <span>Two</span> <span>Three</span></section>
        <section><span>One </span><span>Two </span><span>Three</span></section>
        <section><div>One</div><div>Two</div><div>Three</div></section>
        <p>Line 1<br>Line 2</p>
      `)).toBe(unindent(`
        - heading "Microsoft" [level=1]
        - text: Open source projects One Two Three One Two Three One Two Three
        - paragraph: Line 1 Line 2
      `));
    });

    testIf(isNativeDom(), 'should keep text and nodes in order beneath their parent', () => {
      expect(snapshotText(`
        <div role="listitem"><div><span title="a.test.ts">a.test.ts</span></div><div>30ms</div><div><button title="Run"></button><button title="Watch"></button></div></div>
      `)).toBe(unindent(`
        - listitem:
          - text: a.test.ts 30ms
          - button "Run"
          - button "Watch"
      `));
    });

    testIf(isNativeDom(), 'should normalize white space in names and text', () => {
      const softHyphen = String.fromCharCode(0xad);
      const zeroWidthSpace = String.fromCharCode(0x200b);
      expect(snapshotText(`
        <details><summary> one  \n two <a href="#"> link &nbsp;\n  1 </a> </summary></details>
        <input value="  hello   &nbsp; world ">
        <button>hello${softHyphen}${zeroWidthSpace}world</button>
      `)).toBe(unindent(`
        - group:
          - text: one two
          - link "link 1":
            - /url: "#"
        - textbox: hello world
        - button "helloworld"
      `));
    });

    testIf(isNativeDom(), 'should include pseudo-element content in names and text', () => {
      expect(snapshotText(`
        <style>
          .before span::before { content: 'world'; }
          .after div::after { content: 'bye'; }
          .block span::before { content: 'world'; display: block; }
          .block div::after { content: 'bye'; display: block; }
          .hidden span::before { content: 'world'; display: none; }
          p.marked::before { content: '*'; }
        </style>
        <a class="before after" href="about:blank"><span>hello</span><div>hello</div></a>
        <a class="block" href="about:blank"><span>hello</span><div>hello</div></a>
        <a class="hidden" href="about:blank"><span>hello</span></a>
        <p class="marked">note</p>
      `)).toBe(unindent(`
        - link "worldhello hellobye":
          - /url: about:blank
        - link "world hello hello bye":
          - /url: about:blank
        - link "hello":
          - /url: about:blank
        - paragraph: "*note"
      `));
    });

    testIf(isNativeDom(), 'should show a password as a bullet for each character, and an empty one as no text', () => {
      container.innerHTML = '<input type="password" aria-label="Password" value="s3cr\u00e9t"><input type="password" aria-label="Empty"><input type="password" aria-label="Emoji" value="a\u{1F600}">';

      expect(generator.generate(container, { refs: false }).text).toBe(unindent(`
        - textbox "Password": \u2022\u2022\u2022\u2022\u2022\u2022
        - textbox "Empty"
        - textbox "Emoji": \u2022\u2022
      `));
    });

    testIf(isNativeDom(), 'should show the value of text inputs and text areas, but not of checkboxes, radio buttons, or file inputs', () => {
      container.innerHTML = '<input value="hello world"><input type="file"><input type="checkbox" checked><input type="radio"><textarea>Before</textarea>';
      expect(generator.generate(container, { refs: false }).text).toBe(unindent(`
        - textbox: hello world
        - button "Choose File"
        - checkbox [checked]
        - radio
        - textbox: Before
      `));
      container.querySelector('textarea')!.value = 'After';
      expect(generator.generate(container, { refs: false }).text).toContain('- textbox: After');
    });

    testIf(isNativeDom(), 'should not show the text inside a text box', () => {
      expect(snapshotText('<div role="textbox" aria-label="Editor" contenteditable>Typed <b>text</b></div>')).toBe('- textbox "Editor"');
    });
  });

  describe('shadow DOM and slots', () => {
    testIf(isNativeDom(), 'should use slotted content once, and fallback content when nothing is assigned', () => {
      container.innerHTML = '<button><div id="slotting">foo</div></button><div id="assigned">bar</div><div id="empty"></div>';
      container.querySelector('#slotting')!.attachShadow({ mode: 'open' }).innerHTML = '<slot></slot>';
      container.querySelector('#assigned')!.attachShadow({ mode: 'open' }).innerHTML = '<button><slot><span>pre</span></slot></button>';
      container.querySelector('#empty')!.attachShadow({ mode: 'open' }).innerHTML = '<button><slot><span>pre</span></slot></button>';
      expect(generator.generate(container, { refs: false }).text).toBe(unindent(`
        - button "foo"
        - button "bar"
        - button "pre"
      `));
    });
  });

  describe('states and properties', () => {
    testIf(isNativeDom(), 'should show the states of nodes in a fixed order', () => {
      expect(snapshotText(`
        <input type="checkbox" id="mixed"><input type="checkbox" checked disabled>
        <button aria-expanded="true" aria-pressed="true">Toggle</button>
        <button aria-pressed="mixed">Partly</button>
        <button aria-expanded="false" aria-pressed="false">Off</button>
        <div role="tablist"><div role="tab" aria-selected="true">Tab</div><div role="tab">Other</div></div>
        <div role="treeitem" aria-level="2" aria-expanded="true" aria-selected="true" aria-checked="true" aria-disabled="true">Item</div>
      `)).toBe(unindent(`
        - checkbox
        - checkbox [checked] [disabled]
        - button "Toggle" [expanded] [pressed]
        - button "Partly" [pressed=mixed]
        - button "Off"
        - tablist:
          - tab "Tab" [selected]
          - tab "Other"
        - treeitem "Item" [checked] [disabled] [expanded] [level=2] [selected]
      `));
      const checkbox = container.querySelector<HTMLInputElement>('#mixed')!;
      checkbox.indeterminate = true;
      expect(generator.generate(checkbox, { refs: false }).text).toBe('- checkbox [checked=mixed]');
    });

    testIf(isNativeDom(), 'should keep the states that apply to a node in the tree, including false ones', () => {
      container.innerHTML = '<button>Plain</button><h4>Heading</h4><p>Text</p>';
      const [button, heading, paragraph] = generator.generate(container, { refs: false }).root.children;
      expect(button).toEqual({ role: 'button', name: 'Plain', disabled: false, pressed: false, children: [] });
      expect(heading).toEqual({ role: 'heading', name: 'Heading', level: 4, children: [] });
      expect(paragraph).toEqual({ role: 'paragraph', name: '', children: ['Text'] });
    });

    testIf(isNativeDom(), 'should show the URL of links, shortening data URLs', () => {
      expect(snapshotText('<a href="/auth?r=/">Log in</a><a href="data:text/plain;base64,SGVsbG8=">Data</a><a href="data:nocomma">Odd</a><a>No href</a>')).toBe(unindent(`
        - link "Log in":
          - /url: /auth?r=/
        - link "Data":
          - /url: data:text/plain;base64,${String.fromCharCode(0x2026)}
        - link "Odd":
          - /url: data:nocomma
        - text: No href
      `));
    });

    testIf(isNativeDom(), 'should show the placeholder of a text box when it differs from the name', () => {
      expect(snapshotText('<input placeholder="Placeholder"><input placeholder="Placeholder" aria-label="Label" value="typed">')).toBe(unindent(`
        - textbox "Placeholder"
        - textbox "Label":
          - /placeholder: Placeholder
          - text: typed
      `));
    });

    testIf(isNativeDom(), 'should leave out a name too long for a YAML key', () => {
      const long = 'a'.repeat(1000);
      expect(snapshotText(`<a href="about:blank"><div role="region">${long}</div></a>`)).toBe(unindent(`
        - link:
          - /url: about:blank
          - region: ${long}
      `));
    });
  });

  describe('refs', () => {
    testIf(isNativeDom(), 'should give each node a ref and return the elements in document order', () => {
      container.innerHTML = '<h1>Title</h1><div><button>Go</button></div><iframe></iframe>';
      const snapshot = generator.generate(container);
      const [heading, button, frame] = snapshot.references;
      expect(snapshot.text).toBe(unindent(`
        - heading "Title" [level=1] [ref=${heading.ref}]
        - button "Go" [ref=${button.ref}]
        - iframe [ref=${frame.ref}]
      `));
      expect(snapshot.references.map((reference) => reference.element)).toEqual([
        container.querySelector('h1'), container.querySelector('button'), container.querySelector('iframe'),
      ]);
      expect(new Set(snapshot.references.map((reference) => reference.ref)).size).toBe(3);
    });

    testIf(isNativeDom(), 'should keep an element\'s ref across snapshots, and give new elements new refs', () => {
      container.innerHTML = '<button>One</button>';
      const first = generator.generate(container).references[0];
      container.insertAdjacentHTML('afterbegin', '<button>Zero</button>');
      container.querySelector('button + button')!.textContent = 'Renamed';
      const [added, kept] = generator.generate(container).references;
      expect(kept).toEqual(first);
      expect(added.ref).not.toBe(first.ref);
    });

    testIf(isNativeDom(), 'should put a prefix before refs', () => {
      container.innerHTML = '<button>Go</button>';
      const [reference] = generator.generate(container, { refPrefix: 'f1' }).references;
      expect(reference.ref).toMatch(/^f1e\d+$/);
      expect(generator.generate(container).references[0].ref).toBe(reference.ref.slice(2));
    });

    testIf(isNativeDom(), 'should give no refs when asked', () => {
      container.innerHTML = '<button>Go</button>';
      const snapshot = generator.generate(container, { refs: false });
      expect(snapshot.references).toEqual([]);
      expect(snapshot.root.children[0]).not.toHaveProperty('ref');
    });
  });

  describe('YAML quoting', () => {
    testIf(isNativeDom(), 'should quote text that YAML would misread', () => {
      expect(snapshotText(`
        <div>@hello</div><div>]hello</div><div>#hello</div><div>[Select all]</div><div>one:</div><div>a {b}</div>
        <div>False</div><div>yes</div><div>N</div><div>Off</div><div>NULL</div><div>123</div><div>-1.2</div><div>-</div>
        <div>"two</div><div>'three</div><div>\`four</div><div>a #b</div><div>a: b</div><div>plain text</div>
      `)).toBe(unindent(`
        - text: "@hello ]hello #hello [Select all] one: a {b} False yes N Off NULL 123 -1.2 - \\"two 'three \`four a #b a: b plain text"
      `));
    });

    testIf(isNativeDom(), 'should quote each text and URL that needs it', () => {
      expect(snapshotText('<p>yes</p><p>123</p><p>-</p><p>#tag</p><p>plain</p><a href="#">Top</a>')).toBe(unindent(`
        - paragraph: "yes"
        - paragraph: "123"
        - paragraph: "-"
        - paragraph: "#tag"
        - paragraph: plain
        - link "Top":
          - /url: "#"
      `));
    });

    testIf(isNativeDom(), 'should quote names inside the key, and quote keys that YAML would misread', () => {
      expect(snapshotText('<a href="/">/</a><button>/docs/</button><button>a: b</button><button>it\'s: here</button>')).toBe(unindent(`
        - link "/":
          - /url: /
        - button "/docs/"
        - 'button "a: b"'
        - 'button "it''s: here"'
      `));
    });
  });
});

describe('AriaSnapshotRenderer', () => {
  const renderer = new AriaSnapshotRenderer();

  test('should render a node that is not a fragment as the only node', () => {
    expect(renderer.render({ role: 'button', name: 'Go', children: [] })).toBe('- button "Go"');
  });

  test('should escape control characters and line breaks in quoted values', () => {
    const value = ['a\\b"c', String.fromCharCode(8), String.fromCharCode(12), '\n', '\r', '\t', String.fromCharCode(1)].join('');
    expect(renderer.render({ role: 'textbox', name: '', placeholder: value, children: [] })).toBe([
      '- textbox:',
      '  - /placeholder: "a\\\\b\\"c\\b\\f\\n\\r\\t\\x01"',
    ].join('\n'));
  });

  test('should render empty text as quoted', () => {
    expect(renderer.render({ role: 'fragment', name: '', children: [''] })).toBe('- text: ""');
  });
});
