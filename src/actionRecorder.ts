/**
 * A modifier key held during a recorded action.
 */
export type ModifierKey = 'Alt' | 'Control' | 'Meta' | 'Shift';

/**
 * An action a user took in a document, on the element the event was aimed at, which for an element in an open
 * shadow root is that element.
 */
export type RecordedAction =
  // A click with a mouse button; clickCount is the click's number in a series, 2 for the second click of a double
  // click. A click on a checkbox, a radio button, a select, a file input, or a label of a checkbox or radio button is
  // recorded by what it changes instead.
  | { kind: 'click', element: Element, button: 'left' | 'middle' | 'right', clickCount: number, modifiers: ModifierKey[] }
  // A checkbox or radio button checked or unchecked, with the mouse or the keyboard.
  | { kind: 'check' | 'uncheck', element: Element }
  // Text entered into an element that takes text, as its whole value after the change.
  | { kind: 'fill', element: Element, value: string }
  // A key pressed that is not typing: a key that types no character, such as Enter or Tab, a key with Control,
  // Alt, or Meta held, or a character key aimed at an element that does not take text.
  | { kind: 'press', element: Element, key: string, modifiers: ModifierKey[] }
  // The options chosen in a select, by their values.
  | { kind: 'select', element: Element, values: string[] }
  // The files chosen for a file input, by their names.
  | { kind: 'setInputFiles', element: Element, files: string[] };

/**
 * Options for recording actions.
 */
export type ActionRecorderOptions = {
  // Leaves out events aimed at elements it returns true for, such as a recording tool's own.
  ignore?: (element: Element) => boolean,
};

/**
 * Records the actions a user takes in a document, from the trusted events the browser raises for them, as they
 * happen: clicks, checkboxes checked and unchecked, text entered, keys pressed, options selected, and files chosen.
 * Events a script raises are left out.
 */
class ActionRecorder {
  // Keys that only modify another, or that edit text as typing does.
  private readonly unreportedKeys = ['Alt', 'AltGraph', 'CapsLock', 'Control', 'Meta', 'Shift', 'Dead', 'Process', 'Unidentified'];
  private readonly textEditingKeys = ['Backspace', 'Delete'];
  private readonly selectJumpKeys = ['Home', 'End', 'PageUp', 'PageDown'];
  private readonly buttons: Array<'left' | 'middle' | 'right'> = ['left', 'middle', 'right'];
  private readonly listeners: Array<[string, (event: Event) => void]> = [
    ['click', (event) => this.onClick(event as MouseEvent)],
    ['auxclick', (event) => this.onClick(event as MouseEvent)],
    ['input', (event) => this.onInput(event)],
    ['change', (event) => this.onChange(event)],
    ['keydown', (event) => this.onKeyDown(event as KeyboardEvent)],
  ];

  private document: Document | null = null;

  /**
   * Initializes a new instance of the ActionRecorder class.
   * @param report {(action: RecordedAction) => void} Called with each action, as it happens.
   * @param options {ActionRecorderOptions} Options for recording.
   */
  constructor(private readonly report: (action: RecordedAction) => void, private readonly options: ActionRecorderOptions = {}) {
  }

  /**
   * Starts recording a document's actions, stopping any recording already started.
   * @param document {Document} The document.
   */
  start(document: Document): void {
    this.stop();
    this.document = document;
    for (const [type, listener] of this.listeners) {
      document.addEventListener(type, listener, true);
    }
  }

  /**
   * Stops recording.
   */
  stop(): void {
    for (const [type, listener] of this.listeners) {
      this.document?.removeEventListener(type, listener, true);
    }

    this.document = null;
  }

  private onClick(event: MouseEvent): void {
    const element = this.getRecordedElement(event);
    // A click with no count comes from the keyboard, which is recorded as its key.
    if (!element || event.detail === 0 || this.isRecordedByChange(element)) {
      return;
    }

    const button = this.buttons[event.button];
    // WebDriver input, which the tests use, offers only the left, middle, and right buttons; others, such as back, are not recorded.
    /* istanbul ignore if -- @preserve */
    if (button === undefined) {
      return;
    }

    this.report({ kind: 'click', element, button, clickCount: event.detail, modifiers: this.getModifiers(event) });
  }

  private onInput(event: Event): void {
    const element = this.getRecordedElement(event);
    if (!element || !this.takesText(element)) {
      return;
    }

    const value = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.value : (element as HTMLElement).innerText;
    this.report({ kind: 'fill', element, value });
  }

  private onChange(event: Event): void {
    const element = this.getRecordedElement(event);
    if (element instanceof HTMLSelectElement) {
      this.report({ kind: 'select', element, values: Array.from(element.selectedOptions, (option) => option.value) });
    } else if (element instanceof HTMLInputElement && element.type === 'file') {
      // A file input always has a file list.
      this.report({ kind: 'setInputFiles', element, files: Array.from(element.files ?? /* istanbul ignore next -- @preserve */ [], (file) => file.name) });
    } else if (element instanceof HTMLInputElement && this.isCheckable(element)) {
      this.report({ kind: element.checked ? 'check' : 'uncheck', element });
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    const element = this.getRecordedElement(event);
    if (!element || this.unreportedKeys.includes(event.key) || this.isRecordedAsText(element, event) || this.isRecordedAsChoice(element, event)) {
      return;
    }

    this.report({ kind: 'press', element, key: event.key, modifiers: this.getModifiers(event) });
  }

  // Typing into an element that takes text is recorded as its value: characters, the keys that delete them, and
  // Enter where it makes a new line.
  private isRecordedAsText(element: Element, event: KeyboardEvent): boolean {
    return this.takesText(element) && !event.ctrlKey && !event.altKey && !event.metaKey
      && (event.key.length === 1 || this.textEditingKeys.includes(event.key) || (event.key === 'Enter' && !(element instanceof HTMLInputElement)));
  }

  // A key that changes a checkbox, a radio button, or a select's choice is recorded as the change: Space, arrows,
  // and the keys a select jumps by.
  private isRecordedAsChoice(element: Element, event: KeyboardEvent): boolean {
    const choosing = (element instanceof HTMLInputElement && this.isCheckable(element)) || element instanceof HTMLSelectElement;
    return choosing && (event.key.length === 1 || event.key.startsWith('Arrow') || this.selectJumpKeys.includes(event.key));
  }

  // The element the event was aimed at, unless the event is a script's or the element is ignored.
  private getRecordedElement(event: Event): Element | null {
    const element = event.composedPath()[0];
    if (!event.isTrusted || !(element instanceof Element) || this.options.ignore?.(element)) {
      return null;
    }

    return element;
  }

  private isCheckable(element: HTMLInputElement): boolean {
    return element.type === 'checkbox' || element.type === 'radio';
  }

  // A click that changes a checkbox, a radio button, a select, or a file input is recorded by the change.
  private isRecordedByChange(element: Element): boolean {
    const control = element instanceof HTMLLabelElement ? element.control : element;
    return (control instanceof HTMLInputElement && (this.isCheckable(control) || control.type === 'file'))
      || element.closest('select') !== null;
  }

  private takesText(element: Element): boolean {
    if (element instanceof HTMLInputElement) {
      return !this.isCheckable(element) && !['button', 'submit', 'reset', 'image', 'file', 'hidden'].includes(element.type);
    }

    return element instanceof HTMLTextAreaElement || (element as HTMLElement).isContentEditable;
  }

  private getModifiers(event: MouseEvent | KeyboardEvent): ModifierKey[] {
    const modifiers: ModifierKey[] = [];
    if (event.altKey) {
      modifiers.push('Alt');
    }

    if (event.ctrlKey) {
      modifiers.push('Control');
    }

    if (event.metaKey) {
      modifiers.push('Meta');
    }

    if (event.shiftKey) {
      modifiers.push('Shift');
    }

    return modifiers;
  }
}

export default ActionRecorder;
