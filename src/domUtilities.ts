/**
 * Provides utilities for working with the DOM.
 */
class DOMUtilities {
  /**
   * Gets a value indicating whether an element is focusable.
   * @param element {Element} The element to check.
   * @returns {boolean} True if the element is focusable; otherwise, false.
   */
  isFocusable(element: Element): boolean {
    return !this.isNativelyDisabled(element) && (this.isNativelyFocusable(element) || this.hasTabIndex(element));
  }

  /**
   * Gets a value indicating whether an element is natively disabled.
   * @param element {Element} The element to check.
   * @returns {boolean} True if the element is natively disabled; otherwise, false.
   */
  isNativelyDisabled(element: Element): boolean {
    // https://www.w3.org/TR/html-aam-1.0/#html-attribute-state-and-property-mappings
    const isNativeFormControl = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'OPTION', 'OPTGROUP'].includes(this.getNormalizedElementTagName(element));
    return isNativeFormControl && (element.hasAttribute('disabled') || this.isInDisabledOptGroup(element) || this.isInDisabledFieldSet(element));
  }

  /**
   * Gets the normalized (uppercase) element tag name.
   * @param element {Element} The element to check.
   * @returns {string} The normalized element tag name.
   */
  getNormalizedElementTagName(element: Element): string {
    const tagName = element.tagName;
    if (typeof tagName === 'string') {
      // Early return for the normal case.
      return tagName.toUpperCase();
    }

    // Special case for <form> elements, since if a form has a named input,
    // like <input name="tagName">, then element.tagName will return the input
    // element itself.
    if (element instanceof HTMLFormElement) {
      return 'FORM';
    }

    // Elements from the svg namespace do not have uppercase tagName right away.
    return element.tagName.toUpperCase();
  }

  /**
   * Gets the parent element or shadow host of an element.
   * @param element {Element} The element to check.
   * @returns {Element | undefined} The parent element or shadow host of the element, or undefined if the element has no parent.
   */
  getParentElementOrShadowHost(element: Element): Element | undefined {
    if (element.parentElement) {
      return element.parentElement;
    }
    if (!element.parentNode) {
      return;
    }
    if (element.parentNode.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */ && (element.parentNode as ShadowRoot).host) {
      return (element.parentNode as ShadowRoot).host;
    }
  }

  /**
   * Gets the enclosing shadow root or document of an element.
   * @param element {Element} The element to check.
   * @returns {Document | ShadowRoot | undefined} The enclosing shadow root or document of the element, or undefined if the element has no enclosing shadow root or document.
   */
  getEnclosingShadowRootOrDocument(element: Element): Document | ShadowRoot | undefined {
    let node: Node = element;
    while (node.parentNode) {
      node = node.parentNode;
    }
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE || node.nodeType === Node.DOCUMENT_NODE) {
      return node as Document | ShadowRoot;
    }
  }

  /**
   * Gets the closest cross-shadow element.
   * @param element {Element | undefined} The element to check.
   * @param css {string} The CSS selector to use.
   * @param scope {Document | Element | undefined} The scope to use. If provided, the element must be inside scope's subtree.
   * @returns {Element | undefined} The closest cross-shadow element, or undefined if no closest element is found.
   */
  getClosestCrossShadowElement(element: Element | undefined, css: string, scope?: Document | Element): Element | undefined {
    // Assumption: if scope is provided, element must be inside scope's subtree.
    while (element) {
      const closest = element.closest(css);
      if (scope && closest !== scope && closest?.contains(scope)) {
        return;
      }
      if (closest) {
        return closest;
      }
      element = this.getEnclosingShadowHost(element);
    }
  }

  /**
   * Gets the enclosing shadow host of an element.
   * @param element {Element} The element to check.
   * @returns {Element | undefined} The enclosing shadow host of the element, or undefined if the element has no enclosing shadow host.
   */
  getEnclosingShadowHost(element: Element): Element | undefined {
    while (element.parentElement) {
      element = element.parentElement;
    }
    return this.getParentElementOrShadowHost(element);
  }

  /**
   * Gets a value indicating whether an element has a tab index.
   * @param element {Element} The element to check.
   * @returns {boolean} True if the element has a tab index; otherwise, false.
   */
  hasTabIndex(element: Element): boolean {
    return !Number.isNaN(Number(String(element.getAttribute('tabindex'))));
  }

  /**
   * Gets a value indicating whether an element is in a disabled opt group.
   * @param element {Element} The element to check.
   * @returns {boolean} True if the element is in a disabled opt group; otherwise, false.
   */
  private isInDisabledOptGroup(element: Element): boolean {
    return this.getNormalizedElementTagName(element) === 'OPTION' && !!element.closest('OPTGROUP[DISABLED]');
  }

  /**
   * Gets a value indicating whether an element is in a disabled field set.
   * @param element {Element} The element to check.
   * @returns {boolean} True if the element is in a disabled field set; otherwise, false.
   */
  private isInDisabledFieldSet(element: Element): boolean {
    const fieldSetElement = element?.closest('FIELDSET[DISABLED]');
    if (!fieldSetElement) {
      return false;
    }

    const legendElement = fieldSetElement.querySelector(':scope > LEGEND');
    return !legendElement?.contains(element);
  }

  /**
   * Gets the open shadow roots within some scopes: that of a scope element itself, those of the elements within
   * each scope, and those nested within them. Closed shadow roots cannot be reached from script, so they are not
   * included, and neither is anything within them.
   * @param scopes {Array<Document | Element | ShadowRoot>} The scopes to search.
   * @returns {ShadowRoot[]} The shadow roots, each once, in the order found.
   */
  getOpenShadowRoots(scopes: Array<Document | Element | ShadowRoot>): ShadowRoot[] {
    const roots = new Set<ShadowRoot>();
    const visit = (scope: Document | Element | ShadowRoot) => {
      const elements = Array.from(scope.querySelectorAll('*'));
      if (scope instanceof Element) {
        elements.unshift(scope);
      }
      for (const element of elements) {
        const shadowRoot = element.shadowRoot;
        if (shadowRoot && !roots.has(shadowRoot)) {
          roots.add(shadowRoot);
          visit(shadowRoot);
        }
      }
    };
    scopes.forEach(visit);
    return Array.from(roots);
  }

  /**
   * Gets the text of a node as it is rendered: text within an open shadow root rather than the shadow host's
   * own children, the nodes assigned to a slot (or its fallback content when none are), and no text from
   * script, style, or noscript elements. A closed shadow root cannot be read, so its host's children are used.
   * @param node {Node} The node whose text to get.
   * @returns {string} The text, with whitespace as it appears in the document.
   */
  getNodeText(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node as Text).data;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const element = node as Element;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(this.getNormalizedElementTagName(element))) {
      return '';
    }

    let children: ArrayLike<Node> = element.shadowRoot ? element.shadowRoot.childNodes : element.childNodes;
    if (element instanceof HTMLSlotElement && element.assignedNodes().length > 0) {
      children = element.assignedNodes();
    }

    return Array.from(children, (child) => this.getNodeText(child)).join('');
  }

  /**
   * Gets the computed style of an element or one of its pseudo-elements.
   * @param element {Element} The element to get the computed style of.
   * @param pseudo {string | undefined} The pseudo-element to get the computed style of. If omitted, the style of the element itself is returned.
   * @returns {CSSStyleDeclaration | undefined} The computed style, or undefined if the element is not in a document with a window.
   */
  getElementComputedStyle(element: Element, pseudo?: string): CSSStyleDeclaration | undefined {
    return element.ownerDocument?.defaultView ? element.ownerDocument.defaultView.getComputedStyle(element, pseudo) : undefined;
  }

  /**
   * Gets a value indicating whether a text node takes up space when rendered.
   * @param node {Text} The text node to check.
   * @returns {boolean} True if the text node is visible; otherwise, false.
   */
  isVisibleTextNode(node: Text): boolean {
    // https://stackoverflow.com/questions/1461059/is-there-an-equivalent-to-getboundingclientrect-for-text-nodes
    const range = node.ownerDocument.createRange();
    range.selectNode(node);
    const rect = range.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Gets a value indicating whether an element is visible as defined in its style: rendered, and with a visibility of visible.
   * @param element {Element} The element to check.
   * @param style {CSSStyleDeclaration | undefined} The computed style of the element.
   * @returns {boolean} True if the element's style makes it visible, or if it has no computed style; otherwise, false.
   */
  isStyleVisibilityVisible(element: Element, style: CSSStyleDeclaration | undefined): boolean {
    if (!style) {
      return true;
    }
    return element.checkVisibility() && style.visibility === 'visible';
  }

  /**
   * Gets a value indicating whether an element is natively focusable.
   * @param element {Element} The element to check.
   * @returns {boolean} True if the element is natively focusable; otherwise, false.
   */
  private isNativelyFocusable(element: Element): boolean {
    const tagName = this.getNormalizedElementTagName(element);
    if (['BUTTON', 'DETAILS', 'SELECT', 'TEXTAREA'].includes(tagName)) {
      return true;
    }
    if (tagName === 'A' || tagName === 'AREA') {
      return element.hasAttribute('href');
    }
    if (tagName === 'INPUT') {
      return !(element as HTMLInputElement).hidden;
    }
    return false;
  }
};

export default DOMUtilities;
