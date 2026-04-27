/**
 * @jest-environment jsdom
 */
import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { jest } from '@jest/globals';

// Mock ink so that useInput and useApp are no-ops (require real TTY in production)
await jest.unstable_mockModule('ink', () => ({
  useInput: () => {},
  useApp: () => ({ exit: () => {} }),
}));

// Mock containerActions — expose all named exports so dependents don't break
const mockSvcCreateContainer = jest.fn();
await jest.unstable_mockModule(
  '../src/helpers/dockerService/serviceComponents/containerActions.js',
  () => ({
    createContainer: mockSvcCreateContainer,
    removeContainer: jest.fn().mockResolvedValue(undefined),
    startContainer: jest.fn().mockResolvedValue(undefined),
    stopContainer: jest.fn().mockResolvedValue(undefined),
    restartContainer: jest.fn().mockResolvedValue(undefined),
  })
);

// Mock getLogsStream to avoid side effects
await jest.unstable_mockModule(
  '../src/helpers/dockerService/serviceComponents/containerLogs.js',
  () => ({ getLogsStream: () => {} })
);

const { useControls } = await import('../src/hooks/useControls.js');

function HookTester({ containers, expose }) {
  const hook = useControls(containers);
  useEffect(() => {
    if (expose) expose.current = hook;
  });
  return null;
}

// Helper: advance creation wizard to the final step and trigger onCreate
async function completeCreationWizard(expose, imageName = 'nginx') {
  act(() => { expose.current.creation.setImageName(imageName); });
  act(() => { expose.current.creation.nextStep(); }); // step 0 → 1
  act(() => { expose.current.creation.nextStep(); }); // step 1 → 2
  act(() => { expose.current.creation.nextStep(); }); // step 2 → 3
  // step 3: call nextStep to trigger onCreate (async)
  await act(async () => { expose.current.creation.nextStep(); });
}

describe('useControls (FR6 — port mapping in success message)', () => {
  beforeEach(() => {
    mockSvcCreateContainer.mockReset();
  });

  test('success message includes port mapping after container creation', async () => {
    const ports = [
      { containerPort: '3306', hostPort: '3306', protocol: 'tcp', source: 'auto' },
    ];
    mockSvcCreateContainer.mockResolvedValue({ id: 'cid-abc', ports });

    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    await completeCreationWizard(expose, 'nginx');

    expect(expose.current.actions.message).toBe(
      'Created container cid-abc | Ports: 3306→3306/tcp'
    );
    expect(expose.current.actions.messageColor).toBe('green');
  });

  test('success message has no port section when ports array is empty', async () => {
    mockSvcCreateContainer.mockResolvedValue({ id: 'cid-xyz', ports: [] });

    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    await completeCreationWizard(expose, 'alpine');

    expect(expose.current.actions.message).toBe('Created container cid-xyz');
    expect(expose.current.actions.messageColor).toBe('green');
  });

  test('success message includes multiple port mappings', async () => {
    const ports = [
      { containerPort: '80', hostPort: '8080', protocol: 'tcp', source: 'user' },
      { containerPort: '443', hostPort: '8443', protocol: 'tcp', source: 'user' },
    ];
    mockSvcCreateContainer.mockResolvedValue({ id: 'cid-multi', ports });

    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    await completeCreationWizard(expose, 'nginx');

    expect(expose.current.actions.message).toBe(
      'Created container cid-multi | Ports: 8080→80/tcp, 8443→443/tcp'
    );
  });

  test('error message is shown when svcCreateContainer rejects', async () => {
    mockSvcCreateContainer.mockRejectedValue(new Error('pull access denied'));

    const expose = { current: null };
    render(<HookTester containers={[]} expose={expose} />);

    await completeCreationWizard(expose, 'badimage');

    expect(expose.current.actions.message).toBe(
      'Error creating container: pull access denied'
    );
    expect(expose.current.actions.messageColor).toBe('red');
  });
});
