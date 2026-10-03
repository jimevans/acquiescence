import AriaSnapshotGenerator from './ariaSnapshotGenerator.js';
import type { AriaNode } from './ariaSnapshotGenerator.js';
import AriaTemplateParser from './ariaTemplateParser.js';
import type { AriaRoleTemplate, AriaTemplateNode, AriaTextTemplate } from './ariaTemplateParser.js';

/**
 * The result of matching an accessibility snapshot against a template.
 */
export type AriaSnapshotMatchResult = {
  matches: boolean,
  // The snapshot that was matched, rendered without refs, to show when it does not match.
  actual: string,
};

/**
 * Matches the accessibility snapshot of an element against a template written in the snapshot format. A template
 * matches if some node of the snapshot matches its first node, or, when it lists several, if the snapshot contains
 * them in order. A node matches if it has the template's role, and its name, states, and properties where the
 * template gives them; its children must contain those the template lists, in order, unless the template's
 * /children property asks for them to be equal. Names and text match exactly, or, written between slashes, as
 * regular expressions; refs are ignored.
 */
class AriaSnapshotMatcher {
  private readonly generator = new AriaSnapshotGenerator();
  private readonly parser = new AriaTemplateParser();
  private readonly states = ['checked', 'disabled', 'expanded', 'level', 'pressed', 'selected'] as const;

  /**
   * Matches the snapshot of an element against a template.
   * @param rootElement {Element} The element whose snapshot to match.
   * @param template {string} The template.
   * @returns {AriaSnapshotMatchResult} Whether the snapshot matches, and the snapshot as text.
   * @throws {Error} If the template is not valid.
   */
  match(rootElement: Element, template: string): AriaSnapshotMatchResult {
    const parsed = this.parser.parse(template);
    const snapshot = this.generator.generate(rootElement, { refs: false });
    return { matches: this.containsMatch(snapshot.root, parsed), actual: snapshot.text };
  }

  /**
   * Gets a value indicating whether a node, or any of its descendants, matches a template.
   * @param node {AriaNode | string} The node, or a run of text.
   * @param template {AriaTemplateNode} The template.
   * @returns {boolean} True if the node or a descendant matches; otherwise, false.
   */
  private containsMatch(node: AriaNode | string, template: AriaTemplateNode): boolean {
    if (this.matchesNode(node, template, false)) {
      return true;
    }
    return typeof node !== 'string' && node.children.some((child) => this.containsMatch(child, template));
  }

  /**
   * Gets a value indicating whether a node matches a template.
   * @param node {AriaNode | string} The node, or a run of text.
   * @param template {AriaTemplateNode} The template.
   * @param isDeepEqual {boolean} Whether an ancestor's template asked for all descendants to match exactly.
   * @returns {boolean} True if the node matches; otherwise, false.
   */
  private matchesNode(node: AriaNode | string, template: AriaTemplateNode, isDeepEqual: boolean): boolean {
    if (typeof node === 'string' || template.kind === 'text') {
      return typeof node === 'string' && template.kind === 'text' && this.matchesText(node, template.text);
    }
    if (template.role !== 'fragment' && template.role !== node.role) {
      return false;
    }
    if (this.states.some((state) => template[state] !== undefined && template[state] !== node[state])) {
      return false;
    }
    if (!this.matchesName(node.name, template) || !this.matchesOptionalText(node.url, template.url) || !this.matchesOptionalText(node.placeholder, template.placeholder)) {
      return false;
    }
    const mode = template.childrenMode ?? (isDeepEqual ? 'deep-equal' : 'contain');
    return mode === 'contain' ? this.containsInOrder(node.children, template.children) : this.equalsList(node.children, template.children, mode === 'deep-equal');
  }

  /**
   * Gets a value indicating whether a node's name matches the name a template gives, if it gives one.
   * @param name {string} The node's name.
   * @param template {AriaRoleTemplate} The template.
   * @returns {boolean} True if the template gives no name, or the name matches it; otherwise, false.
   */
  private matchesName(name: string, template: AriaRoleTemplate): boolean {
    if (template.name === undefined) {
      return true;
    }
    if (typeof template.name === 'string') {
      return name === template.name;
    }
    return !!name && new RegExp(template.name.pattern).test(name);
  }

  /**
   * Gets a value indicating whether a property of a node matches the text a template gives for it, if it gives any.
   * @param text {string | undefined} The property's value, or undefined if the node does not have it.
   * @param template {AriaTextTemplate | undefined} The template, or undefined if it gives none.
   * @returns {boolean} True if the template gives no text, or the property matches it; otherwise, false.
   */
  private matchesOptionalText(text: string | undefined, template: AriaTextTemplate | undefined): boolean {
    return !template || this.matchesText(text ?? '', template);
  }

  /**
   * Gets a value indicating whether text matches a template: it is equal to the template's text, normalized or as
   * written, or matches it as a regular expression when it is written between slashes.
   * @param text {string} The text.
   * @param template {AriaTextTemplate} The template.
   * @returns {boolean} True if the text matches; otherwise, false.
   */
  private matchesText(text: string, template: AriaTextTemplate): boolean {
    if (!template.normalized) {
      return true;
    }
    if (!text) {
      return false;
    }
    if (text === template.normalized || text === template.raw) {
      return true;
    }
    const { raw } = template;
    if (raw.length < 2 || !raw.startsWith('/') || !raw.endsWith('/')) {
      return false;
    }
    try {
      return new RegExp(raw.slice(1, -1)).test(text);
    } catch {
      // Text between slashes that is not a valid regular expression is only compared as text.
      return false;
    }
  }

  /**
   * Gets a value indicating whether children contain the children a template lists, in order, among others.
   * @param children {Array<AriaNode | string>} The children.
   * @param templates {AriaTemplateNode[]} The templates for the children.
   * @returns {boolean} True if each template matches a child after the child the one before it matched; otherwise, false.
   */
  private containsInOrder(children: Array<AriaNode | string>, templates: AriaTemplateNode[]): boolean {
    let index = 0;
    for (const template of templates) {
      while (index < children.length && !this.matchesNode(children[index], template, false)) {
        index++;
      }
      if (index === children.length) {
        return false;
      }
      index++;
    }
    return true;
  }

  /**
   * Gets a value indicating whether children are exactly the children a template lists.
   * @param children {Array<AriaNode | string>} The children.
   * @param templates {AriaTemplateNode[]} The templates for the children.
   * @param isDeepEqual {boolean} Whether the children's descendants must also match exactly.
   * @returns {boolean} True if there are as many children as templates, and each matches its template; otherwise, false.
   */
  private equalsList(children: Array<AriaNode | string>, templates: AriaTemplateNode[], isDeepEqual: boolean): boolean {
    return children.length === templates.length && templates.every((template, index) => this.matchesNode(children[index], template, isDeepEqual));
  }
}

export default AriaSnapshotMatcher;
