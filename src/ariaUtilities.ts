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

  private readonly ignoredTagNames = ['STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE'];
  private readonly ariaCheckedRoles = ['checkbox', 'menuitemcheckbox', 'option', 'radio', 'switch', 'menuitemradio', 'treeitem'];
  private readonly ariaPressedRoles = ['button'];
  private readonly ariaExpandedRoles = [
    'application', 'button', 'checkbox', 'combobox', 'gridcell', 'link', 'listbox', 'menuitem', 'row',
    'rowheader', 'tab', 'treeitem', 'columnheader', 'menuitemcheckbox', 'menuitemradio', 'switch'
  ];
  private readonly ariaSelectedRoles = ['gridcell', 'option', 'row', 'tab', 'rowheader', 'columnheader', 'treeitem'];
  private readonly ariaLevelRoles = ['heading', 'listitem', 'row', 'treeitem'];

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
   * Gets the checked state of an element: from a native checkbox or radio button, including an indeterminate
   * checkbox, or from aria-checked for a role that supports it.
   * @param element {Element} The element to check.
   * @returns {boolean | 'mixed' | undefined} The checked state, or undefined if the element cannot be checked.
   */
  getAriaChecked(element: Element): boolean | 'mixed' | undefined {
    if (element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)) {
      return element.indeterminate && element.type === 'checkbox' ? 'mixed' : element.checked;
    }
    if (this.ariaCheckedRoles.includes(this.getAriaRole(element) ?? '')) {
      return this.readTriState(element.getAttribute('aria-checked'));
    }
    return undefined;
  }

  /**
   * Gets a value indicating whether an element is a radio button, native or by role, which clicking checks but
   * cannot uncheck.
   * @param element {Element} The element to check.
   * @returns {boolean} True if the element is a radio button; otherwise, false.
   */
  isAriaRadio(element: Element): boolean {
    return ['radio', 'menuitemradio'].includes(this.getAriaRole(element) ?? '');
  }

  /**
   * Gets the pressed state of a toggle button, from aria-pressed.
   * @param element {Element} The element to check.
   * @returns {boolean | 'mixed' | undefined} The pressed state, or undefined if the element is not a button.
   */
  getAriaPressed(element: Element): boolean | 'mixed' | undefined {
    if (this.ariaPressedRoles.includes(this.getAriaRole(element) ?? '')) {
      return this.readTriState(element.getAttribute('aria-pressed'));
    }
    return undefined;
  }

  /**
   * Gets the expanded state of an element: whether a details element is open, or aria-expanded for a role that
   * supports it.
   * @param element {Element} The element to check.
   * @returns {boolean | undefined} The expanded state, or undefined if the element does not expand or does not say.
   */
  getAriaExpanded(element: Element): boolean | undefined {
    if (element instanceof HTMLDetailsElement) {
      return element.open;
    }
    if (this.ariaExpandedRoles.includes(this.getAriaRole(element) ?? '')) {
      const expanded = element.getAttribute('aria-expanded');
      return expanded === 'true' ? true : expanded === 'false' ? false : undefined;
    }
    return undefined;
  }

  /**
   * Gets the selected state of an element: from a native option, or from aria-selected for a role that supports it.
   * @param element {Element} The element to check.
   * @returns {boolean | undefined} The selected state, or undefined if the element cannot be selected.
   */
  getAriaSelected(element: Element): boolean | undefined {
    if (element instanceof HTMLOptionElement) {
      return element.selected;
    }
    if (this.ariaSelectedRoles.includes(this.getAriaRole(element) ?? '')) {
      return element.getAttribute('aria-selected') === 'true';
    }
    return undefined;
  }

  /**
   * Gets the level of an element: from a native h1 to h6 heading, or from aria-level for a role that supports it.
   * @param element {Element} The element to check.
   * @returns {number | undefined} The level, or undefined if the element has none.
   */
  getAriaLevel(element: Element): number | undefined {
    const headingLevel = /^H([1-6])$/.exec(this.domUtilities.getNormalizedElementTagName(element));
    if (headingLevel) {
      return Number(headingLevel[1]);
    }
    if (this.ariaLevelRoles.includes(this.getAriaRole(element) ?? '')) {
      const level = Number(element.getAttribute('aria-level'));
      return Number.isInteger(level) && level >= 1 ? level : undefined;
    }
    return undefined;
  }

  /**
   * Gets the elements an element's aria-labelledby attribute refers to.
   * @param element {Element} The element to check.
   * @returns {Element[] | null} The elements, or null if the element has no aria-labelledby attribute.
   */
  getAriaLabelledByElements(element: Element): Element[] | null {
    const ref = element.getAttribute('aria-labelledby');
    return ref === null ? null : this.getIdRefs(element, ref);
  }

  /**
   * Gets the ARIA role of an element, taking into account the element's explicit and implicit roles.
   * @param element {Element} The element to get the ARIA role of.
   * @returns {AriaRole | null} The ARIA role of the element, or null if the element has no ARIA role.
   */
  getAriaRole(element: Element): AriaRole | null {
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
   * Gets the elements that an ID reference attribute of an element, such as aria-owns or aria-describedby, refers to.
   * @param element {Element} The element whose attribute to read.
   * @param attributeName {string} The name of the attribute, holding a space-separated list of IDs.
   * @returns {Element[]} The elements found, each once, in the order of the IDs; empty if the attribute is missing.
   */
  getReferencedElements(element: Element, attributeName: string): Element[] {
    return this.getIdRefs(element, element.getAttribute(attributeName));
  }

  /**
   * Gets a value indicating whether an element is hidden from the accessibility tree: it is not rendered, it or an
   * ancestor is aria-hidden or display: none, or it is a child of a shadow host that is not assigned to a slot.
   * @param element {Element} The element to check.
   * @returns {boolean} True if the element is hidden from the accessibility tree; otherwise, false.
   */
  isHiddenForAria(element: Element): boolean {
    // https://www.w3.org/TR/wai-aria-1.2/#tree_exclusion
    // https://www.w3.org/TR/wai-aria-1.2/#aria-hidden
    if (this.isIgnoredForAria(element)) {
      return true;
    }
    const tagName = this.domUtilities.getNormalizedElementTagName(element);
    const style = this.domUtilities.getElementComputedStyle(element);
    if (style?.display === 'contents' && tagName !== 'SLOT') {
      // An element with display: contents is not rendered itself, but its child nodes are.
      return !Array.from(element.childNodes).some((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          return !this.isHiddenForAria(child as Element);
        }
        return child.nodeType === Node.TEXT_NODE && this.domUtilities.isVisibleTextNode(child as Text);
      });
    }
    // The visibility of an option in a select, or of a slot, does not hide it.
    const isOptionInSelect = tagName === 'OPTION' && !!element.closest('select');
    if (!isOptionInSelect && tagName !== 'SLOT' && !this.domUtilities.isStyleVisibilityVisible(element, style)) {
      return true;
    }
    for (let current: Element | undefined = element; current; current = this.domUtilities.getParentElementOrShadowHost(current)) {
      if (this.isExcludedFromAriaTree(current)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Gets a value indicating whether an element is never part of the accessibility tree, whatever its style.
   * @param element {Element} The element to check.
   * @returns {boolean} True if the element is a style, script, noscript, or template element; otherwise, false.
   */
  isIgnoredForAria(element: Element): boolean {
    return this.ignoredTagNames.includes(this.domUtilities.getNormalizedElementTagName(element));
  }

  /**
   * Reads a true/false/mixed ARIA attribute value; anything but "true" or "mixed" is false.
   * @param value {string | null} The attribute value.
   * @returns {boolean | 'mixed'} The state.
   */
  private readTriState(value: string | null): boolean | 'mixed' {
    return value === 'mixed' ? 'mixed' : value === 'true';
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
   * Gets a value indicating whether an element, by itself and not through its ancestors, removes itself and its
   * subtree from the accessibility tree.
   * @param element {Element} The element to check.
   * @returns {boolean} True if the element is display: none or aria-hidden, has no computed style, or is a child of a
   * shadow host that is not assigned to a slot; otherwise, false.
   */
  private isExcludedFromAriaTree(element: Element): boolean {
    if (element.parentElement?.shadowRoot && !element.assignedSlot) {
      return true;
    }
    const style = this.domUtilities.getElementComputedStyle(element);
    return !style || style.display === 'none' || (element.getAttribute('aria-hidden') ?? '').toLowerCase() === 'true';
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
