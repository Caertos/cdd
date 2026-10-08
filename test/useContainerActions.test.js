/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';

const svc = {
  startContainer: jest.fn(),
  stopContainer: jest.fn(),
  restartContainer: jest.fn(),
  removeContainer: jest.fn(),
};
await jest.unstable_mockModule(
  '../src/helpers/dockerService/serviceComponents/containerActions.js',
  () => svc
);

const { useContainerActions } =
  await import('../src/hooks/creation/useContainerActions.js');

const containers = [{ id: 'cid-1', state: 'running' }];

function setup(onAction = jest.fn()) {
  const view = renderHook(() => useContainerActions({ onAction }));
  return { ...view, onAction };
}

describe('useContainerActions — handleAction', () => {
  beforeEach(() => {
    Object.values(svc).forEach((fn) => fn.mockReset());
  });

  test('success: runs the action on the selected id, reports green and calls onAction', async () => {
    const { result, onAction } = setup();
    const actionFn = jest.fn().mockResolvedValue(undefined);
    await act(async () => {
      await result.current.handleAction({
        actionFn,
        actionLabel: 'Starting',
        container: containers[0],
      });
    });
    expect(actionFn).toHaveBeenCalledWith('cid-1');
    expect(result.current.message).toBe('Starting container successful.');
    expect(result.current.messageColor).toBe('green');
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  test('failure: reports the error in red and does not call onAction', async () => {
    const { result, onAction } = setup();
    const actionFn = jest.fn().mockRejectedValue(new Error('boom'));
    await act(async () => {
      await result.current.handleAction({
        actionFn,
        actionLabel: 'Stopping',
        container: containers[0],
      });
    });
    expect(result.current.message).toContain('boom');
    expect(result.current.messageColor).toBe('red');
    expect(onAction).not.toHaveBeenCalled();
  });

  // D23. The label is a gerund ('Stopping'), so the failure text used to
  // read "Failed to stopping container". Control: test above.
  test('failure message uses the verb, not the gerund', async () => {
    const { result } = setup();
    const actionFn = jest.fn().mockRejectedValue(new Error('boom'));
    await act(async () => {
      await result.current.handleAction({
        actionFn,
        actionLabel: 'Stopping',
        actionVerb: 'stop',
        container: containers[0],
      });
    });
    expect(result.current.message).toBe('Failed to stop container: boom');
  });

  test('stateCheck message short-circuits the action', async () => {
    const { result } = setup();
    const actionFn = jest.fn();
    await act(async () => {
      await result.current.handleAction({
        actionFn,
        actionLabel: 'Starting',
        container: containers[0],
        stateCheck: () => 'Container is already running.',
      });
    });
    expect(actionFn).not.toHaveBeenCalled();
    expect(result.current.message).toBe('Container is already running.');
    expect(result.current.messageColor).toBe('yellow');
  });

  // With the container passed in, "nothing selected" is an absent container
  // rather than an index past the end of the list. The early exit must still
  // hold: the keystroke must not reach Docker with nothing to act on.
  test('no container given does nothing', async () => {
    const { result } = setup();
    const actionFn = jest.fn();
    await act(async () => {
      await result.current.handleAction({
        actionFn,
        actionLabel: 'Starting',
        container: undefined,
      });
    });
    expect(actionFn).not.toHaveBeenCalled();
    expect(result.current.message).toBe('');
  });
});

describe('useContainerActions — service passthrough', () => {
  test.each([
    'startContainer',
    'stopContainer',
    'restartContainer',
    'removeContainer',
  ])('%s delegates to the service with the id', async (name) => {
    svc[name].mockResolvedValue('ok');
    const { result } = setup();
    await expect(result.current[name]('cid-1')).resolves.toBe('ok');
    expect(svc[name]).toHaveBeenCalledWith('cid-1');
  });
});
