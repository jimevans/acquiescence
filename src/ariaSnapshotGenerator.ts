import AccessibleNameCalculator from './accessibleNameCalculator.js';
import AriaSnapshotRenderer from './ariaSnapshotRenderer.js';
import AriaUtilities from './ariaUtilities.js';
import DOMUtilities from './domUtilities.js';

/**
 * A node of an accessibility snapshot: an element with a role, an iframe, or the fragment at the root.
 */
export type AriaNode = {
  // An ARIA role, iframe for an iframe or frame element, or fragment for the root of a snapshot.
  role: string,
  name: string,
  ref?: string,
  checked?: boolean | 'mixed',
  disabled?: boolean,
  expanded?: boolean,
  level?: number,
  pressed?: boolean | 'mixed',
  selected?: boolean,
  url?: string,
  placeholder?: string,
  // Child nodes, and runs of text, in document order.
  children: Array<AriaNode | string>,
};

/**
 * A ref in a snapshot, and the element it refers to.
 */
export type AriaSnapshotReference = { ref: string, element: Element };

/**
 * An accessibility snapshot of an element and its descendants.
 */
export type AriaSnapshot = {
  // A fragment whose children are the nodes of the snapshot.
  root: AriaNode,
  // The snapshot as text, in a format compatible with Playwright's aria snapshots.
  text: string,
  // The elements the snapshot's refs refer to, in document order.
  references: AriaSnapshotReference[],
};

/**
 * Options for taking an accessibility snapshot.
 */
export type AriaSnapshotOptions = {
  // Whether to give nodes refs; defaults to true.
  refs?: boolean,
  // Text to put before each ref, such as one that identifies the frame; defaults to empty.
  refPrefix?: string,
};

/**
 * The state of one snapshot.
 */
type SnapshotContext = {
  visited: Set<Node>,
  references: AriaSnapshotReference[],
  refs: boolean,
  refPrefix: string,
};

/**
 * Takes accessibility snapshots: trees of the elements in the accessibility tree, each with its role, accessible
 * name, and states, and the text between them. Elements without a role, or with a generic, none, or presentation
 * role, are left out, with their content moved up to their parent. Hidden elements are left out with their content.
 */
class AriaSnapshotGenerator {
  private readonly ariaUtilities = new AriaUtilities();
  private readonly domUtilities = new DOMUtilities();
  private readonly nameCalculator = new AccessibleNameCalculator();
  private readonly renderer = new AriaSnapshotRenderer();
  private readonly omittedRoles = ['generic', 'none', 'presentation'];
  // Inputs whose value is not text that the snapshot shows.
  private readonly nonTextInputTypes = ['checkbox', 'file', 'radio'];
  // An element keeps its ref for as long as its document lasts, so successive snapshots can be compared.
  private readonly refIds = new WeakMap<Element, number>();
  private lastRefId = 0;

  /**
   * Takes an accessibility snapshot of an element and its descendants.
   * @param rootElement {Element} The element to take the snapshot of, which is included if it has a role.
   * @param options {AriaSnapshotOptions} Options for the snapshot. If omitted, nodes get refs without a prefix.
   * @returns {AriaSnapshot} The snapshot.
   */
  generate(rootElement: Element, options: AriaSnapshotOptions = {}): AriaSnapshot {
    const context: SnapshotContext = {
      visited: new Set(),
      references: [],
      refs: options.refs ?? true,
      refPrefix: options.refPrefix ?? '',
    };
    const root: AriaNode = { role: 'fragment', name: '', children: [] };
    this.visit(root, rootElement, context);
    this.finishNode(root);
    return { root, text: this.renderer.render(root), references: context.references };
  }

  /**
   * Adds a node, and what it contains, to the snapshot.
   * @param parent {AriaNode} The node of the nearest ancestor in the snapshot.
   * @param node {Node} The node to add.
   * @param context {SnapshotContext} The state of the snapshot.
   */
  private visit(parent: AriaNode, node: Node, context: SnapshotContext): void {
    if (context.visited.has(node)) {
      return;
    }
    context.visited.add(node);

    if (node.nodeType === Node.TEXT_NODE) {
      // The text inside a text box is its value, which the text box already shows.
      if (parent.role !== 'textbox') {
        parent.children.push((node as Text).data);
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || this.ariaUtilities.isHiddenForAria(node as Element)) {
      return;
    }

    const element = node as Element;
    const ariaNode = this.createNode(element, context);
    if (ariaNode) {
      parent.children.push(ariaNode);
    }
    this.visitContent(ariaNode ?? parent, element, context);
    if (ariaNode) {
      this.finishNode(ariaNode, element);
    }
  }

  /**
   * Adds what an element contains to the snapshot: its pseudo-elements, its child nodes or the nodes assigned to it
   * as a slot, its shadow root's child nodes, and the elements it owns through aria-owns.
   * @param target {AriaNode} The node to add the content to: the element's own, or that of its nearest ancestor in the snapshot.
   * @param element {Element} The element.
   * @param context {SnapshotContext} The state of the snapshot.
   */
  private visitContent(target: AriaNode, element: Element, context: SnapshotContext): void {
    // Text either side of an element that is not inline is separate from it.
    const display = this.domUtilities.getElementComputedStyle(element)?.display;
    const separator = display !== 'inline' || this.domUtilities.getNormalizedElementTagName(element) === 'BR' ? ' ' : '';
    target.children.push(separator, this.nameCalculator.getCssContent(element, '::before') ?? '');
    const assignedNodes = element instanceof HTMLSlotElement ? element.assignedNodes() : [];
    // A node assigned to a slot is visited through the slot rather than as a child of its shadow host.
    const nodes = assignedNodes.length ? assignedNodes : [
      ...Array.from(element.childNodes).filter((child) => !(child as Element | Text).assignedSlot),
      ...Array.from(element.shadowRoot?.childNodes ?? []),
    ];
    for (const child of [...nodes, ...this.ariaUtilities.getReferencedElements(element, 'aria-owns')]) {
      this.visit(target, child, context);
    }
    target.children.push(this.nameCalculator.getCssContent(element, '::after') ?? '', separator);
  }

  /**
   * Creates the node for an element, if it has one.
   * @param element {Element} The element.
   * @param context {SnapshotContext} The state of the snapshot.
   * @returns {AriaNode | null} The node, or null if the element has no role, or one that the snapshot leaves out.
   */
  private createNode(element: Element, context: SnapshotContext): AriaNode | null {
    const tagName = this.domUtilities.getNormalizedElementTagName(element);
    if (tagName === 'IFRAME' || tagName === 'FRAME') {
      return this.assignRef({ role: 'iframe', name: '', children: [] }, element, context);
    }
    const role = this.ariaUtilities.getAriaRole(element);
    if (!role || this.omittedRoles.includes(role)) {
      return null;
    }
    const node = this.assignRef({ role, name: this.normalizeWhiteSpace(this.nameCalculator.getAccessibleName(element)), children: [] }, element, context);
    const states: Partial<AriaNode> = {
      checked: this.ariaUtilities.getAriaChecked(element),
      disabled: this.ariaUtilities.getAriaDisabled(element),
      expanded: this.ariaUtilities.getAriaExpanded(element),
      level: this.ariaUtilities.getAriaLevel(element),
      pressed: this.ariaUtilities.getAriaPressed(element),
      selected: this.ariaUtilities.getAriaSelected(element),
    };
    for (const [state, value] of Object.entries(states)) {
      if (value !== undefined) {
        Object.assign(node, { [state]: value });
      }
    }
    if ((element instanceof HTMLInputElement && !this.nonTextInputTypes.includes(element.type)) || element instanceof HTMLTextAreaElement) {
      node.children.push(element.value);
    }
    return node;
  }

  /**
   * Gives a node the ref of its element, and records the element, unless the snapshot has no refs.
   * @param node {AriaNode} The node.
   * @param element {Element} The element.
   * @param context {SnapshotContext} The state of the snapshot.
   * @returns {AriaNode} The node.
   */
  private assignRef(node: AriaNode, element: Element, context: SnapshotContext): AriaNode {
    if (context.refs) {
      let id = this.refIds.get(element);
      if (id === undefined) {
        id = ++this.lastRefId;
        this.refIds.set(element, id);
      }
      node.ref = `${context.refPrefix}e${id}`;
      context.references.push({ ref: node.ref, element });
    }
    return node;
  }

  /**
   * Completes a node once its content is added: merges and normalizes its runs of text, drops text that only repeats
   * its name, and adds the URL of a link and the placeholder of a text box.
   * @param node {AriaNode} The node.
   * @param element {Element | undefined} The node's element; omitted for the root.
   */
  private finishNode(node: AriaNode, element?: Element): void {
    const children: Array<AriaNode | string> = [];
    let text = '';
    const flushText = () => {
      const normalized = this.normalizeWhiteSpace(text);
      if (normalized) {
        children.push(normalized);
      }
      text = '';
    };
    for (const child of node.children) {
      if (typeof child === 'string') {
        text += child;
      } else {
        flushText();
        children.push(child);
      }
    }
    flushText();
    node.children = children.length === 1 && children[0] === node.name ? [] : children;

    const href = element?.getAttribute('href') ?? null;
    if (node.role === 'link' && href !== null) {
      node.url = this.truncateDataUrl(href);
    }
    const placeholder = element?.getAttribute('placeholder');
    if (node.role === 'textbox' && placeholder && placeholder !== node.name) {
      node.placeholder = placeholder;
    }
  }

  /**
   * Shortens a data URL to its media type, since its data is never useful to read.
   * @param url {string} The URL.
   * @returns {string} The URL, with the data of a data URL replaced by an ellipsis.
   */
  private truncateDataUrl(url: string): string {
    const comma = url.indexOf(',');
    return url.startsWith('data:') && comma !== -1 ? `${url.slice(0, comma + 1)}\u2026` : url;
  }

  /**
   * Normalizes white space in text: zero-width spaces and soft hyphens removed, and runs of white space collapsed to
   * one space and trimmed.
   * @param text {string} The text.
   * @returns {string} The normalized text.
   */
  private normalizeWhiteSpace(text: string): string {
    return text.replace(/[\u200b\u00ad]/g, '').trim().replace(/\s+/g, ' ');
  }
}

export default AriaSnapshotGenerator;
