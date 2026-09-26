/**
 * @jest-environment jsdom
 */
import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { jest } from '@jest/globals';

const { useDockerConnection } = await import(
  '../src/hooks/useDockerConnection.js'
);

function HookTester({ expose, options }) {
  const hook = useDockerConnection(options);
  useEffect(() => {
    expose.current = hook;
  });
  return null;
}

describe('useDockerConnection — live retry countdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('nextRetryIn starts at full interval when entering error', () => {
    const expose = { current: null };
    render(
      <HookTester expose={expose} options={{ retryIntervalMs: 5000 }} />
    );

    expect(expose.current.status).toBe('connecting');
    expect(expose.current.nextRetryIn).toBe(0);

    act(() => {
      expose.current.reportResult(new Error('ENOENT'));
    });

    expect(expose.current.status).toBe('error');
    expect(expose.current.nextRetryIn).toBe(5);
  });

  test('nextRetryIn ticks down every second while in error', () => {
    const expose = { current: null };
    render(
      <HookTester expose={expose} options={{ retryIntervalMs: 5000 }} />
    );

    act(() => {
      expose.current.reportResult(new Error('ENOENT'));
    });
    expect(expose.current.nextRetryIn).toBe(5);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(expose.current.nextRetryIn).toBe(4);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(expose.current.nextRetryIn).toBe(3);
  });

  test('manual retry resets the countdown to the full interval', () => {
    const expose = { current: null };
    render(
      <HookTester expose={expose} options={{ retryIntervalMs: 5000 }} />
    );

    act(() => {
      expose.current.reportResult(new Error('ENOENT'));
    });
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(expose.current.nextRetryIn).toBe(3);

    act(() => {
      expose.current.retry();
    });

    expect(expose.current.retryToken).toBeGreaterThan(0);
    expect(expose.current.nextRetryIn).toBe(5);
  });

  test('nextRetryIn resets to 0 when connection recovers', () => {
    const expose = { current: null };
    render(
      <HookTester expose={expose} options={{ retryIntervalMs: 5000 }} />
    );

    act(() => {
      expose.current.reportResult(new Error('ENOENT'));
    });
    expect(expose.current.nextRetryIn).toBe(5);

    act(() => {
      expose.current.reportResult();
    });

    expect(expose.current.status).toBe('ok');
    expect(expose.current.nextRetryIn).toBe(0);
  });

  test('auto-retry fires after interval and restarts the countdown', () => {
    const expose = { current: null };
    render(
      <HookTester expose={expose} options={{ retryIntervalMs: 5000 }} />
    );

    act(() => {
      expose.current.reportResult(new Error('ENOENT'));
    });
    const tokenBefore = expose.current.retryToken;

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(expose.current.retryToken).toBeGreaterThan(tokenBefore);
    expect(expose.current.nextRetryIn).toBe(5);
  });
});

describe('useDockerConnection — status and stale', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('starts in "connecting" with no error', () => {
    const expose = { current: null };
    render(<HookTester expose={expose} />);
    expect(expose.current.status).toBe('connecting');
    expect(expose.current.error).toBeNull();
    expect(expose.current.isStale).toBe(false);
  });

  test('reportResult() without error → "ok" and stamps lastOkAt', () => {
    const expose = { current: null };
    render(<HookTester expose={expose} />);
    act(() => expose.current.reportResult());
    expect(expose.current.status).toBe('ok');
    expect(expose.current.lastOkAt).toBeGreaterThan(0);
  });

  test('reportResult(err) → "error" with classified error', () => {
    const expose = { current: null };
    render(<HookTester expose={expose} />);
    const err = Object.assign(new Error('connect ENOENT'), { code: 'ENOENT' });
    act(() => expose.current.reportResult(err));
    expect(expose.current.status).toBe('error');
    expect(expose.current.error.kind).toBe('not-running');
  });

  test('does not mark stale if there was never data', () => {
    const expose = { current: null };
    render(<HookTester expose={expose} />);
    act(() => expose.current.reportResult(new Error('x')));
    expect(expose.current.isStale).toBe(false);
  });

  test('marks stale after a prior successful connection', () => {
    const expose = { current: null };
    render(<HookTester expose={expose} />);
    act(() => expose.current.reportResult());
    act(() => expose.current.reportResult(new Error('x')));
    expect(expose.current.isStale).toBe(true);
  });

  test('recovery clears stale and error', () => {
    const expose = { current: null };
    render(<HookTester expose={expose} />);
    act(() => expose.current.reportResult());
    act(() => expose.current.reportResult(new Error('x')));
    act(() => expose.current.reportResult());
    expect(expose.current.isStale).toBe(false);
    expect(expose.current.error).toBeNull();
  });

  test('retry() increments retryToken', () => {
    const expose = { current: null };
    render(<HookTester expose={expose} />);
    const before = expose.current.retryToken;
    act(() => expose.current.retry());
    expect(expose.current.retryToken).toBe(before + 1);
  });
});
