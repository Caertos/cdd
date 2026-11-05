/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, act } from '@testing-library/react';
import { jest } from '@jest/globals';

// Mock ink — capture the useInput handler so tests can simulate keypresses.
let _inputHandler = null;
const triggerInput = (input, key = {}) => {
  if (_inputHandler) _inputHandler(input, key);
};
const MockBox = ({ children, ...props }) =>
  React.createElement('div', props, children);
const MockText = ({ children }) => React.createElement('span', null, children);
const MockSpacer = () => React.createElement('div', null);
await jest.unstable_mockModule('ink', () => ({
  Box: MockBox,
  Text: MockText,
  Spacer: MockSpacer,
  useInput: (fn) => {
    _inputHandler = fn;
  },
  useApp: () => ({ exit: () => {} }),
  render: () => ({ unmount: () => {}, waitUntilExit: () => Promise.resolve() }),
}));

// Mock containerActions — expose all named exports so dependents don't break
const mockSvcCreateContainer = jest.fn();
const mockSvcStopContainer = jest.fn().mockResolvedValue(undefined);
await jest.unstable_mockModule(
  '../src/helpers/dockerService/serviceComponents/containerActions.js',
  () => ({
    createContainer: mockSvcCreateContainer,
    removeContainer: jest.fn().mockResolvedValue(undefined),
    startContainer: jest.fn().mockResolvedValue(undefined),
    stopContainer: mockSvcStopContainer,
    restartContainer: jest.fn().mockResolvedValue(undefined),
  })
);

// Mock the log module to avoid side effects.
const mockGetLogsStream = jest.fn(() => ({ stop: jest.fn() }));
const mockGetLogsChunk = jest.fn();
await jest.unstable_mockModule(
  '../src/helpers/dockerService/serviceComponents/containerLogs.js',
  () => ({
    getLogsStream: mockGetLogsStream,
    getLogsChunk: mockGetLogsChunk,
    getLogsTail: jest.fn().mockResolvedValue([]),
  })
);

// inspect: the F key reads Config.Env to rebuild the wizard (TASK-8).
const mockGetContainerDetails = jest.fn();
const mockGetImageEnv = jest.fn();
await jest.unstable_mockModule(
  '../src/helpers/dockerService/serviceComponents/containerInspect.js',
  () => ({
    getContainerDetails: mockGetContainerDetails,
    getImageEnv: mockGetImageEnv,
    getManyContainerDetails: jest.fn().mockResolvedValue(new Map()),
  })
);

// Break useControls → useShellMode → App.jsx → useContainers cycle under ESM
await jest.unstable_mockModule('../src/hooks/useShellMode.js', () => ({
  useShellMode: () => ({ openShell: jest.fn() }),
}));

// Review step (TASK-4) imports these dynamically; without mocks a unit test
// would open the real Docker daemon socket.
await jest.unstable_mockModule(
  '../src/helpers/dockerService/dockerService.js',
  () => ({
    docker: { listContainers: jest.fn().mockResolvedValue([]) },
  })
);
await jest.unstable_mockModule(
  '../src/helpers/dockerService/serviceComponents/imageUtils.js',
  () => ({
    imageExists: jest.fn().mockResolvedValue(true),
    pullImage: jest.fn().mockResolvedValue(undefined),
    previewAutoPorts: jest.fn().mockResolvedValue(null),
  })
);

// App is the composition root. Its data hooks are mocked so the three
// containers are the only input; useControls stays real so the keymap, the
// view router and the wizard are the code under test.
const CONTAINERS = [
  { id: 'id-web', name: 'web', image: 'nginx:latest', state: 'running', status: 'Up 1 m', ports: [] },
  { id: 'id-db', name: 'db', image: 'nginx:latest', state: 'running', status: 'Up 1 m', ports: [] },
  { id: 'id-cache', name: 'cache', image: 'nginx:latest', state: 'running', status: 'Up 1 m', ports: [] },
];
const freshConnection = () => ({
  status: 'ok',
  error: null,
  isStale: false,
  nextRetryIn: 0,
  retry: jest.fn(),
});

await jest.unstable_mockModule('../src/hooks/useContainers.js', () => ({
  useContainers: () => ({
    containers: CONTAINERS,
    connection: freshConnection(),
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

// Mutable so a test can put the shell on a short terminal.
let rowsMock = 24;
await jest.unstable_mockModule('../src/hooks/useTerminalHeight.js', () => ({
  useTerminalHeight: () => rowsMock,
  DEFAULT_TERMINAL_ROWS: 24,
}));

// Rows read their stats through props; the shared poller must not start.
await jest.unstable_mockModule('../src/hooks/useSharedContainerStats.js', () => ({
  useSharedContainerStats: () => ({ stats: new Map(), errors: new Map() }),
}));

// Imported after the mocks; the mock factories read them only at render time.
const { STRINGS } = await import('../src/helpers/strings.js');
const { default: App } = await import('../src/App.jsx');

const TABS = ['1 Containers', '2 Projects', '3 Images'];

const setup = async () => {
  const utils = render(<App rows={24} />);
  await act(async () => {});
  return utils;
};

const press = (input, key = {}) => {
  act(() => {
    triggerInput(input, key);
  });
};

/** The text of the row the selection marker sits in. */
const markedRowText = (getByText) =>
  getByText('➤').closest('div').parentElement.textContent;

beforeEach(() => {
  _inputHandler = null;
  rowsMock = 24;
});

describe('App — views and the persistent shell (TASK-12)', () => {
  test('c opens the wizard and keeps the header and the tabs (D11)', async () => {
    const { getByText } = await setup();
    expect(getByText(/3 containers found/)).toBeTruthy();
    for (const tab of TABS) { expect(getByText(tab)).toBeTruthy(); }

    press('c');

    expect(getByText(/Step 1 of/)).toBeTruthy();
    expect(getByText(/3 containers found/)).toBeTruthy();
    for (const tab of TABS) { expect(getByText(tab)).toBeTruthy(); }
  });

  test('the selected row survives a trip to Projects', async () => {
    const { getByText } = await setup();

    press('', { downArrow: true });
    expect(markedRowText(getByText)).toContain('db');

    press('', { tab: true });
    expect(getByText(STRINGS.views.projectsPlaceholder)).toBeTruthy();
    for (const tab of TABS) { expect(getByText(tab)).toBeTruthy(); }

    press('1');
    expect(markedRowText(getByText)).toContain('db');
  });

  test('list keys do nothing on the projects view', async () => {
    const { getByText, queryByText } = await setup();

    press('', { tab: true });
    press('c');

    expect(queryByText(/Step 1 of/)).toBeNull();
    expect(getByText(STRINGS.views.projectsPlaceholder)).toBeTruthy();
    for (const tab of TABS) { expect(getByText(tab)).toBeTruthy(); }
  });
});

describe('App — the footer on short terminals (TASK-12)', () => {
  test('a 15-row terminal keeps the tabs, the key hints and a list row, and drops the footer', async () => {
    rowsMock = 15;
    const { getByText, getAllByText, queryByText } = await setup();
    for (const tab of TABS) { expect(getByText(tab)).toBeTruthy(); }
    // Only some rows fit: the list is sorted by name, so which of them shows
    // is not the point. One row is enough.
    expect(getAllByText(/^(web|db|cache)$/).length).toBeGreaterThan(0);
    expect(getByText('Start')).toBeTruthy();
    expect(queryByText(/Crafted by/)).toBeNull();
  });

  test('a 24-row terminal shows the footer', async () => {
    rowsMock = 24;
    const { getByText } = await setup();
    expect(getByText(/Crafted by/)).toBeTruthy();
  });
});
