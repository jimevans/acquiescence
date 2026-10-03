import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import AccessibleNameCalculator from '../accessibleNameCalculator';
import { isNativeDom, testIf } from './testUtilities';

// Accessible names depend on rendering (visibility, display, and pseudo-element content), which jsdom does not
// provide, so most of these tests run only in a browser.
describe('AccessibleNameCalculator', () => {
  let calculator: AccessibleNameCalculator;
  let container: HTMLElement;

  beforeEach(() => {
    calculator = new AccessibleNameCalculator();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  const render = (html: string): void => {
    container.innerHTML = html;
  };

  const query = (selector: string): Element => {
    const element = container.querySelector(selector);
    if (!element) {
      throw new Error(`No element matches ${selector}`);
    }
    return element;
  };

  const nameOf = (selector: string, includeHidden = false): string => calculator.getAccessibleName(query(selector), includeHidden);

  const descriptionOf = (selector: string, includeHidden = false): string => calculator.getAccessibleDescription(query(selector), includeHidden);

  const attachShadow = (host: Element, html: string): ShadowRoot => {
    const shadowRoot = host.attachShadow({ mode: 'open' });
    shadowRoot.innerHTML = html;
    return shadowRoot;
  };

  describe('aria-label and aria-labelledby', () => {
    testIf(isNativeDom(), 'should use aria-label', () => {
      render('<button aria-label="Close">X</button>');
      expect(nameOf('button')).toBe('Close');
    });

    testIf(isNativeDom(), 'should ignore an aria-label that is only white space', () => {
      render('<button aria-label="  ">Save</button>');
      expect(nameOf('button')).toBe('Save');
    });

    testIf(isNativeDom(), 'should prefer aria-labelledby, joining the referenced elements in order', () => {
      render('<span id="first">Hello</span><span id="second">world</span><button aria-labelledby="second first" aria-label="Ignored">X</button>');
      expect(nameOf('button')).toBe('world Hello');
    });

    testIf(isNativeDom(), 'should combine an element\'s own aria-label with the elements it is labelled by', () => {
      // https://w3c.github.io/accname/#example-5-0
      render(`
        <a id="file" href="#">Documentation.pdf</a>
        <span role="button" tabindex="0" id="delete" aria-label="Delete" aria-labelledby="delete file"></span>
      `);
      expect(nameOf('#delete')).toBe('Delete Documentation.pdf');
    });

    testIf(isNativeDom(), 'should ignore aria-labelledby that refers to no element', () => {
      render('<label><span>Text here</span><input type="text" aria-labelledby="does-not-exist"></label>');
      expect(nameOf('input')).toBe('Text here');
    });

    testIf(isNativeDom(), 'should fall back when the referenced elements have no text', () => {
      render('<span id="empty"></span><button aria-labelledby="empty">Save</button>');
      expect(nameOf('button')).toBe('Save');
    });

    testIf(isNativeDom(), 'should not follow aria-labelledby within an aria-labelledby traversal', () => {
      render(`
        <span id="outer" aria-labelledby="inner">Outer</span>
        <span id="inner">Inner</span>
        <button aria-labelledby="outer"></button>
      `);
      expect(nameOf('button')).toBe('Outer');
    });

    testIf(isNativeDom(), 'should use the content of hidden referenced elements', () => {
      render('<span id="label" hidden>Hidden <b>label</b></span><button aria-labelledby="label"></button>');
      expect(nameOf('button')).toBe('Hidden label');
    });

    testIf(isNativeDom(), 'should use the content of an aria-hidden referenced element that slots its content', () => {
      render(`
        <button aria-labelledby="tip"></button>
        <span id="tip" aria-hidden="true">Label1</span>
        <label for="second" aria-hidden="true"><div id="slotted">Label2</div></label>
        <button id="second"></button>
      `);
      attachShadow(query('#tip'), '<slot></slot>');
      attachShadow(query('#slotted'), '<slot></slot>');
      expect(nameOf('button')).toBe('Label1');
      expect(nameOf('#second')).toBe('Label2');
    });

    testIf(isNativeDom(), 'should skip hidden content within a visible referenced element', () => {
      render('<span id="label">Visible <span hidden>hidden</span></span><button aria-labelledby="label"></button>');
      expect(nameOf('button')).toBe('Visible');
    });

    testIf(isNativeDom(), 'should ignore a style sheet within a hidden referenced element', () => {
      render('<div id="label" style="display: none"></div><input type="text" aria-labelledby="label">');
      attachShadow(query('#label'), '<style>span { color: red; }</style><span>hello</span>');
      expect(nameOf('input')).toBe('hello');
    });

    testIf(isNativeDom(), 'should not visit an element twice', () => {
      render('<div role="button" id="loop" aria-owns="loop">Text</div>');
      expect(nameOf('#loop')).toBe('Text');
    });
  });

  describe('naming from content', () => {
    testIf(isNativeDom(), 'should name a button, a link, and a heading from their content', () => {
      render('<button>Save</button><a href="#">Home</a><h2>Title</h2>');
      expect(nameOf('button')).toBe('Save');
      expect(nameOf('a')).toBe('Home');
      expect(nameOf('h2')).toBe('Title');
    });

    testIf(isNativeDom(), 'should not name roles that only take a name from an author', () => {
      render('<nav>Links</nav><div role="list">Items</div>');
      expect(nameOf('nav')).toBe('');
      expect(nameOf('[role="list"]')).toBe('');
    });

    testIf(isNativeDom(), 'should not name an element whose role prohibits a name', () => {
      render('<p aria-label="Ignored">Text</p>');
      expect(nameOf('p')).toBe('');
    });

    testIf(isNativeDom(), 'should collapse white space, and remove soft hyphens and zero-width spaces', () => {
      render('<button>  one\n\ttwo  1\u00ad2\u200b3  </button>');
      expect(nameOf('button')).toBe('one two 123');
    });

    testIf(isNativeDom(), 'should keep non-breaking spaces', () => {
      render('<button>a\u00a0 b</button>');
      expect(nameOf('button')).toBe('a\u00a0 b');
    });

    testIf(isNativeDom(), 'should separate block elements and line breaks with spaces, but not inline elements', () => {
      render('<button><div>one</div><div>two</div>th<b>re</b>e<br>four</button>');
      expect(nameOf('button')).toBe('one two three four');
    });

    testIf(isNativeDom(), 'should use the content of descendants whose roles contribute only within a name', () => {
      render('<a href="#"><ul><li>Item</li></ul><p>Paragraph</p></a>');
      expect(nameOf('a')).toBe('Item Paragraph');
    });

    testIf(isNativeDom(), 'should not use the content of descendants whose roles do not contribute', () => {
      render('<a href="#">Go <span role="navigation">nowhere</span></a>');
      expect(nameOf('a')).toBe('Go');
    });

    testIf(isNativeDom(), 'should skip script, style, and hidden descendants, and comments', () => {
      render('<button>Visible<script>1</script><style>b {}</style><span style="display: none">none</span><span style="visibility: hidden">hidden</span><!-- comment --></button>');
      expect(nameOf('button')).toBe('Visible');
    });

    testIf(isNativeDom(), 'should include hidden content when asked', () => {
      render('<button>Visible <span hidden>Hidden</span></button>');
      expect(nameOf('button', true)).toBe('Visible Hidden');
    });

    testIf(isNativeDom(), 'should not use the names of nested tree items', () => {
      render(`
        <div role="treeitem" id="target">
          <span>Top-level</span>
          <div role="group">
            <div role="treeitem"><span>Nested 1</span></div>
          </div>
        </div>
      `);
      expect(nameOf('#target')).toBe('Top-level');
    });

    testIf(isNativeDom(), 'should use the content of elements owned through aria-owns', () => {
      render('<button aria-owns="owned">Own</button><span id="owned">ed</span>');
      expect(nameOf('button')).toBe('Owned');
    });

    testIf(isNativeDom(), 'should name a summary from its content unless it is presentational', () => {
      render('<details><summary>More</summary></details><details><summary role="none" id="none">Less</summary></details>');
      expect(nameOf('summary')).toBe('More');
      expect(nameOf('#none')).toBe('');
    });

    testIf(isNativeDom(), 'should fall back to the title when the content is only white space', () => {
      render('<button title="Tooltip">   </button>');
      expect(nameOf('button')).toBe('Tooltip');
    });

    testIf(isNativeDom(), 'should use the title of an element that cannot be named from content', () => {
      render('<nav title="Main">Links</nav><nav title="  ">Links</nav>');
      expect(nameOf('nav')).toBe('Main');
      expect(nameOf('nav[title="  "]')).toBe('');
    });

    testIf(isNativeDom(), 'should use the title of a presentational frame within a name, but not of other presentational elements', () => {
      render('<button id="inline">Go <iframe role="presentation" title="Frame"></iframe><span role="presentation" title="Span"></span></button><button id="old">Go </button>');
      const frame = document.createElement('frame');
      frame.setAttribute('role', 'presentation');
      frame.setAttribute('title', 'Old frame');
      query('#old').appendChild(frame);
      expect(nameOf('#inline')).toBe('Go Frame');
      expect(nameOf('#old')).toBe('Go Old frame');
    });

    testIf(isNativeDom(), 'should name an element whose display is contents', () => {
      render('<button style="display: contents">yo</button>');
      expect(nameOf('button')).toBe('yo');
    });
  });

  describe('shadow DOM and slots', () => {
    testIf(isNativeDom(), 'should use the content of a shadow root', () => {
      render('<div role="button"></div>');
      attachShadow(query('div'), '<span>Shadow</span>');
      expect(nameOf('div')).toBe('Shadow');
    });

    testIf(isNativeDom(), 'should not use slotted text twice', () => {
      render('<button><div>foo</div></button>');
      attachShadow(query('div'), '<slot></slot>');
      expect(nameOf('button')).toBe('foo');
    });

    testIf(isNativeDom(), 'should use the nodes assigned to a slot rather than its fallback content', () => {
      render('<div>foo</div>');
      const shadowRoot = attachShadow(query('div'), '<button><slot><span>pre</span></slot></button>');
      expect(calculator.getAccessibleName(shadowRoot.querySelector('button')!)).toBe('foo');
    });

    testIf(isNativeDom(), 'should use a slot\'s fallback content when nothing is assigned to it', () => {
      render('<div></div>');
      const shadowRoot = attachShadow(query('div'), '<button><slot><span>pre</span></slot></button>');
      expect(calculator.getAccessibleName(shadowRoot.querySelector('button')!)).toBe('pre');
    });
  });

  describe('CSS generated content', () => {
    const style = (css: string) => `<style>${css}</style>`;

    testIf(isNativeDom(), 'should include ::before and ::after content', () => {
      render(style('.decorated::before { content: "Hello "; } .decorated::after { content: "!"; }') + '<button class="decorated">world</button>');
      expect(nameOf('button')).toBe('Hello world!');
    });

    testIf(isNativeDom(), 'should separate pseudo-element content that is not inline with spaces', () => {
      render(style('.block::before { content: "Hello"; display: block; }') + '<button class="block">world</button>');
      expect(nameOf('button')).toBe('Hello world');
    });

    testIf(isNativeDom(), 'should not include hidden pseudo-element content', () => {
      render(style('span::before { content: "world"; display: none; } div::after { content: "bye"; visibility: hidden; }') +
        '<a href="#"><span>hello</span><div>hello</div></a>');
      expect(nameOf('a')).toBe('hello hello');
    });

    testIf(isNativeDom(), 'should resolve attr() in pseudo-element content', () => {
      render(style('.stars::before { display: block; content: attr(data-hello); } .missing::after { content: attr(data-missing) "x"; }') +
        '<a href="#"><div class="stars" data-hello="hello">world</div></a><button class="missing">y</button>');
      expect(nameOf('a')).toBe('hello world');
      expect(nameOf('button')).toBe('yx');
    });

    testIf(isNativeDom(), 'should resolve escapes in pseudo-element content', () => {
      render(style('.escaped::before { content: "\\"quoted\\" a\\A b"; }') + '<button class="escaped"></button>');
      expect(nameOf('button')).toBe('"quoted" a b');
    });

    testIf(isNativeDom(), 'should use the alternative text of pseudo-element content', () => {
      render(style('.alt::before { content: url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'></svg>") / "alternative text"; } ' +
        '.gradient::before { content: linear-gradient(red, blue) / "gradient"; }') +
        '<div role="button" class="alt"> inner text</div><div role="button" class="gradient">!</div>');
      expect(nameOf('.alt')).toBe('alternative text inner text');
      expect(nameOf('.gradient')).toBe('gradient!');
    });

    testIf(isNativeDom(), 'should ignore pseudo-element content that is not text', () => {
      render(style('.quote::before { content: open-quote; } .mixed::before { content: open-quote "x"; } .image::before { content: url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'></svg>"); }') +
        '<button class="quote">Q</button><button class="mixed">M</button><button class="image">I</button>');
      expect(nameOf('.quote')).toBe('Q');
      expect(nameOf('.mixed')).toBe('M');
      expect(nameOf('.image')).toBe('I');
    });

    testIf(isNativeDom(), 'should replace an element\'s content with the alternative text of its content property', () => {
      render(style('.with-alt { content: url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'></svg>") / "alternative text"; } ' +
        '.without-alt { content: url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'></svg>"); }') +
        '<div id="first" role="button" class="with-alt">inner text</div><div id="second" role="button" class="without-alt">inner text</div>');
      expect(nameOf('#first')).toBe('alternative text');
      expect(nameOf('#second')).toBe('inner text');
    });
  });

  describe('native host language names', () => {
    testIf(isNativeDom(), 'should name text inputs from labels, then title, then placeholder', () => {
      render(`
        <label for="text1">TEXT1</label><input id="text1" type="text">
        <input id="text2" type="text" title="TEXT2" placeholder="Ignored">
        <input id="text3" type="text" placeholder="TEXT3">
        <input id="number1" type="number" placeholder="NUMBER1">
        <textarea id="area1" placeholder="AREA1"></textarea>
        <input id="checkbox1" type="checkbox" placeholder="Ignored">
        <input id="checkbox2" type="checkbox" title="CHECKBOX2">
        <input id="plain" type="text">
      `);
      expect(nameOf('#text1')).toBe('TEXT1');
      expect(nameOf('#text2')).toBe('TEXT2');
      expect(nameOf('#text3')).toBe('TEXT3');
      expect(nameOf('#number1')).toBe('NUMBER1');
      expect(nameOf('#area1')).toBe('AREA1');
      expect(nameOf('#checkbox1')).toBe('');
      expect(nameOf('#checkbox2')).toBe('CHECKBOX2');
      expect(nameOf('#plain')).toBe('');
    });

    testIf(isNativeDom(), 'should join the text of several labels, skipping empty ones', () => {
      render('<label for="field">First</label><label for="field"></label><label for="field">Second</label><input id="field">');
      expect(nameOf('input')).toBe('First Second');
    });

    testIf(isNativeDom(), 'should name button inputs from their value, type, or title', () => {
      render(`
        <input id="valued" type="button" value="Go">
        <input id="submit" type="submit">
        <input id="reset" type="reset">
        <input id="titled" type="button" title="Titled">
        <input id="blank" type="button" value="  ">
      `);
      expect(nameOf('#valued')).toBe('Go');
      expect(nameOf('#submit')).toBe('Submit');
      expect(nameOf('#reset')).toBe('Reset');
      expect(nameOf('#titled')).toBe('Titled');
      expect(nameOf('#blank')).toBe('');
    });

    testIf(isNativeDom(), 'should name file inputs from their labels or as their button', () => {
      render('<input id="file1" type="file" title="Ignored"><label for="file2">FILE2</label><input id="file2" type="file">');
      expect(nameOf('#file1')).toBe('Choose File');
      expect(nameOf('#file2')).toBe('FILE2');
    });

    testIf(isNativeDom(), 'should name image inputs from labels, then alt, then title, then as a submit button', () => {
      render(`
        <label for="image1">IMAGE1</label><input id="image1" type="image">
        <input id="image2" type="image" alt="IMAGE2">
        <label for="image3">IMAGE3</label><input id="image3" type="image" alt="MORE3">
        <input id="image4" type="image" title="IMAGE4">
        <input id="image5" type="image">
      `);
      expect(nameOf('#image1')).toBe('IMAGE1');
      expect(nameOf('#image2')).toBe('IMAGE2');
      expect(nameOf('#image3')).toBe('IMAGE3');
      expect(nameOf('#image4')).toBe('IMAGE4');
      expect(nameOf('#image5')).toBe('Submit');
    });

    testIf(isNativeDom(), 'should name buttons from labels, then content, then title', () => {
      render(`
        <label for="button1">BUTTON1</label><button id="button1" role="combobox">button</button>
        <button id="button2" role="combobox">BUTTON2</button>
        <button id="button3">BUTTON3</button>
        <button id="button4" title="BUTTON4"></button>
      `);
      expect(nameOf('#button1')).toBe('BUTTON1');
      expect(nameOf('#button2')).toBe('');
      expect(nameOf('#button3')).toBe('BUTTON3');
      expect(nameOf('#button4')).toBe('BUTTON4');
    });

    testIf(isNativeDom(), 'should name native controls with aria-labelledby as browsers do', () => {
      render(`
        <label id="for-text1">TEXT1</label><input aria-labelledby="for-text1" id="text1" type="text">
        <label id="for-text2">TEXT2</label><input aria-labelledby="for-text2 text2" id="text2" type="text">
        <label id="for-submit1" for="submit1">SUBMIT1</label><input aria-labelledby="for-submit1 submit1" id="submit1" type="submit">
        <label id="for-image1" for="image1">IMAGE1</label><input aria-labelledby="for-image1 image1" id="image1" type="image" alt="MORE1">
        <label id="for-image2" for="image2">IMAGE2</label><img aria-labelledby="for-image2 image2" id="image2" alt="MORE2" src="data:image/svg,<g></g>">
        <label id="for-file1" for="file1">FILE1</label><input aria-labelledby="for-file1 file1" id="file1" type="file">
        <label id="for-button1">BUTTON1</label><button aria-labelledby="for-button1" id="button1">MORE1</button>
        <label id="for-button2">BUTTON2</label><button aria-labelledby="for-button2 button2" id="button2">MORE2</button>
        <label id="for-button3" for="button3">BUTTON3</label><button aria-labelledby="for-button3 button3" id="button3">MORE3</button>
        <label id="for-textarea1" for="textarea1">TEXTAREA1</label><textarea aria-labelledby="for-textarea1 textarea1" id="textarea1" placeholder="MORE1">MORE2</textarea>
      `);
      expect(nameOf('#text1')).toBe('TEXT1');
      expect(nameOf('#text2')).toBe('TEXT2');
      expect(nameOf('#submit1')).toBe('SUBMIT1 Submit');
      expect(nameOf('#image1')).toBe('IMAGE1 MORE1');
      expect(nameOf('#image2')).toBe('IMAGE2 MORE2');
      expect(nameOf('#file1')).toBe('FILE1 Choose File');
      expect(nameOf('#button1')).toBe('BUTTON1');
      expect(nameOf('#button2')).toBe('BUTTON2 MORE2');
      expect(nameOf('#button3')).toBe('BUTTON3 MORE3');
      expect(nameOf('#textarea1')).toBe('TEXTAREA1 MORE2');
    });

    testIf(isNativeDom(), 'should name select, meter, and progress elements from their labels or title', () => {
      render(`
        <label for="select1">SELECT1</label><select id="select1"><option>One</option></select>
        <select id="select2" title="SELECT2" placeholder="Ignored"><option>One</option></select>
        <label for="meter1">Battery</label><meter id="meter1" value="0.5"></meter>
        <label for="progress1">Loading</label><progress id="progress1" value="0.3"></progress>
        <label>Charge <meter id="meter2" value="0.5"></meter></label>
        <label for="meter3">Ignored</label><meter id="meter3" aria-label="Overridden" value="0.5"></meter>
      `);
      expect(nameOf('#select1')).toBe('SELECT1');
      expect(nameOf('#select2')).toBe('SELECT2');
      expect(nameOf('#meter1')).toBe('Battery');
      expect(nameOf('#progress1')).toBe('Loading');
      expect(nameOf('#meter2')).toBe('Charge');
      expect(nameOf('#meter3')).toBe('Overridden');
    });

    testIf(isNativeDom(), 'should name output elements from their labels or title', () => {
      render(`
        <label for="output1">Result</label><output id="output1">42</output>
        <output id="output2" title="Total">42</output>
        <output id="output3">42</output>
        <span id="for-output4">Sum</span><output id="output4" aria-labelledby="for-output4">42</output>
        <span id="empty"></span><output id="output5" aria-labelledby="empty" title="Fallback">42</output>
      `);
      expect(nameOf('#output1')).toBe('Result');
      expect(nameOf('#output2')).toBe('Total');
      expect(nameOf('#output3')).toBe('');
      expect(nameOf('#output4')).toBe('Sum');
      expect(nameOf('#output5')).toBe('Fallback');
    });

    testIf(isNativeDom(), 'should name fieldsets from their legend or title', () => {
      render(`
        <fieldset id="legend"><legend>Shipping</legend><input></fieldset>
        <fieldset id="titled" title="Billing"><input></fieldset>
        <fieldset id="unnamed"><input></fieldset>
        <span id="other">Other</span><fieldset id="labelled" aria-labelledby="other"><legend>Ignored</legend></fieldset>
        <span id="empty"></span><fieldset id="empty-labelled" aria-labelledby="empty" title="Fallback"><legend>Ignored</legend></fieldset>
      `);
      expect(nameOf('#legend')).toBe('Shipping');
      expect(nameOf('#titled')).toBe('Billing');
      expect(nameOf('#unnamed')).toBe('');
      expect(nameOf('#labelled')).toBe('Other');
      expect(nameOf('#empty-labelled')).toBe('Fallback');
    });

    testIf(isNativeDom(), 'should name figures from their caption or title', () => {
      render(`
        <figure id="captioned"><img alt=""><figcaption>A <b>cat</b></figcaption></figure>
        <figure id="titled" title="A dog"><img alt=""></figure>
        <span id="other">Other</span><figure id="labelled" aria-labelledby="other"><figcaption>Ignored</figcaption></figure>
        <span id="empty"></span><figure id="empty-labelled" aria-labelledby="empty" title="Fallback"><figcaption>Ignored</figcaption></figure>
      `);
      expect(nameOf('#captioned')).toBe('A cat');
      expect(nameOf('#titled')).toBe('A dog');
      expect(nameOf('#labelled')).toBe('Other');
      expect(nameOf('#empty-labelled')).toBe('Fallback');
    });

    testIf(isNativeDom(), 'should name images and areas from alt, then title', () => {
      render(`
        <img id="alt" alt="Code is Poetry." src="data:image/svg,<g></g>">
        <img id="title" alt="  " title="Titled" src="data:image/svg,<g></g>">
        <img id="none" src="data:image/svg,<g></g>">
        <map name="map"><area id="area1" href="#" alt="Area" shape="rect" coords="0,0,1,1"><area id="area2" href="#" title="Titled area" shape="rect" coords="0,0,1,1"></map>
        <img usemap="#map" src="data:image/svg,<g></g>" alt="Map">
      `);
      expect(nameOf('#alt')).toBe('Code is Poetry.');
      expect(nameOf('#title')).toBe('Titled');
      expect(nameOf('#none')).toBe('');
      // Browsers do not display area elements, so they are hidden.
      expect(nameOf('#area1')).toBe('');
      expect(nameOf('#area1', true)).toBe('Area');
      expect(nameOf('#area2', true)).toBe('Titled area');
    });

    testIf(isNativeDom(), 'should name tables from their caption or summary', () => {
      render(`
        <table id="captioned"><caption>Prices</caption><tr><td>1</td></tr></table>
        <table id="summarized" summary="Summary"><tr><td>1</td></tr></table>
        <table id="titled" title="Title"><tr><td>1</td></tr></table>
      `);
      expect(nameOf('#captioned')).toBe('Prices');
      expect(nameOf('#summarized')).toBe('Summary');
      expect(nameOf('#titled')).toBe('Title');
    });

    testIf(isNativeDom(), 'should name forms whatever their inputs are called', () => {
      render('<form aria-label="my form"><input name="tagName" value="hello"><input name="localName" value="hello"></form>');
      expect(nameOf('form')).toBe('my form');
    });

    testIf(isNativeDom(), 'should name search elements only from an author', () => {
      render('<search id="named" aria-label="example">Hello</search><search id="unnamed">World</search>');
      expect(nameOf('#named')).toBe('example');
      expect(nameOf('#unnamed')).toBe('');
    });
  });

  describe('SVG', () => {
    testIf(isNativeDom(), 'should name SVG elements from their title child, and SVG links from xlink:title', () => {
      render(`
        <svg width="162" height="30" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
          <title>Submit</title>
          <g><title>Hello</title></g>
          <a id="titled" href="#" xlink:title="a link"><circle cx="5" cy="5" r="5"></circle></a>
          <a id="untitled" href="#"><text x="0" y="20">text link</text></a>
          <rect id="plain" width="1" height="1"></rect>
        </svg>
      `);
      expect(nameOf('svg')).toBe('Submit');
      expect(nameOf('g')).toBe('Hello');
      expect(nameOf('#titled')).toBe('a link');
      expect(nameOf('#untitled')).toBe('text link');
      expect(nameOf('#plain')).toBe('');
    });

    testIf(isNativeDom(), 'should not name a presentational SVG element', () => {
      render('<svg viewBox="0 0 100 100" width="16" height="16" xmlns="http://www.w3.org/2000/svg" role="presentation"><title>Ignored</title><circle cx="50" cy="50" r="50"></circle></svg>');
      expect(nameOf('svg')).toBe('');
    });
  });

  describe('embedded controls', () => {
    testIf(isNativeDom(), 'should use the value of a text box embedded in a label', () => {
      render(`
        <label for="flash">
          <input type="checkbox" id="flash">
          Flash the screen <span tabindex="0" role="textbox" aria-label="number of times" contenteditable>5</span> times.
        </label>
      `);
      expect(nameOf('input')).toBe('Flash the screen 5 times.');
      expect(nameOf('span')).toBe('number of times');
      expect(nameOf('label')).toBe('');
    });

    testIf(isNativeDom(), 'should use the value of text boxes and search boxes within the element being named', () => {
      render(`
        <button id="b1" aria-labelledby="l1"></button><div id="l1" hidden><input type="text" value="Query"></div>
        <button id="b2" aria-labelledby="l2"></button><div id="l2" hidden><input type="search" value="Query"></div>
        <label for="c1">Flash the screen <input type="search" value="5"> times.</label><input type="checkbox" id="c1">
        <h1><input type="search" value="Foo bar"></h1>
        <h2><textarea>Area</textarea></h2>
      `);
      expect(nameOf('#b1')).toBe('Query');
      expect(nameOf('#b2')).toBe('Query');
      expect(nameOf('#c1')).toBe('Flash the screen 5 times.');
      expect(nameOf('h1')).toBe('Foo bar');
      expect(nameOf('h2')).toBe('Area');
    });

    testIf(isNativeDom(), 'should use the selected options of select elements', () => {
      render(`
        <label for="c1">Pick <select><option>one</option><option selected>two</option></select></label><input type="checkbox" id="c1">
        <label for="c2">Pick <select multiple><option>first</option><option>second</option></select></label><input type="checkbox" id="c2">
        <label for="c3">Pick <select></select> nothing</label><input type="checkbox" id="c3">
      `);
      expect(nameOf('#c1')).toBe('Pick two');
      expect(nameOf('#c2')).toBe('Pick first');
      expect(nameOf('#c3')).toBe('Pick nothing');
    });

    testIf(isNativeDom(), 'should use the aria-selected options of list boxes and combo boxes', () => {
      render(`
        <label for="c1">Color <div role="listbox"><div role="option">red</div><div role="option" aria-selected="true">green</div><span aria-selected="true">not an option</span></div></label><input type="checkbox" id="c1">
        <label for="c2">Size <div role="combobox" aria-owns="sizes"></div></label><input type="checkbox" id="c2">
        <div role="listbox" id="sizes"><div role="option" aria-selected="true">large</div></div>
        <label for="c3">Shape <div role="combobox" aria-owns="shape"></div></label><input type="checkbox" id="c3">
        <div role="option" aria-selected="true" id="shape">ignored</div>
        <label for="c4">Fruit <input role="combobox" value="apple"></label><input type="checkbox" id="c4">
        <label for="c5">Owned <div role="listbox" aria-owns="owned-option"></div></label><input type="checkbox" id="c5">
        <div role="option" aria-selected="true" id="owned-option">square</div>
        <label for="c6">Wrapped <div role="listbox" aria-owns="wrapper"></div></label><input type="checkbox" id="c6">
        <div id="wrapper"><div role="option" aria-selected="true">circle</div></div>
      `);
      expect(nameOf('#c1')).toBe('Color green');
      expect(nameOf('#c2')).toBe('Size large');
      expect(nameOf('#c3')).toBe('Shape');
      expect(nameOf('#c4')).toBe('Fruit apple');
      expect(nameOf('#c5')).toBe('Owned square');
      expect(nameOf('#c6')).toBe('Wrapped circle');
    });

    testIf(isNativeDom(), 'should use the value text, value, or value attribute of ranges', () => {
      render(`
        <label for="c1">Volume <div role="slider" aria-valuetext="loud" aria-valuenow="9"></div></label><input type="checkbox" id="c1">
        <label for="c2">Volume <div role="slider" aria-valuenow="9"></div></label><input type="checkbox" id="c2">
        <label for="c3">Volume <meter value="0.5"></meter></label><input type="checkbox" id="c3">
        <label for="c4">Volume <div role="spinbutton"></div> level</label><input type="checkbox" id="c4">
      `);
      expect(nameOf('#c1')).toBe('Volume loud');
      expect(nameOf('#c2')).toBe('Volume 9');
      expect(nameOf('#c3')).toBe('Volume 0.5');
      expect(nameOf('#c4')).toBe('Volume level');
    });

    testIf(isNativeDom(), 'should not use the content of an embedded menu', () => {
      render('<label for="c1">Open <div role="menu">File Edit</div></label><input type="checkbox" id="c1">');
      expect(nameOf('#c1')).toBe('Open');
    });

    testIf(isNativeDom(), 'should name an element by its own content when it labels itself', () => {
      render('<span id="prefix">Name</span><div role="textbox" id="self" aria-labelledby="prefix self">value</div>');
      expect(nameOf('#self')).toBe('Name value');
    });
  });

  describe('accessible descriptions', () => {
    testIf(isNativeDom(), 'should describe an element from aria-describedby, then aria-description, then title', () => {
      render(`
        <span id="hint">Use <b>8</b> characters</span><span id="more">at least</span>
        <input id="described" aria-describedby="hint more" aria-description="Ignored" title="Ignored">
        <input id="description" aria-description="  Inline   description " title="Ignored">
        <input id="titled" title="Tooltip">
        <input id="none">
        <input id="missing" aria-describedby="does-not-exist" title="Ignored">
      `);
      expect(descriptionOf('#described')).toBe('Use 8 characters at least');
      expect(descriptionOf('#description')).toBe('Inline description');
      expect(descriptionOf('#titled')).toBe('Tooltip');
      expect(descriptionOf('#none')).toBe('');
      expect(calculator.getAccessibleDescription(query('#titled'))).toBe('Tooltip');
      expect(descriptionOf('#missing')).toBe('');
    });

    testIf(isNativeDom(), 'should use hidden content of a hidden describing element, or when asked', () => {
      render(`
        <span id="hidden" hidden>Hidden hint</span><input id="first" aria-describedby="hidden">
        <span id="partly">Shown <span hidden>secret</span></span><input id="second" aria-describedby="partly">
      `);
      expect(descriptionOf('#first')).toBe('Hidden hint');
      expect(descriptionOf('#second')).toBe('Shown');
      expect(descriptionOf('#second', true)).toBe('Shown secret');
    });
  });

  describe('elements outside a rendered document', () => {
    test('should treat an element in a document without a window as hidden', () => {
      const detached = document.implementation.createHTMLDocument('');
      detached.body.innerHTML = '<button>Save <b>now</b></button>';
      const button = detached.querySelector('button')!;
      expect(calculator.getAccessibleName(button, true)).toBe('Save now');
      expect(calculator.getAccessibleName(button)).toBe('');
    });
  });
});
