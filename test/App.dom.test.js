/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { jest } from '@jest/globals';
import { sanitizedCursorIndex } from '../src/helpers/sanitizeTerminalText.js';
import {
  CSI,
  LEGIT,
  expectNoControlBytes,
  hostile,
  sanitised,
} from './support/terminalControls.js';

// App is the composition root: it wires the hooks to the panels. The hooks
// are mocked so the test can put a hostile query in the filter field without
// a Docker daemon behind it, and so the field is the only thing on screen.
let view = null;

await jest.unstable_mockModule('../src/hooks/useContainers.js', () => ({
  useContainers: () => ({
    containers: [],
    connection: {
      status: 'ok',
      error: null,
      isStale: false,
      nextRetryIn: 0,
      retry: jest.fn(),
    },
  }),
}));

await jest.unstable_mockModule('../src/hooks/useContainerHealth.js', () => ({
  useContainerHealth: () => ({ health: new Map(), details: new Map() }),
}));

await jest.unstable_mockModule('../src/hooks/useDockerLauncher.js', () => ({
  useDockerLauncher: () => ({
    method: null,
    status: 'idle',
    elapsedMs: 0,
    error: null,
    canLaunch: false,
    reset: jest.fn(),
  }),
}));

await jest.unstable_mockModule('../src/hooks/useTerminalHeight.js', () => ({
  useTerminalHeight: () => 24,
  DEFAULT_TERMINAL_ROWS: 24,
}));

await jest.unstable_mockModule('../src/hooks/useControls.js', () => ({
  useControls: () => ({
    selected: 0,
    selectedContainer: null,
    view,
    message: '',
    messageColor: 'gray',
    showLogs: false,
    logs: [],
    exitLogs: jest.fn(),
    creatingContainer: false,
    startCreation: jest.fn(),
    diagnosis: null,
    isDiagnosing: false,
    pendingCleanup: null,
    creationStep: 0,
    imageNameInput: '',
    containerNameInput: '',
    portInput: '',
    envInput: '',
    creation: {
      cursors: {},
      activeItems: [],
      selectedSuggestionIndex: -1,
      visibleOffset: 0,
      hubResults: [],
      reviewRows: [],
      reviewWarnings: [],
      focusedReviewRow: -1,
    },
    actions: {},
    logsViewer: {},
    confirmErase: false,
    confirmDiscard: false,
    confirmQuit: false,
    showDebugLogs: false,
    debugLogs: [],
    showHelp: false,
    context: 'list',
    keymapBindings: [],
    helpContext: 'list',
    helpBindings: [],
    handlers: {},
    dispatch: jest.fn(),
  }),
}));

const { default: App } = await import('../src/App.jsx');

/**
 * Render the app with the filter field open on `query`, the caret at
 * `cursor` (a position in the raw text, counted in code points, the way the
 * filter editor counts it).
 *
 * @param {string} query
 * @param {number} cursor
 * @returns {import('@testing-library/react').RenderResult}
 */
function renderApp(query, cursor) {
  view = {
    visible: [],
    totalCount: 25,
    query,
    cursor,
    isFiltering: true,
    sortMode: 'state',
  };
  return render(<App />);
}

/** The node that holds the value of the filter field (the caret is inside). */
const fieldNode = (container) => {
  const caret = container.querySelector('span[data-inverse="true"]');
  return caret ? caret.parentElement : null;
};

/** The character the caret of the filter field sits on. */
const caretNode = (container) =>
  container.querySelector('span[data-inverse="true"]');

// The query of the filter is what the user typed, but it can also be a
// paste. A terminal executes part of what it is given, so the field has to
// show it without the control bytes.
describe('App — the filter field shows the query sanitised', () => {
  test('no control byte reaches the DOM at all', () => {
    const query = hostile('query');
    const { container } = renderApp(query, query.length);
    expectNoControlBytes(container.textContent);
  });

  test('the field leaves no control byte in the DOM', () => {
    const query = hostile('query');
    const { container } = renderApp(query, query.length);
    const field = fieldNode(container);
    expect(field).toBeTruthy();
    expectNoControlBytes(field.textContent);
  });

  test('the words of the query survive', () => {
    const query = hostile('query');
    const { container } = renderApp(query, query.length);
    const field = fieldNode(container);
    // The field shows the sanitised query; the caret at the end adds the
    // block cursor behind it.
    expect(field.textContent).toContain(sanitised('query'));
    expect(caretNode(container).textContent).toBe(' ');
  });

  test('the url of the hyperlink does not stay on screen', () => {
    const query = hostile('query');
    const { container } = renderApp(query, query.length);
    expect(container.textContent).not.toContain('evil.example');
  });

  test('legitimate text is not mangled', () => {
    const { container } = renderApp(LEGIT, Array.from(LEGIT).length);
    const field = fieldNode(container);
    expect(field.textContent).toContain(LEGIT);
    expectNoControlBytes(field.textContent);
  });
});

// The caret is counted in the raw text, but the field shows the sanitised
// one: without a remap the caret would sit on another character.
describe('App — the caret of the filter field follows the text on screen', () => {
  test('a sequence before the caret does not move it', () => {
    // The caret is right after "ab", which is where the sequence starts.
    const { container } = renderApp(`ab${CSI}31mcd`, 4);
    const field = fieldNode(container);
    expect(field.textContent).toBe('abcd');
    expect(caretNode(container).textContent).toBe('c');
  });

  test('an emoji before the caret does not move it', () => {
    // The caret is right after the whale, which is where "a" starts.
    const { container } = renderApp('🐳ab', 1);
    const field = fieldNode(container);
    expect(field.textContent).toBe('🐳ab');
    expect(caretNode(container).textContent).toBe('a');
  });
});

// The remap itself is a pure function, so it can be checked on its own.
describe('sanitizedCursorIndex — the position on screen', () => {
  test('without a sequence the position does not move', () => {
    expect(sanitizedCursorIndex('plain', 0)).toBe(0);
    expect(sanitizedCursorIndex('plain', 5)).toBe(5);
  });

  test('a sequence before the caret is not counted', () => {
    // "abc" is what is on screen, so the caret is at 3 and then at 1.
    expect(sanitizedCursorIndex(`${CSI}31mabc`, 8)).toBe(3);
    expect(sanitizedCursorIndex(`${CSI}31mabc`, 6)).toBe(1);
  });

  test('an emoji before the caret is not counted twice', () => {
    // The whale is one character on screen, not two.
    expect(sanitizedCursorIndex('🐳ab', 1)).toBe(1);
    expect(sanitizedCursorIndex('🐳ab', 3)).toBe(3);
  });

  test('the caret cannot be negative', () => {
    expect(sanitizedCursorIndex('abc', -1)).toBe(-1);
  });
});
