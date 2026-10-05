import AriaUtilities from './ariaUtilities.js';
import DOMUtilities from './domUtilities.js';
import NodePreviewer from './nodePreviewer.js';
import { TimeoutWaiter, RequestAnimationFrameWaiter } from './waiter.js';

export type ElementState = 'visible' | 'hidden' | 'enabled' | 'disabled' | 'editable' | 'checked' | 'unchecked' | 'indeterminate' | 'stable' | 'inview' | 'notinview' | 'unviewable';
export type ElementStateWithoutStable = Exclude<ElementState, 'stable'>;
export type ElementStateQueryResult = { matches: boolean, received?: string, isRadio?: boolean };

export type AriaStates = {
  checked?: boolean | 'mixed',
  pressed?: boolean | 'mixed',
  expanded?: boolean,
  selected?: boolean,
  level?: number,
  disabled?: boolean,
};

export type ElementInteractionType = 'click' | 'doubleclick' | 'hover' | 'drag' | 'drop' | 'type' | 'clear' | 'screenshot';
export type ElementInteractionReadyResult = 'ready' | 'notready' | 'needsscroll';
export type ElementInteractionReadiness = {
  status: ElementInteractionReadyResult,
  interactionPoint?: { x: number, y: number },
  interactionOffset?: { x: number, y: number },
  reason?: string,
};

export type Box = {
  visible: boolean;
  inline: boolean;
  rect?: DOMRect;
  // Note: we do not store the CSSStyleDeclaration object, because it is a live object
  // and changes values over time. This does not work for caching or comparing to the
  // old values. Instead, store all the properties separately.
  cursor?: CSSStyleDeclaration['cursor'];
};

/**
 * Inspector for element states and interactions.
 */
class ElementStateInspector {
  private readonly ariaUtilities = new AriaUtilities();
  private readonly domUtilities = new DOMUtilities();
  private readonly nodePreviewer = new NodePreviewer();
  // Computed styles are live, so a cached one stays current; holding them weakly lets removed elements be collected.
  private readonly cacheStyle = new WeakMap<Element, CSSStyleDeclaration | undefined>();
  private readonly cacheStyleBefore = new WeakMap<Element, CSSStyleDeclaration | undefined>();
  private readonly cacheStyleAfter = new WeakMap<Element, CSSStyleDeclaration | undefined>();

  /**
   * Queries a Node for a list of states.
   * @param node {Node} The node to query, which will be transformed into the nearest element to query the state.
   * @param states {ElementState[]} The states to query.
   * @returns {Promise<{ status: 'success' } | { status: 'failure', missingState: ElementState } | { status: 'error', message: string }>} 
   * A Promise that resolves to an object with the status of the query.
   * - 'success' if all states are present.
   * - 'failure' if at least one state is missing.
   * - 'error' if the node is not connected, or cannot have a queried state.
   * - 'missingState' is the state that is missing.
   * - 'message' is the message of the error: 'notconnected'; 'noteditable' for an element that is not an <input>,
   * <textarea>, <select> or [contenteditable] and does not have a role allowing [aria-readonly]; or 'notcheckable'
   * for an element that is not a checkbox or radio button and does not have a role allowing [aria-checked].
   */
  async queryElementStates(node: Node, states: ElementState[]): Promise<{ status: 'success' } | { status: 'failure', missingState: ElementState } | { status: 'error', message: string }> {
    if (states.includes('stable')) {
      const stableResult = await this.checkElementIsStable(node);
      if (stableResult === false) {
        return { status: 'failure', missingState: 'stable' };
      }
      if (stableResult === 'error:notconnected') {
        return { status: 'error', message: 'notconnected' };
      }
    }
    for (const state of states) {
      if (state !== 'stable') {
        const result = await this.queryElementState(node, state);
        if (result.received === 'error:notconnected' || result.received === 'error:noteditable' || result.received === 'error:notcheckable') {
          return { status: 'error', message: result.received.substring('error:'.length) };
        }
        if (!result.matches) {
          return { status: 'failure', missingState: result.received as ElementState };
        }
      }
    }
    return { status: 'success' };
  }

  /**
   * Queries a Node for a single state.
   * @param node {Node} The node to query, which will be transformed into the nearest element to query the state.
   * @param state {ElementStateWithoutStable} The state to query.
   * @returns {Promise<ElementStateQueryResult>} A Promise that resolves to an object with the status of the query.
   * - 'matches' is true if the state is present.
   * - 'received' is the state that was received, 'error:notconnected' if the element is not connected,
   * 'error:noteditable' if the editable state is queried for an element that cannot be edited, or
   * 'error:notcheckable' if a checked state is queried for an element that cannot be checked.
   * - 'isRadio', for a checked state, is true if the element is a radio button, which clicking cannot uncheck.
   * @throws {Error} If an invalid state is provided.
   */
  async queryElementState(node: Node, state: ElementStateWithoutStable): Promise<ElementStateQueryResult> {
    // CONSIDER: There is a risk that the element becomes disconnected from the DOM
    // after this block, but before the query of the specified state is performed.
    // This is unlikely to happen in practice, but it is a possibility, and will
    // require a refactor to handle this edge case.
    const element = this.findElementFromNode(node, 'none');
    if (!element?.isConnected) {
      return { matches: false, received: 'error:notconnected' };
    }

    if (state === 'visible' || state === 'hidden') {
      const visible = this.isElementVisible(element);
      return {
        matches: state === 'visible' ? visible : !visible,
        received: visible ? 'visible' : 'hidden'
      };
    }

    if (state === 'disabled' || state === 'enabled') {
      const disabled = this.isElementDisabled(element);
      return {
        matches: state === 'disabled' ? disabled : !disabled,
        received: disabled ? 'disabled' : 'enabled'
      };
    }

    if (state === 'editable') {
      const disabled = this.isElementDisabled(element);
      const readonly = this.isElementReadOnly(element);
      if (readonly === 'error') {
        return { matches: false, received: 'error:noteditable' };
      }
      return {
        matches: !disabled && !readonly,
        received: disabled ? 'disabled' : readonly ? 'readOnly' : 'editable'
      };
    }

    if (state === 'checked' || state === 'unchecked' || state === 'indeterminate') {
      const checked = this.ariaUtilities.getAriaChecked(element);
      if (checked === undefined) {
        return { matches: false, received: 'error:notcheckable' };
      }
      const received = checked === 'mixed' ? 'indeterminate' : checked ? 'checked' : 'unchecked';
      return { matches: received === state, received, isRadio: this.ariaUtilities.isAriaRadio(element) };
    }

    if (state === 'inview') {
      const inView = await this.isElementInViewPort(element);
      const scrollable = inView ? true : this.isElementScrollable(element);
      return {
        matches: inView && scrollable,
        received: inView ? 'inview' : scrollable ? 'notinview' : 'unviewable'
      };
    }

    throw this.createError(`Unexpected element state "${state}"`);
  }

  /**
   * Checks if an element is ready for an interaction.
   * @param element {Element} The element to check.
   * @param interactionType {ElementInteractionType} The type of interaction to check.
   * @param hitPointOffset {?{x: number, y: number}} The offset of the hit point from the center of the element.
   * @returns {Promise<ElementInteractionReadiness>}
   * A Promise that resolves to an object with the status of the check.
   * - 'status' is the status of the check: 'ready', 'needsscroll' or 'notready'.
   * - 'interactionPoint' is the hit point of the interaction, if the element is ready for the interaction.
   * - 'interactionOffset' is the offset of the hit point from the element's in-view center point, if the element is
   * ready for the interaction.
   * - 'needsscroll' if the element is not in the view port, but can be scrolled into view.
   * - 'notready' if the element is not ready for the interaction, with a 'reason': the state seen (such as 'hidden',
   * 'disabled', 'readOnly', 'stable', or 'unviewable' for an element hidden by overflow), 'notconnected',
   * 'noteditable' for typing into an element that cannot be edited, 'element is not in view port', 'element is not
   * visible' with its size, or 'obscured by' and a preview of the element hit instead.
   */
  async isInteractionReady(element: Element, interactionType: ElementInteractionType, hitPointOffset?: { x: number, y: number }): Promise<ElementInteractionReadiness> {
    const states: ElementState[] = ['stable', 'visible', 'inview'];
    if (interactionType === 'click' || interactionType === 'doubleclick' || interactionType === 'hover' || interactionType === 'drag') {
      states.push('enabled');
    }
    if (interactionType === 'type' || interactionType === 'clear') {
      states.push('enabled', 'editable');
    }
    const result = await this.queryElementStates(element, states);
    if (result.status === 'error') {
      return { status: 'notready', reason: result.message };
    }
    if (result.status === 'failure') {
      if (result.missingState === 'notinview') {
        return { status: 'needsscroll' };
      }
      return { status: 'notready', reason: result.missingState };
    }

    const clickPoint = await this.getElementClickPoint(element, hitPointOffset);
    if (clickPoint.status === 'error') {
      return { status: 'notready', reason: clickPoint.message };
    }
    // Reported as an offset from the element's in-view center point too, which is where a WebDriver
    // element origin places the pointer, so that the interaction can be aimed from the element.
    // A successful click point always has a hit point.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const hitPoint = clickPoint.hitPoint!;
    const center = this.getInViewCenterPoint(element);
    return {
      status: 'ready',
      interactionPoint: hitPoint,
      interactionOffset: { x: hitPoint.x - center.x, y: hitPoint.y - center.y },
    };
  }

  /**
   * Waits for an element to be ready for an interaction.
   * @param element {Element} The element to wait for.
   * @param interactionType {ElementInteractionType} The type of interaction to wait for.
   * @param timeoutInMilliseconds {number} The timeout in milliseconds.
   * @param hitPointOffset {?{x: number, y: number}} The offset of the hit point from the center of the element.
   * @returns {Promise<{x: number, y: number}>} A Promise that resolves to the hit point of the interaction.
   * - 'x' is the x coordinate of the hit point.
   * - 'y' is the y coordinate of the hit point.
   * @throws {Error} If the element is not ready for the interaction before the timeout is reached.
   */
  async waitForInteractionReady(element: Element, interactionType: ElementInteractionType, timeoutInMilliseconds: number, hitPointOffset?: { x: number, y: number }): Promise<{x: number, y: number}> {
    const pollIntervals = [0, 0, 20, 50, 100, 100, 500];
    
    const waiter = new TimeoutWaiter<{x: number, y: number} | null>(
      async () => {
        const result = await this.isInteractionReady(element, interactionType, hitPointOffset);
        
        if (result.status === 'needsscroll') {
          element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
        }
        
        if (result.status === 'ready') {
          return result.interactionPoint ?? { x: 0, y: 0 };
        }
        
        return null; // Continue polling
      },
      timeoutInMilliseconds,
      pollIntervals
    );
    
    try {
      const result = await waiter.waitForCondition();
      // The waiter only resolves with a truthy value, so result will never be null here
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return result!;
    } catch {
      throw new Error('timeout waiting for interaction to be ready');
    }
  }

  /**
   * Gets the bounding rectangle of an element in the view port.
   * @param element {Element}The element to get the bounding rectangle of.
   * @returns {Promise<{ x: number, y: number, width: number, height: number } | undefined>} 
   * A Promise that resolves to the bounding rectangle of the element in the view port, or undefined if the element
   * is not in the view port.
   * - 'x' is the x coordinate of the bounding rectangle.
   * - 'y' is the y coordinate of the bounding rectangle.
   * - 'width' is the width of the bounding rectangle.
   * - 'height' is the height of the bounding rectangle.
   * - 'undefined' if the element is not in the view port.
   */
  async getElementInViewPortRect(element: Element): Promise<{ x: number, y: number, width: number, height: number } | undefined> {
    if (element.matches('option, optgroup')) {
      const nearestSelect = element.closest('select');
      if (!nearestSelect) {
        return undefined;
      }
      return this.getElementInViewPortRect(nearestSelect);
    }

    const entry = await this.checkElementViewPortIntersection(element);
    if (!entry?.isIntersecting) {
      return undefined;
    }
    return entry.intersectionRect;
  }

  /**
   * Checks if an element is in the view port.
   * @param element {Element}The element to check.
   * @returns {Promise<boolean>} A Promise that resolves to a boolean indicating if the element is in the view port.
   */
  async isElementInViewPort(element: Element): Promise<boolean> {
    if (element.matches('option, optgroup')) {
      const nearestSelect = element.closest('select');
      if (!nearestSelect) {
        return false;
      }
      return this.isElementInViewPort(nearestSelect);
    }
    const entry = await this.checkElementViewPortIntersection(element);
    if (!entry) {
      return false;
    }
    return entry.isIntersecting;
  }

  /**
   * Checks if an element is visible.
   * @param element The element to check.
   * @returns {boolean} A boolean indicating if the element is visible.
   */
  isElementVisible(element: Element): boolean {
    return this.computeBox(element).visible;
  }

  /**
   * Checks, for each of several elements, whether its rendered text contains a string. Text is compared ignoring
   * case, with each run of whitespace treated as one space and whitespace at either end ignored.
   * @param elements The elements to check.
   * @param text The text to look for; empty text is contained in every element.
   * @returns {boolean[]} For each element, in order, whether its text contains the string.
   */
  elementsContainText(elements: Element[], text: string): boolean[] {
    const normalize = (value: string) => this.normalizeWhiteSpace(value).toLowerCase();
    const expected = normalize(text);
    return elements.map((element) => normalize(this.domUtilities.getNodeText(element)).includes(expected));
  }

  /**
   * Finds the open shadow roots within some scopes, including nested ones, so that a search can include them.
   * @param scopes The documents, elements, or shadow roots to search.
   * @returns {ShadowRoot[]} The open shadow roots, each once, in the order found.
   */
  findOpenShadowRoots(scopes: Array<Document | Element | ShadowRoot>): ShadowRoot[] {
    return this.domUtilities.getOpenShadowRoots(scopes);
  }

  /**
   * Checks, for each of several elements, whether it has every given ARIA state. A state that does not apply to
   * an element, such as checked for a link, does not match.
   * @param elements The elements to check.
   * @param states The states each element must have; an omitted state is not checked.
   * @returns {boolean[]} For each element, in order, whether it has every given state.
   */
  elementsMatchAriaStates(elements: Element[], states: AriaStates): boolean[] {
    return elements.map((element) =>
      (states.checked === undefined || this.ariaUtilities.getAriaChecked(element) === states.checked) &&
      (states.pressed === undefined || this.ariaUtilities.getAriaPressed(element) === states.pressed) &&
      (states.expanded === undefined || this.ariaUtilities.getAriaExpanded(element) === states.expanded) &&
      (states.selected === undefined || this.ariaUtilities.getAriaSelected(element) === states.selected) &&
      (states.level === undefined || this.ariaUtilities.getAriaLevel(element) === states.level) &&
      (states.disabled === undefined || this.isElementDisabled(element) === states.disabled));
  }

  /**
   * Finds the elements within some scopes whose labels match a text. An element's labels are the elements its
   * aria-labelledby attribute refers to; failing that, its aria-label attribute; failing that, the label elements
   * of a form control. Labels are compared as elementsContainText compares text; with exact, the whole label must
   * match, with case.
   * @param scopes The documents or elements to search within, not including the elements themselves.
   * @param text The text to match.
   * @param exact Whether the whole label must match, with case.
   * @returns {Element[]} The matching elements, in the order found, each once.
   */
  findElementsByLabel(scopes: Array<Document | Element>, text: string, exact: boolean): Element[] {
    const expected = exact ? this.normalizeWhiteSpace(text) : this.normalizeWhiteSpace(text).toLowerCase();
    const matches = new Set<Element>();
    for (const scope of scopes) {
      for (const element of Array.from(scope.querySelectorAll('*'))) {
        const labelMatches = this.getElementLabels(element).some((label) => {
          const normalized = this.normalizeWhiteSpace(label);
          return exact ? normalized === expected : normalized.toLowerCase().includes(expected);
        });
        if (labelMatches) {
          matches.add(element);
        }
      }
    }
    return Array.from(matches);
  }

  /**
   * Checks if an element is disabled.
   * @param element The element to check.
   * @returns {boolean} A boolean indicating if the element is disabled.
   */
  isElementDisabled(element: Element): boolean {
    // https://www.w3.org/TR/wai-aria-1.2/#aria-disabled
    // Note that aria-disabled applies to all descendants, so we look up the hierarchy.
    return this.domUtilities.isNativelyDisabled(element) || this.ariaUtilities.hasExplicitAriaDisabled(element);
  }

  /**
   * Checks if an element is read only.
   * @param element The element to check.
   * @returns {boolean | 'error'} A boolean indicating if the element is read only, 
   * or 'error' if the element is not an <input>, <textarea>, <select>, or [contenteditable]
   * and does not have a role allowing [aria-readonly].
   */
  isElementReadOnly(element: Element): boolean | 'error' {
    const tagName = this.domUtilities.getNormalizedElementTagName(element);
    // https://www.w3.org/TR/wai-aria-1.2/#aria-checked
    // https://www.w3.org/TR/html-aam-1.0/#html-attribute-state-and-property-mappings
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)) {
      return element.hasAttribute('readonly');
    }
    if (this.ariaUtilities.isAriaReadOnlyRole(element)) {
      return element.getAttribute('aria-readonly') === 'true';
    }
    if ((element as HTMLElement).isContentEditable) {
      return false;
    }
    return 'error';
  }

  /**
   * Checks if an element is scrollable into view.
   * @param element The element to check.
   * @returns {boolean} A boolean indicating if the element is scrollable into view.
   */
  isElementScrollable(element: Element): boolean {
    const style = this.getElementComputedStyle(element);
    if (!style) {
      return true;
    }

    return !this.isHiddenByOverflow(element, style);
  }

  /**
   * Gets a click point of an element.
   * @param targetElement The element to get the click point of.
   * @param offset The offset of the click point from the center of the element.
   * @returns {Promise<{ status: 'success' | 'error', message?: string, hitPoint?: { x: number, y: number } }>} A Promise that resolves to an object with information about the click point.
   * - 'status' is the status of the check.
   * - 'message' is the message of the error, if the status is 'error'.
   * - 'hitPoint' is the hit point of the click, if the status is 'success'.
   *   - 'x' is the x coordinate of the click point.
   *   - 'y' is the y coordinate of the click point.
   */
  async getElementClickPoint(targetElement: Element, offset?: { x: number, y: number }): Promise<{ status: 'success' | 'error', message?: string, hitPoint?: { x: number, y: number } }> {
    const roots = this.getComponentRootElements(targetElement);

    const rect = await this.getElementInViewPortRect(targetElement);
    if (!rect) {
      return { status: 'error', message: 'element is not in view port' };
    }
    if (rect.width === 0 || rect.height === 0) {
      return { status: 'error', message: `element is not visible (width: ${rect.width}, height: ${rect.height})` };
    }

    const hitPoint = {
      x: rect.x + rect.width / 2 + (offset?.x ?? 0),
      y: rect.y + rect.height / 2 + (offset?.y ?? 0),
    };

    // Check whether hit target is the target or its descendant.
    const hitParents: Element[] = [];
    let hitElement = this.getHitElementFromPoint(roots, hitPoint);
    while (hitElement && hitElement !== targetElement) {
      hitParents.push(hitElement);
      // Prefer the composed tree over the light-dom tree, as browser performs
      // hit testing on the composed tree. Note that we will still eventually
      // climb to the light-dom parent, as any element distributed to a slot
      // is a direct child of the shadow host that contains the slot.
      hitElement = hitElement.assignedSlot ?? this.domUtilities.getParentElementOrShadowHost(hitElement);
    }

    if (hitElement === targetElement) {
      return { status: 'success', hitPoint };
    }

    return { status: 'error', message: `obscured by ${this.createElementObscuredErrorMessage(targetElement, hitParents)}` };
  }

  /**
   * Gets a list of the document or shadow root elements that contain the target element.
   * @param targetElement {Element} The element to get the component root elements of.
   * @returns {Array<Document | ShadowRoot>} An array of component root elements.
   */
  private getComponentRootElements(targetElement: Element): Array<Document | ShadowRoot> { 
    const roots: Array<Document | ShadowRoot> = [];

    // Get all component roots leading to the target element.
    // Go from the bottom to the top to make it work with closed shadow roots.
    let parentElement = targetElement;
    while (parentElement) {
      const root = this.domUtilities.getEnclosingShadowRootOrDocument(parentElement);
      if (!root) {
        break;
      }
      roots.push(root);
      if (root.nodeType === Node.DOCUMENT_NODE) {
        break;
      }
      parentElement = (root as ShadowRoot).host;
    }

    return roots;
  }

  /**
   * Gets the element that is hit by a point.
   * @param componentRootElements {Array<Document | ShadowRoot>} The document or shadow root elements to check.
   * @param hitPoint {x: number, y: number} The point to check.
   * @returns {Element | undefined} The element that is hit by the point, or undefined if no element is hit.
   */
  private getHitElementFromPoint(componentRootElements: Array<Document | ShadowRoot>, hitPoint: { x: number, y: number }): Element | undefined {
    // Hit target in each component root should point to the next component root.
    // Hit target in the last component root should point to the target or its descendant.
    let hitElement: Element | undefined;
    for (let index = componentRootElements.length - 1; index >= 0; index--) {
      const root = componentRootElements[index];
      // All browsers have different behavior around elementFromPoint and elementsFromPoint.
      // https://github.com/w3c/csswg-drafts/issues/556
      // http://crbug.com/1188919
      const elements: Element[] = root.elementsFromPoint(hitPoint.x, hitPoint.y);
      const singleElement = root.elementFromPoint(hitPoint.x, hitPoint.y);
      if (singleElement && elements[0] && this.domUtilities.getParentElementOrShadowHost(singleElement) === elements[0]) {
        const style = globalThis.getComputedStyle(singleElement);
        // Ignore this block for code coverage, as it is only applicable to chromium.
        /* istanbul ignore next -- @preserve */
        if (style?.display === 'contents') {
          // Workaround a case where elementsFromPoint misses the inner-most element with display:contents.
          // https://bugs.chromium.org/p/chromium/issues/detail?id=1342092
          elements.unshift(singleElement);
        }
      }
      // Ignore this block for code coverage, as it is only applicable to webkit-based browsers.
      /* istanbul ignore next -- @preserve */
      if (elements[0]?.shadowRoot === root && elements[1] === singleElement) {
        // Workaround webkit but where first two elements are swapped:
        // <host>
        //   #shadow root
        //     <target>
        // elementsFromPoint produces [<host>, <target>], while it should be [<target>, <host>]
        // In this case, just ignore <host>.
        elements.shift();
      }
      const innerElement = elements[0] as Element | undefined;

      if (!innerElement) {
        break;
      }
      hitElement = innerElement;
      if (index && innerElement !== (componentRootElements[index - 1] as ShadowRoot).host) {
        // It is not expected to happen, but it is possible that the innerElement
        // is not the host of the component root elements.
        // This is a defensive code path to handle this edge case.
        /* istanbul ignore next -- @preserve */
        break;
      }
    }
    return hitElement;
  }

  /**
   * Gets the texts of an element's labels, as findElementsByLabel matches them: the elements it is labelled by,
   * its aria-label, or its label elements.
   * @param element The element.
   * @returns {string[]} The texts, or an empty list if the element is not labelled.
   */
  getElementLabels(element: Element): string[] {
    const labelledBy = this.ariaUtilities.getAriaLabelledByElements(element);
    if (labelledBy) {
      return labelledBy.map((label) => this.domUtilities.getNodeText(label));
    }
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel !== null && ariaLabel.trim() !== '') {
      return [ariaLabel];
    }
    const labels = (element as HTMLInputElement).labels;
    return labels ? Array.from(labels, (label) => this.domUtilities.getNodeText(label)) : [];
  }

  /**
   * Collapses each run of whitespace to one space and removes whitespace at either end.
   * @param value The text.
   * @returns {string} The normalized text.
   */
  private normalizeWhiteSpace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  /**
   * Gets a value indicating whether an element is hidden by overflow of its containing elements.
   * @param element {Element} The element to check.
   * @param style {CSSStyleDeclaration} The computed style of the element.
   * @returns {boolean} True if the element is hidden by overflow; otherwise, false.
   */
  private isHiddenByOverflow(element: Element, style: CSSStyleDeclaration): boolean {
    // If the element is not hidden by overflow, return false.
    if (!this.checkIsHiddenByOverflow(element, style)) {
      return false;
    }
    // If the element is hidden by overflow, check if all its children are also hidden by overflow.
    const children = Array.from(element.childNodes)
      .filter(child => this.findElementFromNode(child, 'none') !== null)
      .reduce<Element[]>((accumulator, current: ChildNode) => {
        if (!accumulator.includes(current as Element)) {
          accumulator.push(current as Element);
        }
        return accumulator;
      }, []);
    const childrenHiddenByOverflow = children.filter(child => {
      const childBox = this.computeBox(child);
      const hasPositiveSize = childBox.rect && childBox.visible;
      if (!hasPositiveSize) {
        return true;
      }
      const childStyle = this.getElementComputedStyle(child);
      if (!childStyle) {
        return true;
      }
      return this.isHiddenByOverflow(child, childStyle);
    });
    return childrenHiddenByOverflow.length === children.length;
  }

  /**
   * Gets a value indicating whether an element is hidden by overflow of its containing elements.
   * @param element {Element} The element to check.
   * @param style {CSSStyleDeclaration} The computed style of the element.
   * @returns {boolean} True if the element is hidden by overflow of its containing elements; otherwise, false.
   */
  private checkIsHiddenByOverflow(element: Element, style: CSSStyleDeclaration): boolean {
    const htmlElement = element.ownerDocument.documentElement;
    let parentElement = this.getNearestOverflowAncestor(element, style, htmlElement);
    while (parentElement) {
      const parentStyle = this.getElementComputedStyle(parentElement);
      if (!parentStyle) {
        return true;
      }
      const parentOverflowX = parentStyle.getPropertyValue('overflow-x');
      const parentOverflowY = parentStyle.getPropertyValue('overflow-y');

      // If the container has overflow:visible, the element cannot be hidden in its overflow.
      if (parentOverflowX !== 'visible' || parentOverflowY !== 'visible') {
        // Zero-sized containers without overflow:visible hide all descendants.
        const parentBox = this.computeBox(parentElement);
        if (!parentBox.rect || !parentBox.visible) {
          return true;
        }

        const elementBox = this.computeBox(element);
        if (!elementBox.rect || !elementBox.visible) {
          return true;
        }

        const parentRect = parentBox.rect;
        const elementRect = elementBox.rect;

        // Check "underflow": if an element is to the left or above the container
        // and overflow is "hidden" in the proper direction, the element is hidden.
        const isLeftOf = elementRect.x + elementRect.width < parentRect.x;
        const isAbove = elementRect.y + elementRect.height < parentRect.y;
        if ((isLeftOf && parentOverflowX === 'hidden') ||
            (isAbove && parentOverflowY === 'hidden')) {
          return true;
        }

        // Check "overflow": if an element is to the right or below a container
        // and overflow is "hidden" in the proper direction, the element is hidden.
        const isRightOf = elementRect.x >= parentRect.x + parentRect.width;
        const isBelow = elementRect.y >= parentRect.y + parentRect.height;
        if ((isRightOf && parentOverflowX === 'hidden') ||
            (isBelow && parentOverflowY === 'hidden')) {
          return true;
        } else if ((isRightOf && parentOverflowX !== 'visible') ||
            (isBelow && parentOverflowY !== 'visible')) {
          // Special case for "fixed" elements: whether it is hidden by
          // overflow depends on the scroll position of the parent element
          if (style.getPropertyValue('position') === 'fixed') {
            const isParentHtmlElement = parentElement.tagName === 'HTML';
            if (isParentHtmlElement && !parentElement.ownerDocument.scrollingElement) {
              return true;
            }
            // We can safely access the scrollingElement property because we know it is not null.
            // The else branch is defensive code that's unreachable in practice because
            // getNearestOverflowAncestor always returns the HTML element for fixed position elements.
            const scrollPosition = isParentHtmlElement ? {
              x: parentElement.ownerDocument.scrollingElement?.scrollLeft ?? 0,
              y: parentElement.ownerDocument.scrollingElement?.scrollTop ?? 0
            } : /* istanbul ignore next -- @preserve */ {
              x: parentElement.scrollLeft,
              y: parentElement.scrollTop
            };
            if ((elementRect.x >= htmlElement.scrollWidth - scrollPosition.x) ||
                (elementRect.y >= htmlElement.scrollHeight - scrollPosition.y)) {
              return true;
            }
          }
        }
      }
      parentElement = this.getNearestOverflowAncestor(parentElement, parentStyle, htmlElement);
    }
    return false;
  }

  /**
   * Gets the nearest overflow ancestor of an element.
   * @param element {Element} The element to check.
   * @param style {CSSStyleDeclaration} The computed style of the element.
   * @param htmlElement {HTMLElement} The HTML element to check.
   * @returns {Element | null} The nearest overflow ancestor of the element, or null if no overflow ancestor is found.
   */
  private getNearestOverflowAncestor(element: Element, style: CSSStyleDeclaration, htmlElement: HTMLElement): Element | null {
    const elementPosition = style.getPropertyValue('position');
    if (elementPosition === 'fixed') {
      return element === htmlElement ? null : htmlElement;
    }

    let container = element.parentElement;
    if (!container) {
      return null;
    }

    const containerStyle = this.getElementComputedStyle(container);
    if (!containerStyle) {
      return null;
    }

    while (container && !this.canBeOverflowed(container, containerStyle, htmlElement)) {
      container = container.parentElement;
    }

    return container;
  }

  /**
   * Gets a value indicating whether an element can be overflowed.
   * @param element {Element} The element to check.
   * @param style {CSSStyleDeclaration} The computed style of the element.
   * @param htmlElement {HTMLElement} The root HTML element containing the element.
   * @returns {boolean} True if the element can be overflowed; otherwise, false.
   */
  private canBeOverflowed(element: Element, style: CSSStyleDeclaration, htmlElement: HTMLElement): boolean {
    if (element === htmlElement) {
      return true;
    }

    const containerStyle = this.getElementComputedStyle(element);
    if (!containerStyle) {
      return true;
    }

    const containerDisplay = containerStyle.getPropertyValue('display');
    if (containerDisplay.startsWith('inline') || containerDisplay === 'contents') {
      return false;
    }

    const elementPosition = style.getPropertyValue('position');
    const containerPosition = containerStyle.getPropertyValue('position');
    if (elementPosition === 'absolute' && containerPosition === 'static') {
      return false;
    }

    return true;
  }

  /**
   * Creates an error message for an element that is obscured by another element, including a description
   * of the element that is obscuring the target element.
   * @param targetElement {Element} The element that is obscured.
   * @param hitParents {Element[]} The elements that are in the chain of the target element.
   * @returns {string} The error message.
   */
  /**
   * Gets an element's in-view center point, as WebDriver defines it: the center of the element's first client
   * rectangle, clipped to the viewport, with each coordinate rounded down.
   * @param element The element.
   * @returns The point, in viewport coordinates.
   */
  private getInViewCenterPoint(element: Element): { x: number, y: number } {
    const rect = element.getClientRects()[0];
    const left = Math.max(0, Math.min(rect.left, rect.right));
    const right = Math.min(window.innerWidth, Math.max(rect.left, rect.right));
    const top = Math.max(0, Math.min(rect.top, rect.bottom));
    const bottom = Math.min(window.innerHeight, Math.max(rect.top, rect.bottom));
    return { x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2) };
  }

  private createElementObscuredErrorMessage(targetElement: Element, hitParents: Element[]): string {
    const hitTargetDescription = this.nodePreviewer.previewNode(hitParents[0] || document.documentElement);
    // Root is the topmost element in the hitTarget's chain that is not in the
    // element's chain. For example, it might be a dialog element that overlays
    // the target.
    let rootHitTargetDescription: string | undefined;
    let element: Element | undefined = targetElement;
    while (element) {
      const index = hitParents.indexOf(element);
      if (index !== -1) {
        if (index > 1) {
          rootHitTargetDescription = this.nodePreviewer.previewNode(hitParents[index - 1]);
        }
        break;
      }
      element = this.domUtilities.getParentElementOrShadowHost(element);
    }
    if (rootHitTargetDescription) {
      return `${hitTargetDescription} from ${rootHitTargetDescription} subtree`;
    }

    return hitTargetDescription;
  }

  /**
   * Checks if an element is in the view port.
   * @param element {Element} The element to check.
   * @returns {Promise<IntersectionObserverEntry | undefined>} 
   * A Promise that resolves to the IntersectionObserverEntry for the element,
   * or undefined if the element is not in the view port.
   * - 'isIntersecting' is true if the element is intersecting with the view port.
   * - 'intersectionRect' is the bounding rectangle of the element in the view port.
   *   - 'x' is the x coordinate of the bounding rectangle.
   *   - 'y' is the y coordinate of the bounding rectangle.
   *   - 'width' is the width of the bounding rectangle.
   *   - 'height' is the height of the bounding rectangle.
   * - 'undefined' if the element's bounding rectangle does not intersect with the view port.
   */
  private async checkElementViewPortIntersection(element: Element): Promise<{ isIntersecting: boolean, intersectionRect: { x: number, y: number, width: number, height: number } } | undefined> {
    const observerEntries: IntersectionObserverEntry[] = [];
    const viewportObserver = new IntersectionObserver((entries: IntersectionObserverEntry[]): void => {
      for (const entry of entries) {
        observerEntries.push(entry);
      }
    });
    viewportObserver.observe(element);

    // No timeout (or, more correctly, an artificially high one), since the element is
    // guaranteed to exist, and therefore the IntersectionObserver will always generate
    // at least one entry.
    // CONSIDER: There is a risk that the element becomes disconnected from the DOM
    // before the IntersectionObserver generates an entry. This is unlikely to happen
    // in practice, but it is a possibility.
    const waiter = new RequestAnimationFrameWaiter<{ isIntersecting: boolean, intersectionRect: { x: number, y: number, width: number, height: number } } | undefined>(
      () => {
        const filtered = observerEntries.filter((entry) => entry.target === element);
        if (filtered.length) {
          const { isIntersecting, intersectionRect } = filtered[0];
          const rect = { x: intersectionRect.x, y: intersectionRect.y, width: intersectionRect.width, height: intersectionRect.height };
          return { isIntersecting, intersectionRect: rect };
        }
        return undefined; // Continue polling
      },
      Number.MAX_SAFE_INTEGER
    );
    const entry = await waiter.waitForCondition();
    viewportObserver.unobserve(element);
    viewportObserver.disconnect();
    return entry;
  }

  /**
   * Checks if an element's position is stable, that is, it has not changed positions since the last animation frame..
   * @param node {Node} The node to check, which will be transformed into the nearest element to check the stability.
   * @returns {Promise<'error:notconnected' | boolean>} A Promise that resolves to a boolean indicating if the element is stable.
   * - 'error:notconnected' if the element is not connected.
   * - true if the element is stable; otherwise, false.
   */
  private async checkElementIsStable(node: Node): Promise<'error:notconnected' | boolean> {
    let lastRect: { x: number, y: number, width: number, height: number } | undefined;
    let stableRafCounter = 0;

    const waiter = new RequestAnimationFrameWaiter<'error:notconnected' | { stable: boolean } | undefined>(
      () => {
        const element = this.findElementFromNode(node, 'no-follow-label');
        if (!element) {
          return 'error:notconnected';
        }

        const clientRect = element.getBoundingClientRect();
        const rect = { x: clientRect.top, y: clientRect.left, width: clientRect.width, height: clientRect.height };
        if (lastRect) {
          const samePosition = rect.x === lastRect.x && rect.y === lastRect.y && rect.width === lastRect.width && rect.height === lastRect.height;
          if (!samePosition) {
            return { stable: false }; // Element is NOT stable - resolve immediately
          }
          // The else branch is ignored for code coverage because stableRafCounter starts at 0,
          // and the first increment makes it 1, satisfying >= 1.
          // This would be reachable if the threshold were higher (e.g., >= 2).
          /* istanbul ignore else -- @preserve */
          if (++stableRafCounter >= 1) {
            return { stable: true }; // Element IS stable
          }
        }
        lastRect = rect;
        return undefined; // Continue polling - need to check next frame
      },
      Number.MAX_SAFE_INTEGER // No timeout - caller handles timeout
    );

    const result = await waiter.waitForCondition();
    if (result === 'error:notconnected') {
      return 'error:notconnected';
    }
    // Type guard: result is guaranteed to be defined since waiter only resolves on truthy values
    /* istanbul ignore if -- @preserve */
    if (!result) {
      throw new Error('Unexpected undefined result from RequestAnimationFrameWaiter');
    }
    return result.stable;
  }

  /**
   * Finds the nearest element from a node, based on the behavior.
   * @param node {Node} The node to find the element from.
   * @param behavior { 'none' | 'follow-label' | 'no-follow-label' | 'button-link' } The behavior to use.
   * @returns {Element | null} The nearest element from the node, or null if no element is found.
   */
  private findElementFromNode(node: Node, behavior: 'none' | 'follow-label' | 'no-follow-label' | 'button-link'): Element | null {
    let element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
    if (!element) {
      return null;
    }

    if (behavior === 'none') {
      return element;
    }

    if (!element.matches('input, textarea, select') && !(element as HTMLElement).isContentEditable) {
      if (behavior === 'button-link') {
        element = element.closest('button, [role=button], a, [role=link]') ?? element;
      } else {
        element = element.closest('button, [role=button], [role=checkbox], [role=radio]') ?? element;
      }
    }

    if (behavior === 'follow-label') {
      if (!element.matches('a, input, textarea, button, select, [role=link], [role=button], [role=checkbox], [role=radio]') &&
        !(element as HTMLElement).isContentEditable) {
        // Go up to the label that might be connected to the input/textarea.
        const enclosingLabel: HTMLLabelElement | null = element.closest('label');
        if (enclosingLabel?.control) {
          element = enclosingLabel.control;
        }
      }
    }
    return element;
  }

  /**
   * Computes the box of an element, including its position and size..
   * @param element {Element} The element to compute the box of.
   * @returns {Box} The computed box of the element.
   */
  private computeBox(element: Element): Box {
    const style = this.getElementComputedStyle(element);
    if (!style) {
      return { visible: true, inline: false };
    }

    const cursor = style.cursor;
    if (style.display === 'contents') {
      // display:contents is not rendered itself, but its child nodes are.
      for (let child = element.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 1 /* Node.ELEMENT_NODE */ && this.isElementVisible(child as Element)) {
          return { visible: true, inline: false, cursor };
        }
        if (child.nodeType === 3 /* Node.TEXT_NODE */ && this.domUtilities.isVisibleTextNode(child as Text)) {
          return { visible: true, inline: true, cursor };
        }
      }
      return { visible: false, inline: false, cursor };
    }
    if (!this.domUtilities.isStyleVisibilityVisible(element, style)) {
      return { cursor, visible: false, inline: false };
    }
    const rect = element.getBoundingClientRect();
    return { rect, cursor, visible: rect.width > 0 && rect.height > 0, inline: style.display === 'inline' };
  }

  /**
   * Gets the computed style of an element.
   * @param element {Element} The element to get the computed style of.
   * @param pseudo {string} The pseudo-element to get the computed style of.
   * @returns {CSSStyleDeclaration | undefined} The computed style of the element, or undefined
   * if the element is not in the document.
   */
  private getElementComputedStyle(element: Element, pseudo?: string): CSSStyleDeclaration | undefined {
    // Calling getComputedStyle is expensive so we will cache values and retrieve them
    // from the cache when possible.
    const cache = this.getCache(pseudo);
    if (cache.has(element)) {
      return cache.get(element);
    }
    const style = this.domUtilities.getElementComputedStyle(element, pseudo);
    cache.set(element, style);
    return style;
  }

  /**
   * Gets the cache for a pseudo-element type.
   * @param pseudo {string | undefined} The pseudo-element type to get the cache for. If omitted, the cache for main elements is returned.
   * @returns {WeakMap<Element, CSSStyleDeclaration | undefined>} The cache for the pseudo-element.
   */
  private getCache(pseudo?: string): WeakMap<Element, CSSStyleDeclaration | undefined> {
    if (pseudo === '::before') {
      return this.cacheStyleBefore;
    } else if (pseudo === '::after') {
      return this.cacheStyleAfter;
    } else {
      return this.cacheStyle;
    }
  }
  
  /**
   * Creates an error with an empty stack.
   * @param message {string} The message of the error.
   * @returns {Error} The error with an empty stack.
   */
  private createError(message: string): Error {
    const error = new Error(message);
    // First set the stack to an empty string (for Firefox),
    // then delete the stack (for Chromium and Safari).
    error.stack = '';
    delete error.stack;
    return error;
  }
}

export default ElementStateInspector;
