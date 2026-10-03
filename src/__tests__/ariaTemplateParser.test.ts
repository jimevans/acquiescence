import { describe, expect, it } from 'vitest';
import AriaTemplateParser from '../ariaTemplateParser';

describe('AriaTemplateParser', () => {
  const parser = new AriaTemplateParser();

  const parse = (template: string) => parser.parse(template);

  const text = (value: string, normalized = value) => ({ kind: 'text', text: { raw: value, normalized } });

  describe('nodes', () => {
    it('should parse a single node as the node to find', () => {
      expect(parse('- heading "title" [level=1]')).toEqual({ kind: 'role', role: 'heading', name: 'title', level: 1, children: [] });
    });

    it('should parse several nodes as a fragment', () => {
      expect(parse(`
        - heading "Microsoft"
        - text: Open source
      `)).toEqual({
        kind: 'role',
        role: 'fragment',
        children: [{ kind: 'role', role: 'heading', name: 'Microsoft', children: [] }, text('Open source')],
      });
    });

    it('should nest children by indentation, skipping blank lines and comments', () => {
      expect(parse(`
        # A list
        - list "my list":

          - listitem: one
          # between items
          - listitem:
            - link "link"
        - button
      `)).toEqual({
        kind: 'role',
        role: 'fragment',
        children: [
          {
            kind: 'role', role: 'list', name: 'my list', children: [
              { kind: 'role', role: 'listitem', children: [text('one')] },
              { kind: 'role', role: 'listitem', children: [{ kind: 'role', role: 'link', name: 'link', children: [] }] },
            ],
          },
          { kind: 'role', role: 'button', children: [] },
        ],
      });
    });

    it('should accept a node with a colon and no children', () => {
      expect(parse('- list:')).toEqual({ kind: 'role', role: 'list', children: [] });
    });

    it('should accept iframes, but not unknown roles', () => {
      expect(parse('- iframe')).toEqual({ kind: 'role', role: 'iframe', children: [] });
      expect(() => parse('- buton "Go"')).toThrow('Unknown role "buton"');
    });
  });

  describe('names', () => {
    it('should read quoted names, resolving escapes and normalizing white space', () => {
      expect(parse('- button "Click \\" me \\\\ \\/ \\n\\t\\x41\\u0042\\U00000043  now"')).toMatchObject({ name: 'Click " me \\ / ABC now' });
    });

    it('should treat an empty name as none', () => {
      expect(parse('- button ""')).not.toHaveProperty('name');
    });

    it('should read regular expressions, where slashes in a class or after a backslash do not end them', () => {
      expect(parse('- heading /Issues \\d+/')).toMatchObject({ name: { pattern: 'Issues \\d+' } });
      expect(parse('- heading /Issues 1[/]2/')).toMatchObject({ name: { pattern: 'Issues 1[/]2' } });
      expect(parse('- heading /Issues 1[\\]]]2/')).toMatchObject({ name: { pattern: 'Issues 1[\\]]]2' } });
      expect(parse('- button /Click \\/ me/')).toMatchObject({ name: { pattern: 'Click \\/ me' } });
    });

    it('should read single-quoted keys, in which two quotes stand for one', () => {
      expect(parse('- \'button "Click: me"\'')).toMatchObject({ role: 'button', name: 'Click: me' });
      expect(parse('- \'button "Click \'\' me" [pressed]\': text')).toMatchObject({ role: 'button', name: 'Click \' me', pressed: true, children: [text('text')] });
    });

    it('should read a name containing a colon without quotes around the key', () => {
      expect(parse('- button "a: b"')).toMatchObject({ role: 'button', name: 'a: b' });
    });
  });

  describe('attributes', () => {
    it('should read every supported attribute, with or without a value', () => {
      expect(parse('- treeitem [checked=mixed] [disabled] [expanded=false] [level = 3 ] [pressed=true] [selected=false]')).toEqual({
        kind: 'role', role: 'treeitem', checked: 'mixed', disabled: true, expanded: false, level: 3, pressed: true, selected: false, children: [],
      });
      expect(parse('- checkbox [checked=false]')).toMatchObject({ checked: false });
      expect(parse('- button [pressed=mixed ]')).toMatchObject({ pressed: 'mixed' });
    });

    it('should ignore refs, so a snapshot can be used as a template', () => {
      expect(parse('- button "Go" [ref=e12]')).toEqual({ kind: 'role', role: 'button', name: 'Go', children: [] });
    });

    it('should reject unsupported attributes and values', () => {
      expect(() => parse('- textbox [invalid]')).toThrow('Unsupported attribute [invalid]');
      expect(() => parse('- checkbox [checked=yes]')).toThrow('The value of [checked] must be true, false, or mixed');
      expect(() => parse('- button [disabled=1]')).toThrow('The value of [disabled] must be true or false');
      expect(() => parse('- heading [level=-3]')).toThrow('The value of [level] must be a positive whole number');
      expect(() => parse('- heading [level')).toThrow('Expected an attribute, such as [checked] or [level=2]');
    });
  });

  describe('values', () => {
    it('should read plain, quoted, and commented values', () => {
      expect(parse(`
        - text: plain value  # a comment
        - text: "double \\"quoted\\""   # a comment
        - text: 'single ''quoted'''
        - text: a#b
        - paragraph: 123
      `)).toMatchObject({
        children: [text('plain value'), text('double "quoted"'), text('single \'quoted\''), text('a#b'), { role: 'paragraph', children: [text('123')] }],
      });
    });

    it('should read literal and folded block values', () => {
      expect(parse(`
        - paragraph: |
            Line 1
              Line 2

            Line 3
        - text: >-
            folded
        - button
      `)).toMatchObject({
        children: [
          { role: 'paragraph', children: [text('Line 1\n  Line 2\n\nLine 3', 'Line 1 Line 2 Line 3')] },
          text('folded'),
          { role: 'button' },
        ],
      });
    });

    it('should read properties and the children mode', () => {
      expect(parse(`
        - link:
          - /url: /.*example.com/
        - textbox:
          - /placeholder: Email
          - /children: equal
      `)).toMatchObject({
        children: [
          { role: 'link', url: { raw: '/.*example.com/', normalized: '/.*example.com/' } },
          { role: 'textbox', placeholder: { raw: 'Email', normalized: 'Email' }, childrenMode: 'equal' },
        ],
      });
    });

    it('should apply a top-level children mode to the fragment', () => {
      expect(parse(`
        - /children: deep-equal
        - list
      `)).toEqual({ kind: 'role', role: 'fragment', childrenMode: 'deep-equal', children: [{ kind: 'role', role: 'list', children: [] }] });
      expect(parse(`
        - /children: contain
        - list
      `)).toEqual({ kind: 'role', role: 'list', children: [] });
    });
  });

  describe('errors', () => {
    it('should report the line and column of an error', () => {
      expect(() => parse('- list:\n  - listitem [level=x]')).toThrow('Invalid aria snapshot template, line 2: The value of [level] must be a positive whole number\n  - listitem [level=x]\n             ^');
      expect(() => parse('- \'button "a" [level=x]\'')).toThrow('\n- \'button "a" [level=x]\'\n              ^');
    });

    it('should reject templates that are not lists of nodes', () => {
      expect(() => parse('')).toThrow('A template must list at least one node');
      expect(() => parse('# only a comment')).toThrow('A template must list at least one node');
      expect(() => parse('heading "title"')).toThrow('Expected a list item starting with "- "');
      expect(() => parse('-')).toThrow('Expected a role');
      expect(() => parse('- "title"')).toThrow('Expected a role');
      expect(() => parse('- |\n    heading "title"')).toThrow('Expected a role');
    });

    it('should reject inconsistent indentation and tabs', () => {
      expect(() => parse('- list:\n    - listitem\n  - listitem')).toThrow('Unexpected indentation');
      expect(() => parse('- listitem: text\n  - link')).toThrow('Unexpected indentation');
      expect(() => parse('- list:\n\t- listitem')).toThrow('Tabs cannot indent a template');
    });

    it('should reject malformed keys and values', () => {
      expect(() => parse('- button "Go" extra')).toThrow('Expected ":" or the end of the line');
      expect(() => parse('- \'button "Go" extra\'')).toThrow('Expected an attribute or the end of the key');
      expect(() => parse('- \'button "Go"')).toThrow('Unterminated string');
      expect(() => parse('- button "Go')).toThrow('Unterminated string');
      expect(() => parse('- button "\\q"')).toThrow('Unsupported escape "\\q"');
      expect(() => parse('- button "\\x4"')).toThrow('Unsupported escape "\\x"');
      expect(() => parse('- button "Go\\')).toThrow('Unsupported escape "\\"');
      expect(() => parse('- button /Go')).toThrow('Unterminated regular expression');
      expect(() => parse('- button /[a/')).toThrow('Unterminated regular expression');
      expect(() => parse('- button /a(/')).toThrow('Invalid regular expression');
      expect(() => parse('- text:')).toThrow('Expected a value');
      expect(() => parse('- text: "quoted" extra')).toThrow('Unexpected text after the quoted value');
      expect(() => parse('- text: |\n- button')).toThrow('Expected the lines of the value beneath it');
    });

    it('should reject unsupported properties and children modes', () => {
      expect(() => parse('- link:\n  - /href: x')).toThrow('Unsupported property /href');
      expect(() => parse('- list:\n  - /children: strict')).toThrow('The value of /children must be contain, equal, or deep-equal');
    });
  });
});
