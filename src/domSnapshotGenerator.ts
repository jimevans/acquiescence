/**
 * A node of a DOM snapshot: a string for a text node, or an array of an element's name, its attributes, and its
 * children. An element with neither attributes nor children has only its name.
 */
export type DomNodeSnapshot = string | [string] | ElementSnapshot;

/**
 * An element of a DOM snapshot: its name, its attributes, and its children.
 */
export type ElementSnapshot = [string, Record<string, string>, ...DomNodeSnapshot[]];

/**
 * A snapshot of a document's DOM, in the format of the frame snapshots in Playwright's traces.
 */
export type DomSnapshot = {
  // The name of the document type, such as html, if the document has one.
  doctype?: string,
  // The document element.
  html: DomNodeSnapshot,
  // The size of the window's viewport, in CSS pixels.
  viewport: { width: number, height: number },
  url: string,
  // When the snapshot was taken, in milliseconds since the epoch.
  wallTime: number,
  // How long the snapshot took, in milliseconds.
  collectionTime: number,
};

/**
 * Options for taking a DOM snapshot.
 */
export type DomSnapshotOptions = {
  // An element to mark as the target of an action.
  target?: Element,
  // Gives the src of each iframe and frame element in the snapshot; defaults to an empty src.
  frameSource?: (frame: HTMLIFrameElement | HTMLFrameElement) => string,
};

/**
 * The state of one snapshot.
 */
type SnapshotContext = {
  options: DomSnapshotOptions,
  customElements: Set<string>,
  headNesting: number,
};

/**
 * Takes snapshots of documents for display in a trace viewer: the DOM without scripts or event handlers, with the
 * state that attributes do not show, such as the values of inputs, scroll positions, open shadow roots, and
 * stylesheets made by script, recorded in attributes the viewer reads.
 */
class DomSnapshotGenerator {
  private readonly shadowRootAttribute = '__playwright_shadow_root_';
  private readonly valueAttribute = '__playwright_value_';
  private readonly checkedAttribute = '__playwright_checked_';
  private readonly selectedAttribute = '__playwright_selected_';
  private readonly scrollTopAttribute = '__playwright_scroll_top_';
  private readonly scrollLeftAttribute = '__playwright_scroll_left_';
  private readonly styleSheetAttribute = '__playwright_style_sheet_';
  private readonly targetAttribute = '__playwright_target__';
  private readonly customElementsAttribute = '__playwright_custom_elements__';
  private readonly currentSrcAttribute = '__playwright_current_src__';
  private readonly boundingRectAttribute = '__playwright_bounding_rect__';
  private readonly popoverOpenAttribute = '__playwright_popover_open_';
  private readonly dialogOpenAttribute = '__playwright_dialog_open_';
  // META directives that could navigate, set cookies, or block the viewer's own content when shown.
  private readonly droppedHttpEquivs = ['content-security-policy', 'refresh', 'set-cookie'];

  /**
   * Takes a snapshot of a document.
   * @param document {Document} The document to take the snapshot of.
   * @param options {DomSnapshotOptions} Options for the snapshot. If omitted, no element is marked and frames
   * have an empty src.
   * @returns {DomSnapshot} The snapshot.
   */
  generate(document: Document, options: DomSnapshotOptions = {}): DomSnapshot {
    const start = performance.now();
    const context: SnapshotContext = { options, customElements: new Set(), headNesting: 0 };
    const html = (document.documentElement && this.visitElement(document.documentElement, context)) ?? ['HTML'];
    const view = document.defaultView;
    return {
      doctype: document.doctype?.name,
      html,
      viewport: { width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 },
      url: document.URL,
      wallTime: Date.now(),
      collectionTime: performance.now() - start,
    };
  }

  private visit(node: Node, context: SnapshotContext): DomNodeSnapshot | undefined {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node as Text).data;
    }

    return node.nodeType === Node.ELEMENT_NODE ? this.visitElement(node as Element, context) : undefined;
  }

  private visitShadowRoot(shadowRoot: ShadowRoot, context: SnapshotContext): ElementSnapshot {
    const result: ElementSnapshot = ['template', { [this.shadowRootAttribute]: 'open' }];
    this.visitChildren(shadowRoot, result, context);
    this.addAdoptedStyleSheets(shadowRoot, result);
    return result;
  }

  private visitElement(element: Element, context: SnapshotContext): DomNodeSnapshot | undefined {
    const name = element.nodeName;
    if (this.isLeftOut(element, name, context)) {
      return undefined;
    }

    if (name === 'STYLE') {
      return [name, this.copyAttributes(element, name), this.styleText(element as HTMLStyleElement)];
    }

    const attributes: Record<string, string> = {};
    this.addState(element, name, attributes, context);
    const result: ElementSnapshot = [name, attributes];
    if (element.shadowRoot) {
      result.push(this.visitShadowRoot(element.shadowRoot, context));
    }

    if (name === 'HEAD') {
      // The viewer serves the snapshot from another URL, so relative URLs need the document's base.
      result.push(['BASE', { href: element.ownerDocument.baseURI }]);
      context.headNesting++;
    }

    this.visitChildren(element, result, context);
    if (name === 'HEAD') {
      context.headNesting--;
    }

    if (element === element.ownerDocument.documentElement) {
      this.addAdoptedStyleSheets(element.ownerDocument, result);
    }

    if (name === 'BODY' && context.customElements.size) {
      attributes[this.customElementsAttribute] = [...context.customElements].join(',');
    }

    Object.assign(attributes, this.copyAttributes(element, name));
    if (result.length === 2 && !Object.keys(attributes).length) {
      return [name];
    }

    return result;
  }

  private visitChildren(parent: Node, result: ElementSnapshot, context: SnapshotContext): void {
    for (let child = parent.firstChild; child; child = child.nextSibling) {
      const snapshot = this.visit(child, context);
      if (snapshot !== undefined) {
        result.push(snapshot);
      }
    }
  }

  private isLeftOut(element: Element, name: string, context: SnapshotContext): boolean {
    if (name === 'SCRIPT' || name === 'NOSCRIPT') {
      return true;
    }

    if (name === 'LINK') {
      const rel = (element.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
      return rel.includes('preload') || rel.includes('prefetch');
    }

    if (name === 'META') {
      return this.droppedHttpEquivs.includes((element.getAttribute('http-equiv') ?? '').toLowerCase());
    }

    // A frame in the head is never shown.
    return (name === 'IFRAME' || name === 'FRAME') && context.headNesting > 0;
  }

  // State that the element's attributes do not show.
  private addState(element: Element, name: string, attributes: Record<string, string>, context: SnapshotContext): void {
    if (element.localName.includes('-') && element.matches(':defined')) {
      context.customElements.add(element.localName);
    }

    if (name === 'INPUT' || name === 'TEXTAREA') {
      attributes[this.valueAttribute] = (element as HTMLInputElement).value;
    }

    if (name === 'INPUT' && ['checkbox', 'radio'].includes((element as HTMLInputElement).type)) {
      attributes[this.checkedAttribute] = String((element as HTMLInputElement).checked);
    }

    if (name === 'OPTION') {
      attributes[this.selectedAttribute] = String((element as HTMLOptionElement).selected);
    }

    if (name === 'CANVAS' || name === 'IFRAME' || name === 'FRAME') {
      const rect = element.getBoundingClientRect();
      attributes[this.boundingRectAttribute] = JSON.stringify({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
    }

    if ((element as HTMLElement).popover && element.matches(':popover-open')) {
      attributes[this.popoverOpenAttribute] = 'true';
    }

    if (name === 'DIALOG' && (element as HTMLDialogElement).open) {
      attributes[this.dialogOpenAttribute] = element.matches(':modal') ? 'modal' : 'true';
    }

    if (element.scrollTop) {
      attributes[this.scrollTopAttribute] = String(element.scrollTop);
    }

    if (element.scrollLeft) {
      attributes[this.scrollLeftAttribute] = String(element.scrollLeft);
    }

    if (element === context.options.target) {
      attributes[this.targetAttribute] = '';
    }

    if (name === 'IFRAME' || name === 'FRAME') {
      attributes.src = context.options.frameSource?.(element as HTMLIFrameElement) ?? '';
    }

    if (name === 'IMG' || name === 'PICTURE') {
      attributes[this.currentSrcAttribute] = name === 'IMG' ? this.sanitizeUrl((element as HTMLImageElement).currentSrc) : '';
    }
  }

  private copyAttributes(element: Element, name: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (const attribute of Array.from(element.attributes)) {
      const attributeName = attribute.name;
      if (this.isAttributeLeftOut(name, attributeName)) {
        continue;
      }

      let value = attribute.value;
      if (attributeName.startsWith('on')) {
        value = '';
      } else if (name === 'META') {
        value = this.sanitizeMetaAttribute(attributeName, value, element.getAttribute('http-equiv') ?? '');
      } else if ((name === 'IMG' && attributeName === 'src') || (name === 'LINK' && attributeName === 'href')) {
        value = this.sanitizeUrl(value);
      } else if ((name === 'IMG' || name === 'SOURCE') && attributeName === 'srcset') {
        value = this.sanitizeSrcSet(value);
      }

      attributes[attributeName] = value;
    }

    return attributes;
  }

  // A frame's src is given by the options, and its content by its own snapshot; a dialog's open state by an attribute
  // of the snapshot's own.
  private isAttributeLeftOut(name: string, attributeName: string): boolean {
    return (name === 'LINK' && attributeName === 'integrity')
      || (name === 'IFRAME' && ['src', 'srcdoc', 'sandbox'].includes(attributeName))
      || (name === 'FRAME' && attributeName === 'src')
      || (name === 'DIALOG' && attributeName === 'open');
  }

  // The snapshot is shown as UTF-8, whatever the document's own encoding.
  private sanitizeMetaAttribute(attributeName: string, value: string, httpEquiv: string): string {
    if (attributeName === 'charset') {
      return 'utf-8';
    }

    if (httpEquiv.toLowerCase() !== 'content-type' || attributeName !== 'content') {
      return value;
    }

    return value.replace(/charset=[^;]*/i, 'charset=utf-8');
  }

  private sanitizeUrl(url: string): string {
    return /^\s*(javascript|vbscript):/i.test(url) ? '' : url;
  }

  private sanitizeSrcSet(srcset: string): string {
    return srcset.split(',').map((candidate) => {
      const trimmed = candidate.trim();
      const space = trimmed.lastIndexOf(' ');
      return space === -1 ? this.sanitizeUrl(trimmed) : this.sanitizeUrl(trimmed.substring(0, space).trim()) + trimmed.substring(space);
    }).join(', ');
  }

  // A style element whose rules were added by script, as CSS-in-JS libraries do, has no text of its own.
  private styleText(style: HTMLStyleElement): string {
    const sheet = style.sheet;
    if (sheet?.disabled) {
      return '';
    }

    const text = style.textContent;
    return text.trim() || !sheet ? text : this.sheetText(sheet);
  }

  private sheetText(sheet: CSSStyleSheet): string {
    return Array.from(sheet.cssRules).map((rule) => rule.cssText).join('\n');
  }

  private addAdoptedStyleSheets(root: Document | ShadowRoot, result: ElementSnapshot): void {
    // jsdom has no adopted stylesheets.
    /* istanbul ignore next -- @preserve */
    const sheets = root.adoptedStyleSheets ?? [];
    for (const sheet of sheets) {
      result.push(['template', { [this.styleSheetAttribute]: sheet.disabled ? '' : this.sheetText(sheet) }]);
    }
  }
}

export default DomSnapshotGenerator;
