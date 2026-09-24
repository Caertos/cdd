/**
 * @jest-environment jsdom
 */
import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { jest } from '@jest/globals';

const mockGetContainers = jest.fn();
await jest.unstable_mockModule(
  '../src/helpers/dockerService/serviceComponents/containerList.js',
  () => ({ getContainers: mockGetContainers })
);

const { useContainers } = await import('../src/hooks/useContainers.js');

function HookTester({ expose }) {
  const hook = useContainers();
  useEffect(() => {
    expose.current = hook;
  });
  return null;
}

describe('useContainers — connection retry re-fetches immediately', () => {
  beforeEach(() => {
    mockGetContainers.mockReset();
  });

  test('failure then manual retry fetches again without waiting for interval', async () => {
    const dockerErr = Object.assign(new Error('connect ENOENT'), {
      code: 'ENOENT',
    });
    mockGetContainers.mockRejectedValue(dockerErr);

    const expose = { current: null };
    render(<HookTester expose={expose} />);

    await act(async () => {});

    expect(expose.current.connection.status).toBe('error');
    const callsWhileDown = mockGetContainers.mock.calls.length;
    expect(callsWhileDown).toBeGreaterThanOrEqual(1);

    mockGetContainers.mockReset();
    mockGetContainers.mockResolvedValue([{ id: 'c1', name: 'web' }]);

    await act(async () => {
      expose.current.connection.retry();
    });

    // Immediate re-fetch: status recovers without waiting for the 3s poll.
    // (status error→ok re-runs the effect, so call count may be >1.)
    expect(mockGetContainers.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(expose.current.connection.status).toBe('ok');
    expect(expose.current.containers).toEqual([{ id: 'c1', name: 'web' }]);
  });

  test('containers stay on failure (stale data is not cleared)', async () => {
    mockGetContainers.mockResolvedValueOnce([{ id: 'c1', name: 'kept' }]);
    mockGetContainers.mockRejectedValue(
      Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' })
    );

    const expose = { current: null };
    render(<HookTester expose={expose} />);

    await act(async () => {});
    expect(expose.current.containers).toEqual([{ id: 'c1', name: 'kept' }]);
    expect(expose.current.connection.status).toBe('error');
    expect(expose.current.connection.isStale).toBe(true);

    await act(async () => {
      expose.current.connection.retry();
    });

    expect(expose.current.connection.status).toBe('error');
    expect(expose.current.containers).toEqual([{ id: 'c1', name: 'kept' }]);
    expect(expose.current.connection.isStale).toBe(true);
  });
});
