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

const { useContainerActions } = await import('../src/hooks/creation/useContainerActions.js');

const containers = [{ id: 'cid-1', state: 'running' }];

function setup(onAction = jest.fn()) {
  const view = renderHook(() => useContainerActions({ containers, onAction }));
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
      await result.current.handleAction({ actionFn, actionLabel: 'Starting', selected: 0 });
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
      await result.current.handleAction({ actionFn, actionLabel: 'Stopping', selected: 0 });
    });
    expect(result.current.message).toContain('boom');
    expect(result.current.messageColor).toBe('red');
    expect(onAction).not.toHaveBeenCalled();
  });

  // D23 — fixed by TASK-19. The label is a gerund ('Stopping'), so the
  // failure text reads "Failed to stopping container". Control: test above.
  test.failing('failure message uses the verb, not the gerund', async () => {
    const { result } = setup();
    const actionFn = jest.fn().mockRejectedValue(new Error('boom'));
    await act(async () => {
      await result.current.handleAction({ actionFn, actionLabel: 'Stopping', selected: 0 });
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
        selected: 0,
        stateCheck: () => 'Container is already running.',
      });
    });
    expect(actionFn).not.toHaveBeenCalled();
    expect(result.current.message).toBe('Container is already running.');
    expect(result.current.messageColor).toBe('yellow');
  });

  test('no container at the index does nothing', async () => {
    const { result } = setup();
    const actionFn = jest.fn();
    await act(async () => {
      await result.current.handleAction({ actionFn, actionLabel: 'Starting', selected: 5 });
    });
    expect(actionFn).not.toHaveBeenCalled();
    expect(result.current.message).toBe('');
  });
});

describe('useContainerActions — service passthrough', () => {
  test.each(['startContainer', 'stopContainer', 'restartContainer', 'removeContainer'])(
    '%s delegates to the service with the id',
    async (name) => {
      svc[name].mockResolvedValue('ok');
      const { result } = setup();
      await expect(result.current[name]('cid-1')).resolves.toBe('ok');
      expect(svc[name]).toHaveBeenCalledWith('cid-1');
    }
  );
});
