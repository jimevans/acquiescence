/**
 * Options for picking an element.
 */
export type ElementPickerOptions = {
  // Gives the element highlighted and picked for the element under the pointer, such as
  // ElementDescriber.getActionTarget; defaults to the element under the pointer.
  resolve?: (element: Element) => Element,
  // Leaves out elements it returns true for, such as a tool's own, whose events reach them as usual.
  ignore?: (element: Element) => boolean,
};

/**
 * Lets a user pick an element in a document: highlights the element under the pointer, and reports the element
 * clicked, keeping the page from seeing the click. Events a script raises are left out.
 */
class ElementPicker {
  private readonly suppressedEvents = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'dblclick', 'auxclick', 'contextmenu'];

  private picking: { document: Document, host: HTMLElement, listeners: Array<[string, (event: Event) => void]> } | null = null;
  private highlighted: Element | null = null;

  /**
   * Initializes a new instance of the ElementPicker class.
   * @param pick {(element: Element) => void} Called with each element picked.
   * @param options {ElementPickerOptions} Options for picking.
   */
  constructor(private readonly pick: (element: Element) => void, private readonly options: ElementPickerOptions = {}) {
  }

  /**
   * Starts picking in a document, stopping any picking already started. The highlight is drawn in a shadow root of
   * an acquiescence-highlight element added to the document element.
   * @param document {Document} The document.
   */
  start(document: Document): void {
    this.stop();
    const host = document.createElement('acquiescence-highlight');
    host.setAttribute('style', 'position: fixed; top: 0; left: 0; width: 0; height: 0; pointer-events: none; z-index: 2147483647;');
    const box = document.createElement('div');
    box.setAttribute('style', 'position: fixed; box-sizing: border-box; display: none; pointer-events: none; border: 2px solid #1a73e8; background: rgba(26, 115, 232, 0.2);');
    host.attachShadow({ mode: 'open' }).appendChild(box);
    document.documentElement.appendChild(host);
    const listeners: Array<[string, (event: Event) => void]> = [
      ['pointermove', (event) => {
        this.highlighted = this.getPickedElement(event);
        this.draw(box);
      }],
      ['click', (event) => this.onClick(event)],
      ['scroll', () => this.draw(box)],
      ...this.suppressedEvents.map((type): [string, (event: Event) => void] => [type, (event) => this.suppress(event)]),
    ];
    for (const [type, listener] of listeners) {
      document.addEventListener(type, listener, true);
    }

    this.picking = { document, host, listeners };
  }

  /**
   * Stops picking, and removes the highlight.
   */
  stop(): void {
    if (this.picking) {
      for (const [type, listener] of this.picking.listeners) {
        this.picking.document.removeEventListener(type, listener, true);
      }

      this.picking.host.remove();
    }

    this.picking = null;
    this.highlighted = null;
  }

  private onClick(event: Event): void {
    const element = this.getPickedElement(event);
    if (element) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.pick(element);
    }
  }

  private suppress(event: Event): void {
    if (this.getPickedElement(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  // Draws the box over the highlighted element, or hides it when there is none.
  private draw(box: HTMLElement): void {
    if (!this.highlighted?.isConnected) {
      box.style.display = 'none';
      return;
    }

    const rect = this.highlighted.getBoundingClientRect();
    Object.assign(box.style, { display: 'block', left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  }

  // The element picked for the element the event was aimed at, unless the event is a script's or the element is ignored.
  private getPickedElement(event: Event): Element | null {
    const element = event.composedPath()[0];
    if (!event.isTrusted || !(element instanceof Element) || this.options.ignore?.(element)) {
      return null;
    }

    return this.options.resolve?.(element) ?? element;
  }
}

export default ElementPicker;
