import AriaUtilities from './ariaUtilities.js';
import DOMUtilities from './domUtilities.js';

/**
 * A traversal that follows a reference to another element: aria-labelledby, aria-describedby, a label, or a native
 * text alternative such as a legend. Hidden content is used when the referenced element is itself hidden.
 */
type ReferenceTraversal = { hidden: boolean };

/**
 * The state of one accessible name or description computation.
 */
type TextAlternativeContext = {
  includeHidden: boolean,
  visited: Set<Element>,
  labelledBy?: ReferenceTraversal,
  describedBy?: ReferenceTraversal,
  label?: ReferenceTraversal,
  nativeTextAlternative?: ReferenceTraversal,
  // Whether the current element is the one being named, or a descendant of it.
  target?: 'self' | 'descendant',
};

/**
 * A part of a CSS content property value.
 */
type CssContentToken = { type: 'string', value: string } | { type: 'attr', name: string } | { type: 'slash' } | { type: 'other' };

/**
 * Computes accessible names and descriptions of elements, following the Accessible Name and Description Computation
 * (https://w3c.github.io/accname/) and the HTML Accessibility API Mappings (https://w3c.github.io/html-aam/). Where
 * browsers agree with each other but not with those specifications, it follows the browsers.
 */
class AccessibleNameCalculator {
  private readonly ariaUtilities = new AriaUtilities();
  private readonly domUtilities = new DOMUtilities();

  // https://w3c.github.io/aria/#namefromprohibited
  private readonly namingProhibitedRoles = [
    'caption', 'code', 'definition', 'deletion', 'emphasis', 'generic', 'insertion', 'mark', 'paragraph',
    'presentation', 'strong', 'subscript', 'suggestion', 'superscript', 'term', 'time'
  ];

  // https://w3c.github.io/aria/#namefromcontent, as Chromium and Firefox apply it
  // (see the proposal at https://github.com/w3c/aria/issues/1821).
  private readonly nameFromContentRoles = [
    'button', 'cell', 'checkbox', 'columnheader', 'gridcell', 'heading', 'link', 'menuitem', 'menuitemcheckbox',
    'menuitemradio', 'option', 'radio', 'row', 'rowheader', 'switch', 'tab', 'tooltip', 'treeitem'
  ];

  // Roles that contribute their content to the name of an element they are inside, as well as those above.
  private readonly nameFromDescendantContentRoles = [
    '', 'caption', 'code', 'contentinfo', 'definition', 'deletion', 'emphasis', 'insertion', 'list', 'listitem',
    'mark', 'none', 'paragraph', 'presentation', 'region', 'row', 'rowgroup', 'section', 'strong', 'subscript',
    'superscript', 'table', 'term', 'time'
  ];

  private readonly rangeRoles = ['meter', 'progressbar', 'scrollbar', 'slider', 'spinbutton'];

  // https://w3c.github.io/html-aam/#input-type-button-input-type-submit-and-input-type-reset-accessible-name-computation
  private readonly defaultButtonNames: Record<string, string | undefined> = { 'reset': 'Reset', 'submit': 'Submit' };

  private readonly placeholderInputTypes = ['email', 'number', 'password', 'search', 'tel', 'text', 'url'];

  // Names that HTML elements get from their attributes, labels, and particular children, each returning undefined
  // when the element should be named from its content instead.
  // https://w3c.github.io/html-aam/#accessible-name-computations-by-html-element
  private readonly hostLanguageNames: Record<string, (element: Element, context: TextAlternativeContext, hasLabelledBy: boolean) => string | undefined> = {
    'AREA': (element: Element) => this.getFirstNonBlankAttribute(element, ['alt', 'title']),
    'BUTTON': (element: Element, context: TextAlternativeContext, hasLabelledBy: boolean) => {
      const labels = (element as HTMLButtonElement).labels;
      return !hasLabelledBy && labels.length ? this.getNameFromLabels(labels, context) : undefined;
    },
    'FIELDSET': (element: Element, context: TextAlternativeContext, hasLabelledBy: boolean) =>
      hasLabelledBy ? undefined : this.getNameFromChild(element, 'LEGEND', context) ?? this.getFirstNonBlankAttribute(element, ['title']),
    'FIGURE': (element: Element, context: TextAlternativeContext, hasLabelledBy: boolean) =>
      hasLabelledBy ? undefined : this.getNameFromChild(element, 'FIGCAPTION', context) ?? this.getFirstNonBlankAttribute(element, ['title']),
    'IMG': (element: Element) => this.getFirstNonBlankAttribute(element, ['alt', 'title']),
    'INPUT': (element: Element, context: TextAlternativeContext, hasLabelledBy: boolean) => this.getInputName(element as HTMLInputElement, context, hasLabelledBy),
    'METER': (element: Element, context: TextAlternativeContext, hasLabelledBy: boolean) => this.getFormControlName(element as HTMLMeterElement, context, hasLabelledBy),
    'OUTPUT': (element: Element, context: TextAlternativeContext, hasLabelledBy: boolean) => {
      if (hasLabelledBy) {
        return undefined;
      }
      const labels = (element as HTMLOutputElement).labels;
      return labels.length ? this.getNameFromLabels(labels, context) : this.getFirstNonBlankAttribute(element, ['title']);
    },
    'PROGRESS': (element: Element, context: TextAlternativeContext, hasLabelledBy: boolean) => this.getFormControlName(element as HTMLProgressElement, context, hasLabelledBy),
    'SELECT': (element: Element, context: TextAlternativeContext, hasLabelledBy: boolean) => this.getFormControlName(element as HTMLSelectElement, context, hasLabelledBy),
    // Browsers use the summary attribute, which the specification does not mention, and do not use the title.
    'TABLE': (element: Element, context: TextAlternativeContext) =>
      this.getNameFromChild(element, 'CAPTION', context) ?? (this.getFirstNonBlankAttribute(element, ['summary']) || undefined),
    'TEXTAREA': (element: Element, context: TextAlternativeContext, hasLabelledBy: boolean) => this.getFormControlName(element as HTMLTextAreaElement, context, hasLabelledBy),
  };

  /**
   * Gets the accessible name of an element.
   * @param element {Element} The element to get the accessible name of.
   * @param includeHidden {boolean} Whether to use content hidden from the accessibility tree. If omitted, defaults to false.
   * @returns {string} The accessible name, with white space collapsed; empty if the element has none, or its role does
   * not allow one.
   */
  getAccessibleName(element: Element, includeHidden = false): string {
    // https://w3c.github.io/accname/#computation-steps
    if (this.namingProhibitedRoles.includes(this.ariaUtilities.getAriaRole(element) ?? '')) {
      return '';
    }
    return this.normalizeFlatString(this.getTextAlternative(element, { includeHidden, visited: new Set(), target: 'self' }));
  }

  /**
   * Gets the accessible description of an element: from aria-describedby, then aria-description, then the title attribute.
   * @param element {Element} The element to get the accessible description of.
   * @param includeHidden {boolean} Whether to use content hidden from the accessibility tree. If omitted, defaults to false.
   * @returns {string} The accessible description, with white space collapsed; empty if the element has none.
   */
  getAccessibleDescription(element: Element, includeHidden = false): string {
    // https://w3c.github.io/accname/#mapping_additional_nd_description
    // https://w3c.github.io/html-aam/#accdesc-computation
    if (element.hasAttribute('aria-describedby')) {
      const parts = this.ariaUtilities.getReferencedElements(element, 'aria-describedby').map((reference) => this.getTextAlternative(reference, {
        includeHidden,
        visited: new Set(),
        describedBy: { hidden: this.ariaUtilities.isHiddenForAria(reference) },
      }));
      return this.normalizeFlatString(parts.join(' '));
    }
    return this.normalizeFlatString(element.getAttribute('aria-description') ?? element.getAttribute('title') ?? '');
  }

  /**
   * Computes the text alternative of an element, the recursive step 2 of the computation.
   * @param element {Element} The element to compute the text alternative of.
   * @param context {TextAlternativeContext} The state of the computation.
   * @returns {string} The text alternative, before white space is collapsed.
   */
  private getTextAlternative(element: Element, context: TextAlternativeContext): string {
    if (context.visited.has(element)) {
      return '';
    }

    // Step 2A: hidden content is skipped, unless it is within a reference to a hidden element.
    if (!context.includeHidden) {
      const isInHiddenReference = [context.labelledBy, context.describedBy, context.label, context.nativeTextAlternative].some((traversal) => traversal?.hidden);
      if (this.ariaUtilities.isIgnoredForAria(element) || (!isInHiddenReference && this.ariaUtilities.isHiddenForAria(element))) {
        context.visited.add(element);
        return '';
      }
    }

    // Step 2B: aria-labelledby, unless this is already within an aria-labelledby traversal.
    const labelledBy = this.ariaUtilities.getReferencedElements(element, 'aria-labelledby');
    if (!context.labelledBy) {
      const parts = labelledBy.map((reference) => this.getTextAlternative(reference, {
        includeHidden: context.includeHidden,
        visited: context.visited,
        labelledBy: { hidden: this.ariaUtilities.isHiddenForAria(reference) },
      }));
      const name = parts.filter((part) => !!part).join(' ');
      if (name) {
        return name;
      }
    }

    context.visited.add(element);
    const role = this.ariaUtilities.getAriaRole(element) ?? '';
    const tagName = this.domUtilities.getNormalizedElementTagName(element);
    const isPresentational = role === 'none' || role === 'presentation';

    // Step 2C: a control embedded in the label of another element contributes its value. Browsers also do this for a
    // control within the element being named (https://github.com/w3c/accname/issues/64).
    if ((context.label || context.labelledBy || context.target === 'descendant') && !labelledBy.includes(element)) {
      const controlName = this.getEmbeddedControlName(element, role, tagName, context);
      if (controlName !== undefined) {
        return controlName;
      }
    }

    // Step 2D: aria-label.
    const ariaLabel = element.getAttribute('aria-label') ?? '';
    if (ariaLabel.trim()) {
      return ariaLabel;
    }

    // Step 2E: the host language's own text alternatives.
    if (!isPresentational) {
      const hostLanguageName = this.hostLanguageNames[tagName]?.(element, context, labelledBy.length > 0) ?? this.getSvgName(element, tagName, context);
      if (hostLanguageName !== undefined) {
        return hostLanguageName;
      }
    }

    // Steps 2F to 2H: the element's content, for roles that allow it and for content reached through a reference.
    const isNamedByContent = this.allowsNameFromContent(role, context.target === 'descendant') ||
      (tagName === 'SUMMARY' && !isPresentational) ||
      !!(context.labelledBy ?? context.describedBy ?? context.label ?? context.nativeTextAlternative);
    if (isNamedByContent) {
      const content = this.getNameFromContent(element, this.getChildContext(context));
      // Browsers fall back to the title of an element being named when its content is only white space.
      if (context.target === 'self' ? content.trim() : content) {
        return content;
      }
    }

    // Step 2I: the tooltip attribute.
    if (!isPresentational || tagName === 'IFRAME' || tagName === 'FRAME') {
      return this.getFirstNonBlankAttribute(element, ['title']);
    }
    return '';
  }

  /**
   * Gets the text a control contributes when it is embedded in the label or content of another element: the value of
   * a text box, the selected options of a list box or combo box, or the value of a range.
   * @param element {Element} The control.
   * @param role {string} The role of the control.
   * @param tagName {string} The normalized tag name of the control.
   * @param context {TextAlternativeContext} The state of the computation.
   * @returns {string | undefined} The text, or undefined if the element is not such a control.
   */
  private getEmbeddedControlName(element: Element, role: string, tagName: string, context: TextAlternativeContext): string | undefined {
    if (role === 'textbox' || role === 'searchbox') {
      return tagName === 'INPUT' || tagName === 'TEXTAREA' ? (element as HTMLInputElement | HTMLTextAreaElement).value : element.textContent;
    }
    if (role === 'combobox' || role === 'listbox') {
      const selectedOptions = this.getSelectedOptions(element, role, tagName);
      // Browsers use the value of an input combo box with no selected option, which the specification does not mention.
      if (!selectedOptions.length && tagName === 'INPUT') {
        return (element as HTMLInputElement).value;
      }
      return selectedOptions.map((option) => this.getTextAlternative(option, this.getChildContext(context))).join(' ');
    }
    if (this.rangeRoles.includes(role)) {
      return element.getAttribute('aria-valuetext') ?? element.getAttribute('aria-valuenow') ?? element.getAttribute('value') ?? '';
    }
    if (role === 'menu') {
      // https://github.com/w3c/accname/issues/67#issuecomment-553196887
      return '';
    }
    return undefined;
  }

  /**
   * Gets the selected options of a list box or combo box: those of a select element, or else its first option; or
   * the options marked aria-selected in the list box, which for a combo box is the list box it contains or owns.
   * @param element {Element} The list box or combo box.
   * @param role {string} The role of the element.
   * @param tagName {string} The normalized tag name of the element.
   * @returns {Element[]} The selected options.
   */
  private getSelectedOptions(element: Element, role: string, tagName: string): Element[] {
    if (tagName === 'SELECT') {
      const select = element as HTMLSelectElement;
      const selected = Array.from(select.selectedOptions);
      return selected.length || !select.options.length ? selected : [select.options[0]];
    }
    const listBox = role === 'combobox'
      ? this.getOwnedElements(element, '*').find((candidate) => this.ariaUtilities.getAriaRole(candidate) === 'listbox')
      : element;
    if (!listBox) {
      return [];
    }
    return this.getOwnedElements(listBox, '[aria-selected="true"]').filter((candidate) => this.ariaUtilities.getAriaRole(candidate) === 'option');
  }

  /**
   * Gets the elements matching a selector within an element or within the elements it owns through aria-owns.
   * @param element {Element} The element to search.
   * @param selector {string} The CSS selector to match.
   * @returns {Element[]} The matching descendants, then the matching owned elements and their matching descendants.
   */
  private getOwnedElements(element: Element, selector: string): Element[] {
    const result = Array.from(element.querySelectorAll(selector));
    for (const owned of this.ariaUtilities.getReferencedElements(element, 'aria-owns')) {
      if (owned.matches(selector)) {
        result.push(owned);
      }
      result.push(...Array.from(owned.querySelectorAll(selector)));
    }
    return result;
  }

  /**
   * Gets the name an input element has from its type, labels, and attributes.
   * @param element {HTMLInputElement} The input element.
   * @param context {TextAlternativeContext} The state of the computation.
   * @param hasLabelledBy {boolean} Whether the element has a valid aria-labelledby attribute.
   * @returns {string | undefined} The name, or undefined if the element should be named from its content.
   */
  private getInputName(element: HTMLInputElement, context: TextAlternativeContext, hasLabelledBy: boolean): string | undefined {
    // https://w3c.github.io/html-aam/#input-type-button-input-type-submit-and-input-type-reset-accessible-name-computation
    // Browsers use these even with aria-labelledby, as the specification says not to.
    if (['button', 'submit', 'reset'].includes(element.type)) {
      if (element.value.trim()) {
        return element.value;
      }
      return this.defaultButtonNames[element.type] ?? this.getFirstNonBlankAttribute(element, ['title']);
    }
    // There is no specification for file inputs; browsers use their labels, then the text of the button they show,
    // and do not use the title.
    if (element.type === 'file') {
      return element.labels?.length && !context.labelledBy ? this.getNameFromLabels(element.labels, context) : 'Choose File';
    }
    // https://w3c.github.io/html-aam/#input-type-image-accessible-name-computation
    // The specification says "Submit Query"; browsers say "Submit".
    if (element.type === 'image') {
      if (element.labels?.length && !context.labelledBy) {
        return this.getNameFromLabels(element.labels, context);
      }
      return this.getFirstNonBlankAttribute(element, ['alt', 'title']) || 'Submit';
    }
    return this.getFormControlName(element, context, hasLabelledBy);
  }

  /**
   * Gets the name a form control has from its labels, title, or placeholder.
   * @param element {HTMLInputElement | HTMLMeterElement | HTMLProgressElement | HTMLSelectElement | HTMLTextAreaElement} The form control.
   * @param context {TextAlternativeContext} The state of the computation.
   * @param hasLabelledBy {boolean} Whether the element has a valid aria-labelledby attribute.
   * @returns {string | undefined} The name, or undefined if the element has aria-labelledby and should be named from its content.
   */
  private getFormControlName(element: HTMLInputElement | HTMLMeterElement | HTMLProgressElement | HTMLSelectElement | HTMLTextAreaElement, context: TextAlternativeContext, hasLabelledBy: boolean): string | undefined {
    // https://w3c.github.io/html-aam/#input-type-text-input-type-password-input-type-number-input-type-search-input-type-tel-input-type-email-input-type-url-and-textarea-element-accessible-name-computation
    // https://w3c.github.io/html-aam/#other-form-elements-accessible-name-computation
    if (hasLabelledBy) {
      return undefined;
    }
    if (element.labels?.length) {
      return this.getNameFromLabels(element.labels, context);
    }
    const title = element.getAttribute('title') ?? '';
    const usesPlaceholder = element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && this.placeholderInputTypes.includes(element.type));
    return usesPlaceholder && !title ? element.getAttribute('placeholder') ?? '' : title;
  }

  /**
   * Gets the name an element has from its associated label elements.
   * @param labels {NodeListOf<HTMLLabelElement>} The label elements.
   * @param context {TextAlternativeContext} The state of the computation.
   * @returns {string} The text alternatives of the labels that have one, separated by spaces.
   */
  private getNameFromLabels(labels: NodeListOf<HTMLLabelElement>, context: TextAlternativeContext): string {
    return Array.from(labels, (label) => this.getTextAlternative(label, {
      includeHidden: context.includeHidden,
      visited: context.visited,
      label: { hidden: this.ariaUtilities.isHiddenForAria(label) },
    })).filter((name) => !!name).join(' ');
  }

  /**
   * Gets the text alternative of the first child of an element with a given tag name, such as the legend of a fieldset.
   * @param element {Element} The parent element.
   * @param childTagName {string} The normalized tag name of the child.
   * @param context {TextAlternativeContext} The state of the computation.
   * @returns {string | undefined} The text alternative of the child, or undefined if there is no such child.
   */
  private getNameFromChild(element: Element, childTagName: string, context: TextAlternativeContext): string | undefined {
    const child = Array.from(element.children).find((candidate) => this.domUtilities.getNormalizedElementTagName(candidate) === childTagName);
    if (!child) {
      return undefined;
    }
    return this.getTextAlternative(child, {
      ...this.getChildContext(context),
      nativeTextAlternative: { hidden: this.ariaUtilities.isHiddenForAria(child) },
    });
  }

  /**
   * Gets the name of an SVG element from its title child, or of an SVG link from its xlink:title attribute.
   * @param element {Element} The element.
   * @param tagName {string} The normalized tag name of the element.
   * @param context {TextAlternativeContext} The state of the computation.
   * @returns {string | undefined} The name, or undefined if the element is not SVG or has neither.
   */
  private getSvgName(element: Element, tagName: string, context: TextAlternativeContext): string | undefined {
    // https://www.w3.org/TR/svg-aam-1.0/#mapping_additional_nd
    if (!(element instanceof SVGElement)) {
      return undefined;
    }
    const title = Array.from(element.children).find((child) => child instanceof SVGTitleElement);
    if (title) {
      return this.getTextAlternative(title, {
        ...this.getChildContext(context),
        labelledBy: { hidden: this.ariaUtilities.isHiddenForAria(title) },
      });
    }
    return tagName === 'A' ? this.getFirstNonBlankAttribute(element, ['xlink:title']) || undefined : undefined;
  }

  /**
   * Gets the text of an element's content: its pseudo-elements, and the text alternatives of its child nodes, the
   * nodes assigned to it as a slot, its shadow root's child nodes, and the elements it owns through aria-owns.
   * @param element {Element} The element.
   * @param context {TextAlternativeContext} The state of the computation, for the element's children.
   * @returns {string} The text, before white space is collapsed.
   */
  private getNameFromContent(element: Element, context: TextAlternativeContext): string {
    const parts = [this.getCssContent(element, '::before') ?? ''];
    const content = this.getCssContent(element);
    if (content !== undefined) {
      // The content property replaces everything within the element.
      parts.push(content);
    } else {
      const assignedNodes = element instanceof HTMLSlotElement ? element.assignedNodes() : [];
      // A node assigned to a slot is visited through the slot rather than as a child of its shadow host.
      const nodes = assignedNodes.length ? assignedNodes : [
        ...Array.from(element.childNodes),
        ...Array.from(element.shadowRoot?.childNodes ?? []),
        ...this.ariaUtilities.getReferencedElements(element, 'aria-owns'),
      ].filter((node) => !(node as Element | Text).assignedSlot);
      for (const node of nodes) {
        parts.push(this.getNodeContentText(node, context));
      }
    }
    parts.push(this.getCssContent(element, '::after') ?? '');
    return parts.join('');
  }

  /**
   * Gets the text a node contributes to the content of its parent.
   * @param node {Node} The node.
   * @param context {TextAlternativeContext} The state of the computation.
   * @returns {string} The text of a text node, or the text alternative of an element, with spaces around it unless it
   * is displayed inline; empty for any other node.
   */
  private getNodeContentText(node: Node, context: TextAlternativeContext): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node as Text).data;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }
    const element = node as Element;
    const text = this.getTextAlternative(element, context);
    // Browsers separate the text of elements that are not inline, and of line breaks, with spaces.
    const display = this.domUtilities.getElementComputedStyle(element)?.display ?? 'inline';
    return display !== 'inline' || this.domUtilities.getNormalizedElementTagName(element) === 'BR' ? ` ${text} ` : text;
  }

  /**
   * Gets the text that the CSS content property gives an element or one of its pseudo-elements.
   * @param element {Element} The element.
   * @param pseudo {'::before' | '::after' | undefined} The pseudo-element. If omitted, the element itself.
   * @returns {string | undefined} The text, or undefined if there is no content, it is hidden, or it cannot be read.
   */
  private getCssContent(element: Element, pseudo?: '::before' | '::after'): string | undefined {
    // https://w3c.github.io/accname/#computation-steps step 2F.ii, and https://github.com/w3c/accname/issues/204
    const style = this.domUtilities.getElementComputedStyle(element, pseudo);
    if (!style || ['', 'none', 'normal'].includes(style.content) || style.display === 'none' || style.visibility === 'hidden') {
      return undefined;
    }
    const content = this.parseCssContent(element, style.content, !!pseudo);
    // Browsers separate the content of a pseudo-element that is not inline with spaces, as the specification does not.
    return pseudo && content !== undefined && style.display !== 'inline' ? ` ${content} ` : content;
  }

  /**
   * Reads the text of a CSS content property value: its alternative text after a slash if it has one, or else, for a
   * pseudo-element, its strings and attr() values. The content of an element itself can only be an image, so only its
   * alternative text is read.
   * @param element {Element} The element, whose attributes attr() reads.
   * @param value {string} The computed value of the content property.
   * @param isPseudo {boolean} Whether the value is that of a pseudo-element.
   * @returns {string | undefined} The text, or undefined if there is none or the value has parts that are not text.
   */
  private parseCssContent(element: Element, value: string, isPseudo: boolean): string | undefined {
    // https://developer.mozilla.org/en-US/docs/Web/CSS/content
    let tokens = this.tokenizeCssContent(value);
    const slashIndex = tokens.findIndex((token) => token.type === 'slash');
    if (slashIndex !== -1) {
      tokens = tokens.slice(slashIndex + 1);
    } else if (!isPseudo) {
      return undefined;
    }
    let text = '';
    for (const token of tokens) {
      if (token.type === 'string') {
        text += token.value;
        continue;
      }
      // Only Firefox leaves attr() unresolved in the computed value.
      /* istanbul ignore if -- @preserve */
      if (token.type === 'attr') {
        text += element.getAttribute(token.name) ?? '';
        continue;
      }
      return undefined;
    }
    return text;
  }

  /**
   * Splits a computed CSS content property value into strings, attr() references, slashes, and anything else.
   * @param value {string} The computed value.
   * @returns {CssContentToken[]} The tokens, in order.
   */
  private tokenizeCssContent(value: string): CssContentToken[] {
    const tokens: CssContentToken[] = [];
    let index = 0;
    while (index < value.length) {
      const character = value[index];
      if (/\s/.test(character)) {
        index++;
      } else if (character === '"') {
        const [text, end] = this.readCssString(value, index);
        tokens.push({ type: 'string', value: text });
        index = end;
      } else if (character === '/') {
        tokens.push({ type: 'slash' });
        index++;
      } else {
        const end = this.findCssComponentEnd(value, index);
        const attr = /^attr\(\s*([-\w]+)\s*\)$/i.exec(value.slice(index, end));
        // Only Firefox leaves attr() unresolved in the computed value.
        /* istanbul ignore next -- @preserve */
        tokens.push(attr ? { type: 'attr', name: attr[1] } : { type: 'other' });
        index = end;
      }
    }
    return tokens;
  }

  /**
   * Reads a CSS string, as a computed value serializes it in double quotes, resolving its escapes.
   * @param value {string} The text containing the string.
   * @param start {number} The index of the opening quote.
   * @returns {[string, number]} The string's value, and the index just past its closing quote.
   */
  private readCssString(value: string, start: number): [string, number] {
    // https://www.w3.org/TR/css-syntax-3/#consume-string-token
    const quote = value[start];
    let text = '';
    let index = start + 1;
    while (index < value.length && value[index] !== quote) {
      if (value[index] === '\\') {
        const hex = /^[0-9a-f]{1,6}\s?/i.exec(value.slice(index + 1));
        if (hex) {
          text += String.fromCodePoint(parseInt(hex[0], 16));
          index += hex[0].length + 1;
        } else {
          text += value[index + 1];
          index += 2;
        }
      } else {
        text += value[index];
        index++;
      }
    }
    return [text, index + 1];
  }

  /**
   * Finds the end of a CSS component that is not a string or slash, such as a keyword or a function like url(), whose
   * parentheses may hold strings and nested functions.
   * @param value {string} The text containing the component.
   * @param start {number} The index of the component's first character.
   * @returns {number} The index just past the component.
   */
  private findCssComponentEnd(value: string, start: number): number {
    let depth = 0;
    let index = start;
    while (index < value.length) {
      const character = value[index];
      if (character === '"') {
        index = this.readCssString(value, index)[1];
        continue;
      }
      if (character === '(') {
        depth++;
      } else if (character === ')') {
        depth--;
        if (depth === 0) {
          return index + 1;
        }
      } else if (depth === 0 && /\s/.test(character)) {
        return index;
      }
      index++;
    }
    return index;
  }

  /**
   * Gets a value indicating whether an element's role lets it be named from its content.
   * @param role {string} The role of the element; empty if it has none.
   * @param isDescendant {boolean} Whether the element is a descendant of the element being named.
   * @returns {boolean} True if the element's content can name it; otherwise, false.
   */
  private allowsNameFromContent(role: string, isDescendant: boolean): boolean {
    return this.nameFromContentRoles.includes(role) || (isDescendant && this.nameFromDescendantContentRoles.includes(role));
  }

  /**
   * Gets the value of the first of an element's attributes that is not empty or white space.
   * @param element {Element} The element.
   * @param attributeNames {string[]} The names of the attributes, in order of preference.
   * @returns {string} The attribute's value, or empty if none of them has one.
   */
  private getFirstNonBlankAttribute(element: Element, attributeNames: string[]): string {
    for (const attributeName of attributeNames) {
      const value = element.getAttribute(attributeName) ?? '';
      if (value.trim()) {
        return value;
      }
    }
    return '';
  }

  /**
   * Gets the state of the computation for the children of an element.
   * @param context {TextAlternativeContext} The state of the computation for the element.
   * @returns {TextAlternativeContext} The same state, marking the element being named, if it was this element, as an ancestor.
   */
  private getChildContext(context: TextAlternativeContext): TextAlternativeContext {
    return { ...context, target: context.target === 'self' ? 'descendant' : context.target };
  }

  /**
   * Converts text to a flat string: zero-width spaces and soft hyphens removed, and runs of white space other than
   * non-breaking spaces collapsed to one space and trimmed.
   * @param value {string} The text.
   * @returns {string} The flat string.
   */
  private normalizeFlatString(value: string): string {
    // https://w3c.github.io/accname/#terminology
    return value.split('\u00A0').map((chunk) => chunk.replace(/[\u200b\u00ad]/g, '').replace(/\s+/g, ' ')).join('\u00A0').trim();
  }
}

export default AccessibleNameCalculator;
