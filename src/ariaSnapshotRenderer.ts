import type { AriaNode } from './ariaSnapshotGenerator.js';

/**
 * Renders accessibility snapshots as text, in a format compatible with Playwright's aria snapshots: a YAML list with
 * a line for each node, holding its role, quoted name, and states, and its URL, placeholder, text, and child nodes
 * nested beneath it.
 */
class AriaSnapshotRenderer {
  // YAML keys are limited to 1024 characters, which leaves room for the role and states.
  private readonly maximumNameLength = 900;

  // Patterns of text that YAML would read as something other than a plain string, or misread.
  private readonly quotedTextPatterns = [
    // Empty text, and text with white space at either end.
    /^$|^\s|\s$/,
    // Control characters, and line breaks.
    // eslint-disable-next-line no-control-regex
    /[\x00-\x1f\x7f-\x9f]/,
    // A sequence entry, a mapping value, or a comment.
    /^-|:(\s|$)|\s#/,
    // An indicator character or quote at the start.
    /^[&*\],?!>|@"'#%[]/,
    // Flow collections and reserved characters.
    /[{}`]/,
  ];

  // Text that YAML would read as a Boolean or null value.
  private readonly reservedWords = ['y', 'n', 'yes', 'no', 'true', 'false', 'on', 'off', 'null'];

  /**
   * Renders a snapshot as text.
   * @param root {AriaNode} The root of the snapshot. A fragment is rendered as its children.
   * @returns {string} The text, with a line for each node and each run of text that is not on its node's line.
   */
  render(root: AriaNode): string {
    const lines: string[] = [];
    for (const node of root.role === 'fragment' ? root.children : [root]) {
      this.renderChild(node, 0, lines);
    }
    return lines.join('\n');
  }

  /**
   * Renders a child node, or a run of text, as lines.
   * @param child {AriaNode | string} The node or text.
   * @param depth {number} The depth of the child, which sets its indentation.
   * @param lines {string[]} The lines rendered so far, which this adds to.
   */
  private renderChild(child: AriaNode | string, depth: number, lines: string[]): void {
    const indent = '  '.repeat(depth);
    if (typeof child === 'string') {
      lines.push(`${indent}- text: ${this.quoteValue(child)}`);
      return;
    }

    const key = `${indent}- ${this.quoteKey(this.getKey(child))}`;
    const properties: Array<[string, string]> = [];
    if (child.url !== undefined) {
      properties.push(['url', child.url]);
    }
    if (child.placeholder !== undefined) {
      properties.push(['placeholder', child.placeholder]);
    }
    if (!properties.length && !child.children.length) {
      lines.push(key);
    } else if (!properties.length && child.children.length === 1 && typeof child.children[0] === 'string') {
      lines.push(`${key}: ${this.quoteValue(child.children[0])}`);
    } else {
      lines.push(`${key}:`);
      for (const [name, value] of properties) {
        lines.push(`${indent}  - /${name}: ${this.quoteValue(value)}`);
      }
      for (const grandchild of child.children) {
        this.renderChild(grandchild, depth + 1, lines);
      }
    }
  }

  /**
   * Gets the key of a node's line: its role, its quoted name if it has one that is not too long, and its states.
   * @param node {AriaNode} The node.
   * @returns {string} The key.
   */
  private getKey(node: AriaNode): string {
    let key = node.role;
    if (node.name && node.name.length <= this.maximumNameLength) {
      key += ` ${JSON.stringify(node.name)}`;
    }
    if (node.checked !== undefined && node.checked !== false) {
      key += node.checked === 'mixed' ? ' [checked=mixed]' : ' [checked]';
    }
    if (node.disabled) {
      key += ' [disabled]';
    }
    if (node.expanded) {
      key += ' [expanded]';
    }
    if (node.level) {
      key += ` [level=${node.level}]`;
    }
    if (node.pressed !== undefined && node.pressed !== false) {
      key += node.pressed === 'mixed' ? ' [pressed=mixed]' : ' [pressed]';
    }
    if (node.selected) {
      key += ' [selected]';
    }
    if (node.ref) {
      key += ` [ref=${node.ref}]`;
    }
    return key;
  }

  /**
   * Quotes a key, if YAML would otherwise misread it, in single quotes.
   * @param key {string} The key.
   * @returns {string} The key, quoted if needed.
   */
  private quoteKey(key: string): string {
    return this.needsQuotes(key) ? `'${key.replace(/'/g, '\'\'')}'` : key;
  }

  /**
   * Quotes a value, if YAML would otherwise misread it, in double quotes with escapes.
   * @param value {string} The value.
   * @returns {string} The value, quoted if needed.
   */
  private quoteValue(value: string): string {
    if (!this.needsQuotes(value)) {
      return value;
    }
    // eslint-disable-next-line no-control-regex
    return `"${value.replace(/[\\"\x00-\x1f\x7f-\x9f]/g, (character) => {
      const escapes: Record<string, string | undefined> = { '\\': '\\\\', '"': '\\"', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t' };
      return escapes[character] ?? `\\x${character.charCodeAt(0).toString(16).padStart(2, '0')}`;
    })}"`;
  }

  /**
   * Gets a value indicating whether YAML would read text as something other than the same plain string.
   * @param text {string} The text.
   * @returns {boolean} True if the text must be quoted; otherwise, false.
   */
  private needsQuotes(text: string): boolean {
    return this.quotedTextPatterns.some((pattern) => pattern.test(text)) ||
      !isNaN(Number(text)) ||
      this.reservedWords.includes(text.toLowerCase());
  }
}

export default AriaSnapshotRenderer;
