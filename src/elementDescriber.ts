import AccessibleNameCalculator from './accessibleNameCalculator.js';
import AriaUtilities from './ariaUtilities.js';
import ElementStateInspector from './elementStateInspector.js';

/**
 * Facts about an element by which a tool can name it, each as the element shows it, with white space normalized.
 */
export type ElementFacts = {
  element: Element,
  // The element's lower-case tag name.
  tagName: string,
  // The element's ARIA role, explicit or implicit, or null if it has none.
  role: string | null,
  // The element's accessible name, or empty.
  name: string,
  // The texts of the element's labels, as ElementStateInspector.findElementsByLabel matches them.
  labels: string[],
  placeholder: string | null,
  alt: string | null,
  title: string | null,
  // The value of the test ID attribute.
  testId: string | null,
  // The element's rendered text, or empty for an element that is not an HTML element.
  text: string,
  id: string | null,
  // A CSS selector for the element within its root, the document or a shadow root, which matches it alone when
  // the document is as it is now.
  cssPath: string,
  // A value indicating whether the element is in a shadow root.
  inShadowRoot: boolean,
};

/**
 * A description of the element a user acts on, and of the ancestors within its root that can be named, nearest first.
 */
export type ElementDescription = {
  target: ElementFacts,
  ancestors: ElementFacts[],
};

/**
 * Options for describing an element.
 */
export type ElementDescriptionOptions = {
  // The attribute test IDs are read from; defaults to data-testid.
  testIdAttribute?: string,
  // The most ancestors to describe; defaults to 3.
  maxAncestors?: number,
};

/**
 * Describes elements by facts a tool can name them by, such as their role, accessible name, labels, and attributes,
 * without choosing among them.
 */
class ElementDescriber {
  private readonly ariaUtilities = new AriaUtilities();
  private readonly nameCalculator = new AccessibleNameCalculator();
  private readonly inspector = new ElementStateInspector();
  // Elements a user acts on as a whole, such as a button around an icon.
  private readonly interactiveSelector = 'button, select, input, a, [role=button], [role=checkbox], [role=radio], [role=link]';
  private readonly unnamedRoles = ['generic', 'none', 'presentation'];

  /**
   * Describes the element a user acting on an element acts on: the element itself if it takes text, or else its
   * closest interactive ancestor, if any; and the ancestors within its root, below the document element, that have
   * a test ID, an ID, or a role.
   * @param element {Element} The element acted on.
   * @param options {ElementDescriptionOptions} Options for the description.
   * @returns {ElementDescription} The description.
   */
  describe(element: Element, options: ElementDescriptionOptions = {}): ElementDescription {
    const testIdAttribute = options.testIdAttribute ?? 'data-testid';
    const target = this.getActionTarget(element);
    const ancestors: ElementFacts[] = [];
    const documentElement = target.ownerDocument.documentElement;
    for (let ancestor = target.parentElement; ancestor && ancestor !== documentElement && ancestors.length < (options.maxAncestors ?? 3); ancestor = ancestor.parentElement) {
      if (ancestor.hasAttribute(testIdAttribute) || ancestor.id || this.hasNameableRole(ancestor)) {
        ancestors.push(this.getFacts(ancestor, testIdAttribute));
      }
    }

    return { target: this.getFacts(target, testIdAttribute), ancestors };
  }

  /**
   * Gets the element a user acting on an element acts on.
   * @param element {Element} The element acted on.
   * @returns {Element} The element itself if it takes text, or else its closest interactive ancestor, or itself.
   */
  getActionTarget(element: Element): Element {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName.toUpperCase()) || (element as HTMLElement).isContentEditable) {
      return element;
    }

    return element.closest(this.interactiveSelector) ?? element;
  }

  private getFacts(element: Element, testIdAttribute: string): ElementFacts {
    return {
      element,
      tagName: element.localName,
      role: this.ariaUtilities.getAriaRole(element),
      name: this.normalize(this.nameCalculator.getAccessibleName(element)),
      labels: this.inspector.getElementLabels(element).map((label) => this.normalize(label)),
      placeholder: element.getAttribute('placeholder'),
      alt: element.getAttribute('alt'),
      title: element.getAttribute('title'),
      testId: element.getAttribute(testIdAttribute),
      text: element instanceof HTMLElement ? this.normalize(this.getRenderedText(element)) : '',
      id: element.id || null,
      cssPath: this.getCssPath(element),
      inShadowRoot: element.getRootNode() instanceof ShadowRoot,
    };
  }

  // jsdom does not render, so has no innerText; its text content stands in.
  private getRenderedText(element: HTMLElement): string {
    /* istanbul ignore next -- @preserve */
    return element.innerText ?? element.textContent ?? '';
  }

  private hasNameableRole(element: Element): boolean {
    const role = this.ariaUtilities.getAriaRole(element);
    return role !== null && !this.unnamedRoles.includes(role);
  }

  // From the element, or its nearest ancestor with an ID unique in the root, each step down names a child by its tag
  // and, when siblings share the tag, its position among them.
  private getCssPath(element: Element): string {
    const root = element.getRootNode() as Document | ShadowRoot;
    const steps: string[] = [];
    for (let current: Element | null = element; current; current = current.parentElement) {
      if (current.id && root.querySelectorAll(`#${this.escapeIdentifier(current.id)}`).length === 1) {
        steps.unshift(`#${this.escapeIdentifier(current.id)}`);
        break;
      }

      const step = current;
      const sameTag = step.parentElement ? Array.from(step.parentElement.children).filter((sibling) => sibling.localName === step.localName) : [step];
      const name = this.escapeIdentifier(step.localName);
      steps.unshift(sameTag.length > 1 ? `${name}:nth-of-type(${sameTag.indexOf(step) + 1})` : name);
    }

    return steps.join(' > ');
  }

  // https://drafts.csswg.org/cssom/#serialize-an-identifier
  private escapeIdentifier(identifier: string): string {
    return Array.from(identifier, (character, index) => {
      const code = character.charCodeAt(0);
      if (code === 0) {
        return '�';
      }

      if ((code >= 0x1 && code <= 0x1f) || code === 0x7f || (/[0-9]/.test(character) && (index === 0 || (index === 1 && identifier.startsWith('-'))))) {
        return `\\${code.toString(16)} `;
      }

      if (index === 0 && character === '-' && identifier.length === 1) {
        return '\\-';
      }

      return code >= 0x80 || /[-_a-zA-Z0-9]/.test(character) ? character : `\\${character}`;
    }).join('');
  }

  private normalize(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }
}

export default ElementDescriber;
