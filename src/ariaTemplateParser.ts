import AriaUtilities from './ariaUtilities.js';

/**
 * Text a template expects: equal to the text as written or with its white space normalized, or, if it is written
 * between slashes, matching it as a regular expression.
 */
export type AriaTextTemplate = { raw: string, normalized: string };

/**
 * A name a template expects: exactly, or matching a regular expression.
 */
export type AriaNameTemplate = string | { pattern: string };

/**
 * How the children of a node must match the children a template lists: contain them in order among others (the
 * default), be exactly them, or be exactly them with every descendant also matched exactly.
 */
export type AriaChildrenMode = 'contain' | 'equal' | 'deep-equal';

/**
 * A template for a node with a role, or for the fragment at the root of a template.
 */
export type AriaRoleTemplate = {
  kind: 'role',
  role: string,
  name?: AriaNameTemplate,
  checked?: boolean | 'mixed',
  disabled?: boolean,
  expanded?: boolean,
  level?: number,
  pressed?: boolean | 'mixed',
  selected?: boolean,
  url?: AriaTextTemplate,
  placeholder?: AriaTextTemplate,
  children: AriaTemplateNode[],
  childrenMode?: AriaChildrenMode,
};

/**
 * A template for a node, or for a run of text.
 */
export type AriaTemplateNode = AriaRoleTemplate | { kind: 'text', text: AriaTextTemplate };

/**
 * A line of a template.
 */
type TemplateLine = { number: number, text: string };

/**
 * Parses templates for accessibility snapshots, written in the format the snapshots are rendered in: a YAML list of
 * nodes, each a role followed by an optional quoted name or /regular expression/ and [attributes], with text,
 * properties, and child nodes nested beneath it. Only the parts of YAML that format uses are supported.
 */
class AriaTemplateParser {
  private readonly ariaUtilities = new AriaUtilities();
  private readonly childrenModes: AriaChildrenMode[] = ['contain', 'equal', 'deep-equal'];
  private readonly toggleValues: Record<string, boolean | 'mixed' | undefined> = { 'true': true, 'false': false, 'mixed': 'mixed' };
  private readonly booleanValues: Record<string, boolean | undefined> = { 'true': true, 'false': false };
  // https://yaml.org/spec/1.2.2/#57-escaped-characters, as far as JSON and the snapshot renderer use them.
  private readonly escapedCharacters: Record<string, string | undefined> = {
    '0': '\0', 'b': '\b', 'f': '\f', 'n': '\n', 'r': '\r', 't': '\t', 'v': '\v', '"': '"', '/': '/', '\\': '\\', ' ': ' ',
  };

  /**
   * Parses a template.
   * @param template {string} The template.
   * @returns {AriaTemplateNode} The template for the node to find: the only node the template lists, unless it says
   * how children must match; otherwise, a fragment holding the nodes it lists.
   * @throws {Error} If the template is not valid, with the line and column where it is not.
   */
  parse(template: string): AriaTemplateNode {
    const lines = template.split('\n').map((text, index) => ({ number: index + 1, text: text.replace(/\r$/, '') }));
    const fragment: AriaRoleTemplate = { kind: 'role', role: 'fragment', children: [] };
    this.parseSequence(lines, 0, -1, fragment);
    if (!fragment.children.length) {
      this.fail(lines[0], 'A template must list at least one node, as a line starting with "- "', 0);
    }
    return fragment.children.length === 1 && (fragment.childrenMode ?? 'contain') === 'contain' ? fragment.children[0] : fragment;
  }

  /**
   * Parses the list items at one indentation, which are the children of a node.
   * @param lines {TemplateLine[]} The lines of the template.
   * @param start {number} The index of the first line to parse.
   * @param parentIndent {number} The indentation of the parent's list item; items must be indented more than it.
   * @param parent {AriaRoleTemplate} The template for the parent node.
   * @returns {number} The index of the first line that is not part of the list.
   */
  private parseSequence(lines: TemplateLine[], start: number, parentIndent: number, parent: AriaRoleTemplate): number {
    let index = start;
    let itemIndent: number | undefined;
    while (index < lines.length) {
      const line = lines[index];
      const trimmed = line.text.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        index++;
        continue;
      }
      const indent = this.getIndent(line.text);
      if (line.text.slice(0, indent).includes('\t')) {
        this.fail(line, 'Tabs cannot indent a template', line.text.indexOf('\t'));
      }
      if (indent <= parentIndent) {
        break;
      }
      itemIndent ??= indent;
      if (indent !== itemIndent) {
        this.fail(line, 'Unexpected indentation', indent);
      }
      if (!/^-(\s|$)/.test(trimmed)) {
        this.fail(line, 'Expected a list item starting with "- "', indent);
      }
      index = this.parseItem(lines, index, indent, parent);
    }
    return index;
  }

  /**
   * Parses a list item: a node, a run of text, or a property of the parent node.
   * @param lines {TemplateLine[]} The lines of the template.
   * @param index {number} The index of the item's line.
   * @param indent {number} The indentation of the item.
   * @param parent {AriaRoleTemplate} The template for the parent node.
   * @returns {number} The index of the first line after the item.
   */
  private parseItem(lines: TemplateLine[], index: number, indent: number, parent: AriaRoleTemplate): number {
    const line = lines[index];
    const contentStart = indent + 1 + this.getIndent(line.text.slice(indent + 1));
    const content = line.text.slice(contentStart);

    const property = /^\/([a-z]+):(?:\s+|$)/i.exec(content);
    if (property) {
      const [value, next] = this.parseValue(lines, index, indent, contentStart + property[0].length);
      this.applyProperty(parent, property[1], value, line, contentStart);
      return next;
    }

    const text = /^text:(?:\s+|$)/.exec(content);
    if (text) {
      const [value, next] = this.parseValue(lines, index, indent, contentStart + text[0].length);
      parent.children.push({ kind: 'text', text: this.createTextTemplate(value) });
      return next;
    }

    const node: AriaRoleTemplate = { kind: 'role', role: '', children: [] };
    parent.children.push(node);
    let position: number;
    if (content.startsWith('\'')) {
      // A single-quoted key, which the renderer writes when the key itself would confuse YAML.
      const [key, end] = this.readSingleQuoted(line, contentStart);
      const keyEnd = this.parseKeyInto(node, key, 0, line, contentStart + 1);
      if (keyEnd < key.length) {
        this.fail(line, 'Expected an attribute or the end of the key', contentStart + 1 + keyEnd);
      }
      position = end;
    } else {
      position = this.parseKeyInto(node, line.text, contentStart, line, 0);
    }

    const rest = line.text.slice(position);
    if (!rest.trim()) {
      return index + 1;
    }
    if (!rest.startsWith(':')) {
      this.fail(line, 'Expected ":" or the end of the line', position);
    }
    if (!rest.slice(1).trim()) {
      return this.parseSequence(lines, index + 1, indent, node);
    }
    const [value, next] = this.parseValue(lines, index, indent, position + 1 + this.getIndent(rest.slice(1)));
    node.children.push({ kind: 'text', text: this.createTextTemplate(value) });
    return next;
  }

  /**
   * Parses the key of a node, its role, name, and attributes, and records them in its template.
   * @param node {AriaRoleTemplate} The template for the node.
   * @param text {string} The text holding the key.
   * @param start {number} The index in the text where the key starts.
   * @param line {TemplateLine} The line, for errors.
   * @param offset {number} The column of the line where the text starts, for errors.
   * @returns {number} The index in the text just past the key and any white space after it.
   */
  private parseKeyInto(node: AriaRoleTemplate, text: string, start: number, line: TemplateLine, offset: number): number {
    const role = /^[a-z]+/i.exec(text.slice(start));
    if (!role) {
      this.fail(line, 'Expected a role', offset + start);
    }
    if (role[0] !== 'iframe' && !this.ariaUtilities.isAriaRole(role[0])) {
      this.fail(line, `Unknown role "${role[0]}"`, offset + start);
    }
    node.role = role[0];
    let position = this.skipSpaces(text, start + role[0].length);

    if (text[position] === '"') {
      const [name, end] = this.readDoubleQuoted(text, position, line, offset);
      // An empty name is no name, which matches any.
      if (name) {
        node.name = this.normalizeWhiteSpace(name);
      }
      position = this.skipSpaces(text, end);
    } else if (text[position] === '/') {
      const [pattern, end] = this.readRegex(text, position, line, offset);
      node.name = { pattern };
      position = this.skipSpaces(text, end);
    }

    while (text[position] === '[') {
      const attribute = /^\[\s*([a-z]+)\s*(?:=\s*([^\]\s]*)\s*)?\]/i.exec(text.slice(position));
      if (!attribute) {
        this.fail(line, 'Expected an attribute, such as [checked] or [level=2]', offset + position);
      }
      this.applyAttribute(node, attribute[1], attribute[2] ?? 'true', line, offset + position);
      position = this.skipSpaces(text, position + attribute[0].length);
    }
    return position;
  }

  /**
   * Records an attribute of a node in its template.
   * @param node {AriaRoleTemplate} The template for the node.
   * @param name {string} The attribute's name.
   * @param value {string} The attribute's value; true when it has none.
   * @param line {TemplateLine} The line, for errors.
   * @param column {number} The column where the attribute starts, for errors.
   */
  private applyAttribute(node: AriaRoleTemplate, name: string, value: string, line: TemplateLine, column: number): void {
    if (name === 'checked' || name === 'pressed') {
      const state = this.toggleValues[value];
      if (state === undefined) {
        this.fail(line, `The value of [${name}] must be true, false, or mixed`, column);
      }
      node[name] = state;
    } else if (name === 'disabled' || name === 'expanded' || name === 'selected') {
      const state = this.booleanValues[value];
      if (state === undefined) {
        this.fail(line, `The value of [${name}] must be true or false`, column);
      }
      node[name] = state;
    } else if (name === 'level') {
      if (!/^[1-9]\d*$/.test(value)) {
        this.fail(line, 'The value of [level] must be a positive whole number', column);
      }
      node.level = Number(value);
    } else if (name !== 'ref') {
      // Refs differ from one page load to the next, so a template ignores them, which lets a snapshot be used as one.
      this.fail(line, `Unsupported attribute [${name}]`, column);
    }
  }

  /**
   * Records a property of a node in its template: its URL, its placeholder, or how its children must match.
   * @param node {AriaRoleTemplate} The template for the node.
   * @param name {string} The property's name.
   * @param value {string} The property's value.
   * @param line {TemplateLine} The line, for errors.
   * @param column {number} The column where the property starts, for errors.
   */
  private applyProperty(node: AriaRoleTemplate, name: string, value: string, line: TemplateLine, column: number): void {
    if (name === 'url' || name === 'placeholder') {
      node[name] = this.createTextTemplate(value);
    } else if (name === 'children') {
      if (!this.childrenModes.includes(value as AriaChildrenMode)) {
        this.fail(line, 'The value of /children must be contain, equal, or deep-equal', column);
      }
      node.childrenMode = value as AriaChildrenMode;
    } else {
      this.fail(line, `Unsupported property /${name}`, column);
    }
  }

  /**
   * Parses a scalar value: double-quoted, single-quoted, a literal (|) or folded (>) block on the lines beneath, or plain.
   * @param lines {TemplateLine[]} The lines of the template.
   * @param index {number} The index of the line the value starts on.
   * @param indent {number} The indentation of the list item the value belongs to.
   * @param start {number} The index in the line where the value starts.
   * @returns {[string, number]} The value, and the index of the first line after it.
   */
  private parseValue(lines: TemplateLine[], index: number, indent: number, start: number): [string, number] {
    const line = lines[index];
    const text = line.text;
    if (start >= text.length) {
      this.fail(line, 'Expected a value', start);
    }
    if (/^[|>][-+]?\s*$/.test(text.slice(start))) {
      return this.readBlock(lines, index, indent);
    }
    let value: string;
    let end: number;
    if (text[start] === '"') {
      [value, end] = this.readDoubleQuoted(text, start, line);
    } else if (text[start] === '\'') {
      [value, end] = this.readSingleQuoted(line, start);
    } else {
      // A plain value ends at a comment.
      const comment = /\s#/.exec(text.slice(start));
      return [text.slice(start, comment ? start + comment.index : undefined).trimEnd(), index + 1];
    }
    const rest = text.slice(end);
    if (rest.trim() && !/^\s+#/.test(rest)) {
      this.fail(line, 'Unexpected text after the quoted value', end);
    }
    return [value, index + 1];
  }

  /**
   * Reads a block value: the lines beneath a list item that are indented more than it, without their shared indentation.
   * @param lines {TemplateLine[]} The lines of the template.
   * @param index {number} The index of the line holding the block indicator.
   * @param indent {number} The indentation of the list item the value belongs to.
   * @returns {[string, number]} The value, with its lines joined by line breaks, and the index of the first line after it.
   */
  private readBlock(lines: TemplateLine[], index: number, indent: number): [string, number] {
    const blockLines: string[] = [];
    let next = index + 1;
    while (next < lines.length && (!lines[next].text.trim() || this.getIndent(lines[next].text) > indent)) {
      blockLines.push(lines[next].text);
      next++;
    }
    const contentIndent = Math.min(...blockLines.filter((text) => text.trim()).map((text) => this.getIndent(text)));
    if (!Number.isFinite(contentIndent)) {
      this.fail(lines[index], 'Expected the lines of the value beneath it', lines[index].text.length);
    }
    return [blockLines.map((text) => text.slice(contentIndent)).join('\n').trimEnd(), next];
  }

  /**
   * Reads a double-quoted string, resolving its escapes.
   * @param text {string} The text holding the string.
   * @param start {number} The index of the opening quote.
   * @param line {TemplateLine} The line, for errors.
   * @param offset {number} The column of the line where the text starts, for errors; zero if omitted.
   * @returns {[string, number]} The string's value, and the index just past its closing quote.
   */
  private readDoubleQuoted(text: string, start: number, line: TemplateLine, offset = 0): [string, number] {
    let value = '';
    let index = start + 1;
    while (index < text.length && text[index] !== '"') {
      if (text[index] !== '\\') {
        value += text[index];
        index++;
        continue;
      }
      const escape = text[index + 1] ?? '';
      const hex = { 'x': 2, 'u': 4, 'U': 8 }[escape];
      const digits = hex ? text.slice(index + 2, index + 2 + hex) : '';
      if (hex && /^[0-9a-f]+$/i.test(digits) && digits.length === hex) {
        value += String.fromCodePoint(parseInt(digits, 16));
        index += 2 + hex;
      } else if (this.escapedCharacters[escape] !== undefined) {
        value += this.escapedCharacters[escape];
        index += 2;
      } else {
        this.fail(line, `Unsupported escape "\\${escape}"`, offset + index);
      }
    }
    if (index >= text.length) {
      this.fail(line, 'Unterminated string', offset + start);
    }
    return [value, index + 1];
  }

  /**
   * Reads a single-quoted string, in which two single quotes stand for one.
   * @param line {TemplateLine} The line holding the string.
   * @param start {number} The index of the opening quote.
   * @returns {[string, number]} The string's value, and the index just past its closing quote.
   */
  private readSingleQuoted(line: TemplateLine, start: number): [string, number] {
    const match = /^'((?:[^']|'')*)'/.exec(line.text.slice(start));
    if (!match) {
      this.fail(line, 'Unterminated string', start);
    }
    return [match[1].replace(/''/g, '\''), start + match[0].length];
  }

  /**
   * Reads a regular expression between slashes, where a slash inside a character class or after a backslash does not end it.
   * @param text {string} The text holding the expression.
   * @param start {number} The index of the opening slash.
   * @param line {TemplateLine} The line, for errors.
   * @param offset {number} The column of the line where the text starts, for errors.
   * @returns {[string, number]} The expression's pattern, and the index just past its closing slash.
   */
  private readRegex(text: string, start: number, line: TemplateLine, offset: number): [string, number] {
    let inClass = false;
    let index = start + 1;
    while (index < text.length && (text[index] !== '/' || inClass)) {
      if (text[index] === '\\') {
        index++;
      } else if (text[index] === '[') {
        inClass = true;
      } else if (text[index] === ']') {
        inClass = false;
      }
      index++;
    }
    if (index >= text.length) {
      this.fail(line, 'Unterminated regular expression', offset + start);
    }
    const pattern = text.slice(start + 1, index);
    try {
      new RegExp(pattern);
    } catch (error) {
      this.fail(line, `Invalid regular expression: ${(error as Error).message}`, offset + start);
    }
    return [pattern, index + 1];
  }

  /**
   * Creates the template for some text.
   * @param value {string} The text as written.
   * @returns {AriaTextTemplate} The template.
   */
  private createTextTemplate(value: string): AriaTextTemplate {
    return { raw: value, normalized: this.normalizeWhiteSpace(value) };
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

  /**
   * Gets the number of white space characters at the start of some text.
   * @param text {string} The text.
   * @returns {number} The number of characters.
   */
  private getIndent(text: string): number {
    return text.length - text.trimStart().length;
  }

  /**
   * Gets the index of the first character at or after a position that is not a space.
   * @param text {string} The text.
   * @param position {number} The position.
   * @returns {number} The index.
   */
  private skipSpaces(text: string, position: number): number {
    return position + this.getIndent(text.slice(position));
  }

  /**
   * Throws an error for a template that is not valid, showing where on its line.
   * @param line {TemplateLine} The line.
   * @param message {string} What is wrong.
   * @param column {number} The zero-based column where it is wrong.
   * @throws {Error} Always.
   */
  private fail(line: TemplateLine, message: string, column: number): never {
    throw new Error(`Invalid aria snapshot template, line ${line.number}: ${message}\n${line.text}\n${' '.repeat(column)}^`);
  }
}

export default AriaTemplateParser;
