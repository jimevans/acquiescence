import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import DomSnapshotGenerator from '../domSnapshotGenerator';
import type { DomNodeSnapshot, ElementSnapshot } from '../domSnapshotGenerator';
import { isNativeDom, testIf } from './testUtilities';

describe('DomSnapshotGenerator', () => {
  let generator: DomSnapshotGenerator;
  let container: HTMLElement;

  beforeEach(() => {
    generator = new DomSnapshotGenerator();
    container = document.createElement('div');
    container.id = 'snapshot-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  // A document of its own, so that the snapshot holds only the markup given.
  const newDocument = (html: string): Document => {
    const created = document.implementation.createHTMLDocument('');
    created.documentElement.innerHTML = html;
    return created;
  };

  const children = (snapshot: DomNodeSnapshot): DomNodeSnapshot[] => typeof snapshot === 'string' ? [] : snapshot.slice(2) as DomNodeSnapshot[];

  const attributesOf = (snapshot: DomNodeSnapshot): Record<string, string> => typeof snapshot === 'string' ? {} : (snapshot[1] ?? {});

  // Finds the element snapshot with an id, depth first.
  const findById = (snapshot: DomNodeSnapshot, id: string): ElementSnapshot | undefined => {
    if (typeof snapshot === 'string') {
      return undefined;
    }

    if (attributesOf(snapshot).id === id) {
      return snapshot as ElementSnapshot;
    }

    for (const child of children(snapshot)) {
      const found = findById(child, id);
      if (found) {
        return found;
      }
    }

    return undefined;
  };

  // The snapshot of the container, with the markup given.
  const snapshotOf = (html: string): ElementSnapshot => {
    container.innerHTML = html;
    return findById(generator.generate(document).html, 'snapshot-container')!;
  };

  const bodyOf = (created: Document): ElementSnapshot => children(generator.generate(created).html).find((child) => Array.isArray(child) && child[0] === 'BODY') as ElementSnapshot;

  const headOf = (created: Document): ElementSnapshot => children(generator.generate(created).html).find((child) => Array.isArray(child) && child[0] === 'HEAD') as ElementSnapshot;

  describe('structure', () => {
    test('should describe the document, its URL, and its viewport', () => {
      const snapshot = generator.generate(document);

      expect(snapshot.html[0]).toBe('HTML');
      expect(snapshot.url).toBe(document.URL);
      expect(snapshot.viewport).toEqual({ width: window.innerWidth, height: window.innerHeight });
      expect(snapshot.wallTime).toBeGreaterThan(0);
      expect(snapshot.collectionTime).toBeGreaterThanOrEqual(0);
    });

    test('should give the doctype name, if the document has one', () => {
      const withDoctype = document.implementation.createHTMLDocument('');
      const withoutDoctype = newDocument('<body></body>');
      withoutDoctype.doctype!.remove();

      expect(generator.generate(withDoctype).doctype).toBe('html');
      expect(generator.generate(withoutDoctype).doctype).toBeUndefined();
    });

    test('should give an empty document element and viewport for a document without them', () => {
      const empty = document.implementation.createDocument(null, null);

      const snapshot = generator.generate(empty);

      expect(snapshot.html).toEqual(['HTML']);
      expect(snapshot.viewport).toEqual({ width: 0, height: 0 });
    });

    test('should give elements their names, attributes, and children, and text as strings', () => {
      expect(snapshotOf('<p class="lead">Hello, <b>world</b><br></p><!-- note -->')).toEqual(
        ['DIV', { id: 'snapshot-container' }, ['P', { class: 'lead' }, 'Hello, ', ['B', {}, 'world'], ['BR']]],
      );
    });

    test('should keep the case of element names outside HTML', () => {
      const svg = snapshotOf('<svg><foreignObject></foreignObject></svg>');

      expect(children(svg)).toEqual([['svg', {}, ['foreignObject']]]);
    });

    test('should put a base element with the document base URL first in the head', () => {
      const created = newDocument('<head><title>Title</title></head><body></body>');

      expect(children(headOf(created))).toEqual([['BASE', { href: created.baseURI }], ['TITLE', {}, 'Title']]);
    });
  });

  describe('left out', () => {
    test('should leave out scripts and noscript content', () => {
      expect(children(snapshotOf('<script>window.x = 1;</script><noscript>Enable scripts</noscript><p></p>'))).toEqual([['P']]);
    });

    test('should leave out preloads and prefetches, but not stylesheets', () => {
      const head = headOf(newDocument('<head><link rel="preload" href="a.css"><link rel="dns-prefetch PREFETCH" href="b.css"><link rel="stylesheet" href="c.css"><link href="d.css"></head>'));

      expect(children(head).slice(1)).toEqual([['LINK', { rel: 'stylesheet', href: 'c.css' }], ['LINK', { href: 'd.css' }]]);
    });

    test('should leave out meta directives that act on the page', () => {
      const head = headOf(newDocument(`<head>
        <meta http-equiv="refresh" content="0;url=https://example.com/">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'">
        <meta http-equiv="set-cookie" content="a=b">
        <meta name="viewport" content="width=device-width">
      </head>`));

      expect(children(head).filter((child) => typeof child !== 'string').slice(1)).toEqual([['META', { name: 'viewport', content: 'width=device-width' }]]);
    });

    test('should leave out frames in the head, but not in the body', () => {
      const created = newDocument('<head></head><body><iframe id="shown"></iframe></body>');
      created.head.appendChild(created.createElement('iframe'));

      expect(children(headOf(created))).toHaveLength(1);
      expect(findById(bodyOf(created), 'shown')).toBeDefined();
    });

    test('should leave out comments and processing instructions', () => {
      const created = newDocument('<body><!-- comment --></body>');

      expect(bodyOf(created)).toEqual(['BODY']);
    });
  });

  describe('attributes', () => {
    test('should empty event handler attributes', () => {
      expect(children(snapshotOf('<button onclick="steal()" type="button">Go</button>'))).toEqual([['BUTTON', { onclick: '', type: 'button' }, 'Go']]);
    });

    test('should empty script URLs of images and links, and keep others', () => {
      const created = newDocument('<head><link rel="stylesheet" href="javascript:alert(1)"><link rel="stylesheet" href="site.css"></head><body><img src=" VBScript:x"><a href="javascript:void(0)">x</a></body>');

      expect(attributesOf(children(headOf(created))[1]).href).toBe('');
      expect(attributesOf(children(headOf(created))[2]).href).toBe('site.css');
      const body = children(bodyOf(created));
      expect(attributesOf(body[0]).src).toBe('');
      expect(attributesOf(body[1]).href).toBe('javascript:void(0)');
    });

    test('should empty script URLs in source sets, keeping their descriptors', () => {
      const body = children(bodyOf(newDocument('<img srcset="small.png 1x, javascript:x 2x,large.png"><picture><source srcset="wide.png 800w, vbscript:y"></picture>')));

      expect(attributesOf(body[0]).srcset).toBe('small.png 1x,  2x, large.png');
      expect(attributesOf(children(body[1])[0]).srcset).toBe('wide.png 800w, ');
    });

    test('should leave out link integrity, dialog open, and frame sources', () => {
      const created = newDocument('<head><link rel="stylesheet" href="a.css" integrity="sha384-x"></head><body><dialog open id="d"></dialog><iframe id="i" src="a.html" srcdoc="<p>" sandbox name="n"></iframe><frameset><frame id="f" src="b.html"></frameset></body>');
      const frameset = newDocument('<frameset><frame id="f" src="b.html"></frameset>');

      expect(attributesOf(children(headOf(created))[1])).toEqual({ rel: 'stylesheet', href: 'a.css' });
      const body = bodyOf(created);
      expect(attributesOf(findById(body, 'd')!).open).toBeUndefined();
      expect(attributesOf(findById(body, 'i')!)).toMatchObject({ id: 'i', name: 'n', src: '' });
      expect(attributesOf(findById(body, 'i')!).srcdoc).toBeUndefined();
      expect(attributesOf(findById(body, 'i')!).sandbox).toBeUndefined();
      expect(attributesOf(findById(generator.generate(frameset).html, 'f')!)).toMatchObject({ id: 'f', src: '' });
    });

    test('should give frames the source the options give', () => {
      const created = newDocument('<body><iframe id="first"></iframe><iframe id="second"></iframe></body>');

      const body = bodyOf(created);
      const withSources = generator.generate(created, { frameSource: (frame) => `/snapshot/${frame.id}` }).html;

      expect(attributesOf(findById(body, 'first')!).src).toBe('');
      expect(attributesOf(findById(withSources, 'first')!).src).toBe('/snapshot/first');
      expect(attributesOf(findById(withSources, 'second')!).src).toBe('/snapshot/second');
    });

    test('should show the snapshot as UTF-8', () => {
      const head = children(headOf(newDocument(`<head>
        <meta charset="windows-1252">
        <meta http-equiv="Content-Type" content="text/html; charset=windows-1252; x=y">
        <meta http-equiv="content-type" content="text/html">
        <meta http-equiv="content-language" content="charset=fr">
        <meta name="description" content="charset=fr">
      </head>`))).filter((child) => typeof child !== 'string').slice(1);

      expect(head.map((meta) => attributesOf(meta).charset ?? attributesOf(meta).content)).toEqual([
        'utf-8',
        'text/html; charset=utf-8; x=y',
        'text/html',
        'charset=fr',
        'charset=fr',
      ]);
    });
  });

  describe('state', () => {
    test('should record the values of inputs and text areas', () => {
      container.innerHTML = '<input id="text" value="initial"><textarea id="area">initial</textarea>';
      container.querySelector<HTMLInputElement>('#text')!.value = 'typed';
      container.querySelector<HTMLTextAreaElement>('#area')!.value = 'typed too';

      const snapshot = generator.generate(document).html;

      expect(attributesOf(findById(snapshot, 'text')!)).toMatchObject({ __playwright_value_: 'typed', value: 'initial' });
      expect(attributesOf(findById(snapshot, 'area')!).__playwright_value_).toBe('typed too');
    });

    test('should record whether checkboxes, radio buttons, and options are checked or selected', () => {
      container.innerHTML = '<input id="check" type="checkbox"><input id="radio" type="radio" checked><input id="text" type="text"><select><option id="one">1</option><option id="two">2</option></select>';
      container.querySelector<HTMLInputElement>('#check')!.checked = true;
      container.querySelector<HTMLOptionElement>('#two')!.selected = true;

      const snapshot = generator.generate(document).html;

      expect(attributesOf(findById(snapshot, 'check')!).__playwright_checked_).toBe('true');
      expect(attributesOf(findById(snapshot, 'radio')!).__playwright_checked_).toBe('true');
      expect(attributesOf(findById(snapshot, 'text')!).__playwright_checked_).toBeUndefined();
      expect(attributesOf(findById(snapshot, 'one')!).__playwright_selected_).toBe('false');
      expect(attributesOf(findById(snapshot, 'two')!).__playwright_selected_).toBe('true');
    });

    test('should mark the target, and only the target', () => {
      container.innerHTML = '<button id="target">Save</button><button id="other">Cancel</button>';

      const snapshot = generator.generate(document, { target: container.querySelector('#target')! }).html;

      expect(attributesOf(findById(snapshot, 'target')!).__playwright_target__).toBe('');
      expect(attributesOf(findById(snapshot, 'other')!).__playwright_target__).toBeUndefined();
    });

    test('should name the defined custom elements on the body', () => {
      if (!customElements.get('snapshot-defined')) {
        customElements.define('snapshot-defined', class extends HTMLElement {});
      }

      container.innerHTML = '<snapshot-defined></snapshot-defined><snapshot-defined></snapshot-defined><snapshot-undefined></snapshot-undefined>';

      const body = children(generator.generate(document).html).find((child) => Array.isArray(child) && child[0] === 'BODY')!;

      expect(attributesOf(body).__playwright_custom_elements__).toBe('snapshot-defined');
      expect(bodyOf(newDocument('<body><p></p></body>'))).toEqual(['BODY', {}, ['P']]);
    });

    test('should record the bounds of canvases and frames', () => {
      const canvas = children(snapshotOf('<canvas></canvas>'))[0];
      const rect = container.querySelector('canvas')!.getBoundingClientRect();

      expect(JSON.parse(attributesOf(canvas).__playwright_bounding_rect__)).toEqual({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
    });

    test('should record the source an image shows, but not a picture', () => {
      const body = children(bodyOf(newDocument('<img><picture></picture>')));

      expect(attributesOf(body[0]).__playwright_current_src__).toBe('');
      expect(attributesOf(body[1]).__playwright_current_src__).toBe('');
    });

    testIf(isNativeDom(), 'should record the source an image chose', async () => {
      container.innerHTML = '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">';
      await container.querySelector('img')!.decode().catch(() => undefined);

      const image = children(findById(generator.generate(document).html, 'snapshot-container')!)[0];

      expect(attributesOf(image).__playwright_current_src__).toBe('data:image/gif;base64,R0lGODlhAQABAAAAACw=');
    });

    testIf(isNativeDom(), 'should record scroll offsets', () => {
      container.innerHTML = '<div id="scroller" style="width: 50px; height: 50px; overflow: scroll"><div style="width: 500px; height: 500px"></div></div><div id="still"></div>';
      const scroller = container.querySelector('#scroller')!;
      scroller.scrollTop = 20;
      scroller.scrollLeft = 30;

      const snapshot = generator.generate(document).html;

      expect(attributesOf(findById(snapshot, 'scroller')!)).toMatchObject({ __playwright_scroll_top_: '20', __playwright_scroll_left_: '30' });
      expect(attributesOf(findById(snapshot, 'still')!).__playwright_scroll_top_).toBeUndefined();
    });

    testIf(isNativeDom(), 'should record open popovers', () => {
      container.innerHTML = '<div id="open" popover>Open</div><div id="closed" popover>Closed</div>';
      container.querySelector<HTMLElement>('#open')!.showPopover();

      const snapshot = generator.generate(document).html;
      container.querySelector<HTMLElement>('#open')!.hidePopover();

      expect(attributesOf(findById(snapshot, 'open')!).__playwright_popover_open_).toBe('true');
      expect(attributesOf(findById(snapshot, 'closed')!).__playwright_popover_open_).toBeUndefined();
    });

    testIf(isNativeDom(), 'should record open dialogs, and whether they are modal', () => {
      container.innerHTML = '<dialog id="modal"></dialog><dialog id="shown"></dialog><dialog id="closed"></dialog>';
      container.querySelector<HTMLDialogElement>('#modal')!.showModal();
      container.querySelector<HTMLDialogElement>('#shown')!.show();

      const snapshot = generator.generate(document).html;
      container.querySelector<HTMLDialogElement>('#modal')!.close();

      expect(attributesOf(findById(snapshot, 'modal')!).__playwright_dialog_open_).toBe('modal');
      expect(attributesOf(findById(snapshot, 'shown')!).__playwright_dialog_open_).toBe('true');
      expect(attributesOf(findById(snapshot, 'closed')!).__playwright_dialog_open_).toBeUndefined();
    });
  });

  describe('style', () => {
    test('should keep the text and attributes of style elements', () => {
      expect(children(snapshotOf('<style media="print">p { color: red; }</style>'))).toEqual([['STYLE', { media: 'print' }, 'p { color: red; }']]);
    });

    test('should give the rules of a style element that script filled', () => {
      container.innerHTML = '<style id="filled"></style><style id="empty"></style>';
      const sheet = container.querySelector<HTMLStyleElement>('#filled')!.sheet!;
      sheet.insertRule('p { color: red; }');
      sheet.insertRule('b { color: blue; }', 1);

      const snapshot = generator.generate(document).html;

      expect(findById(snapshot, 'filled')![2]).toBe('p { color: red; }\nb { color: blue; }');
      expect(findById(snapshot, 'empty')![2]).toBe('');
    });

    test('should give a disabled style element no text', () => {
      container.innerHTML = '<style id="disabled">p { color: red; }</style>';
      container.querySelector<HTMLStyleElement>('#disabled')!.sheet!.disabled = true;

      expect(findById(generator.generate(document).html, 'disabled')![2]).toBe('');
    });

    test('should keep the text of a style element without a sheet', () => {
      container.innerHTML = '<style id="template" type="text/x-template"></style>';

      expect(findById(generator.generate(document).html, 'template')![2]).toBe('');
    });

    testIf(isNativeDom(), 'should add the stylesheets a document or shadow root adopted', () => {
      const adopted = new CSSStyleSheet();
      adopted.replaceSync('p { color: red; }');
      const disabled = new CSSStyleSheet();
      disabled.replaceSync('p { color: blue; }');
      disabled.disabled = true;
      container.innerHTML = '<div id="host"></div>';
      const shadowRoot = container.querySelector('#host')!.attachShadow({ mode: 'open' });
      shadowRoot.adoptedStyleSheets = [adopted];
      document.adoptedStyleSheets = [adopted, disabled];

      const snapshot = generator.generate(document).html;
      document.adoptedStyleSheets = [];

      expect(children(snapshot).slice(-2)).toEqual([
        ['template', { __playwright_style_sheet_: 'p { color: red; }' }],
        ['template', { __playwright_style_sheet_: '' }],
      ]);
      expect(children(findById(snapshot, 'host')!)).toEqual([
        ['template', { __playwright_shadow_root_: 'open' }, ['template', { __playwright_style_sheet_: 'p { color: red; }' }]],
      ]);
    });
  });

  describe('shadow roots', () => {
    test('should put an open shadow root first among its host children', () => {
      container.innerHTML = '<div id="host"><span>light</span></div>';
      const shadowRoot = container.querySelector('#host')!.attachShadow({ mode: 'open' });
      shadowRoot.innerHTML = '<b>shadow</b><slot></slot>';

      expect(children(findById(generator.generate(document).html, 'host')!)).toEqual([
        ['template', { __playwright_shadow_root_: 'open' }, ['B', {}, 'shadow'], ['SLOT']],
        ['SPAN', {}, 'light'],
      ]);
    });

    test('should leave out a closed shadow root', () => {
      container.innerHTML = '<div id="host"><span>light</span></div>';
      container.querySelector('#host')!.attachShadow({ mode: 'closed' }).innerHTML = '<b>shadow</b>';

      expect(children(findById(generator.generate(document).html, 'host')!)).toEqual([['SPAN', {}, 'light']]);
    });
  });
});
