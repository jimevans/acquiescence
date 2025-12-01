/**
 * Generates a string representation of a node.
 */
class NodePreviewer {
  private readonly autoClosingTags = new Set([
    'AREA', 'BASE', 'BR', 'COL', 'COMMAND', 'EMBED', 'HR', 'IMG', 'INPUT', 'KEYGEN', 'LINK',
    'MENUITEM', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR'
  ]);

  private readonly booleanAttributes = new Set(['checked', 'selected', 'disabled', 'readonly', 'multiple']);

  /**
   * Generates a string representation of a node.
   * @param node {Node} The node to preview.
   * @returns {string} A string representation of the node.
   */
  previewNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return this.oneLine(`#text=${node.nodeValue ?? ''}`);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return this.oneLine(`<${node.nodeName.toLowerCase()} />`);
    }
    const element = node as Element;

    const attrs = [];
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes.item(i);
      if (!attr) {
        continue;
      }
      const { name, value } = attr;
      if (name === 'style') {
        continue;
      }

      if (!value && this.booleanAttributes.has(name)) {
        attrs.push(` ${name}`);
      } else {
        attrs.push(` ${name}="${value}"`);
      }
    }
    attrs.sort((a, b) => a.length - b.length);
    const attrText = this.trimStringWithEllipsis(attrs.join(''), 500);
    if (this.autoClosingTags.has(element.nodeName)) {
      return this.oneLine(`<${element.nodeName.toLowerCase()}${attrText}/>`);
    }

    const children = element.childNodes;
    let onlyText = false;
    if (children.length <= 5) {
      onlyText = true;
      for (let i = 0; i < children.length; i++) {
        const child = children.item(i);
        if (!child || child.nodeType !== Node.TEXT_NODE) {
          onlyText = false;
          break;
        }
      }
    }
    const text = onlyText ? (element.textContent || '') : '\u2026';
    return this.oneLine(`<${element.nodeName.toLowerCase()}${attrText}>${this.trimStringWithEllipsis(text, 50)}</${element.nodeName.toLowerCase()}>`);
  }

  private oneLine(s: string): string {
    return s.replaceAll('\n', '↵').replaceAll('\t', '⇆');
  }

  private trimStringWithEllipsis(input: string, cap: number): string {
    return this.trimString(input, cap, '\u2026');
  }

  private trimString(input: string, cap: number, suffix = ''): string {
    if (input.length <= cap) {
      return input;
    }
    const chars = [...input];
    if (chars.length > cap) {
      return chars.slice(0, cap - suffix.length).join('') + suffix;
    }
    return chars.join('');
  }
};

export default NodePreviewer;
