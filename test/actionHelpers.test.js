import { jest } from '@jest/globals';
import { handleAction } from '../src/helpers/actionHelpers.js';
import { MESSAGE_TIMEOUTS } from '../src/helpers/constants.js';

describe('handleAction', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('returns early when no container selected', async () => {
    const setMessage = jest.fn();
    const setMessageColor = jest.fn();
    const actionFn = jest.fn();

    await handleAction({
      containers: [],
      selected: 0,
      actionFn,
      actionLabel: 'Start',
      setMessage,
      setMessageColor,
    });

    expect(actionFn).not.toHaveBeenCalled();
    expect(setMessage).not.toHaveBeenCalled();
    expect(setMessageColor).not.toHaveBeenCalled();
  });

  test('uses stateCheck and shows error then clears message after SHORT timeout', async () => {
    const setMessage = jest.fn();
    const setMessageColor = jest.fn();
    const actionFn = jest.fn();

    const containers = [{ id: 'c1', name: 'one' }];

  const stateCheck = (_c) => 'Already running';

    await handleAction({
      containers,
      selected: 0,
      actionFn,
      actionLabel: 'Start',
      setMessage,
      setMessageColor,
      stateCheck,
    });

    expect(setMessage).toHaveBeenCalledWith('Already running');
    expect(setMessageColor).toHaveBeenCalledWith('red');
    expect(actionFn).not.toHaveBeenCalled();

    // advance timers to allow message clear
    jest.advanceTimersByTime(MESSAGE_TIMEOUTS.SHORT + 10);
    expect(setMessage).toHaveBeenCalledWith('');
  });

  test('on success sets success message and clears after DEFAULT timeout', async () => {
    const setMessage = jest.fn();
    const setMessageColor = jest.fn();
    const actionFn = jest.fn().mockResolvedValue(undefined);

    const containers = [{ id: 'c1', name: 'one' }];

    await handleAction({
      containers,
      selected: 0,
      actionFn,
      actionLabel: 'Start',
      setMessage,
      setMessageColor,
    });

    expect(actionFn).toHaveBeenCalledWith('c1');
    expect(setMessage).toHaveBeenCalledWith('Start container completed successfully');
    expect(setMessageColor).toHaveBeenCalledWith('green');

    jest.advanceTimersByTime(MESSAGE_TIMEOUTS.DEFAULT + 10);
    expect(setMessage).toHaveBeenCalledWith('');
  });

  test('on failure sets failed message and color red', async () => {
    const setMessage = jest.fn();
    const setMessageColor = jest.fn();
    const actionFn = jest.fn().mockRejectedValue(new Error('boom'));

    const containers = [{ id: 'c1', name: 'one' }];

    await handleAction({
      containers,
      selected: 0,
      actionFn,
      actionLabel: 'Stop',
      setMessage,
      setMessageColor,
    });

    expect(actionFn).toHaveBeenCalledWith('c1');
    expect(setMessage).toHaveBeenCalledWith('Failed to stop container.');
    expect(setMessageColor).toHaveBeenCalledWith('red');
  });
});
