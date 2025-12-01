import DOMUtilities from './domUtilities.js';

export type AriaRole = 'alert' | 'alertdialog' | 'application' | 'article' | 'banner' | 'blockquote' | 'button' |
  'caption' | 'cell' | 'checkbox' | 'code' | 'columnheader' | 'combobox' | 'complementary' | 'contentinfo' |
  'definition' | 'deletion' | 'dialog' | 'directory' | 'document' | 'emphasis' | 'feed' | 'figure' | 'form' |
  'generic' | 'grid' | 'gridcell' | 'group' | 'heading' | 'img' | 'insertion' | 'link' | 'list' | 'listbox' |
  'listitem' | 'log' | 'main' | 'mark' | 'marquee' | 'math' | 'meter' | 'menu' | 'menubar' | 'menuitem' |
  'menuitemcheckbox' | 'menuitemradio' | 'navigation' | 'none' | 'note' | 'option' | 'paragraph' | 'presentation' |
  'progressbar' | 'radio' | 'radiogroup' | 'region' | 'row' | 'rowgroup' | 'rowheader' | 'scrollbar' | 'search' |
  'searchbox' | 'separator' | 'slider' | 'spinbutton' | 'status' | 'strong' | 'subscript' | 'superscript' |
  'switch' | 'tab' | 'table' | 'tablist' | 'tabpanel' | 'term' | 'textbox' | 'time' | 'timer' | 'toolbar' |
  'tooltip' | 'tree' | 'treegrid' | 'treeitem';

/**
 * Provides utilities for reading and analyzing ARIA attributes.
 */
class AriaUtilities {
  private readonly domUtilities = new DOMUtilities();
  private readonly ariaDisabledRoles: string[] = [
    'application', 'button', 'composite', 'gridcell', 'group', 'input', 'link', 'menuitem',
    'scrollbar', 'separator', 'tab', 'checkbox', 'columnheader', 'combobox', 'grid', 'listbox',
    'menu', 'menubar', 'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'radiogroup', 'row',
    'rowheader', 'searchbox', 'select', 'slider', 'spinbutton', 'switch', 'tablist', 'textbox',
    'toolbar', 'tree', 'treegrid', 'treeitem'
  ];
  private readonly validRoles: AriaRole[] = [
    'alert', 'alertdialog', 'application', 'article', 'banner', 'blockquote', 'button', 'caption',
    'cell', 'checkbox', 'code', 'columnheader', 'combobox', 'complementary', 'contentinfo',
    'definition', 'deletion', 'dialog', 'directory', 'document', 'emphasis', 'feed', 'figure',
    'form', 'generic', 'grid', 'gridcell', 'group', 'heading', 'img', 'insertion', 'link', 'list',
    'listbox', 'listitem', 'log', 'main', 'mark', 'marquee', 'math', 'meter', 'menu', 'menubar',
    'menuitem', 'menuitemcheckbox', 'menuitemradio', 'navigation', 'none', 'note', 'option',
    'paragraph', 'presentation', 'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup',
    'rowheader', 'scrollbar', 'search', 'searchbox', 'separator', 'slider', 'spinbutton', 'status',
    'strong', 'subscript', 'superscript', 'switch', 'tab', 'table', 'tablist', 'tabpanel', 'term',
    'textbox', 'time', 'timer', 'toolbar', 'tooltip','tree', 'treegrid', 'treeitem'
  ];
  private readonly presentationInheritanceParents: Record<string, string[]> = {
    'DD': ['DL', 'DIV'],
    'DIV': ['DL'],
    'DT': ['DL', 'DIV'],
    'LI': ['OL', 'UL'],
    'TBODY': ['TABLE'],
    'TD': ['TR'],
    'TFOOT': ['TABLE'],
    'TH': ['TR'],
    'THEAD': ['TABLE'],
    'TR': ['THEAD', 'TBODY', 'TFOOT', 'TABLE'],
  };

  // https://www.w3.org/TR/wai-aria-practices/examples/landmarks/HTML5.html
  private readonly ancestorPreventingLandmark: string = 'article:not([role]), aside:not([role]), main:not([role]), nav:not([role]), section:not([role]), [role=article], [role=complementary], [role=main], [role=navigation], [role=region]';
  private readonly inputTypeToRole: Record<string, AriaRole> = {
    'button': 'button',
    'checkbox': 'checkbox',
    'image': 'button',
    'number': 'spinbutton',
    'radio': 'radio',
    'range': 'slider',
    'reset': 'button',
    'submit': 'button',
  };

  // https://w3c.github.io/html-aam/#html-element-role-mappings
  // https://www.w3.org/TR/html-aria/#docconformance
  private readonly implicitRoleByTagName: Record<string, (e: Element) => AriaRole | null> = {
    'A': (e: Element) => {
      return e.hasAttribute('href') ? 'link' : null;
    },
    'AREA': (e: Element) => {
      return e.hasAttribute('href') ? 'link' : null;
    },
    'ARTICLE': () => 'article',
    'ASIDE': () => 'complementary',
    'BLOCKQUOTE': () => 'blockquote',
    'BUTTON': () => 'button',
    'CAPTION': () => 'caption',
    'CODE': () => 'code',
    'DATALIST': () => 'listbox',
    'DD': () => 'definition',
    'DEL': () => 'deletion',
    'DETAILS': () => 'group',
    'DFN': () => 'term',
    'DIALOG': () => 'dialog',
    'DT': () => 'term',
    'EM': () => 'emphasis',
    'FIELDSET': () => 'group',
    'FIGURE': () => 'figure',
    'FOOTER': (e: Element) => this.domUtilities.getClosestCrossShadowElement(e, this.ancestorPreventingLandmark) ? null : 'contentinfo',
    'FORM': (e: Element) => this.hasExplicitAccessibleName(e) ? 'form' : null,
    'H1': () => 'heading',
    'H2': () => 'heading',
    'H3': () => 'heading',
    'H4': () => 'heading',
    'H5': () => 'heading',
    'H6': () => 'heading',
    'HEADER': (e: Element) => this.domUtilities.getClosestCrossShadowElement(e, this.ancestorPreventingLandmark) ? null : 'banner',
    'HR': () => 'separator',
    'HTML': () => 'document',
    'IMG': (e: Element) => (e.getAttribute('alt') === '') && !e.getAttribute('title') && !this.hasGlobalAriaAttribute(e) && !this.domUtilities.hasTabIndex(e) ? 'presentation' : 'img',
    'INPUT': (e: Element) => {
      const type = (e as HTMLInputElement).type.toLowerCase();
      if (type === 'search') {  
        return e.hasAttribute('list') ? 'combobox' : 'searchbox';
      }
      if (['email', 'tel', 'text', 'url', ''].includes(type)) {
        // https://html.spec.whatwg.org/multipage/input.html#concept-input-list
        const list = this.getIdRefs(e, e.getAttribute('list'))[0];
        if (list) {
          const listTagName = this.domUtilities.getNormalizedElementTagName(list);
          if (listTagName === 'DATALIST') {
            return 'combobox';
          }
        }
        return 'textbox';
      }
      if (type === 'hidden')
        return null;
      // File inputs do not have a role by the spec: https://www.w3.org/TR/html-aam-1.0/#el-input-file.
      // However, there are open issues about fixing it: https://github.com/w3c/aria/issues/1926.
      // All browsers report it as a button, and it is rendered as a button, so we do "button".
      if (type === 'file')
        return 'button';
      return this.inputTypeToRole[type] || 'textbox';
    },
    'INS': () => 'insertion',
    'LI': () => 'listitem',
    'MAIN': () => 'main',
    'MARK': () => 'mark',
    'MATH': () => 'math',
    'MENU': () => 'list',
    'METER': () => 'meter',
    'NAV': () => 'navigation',
    'OL': () => 'list',
    'OPTGROUP': () => 'group',
    'OPTION': () => 'option',
    'OUTPUT': () => 'status',
    'P': () => 'paragraph',
    'PROGRESS': () => 'progressbar',
    'SEARCH': () => 'search',
    'SECTION': (e: Element) => this.hasExplicitAccessibleName(e) ? 'region' : null,
    'SELECT': (e: Element) => e.hasAttribute('multiple') || (e as HTMLSelectElement).size > 1 ? 'listbox' : 'combobox',
    'STRONG': () => 'strong',
    'SUB': () => 'subscript',
    'SUP': () => 'superscript',
    // For <svg> we default to Chrome behavior:
    // - Chrome reports 'img'.
    // - Firefox reports 'diagram' that is not in official ARIA spec yet.
    // - Safari reports 'no role', but still computes accessible name.
    'SVG': () => 'img',
    'TABLE': () => 'table',
    'TBODY': () => 'rowgroup',
    'TD': (e: Element) => {
      const table = this.domUtilities.getClosestCrossShadowElement(e, 'table');
      const role = table ? this.getExplicitAriaRole(table) : '';
      return (role === 'grid' || role === 'treegrid') ? 'gridcell' : 'cell';
    },
    'TEXTAREA': () => 'textbox',
    'TFOOT': () => 'rowgroup',
    'TH': (e: Element) => {
      if (e.getAttribute('scope') === 'col')
        return 'columnheader';
      if (e.getAttribute('scope') === 'row')
        return 'rowheader';
      const table = this.domUtilities.getClosestCrossShadowElement(e, 'table');
      const role = table ? this.getExplicitAriaRole(table) : '';
      return (role === 'grid' || role === 'treegrid') ? 'gridcell' : 'cell';
    },
    'THEAD': () => 'rowgroup',
    'TIME': () => 'time',
    'TR': () => 'row',
    'UL': () => 'list',
  };

  // https://www.w3.org/TR/wai-aria-1.2/#global_states
  private readonly globalAriaAttributes: Array<[string, string[] | undefined]> = [
    ['aria-atomic', undefined],
    ['aria-busy', undefined],
    ['aria-controls', undefined],
    ['aria-current', undefined],
    ['aria-describedby', undefined],
    ['aria-details', undefined],
    // Global use deprecated in ARIA 1.2
    // ['aria-disabled', undefined],
    ['aria-dropeffect', undefined],
    // Global use deprecated in ARIA 1.2
    // ['aria-errormessage', undefined],
    ['aria-flowto', undefined],
    ['aria-grabbed', undefined],
    // Global use deprecated in ARIA 1.2
    // ['aria-haspopup', undefined],
    ['aria-hidden', undefined],
    // Global use deprecated in ARIA 1.2
    // ['aria-invalid', undefined],
    ['aria-keyshortcuts', undefined],
    ['aria-label', ['caption', 'code', 'deletion', 'emphasis', 'generic', 'insertion', 'paragraph', 'presentation', 'strong', 'subscript', 'superscript']],
    ['aria-labelledby', ['caption', 'code', 'deletion', 'emphasis', 'generic', 'insertion', 'paragraph', 'presentation', 'strong', 'subscript', 'superscript']],
    ['aria-live', undefined],
    ['aria-owns', undefined],
    ['aria-relevant', undefined],
    ['aria-roledescription', ['generic']],
  ];

  private readonly ariaReadonlyRoles = [
    'checkbox', 'combobox', 'grid', 'gridcell', 'listbox', 'radiogroup',
    'slider', 'spinbutton', 'textbox', 'columnheader', 'rowheader',
    'searchbox', 'switch', 'treegrid'
  ];

  /**
   * Gets a value indicating whether an element has an explicit ARIA disabled attribute.
   * @param element {Element | undefined} The element to check.
   * @param isAncestor {boolean} Whether to check the element's ancestors. If omitted, defaults to false.
   * @returns {boolean} True if the element has an explicit ARIA disabled attribute; otherwise, false.
   */
  hasExplicitAriaDisabled(element: Element | undefined, isAncestor = false): boolean {
    if (!element)
      return false;
    if (isAncestor || this.ariaDisabledRoles.includes(this.getAriaRole(element) ?? '')) {
      const attribute = (element.getAttribute('aria-disabled') ?? '').toLowerCase();
      if (attribute === 'true') {
        return true;
      }
      if (attribute === 'false') {
        return false;
      }
      // aria-disabled works across shadow boundaries.
      return this.hasExplicitAriaDisabled(this.domUtilities.getParentElementOrShadowHost(element), true);
    }
    return false;
  }

  /**
   * Gets a value indicating whether an element has an ARIA read only role.
   * @param element {Element} The element to check.
   * @returns {boolean} True if the element has an ARIA read only role; otherwise, false.
   */
  isAriaReadOnlyRole(element: Element): boolean {
    return this.ariaReadonlyRoles.includes(this.getAriaRole(element) ?? '')
  }

  /**
   * Gets the ARIA role of an element, taking into account the element's explicit and implicit roles.
   * @param element {Element} The element to get the ARIA role of.
   * @returns {AriaRole | null} The ARIA role of the element, or null if the element has no ARIA role.
   */
  private getAriaRole(element: Element): AriaRole | null {
    const explicitRole = this.getExplicitAriaRole(element);
    if (!explicitRole) {
      return this.getImplicitAriaRole(element);
    }
    if (explicitRole === 'none' || explicitRole === 'presentation') {
      const implicitRole = this.getImplicitAriaRole(element);
      if (this.hasPresentationConflictResolution(element, implicitRole)) {
        return implicitRole;
      }
    }
    return explicitRole;
  }

  /**
   * Gets the explicit ARIA role of an element.
   * @param element {Element} The element to get the explicit ARIA role of.
   * @returns {AriaRole | null} The explicit ARIA role of the element, or null if the element has no explicit ARIA role.
   */
  private getExplicitAriaRole(element: Element): AriaRole | null {
    // https://www.w3.org/TR/wai-aria-1.2/#document-handling_author-errors_roles
    const roles = (element.getAttribute('role') ?? '').split(' ').map(role => role.trim());
    return roles.find(role => this.validRoles.includes(role as AriaRole)) as AriaRole || null;
  }

  /**
   * Gets the implicit ARIA role of an element.
   * @param element {Element} The element to get the implicit ARIA role of.
   * @returns {AriaRole | null} The implicit ARIA role of the element, or null if the element has no implicit ARIA role.
   */
  private getImplicitAriaRole(element: Element): AriaRole | null {
    const implicitRole = this.implicitRoleByTagName[this.domUtilities.getNormalizedElementTagName(element)]?.(element) ?? '';
    if (!implicitRole) {
      return null;
    }
    // Inherit presentation role when required.
    // https://www.w3.org/TR/wai-aria-1.2/#conflict_resolution_presentation_none
    let ancestor: Element | null = element;
    while (ancestor) {
      const parent = this.domUtilities.getParentElementOrShadowHost(ancestor);
      const parents = this.presentationInheritanceParents[this.domUtilities.getNormalizedElementTagName(ancestor)];
      if (!parents || !parent || !parents.includes(this.domUtilities.getNormalizedElementTagName(parent))) {
        break;
      }
      const parentExplicitRole = this.getExplicitAriaRole(parent);
      if ((parentExplicitRole === 'none' || parentExplicitRole === 'presentation') && !this.hasPresentationConflictResolution(parent, parentExplicitRole)) {
        return parentExplicitRole;
      }
      ancestor = parent;
    }
    return implicitRole;
  }

  /**
   * Gets a value indicating whether an element has a global ARIA attribute.
   * @param element {Element} The element to check.
   * @param forRole {string | null} The role to check the global ARIA attributes for. If omitted, the global ARIA attributes are checked for all roles.
   * @returns {boolean} True if the element has a global ARIA attribute; otherwise, false.
   */
  private hasGlobalAriaAttribute(element: Element, forRole?: string | null): boolean {
    return this.globalAriaAttributes.some(([attr, prohibited]) => {
      return !prohibited?.includes(forRole ?? '') && element.hasAttribute(attr);
    });
  }

  /**
   * Gets a value indicating whether an element has an explicit accessible name.
   * @param element {Element} The element to check.
   * @returns {boolean} True if the element has an explicit accessible name; otherwise, false.
   */
  private hasExplicitAccessibleName(e: Element): boolean {
    return e.hasAttribute('aria-label') || e.hasAttribute('aria-labelledby');
  }

  /**
   * Gets a value indicating whether an element has a presentation conflict resolution.
   * @param element {Element} The element to check.
   * @param role {string | null} The role to check the presentation conflict resolution for. If omitted, the presentation conflict resolution is checked for all roles.
   * @returns {boolean} True if the element has a presentation conflict resolution; otherwise, false.
   */
  private hasPresentationConflictResolution(element: Element, role: string | null): boolean {
    // https://www.w3.org/TR/wai-aria-1.2/#conflict_resolution_presentation_none
    return this.hasGlobalAriaAttribute(element, role) || this.domUtilities.isFocusable(element);
  }

  /**
   * Gets the elements referenced by an ID.
   * @param element {Element} The element to check.
   * @param ref {string | null} The ID to get the elements referenced by. If omitted, the elements referenced by the ID are returned.
   * @returns {Element[]} The elements referenced by the ID.
   */
  private getIdRefs(element: Element, ref: string | null): Element[] {
    if (!ref) {
      return [];
    }
    const root = this.domUtilities.getEnclosingShadowRootOrDocument(element);
    if (!root) {
      return [];
    }
    try {
      const ids = ref.split(' ').filter(id => !!id);
      const result: Element[] = [];
      for (const id of ids) {
        // https://www.w3.org/TR/wai-aria-1.2/#mapping_additional_relations_error_processing
        // "If more than one element has the same ID, the user agent SHOULD use the first element found with the given ID"
        const firstElement = root.querySelector('#' + CSS.escape(id));
        if (firstElement && !result.includes(firstElement)) {
          result.push(firstElement);
        }
      }
      return result;
    } catch {
      // It is not expected to happen, but it is possible that the querySelector
      // throws an error due to a bug in the browser.
      // This is a defensive code path to handle this edge case.
      /* istanbul ignore next -- @preserve */
      return [];
    }
  }
};

export default AriaUtilities;
