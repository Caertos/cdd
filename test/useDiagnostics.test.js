/**
 * @jest-environment jsdom
 */
import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import { evaluateHealth } from '../src/helpers/health.js';

const mockGetLogsTail = jest.fn();
await jest.unstable_mockModule(
  '../src/helpers/dockerService/serviceComponents/containerLogs.js',
  () => ({ getLogsTail: mockGetLogsTail })
);

const { useDiagnostics, diagnosticCacheKey } =
  await import('../src/hooks/useDiagnostics.js');

function HookTester({ container, verdict, details, expose }) {
  const hook = useDiagnostics(container, verdict, details);
  useEffect(() => {
    expose.current = hook;
  });
  return null;
}

/** A row as getContainers() returns it, plus inspect facts for the verdict. */
function row(overrides = {}) {
  return {
    id: 'c1',
    name: 'mi-basedatos',
    image: 'postgres:17-alpine',
    state: 'exited',
    status: 'Exited (1) 2 seconds ago',
    ports: ['5432:5432'],
    ...overrides,
  };
}

function verdictFor(container, details) {
  return evaluateHealth(container, details, Date.parse('2026-10-05T12:00:00Z'));
}

const crashed = (exitCode = 1, uptimeMs = 2000) => ({
  state: 'exited',
  exitCode,
  startedAt: new Date(Date.now() - uptimeMs).toISOString(),
  finishedAt: new Date().toISOString(),
  restartCount: 0,
  oomKilled: false,
  healthStatus: null,
});

const LOG = ['Error: superuser password is not specified'];

describe('diagnosticCacheKey', () => {
  const verdict = (code, facts = {}) => ({
    code,
    facts: { exitCode: null, restartCount: 0, ...facts },
  });

  test('identifies a failure by verdict, not by the Docker status string', () => {
    const key = diagnosticCacheKey(
      { id: 'a', status: 'Exited (1) 2 seconds ago' },
      verdict('crash-loop', { exitCode: 1 })
    );
    expect(key).toBe('a:crash-loop:1:0');
  });

  test('the ticking status string does not change the key', () => {
    // Docker renders status as "Exited (1) N seconds ago". Keying on it made
    // the panel re-read the log every second and flicker forever.
    const first = diagnosticCacheKey(
      { id: 'a', status: 'Exited (1) 2 seconds ago' },
      verdict('crash-loop', { exitCode: 1 })
    );
    const later = diagnosticCacheKey(
      { id: 'a', status: 'Exited (1) 47 seconds ago' },
      verdict('crash-loop', { exitCode: 1 })
    );
    expect(later).toBe(first);
  });

  test('a different verdict is a different key', () => {
    const a = diagnosticCacheKey(
      { id: 'a' },
      verdict('crash-loop', { exitCode: 1 })
    );
    const b = diagnosticCacheKey({ id: 'a' }, verdict('unhealthy'));
    expect(a).not.toBe(b);
  });

  test('a restart bumps the key so the log is read again', () => {
    const a = diagnosticCacheKey(
      { id: 'a' },
      verdict('crash-loop', { restartCount: 0 })
    );
    const b = diagnosticCacheKey(
      { id: 'a' },
      verdict('crash-loop', { restartCount: 1 })
    );
    expect(b).not.toBe(a);
  });

  test('a missing container still yields a key rather than throwing', () => {
    expect(() => diagnosticCacheKey(null, null)).not.toThrow();
  });
});

describe('useDiagnostics — when it stays quiet', () => {
  beforeEach(() => {
    mockGetLogsTail.mockReset().mockResolvedValue([]);
  });

  test('a running container is not diagnosed and its log is not read', async () => {
    const container = row({ state: 'running', status: 'Up 5 minutes' });
    const expose = { current: null };
    render(
      <HookTester
        container={container}
        verdict={verdictFor(container, null)}
        expose={expose}
      />
    );
    await act(async () => {});

    expect(expose.current.diagnosis).toBeNull();
    expect(mockGetLogsTail).not.toHaveBeenCalled();
  });

  test('a deliberately stopped container is not diagnosed', async () => {
    const container = row();
    const details = crashed(0, 600_000);
    const expose = { current: null };
    render(
      <HookTester
        container={container}
        verdict={verdictFor(container, details)}
        expose={expose}
      />
    );
    await act(async () => {});

    expect(expose.current.diagnosis).toBeNull();
    expect(mockGetLogsTail).not.toHaveBeenCalled();
  });

  test('no selection at all reads nothing', async () => {
    const expose = { current: null };
    render(<HookTester container={null} verdict={null} expose={expose} />);
    await act(async () => {});

    expect(expose.current.diagnosis).toBeNull();
    expect(mockGetLogsTail).not.toHaveBeenCalled();
  });
});

describe('useDiagnostics — when it explains', () => {
  beforeEach(() => {
    mockGetLogsTail.mockReset().mockResolvedValue(LOG);
  });

  test('reads the log and explains the failure', async () => {
    const container = row();
    const expose = { current: null };
    render(
      <HookTester
        container={container}
        verdict={verdictFor(container, crashed())}
        expose={expose}
      />
    );
    await act(async () => {});

    expect(mockGetLogsTail).toHaveBeenCalledWith('c1', 50);
    expect(expose.current.diagnosis.ruleId).toBe('postgres-missing-password');
    expect(expose.current.diagnosis.why).toContain('POSTGRES_PASSWORD');
    expect(expose.current.isLoading).toBe(false);
  });

  test('reports loading until the log arrives', async () => {
    let release;
    mockGetLogsTail.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(LOG);
      })
    );
    const container = row();
    const expose = { current: null };
    render(
      <HookTester
        container={container}
        verdict={verdictFor(container, crashed())}
        expose={expose}
      />
    );
    await act(async () => {});

    expect(expose.current.isLoading).toBe(true);
    expect(expose.current.diagnosis).toBeNull();

    await act(async () => {
      release();
    });
    expect(expose.current.isLoading).toBe(false);
    expect(expose.current.diagnosis).not.toBeNull();
  });

  test('an unrecognised failure still explains what happened', async () => {
    mockGetLogsTail.mockResolvedValue(['segfault at 0x0']);
    const container = row();
    const expose = { current: null };
    render(
      <HookTester
        container={container}
        verdict={verdictFor(container, crashed())}
        expose={expose}
      />
    );
    await act(async () => {});

    expect(expose.current.diagnosis.why).toBeNull();
    expect(expose.current.diagnosis.what).toBeTruthy();
    expect(expose.current.diagnosis.tail).toEqual(['segfault at 0x0']);
  });

  test('uses the image profile when there is one', async () => {
    const container = row();
    const expose = { current: null };
    render(
      <HookTester
        container={container}
        verdict={verdictFor(container, crashed())}
        expose={expose}
      />
    );
    await act(async () => {});
    // The log named the variable, so the fix knows what to add.
    expect(expose.current.diagnosis.fix.patch.env).toHaveProperty(
      'POSTGRES_PASSWORD'
    );
  });

  test('an unknown image simply has no profile', async () => {
    mockGetLogsTail.mockResolvedValue(['permission denied']);
    const container = row({ image: 'acme/internal:1', id: 'c9' });
    const expose = { current: null };
    render(
      <HookTester
        container={container}
        verdict={verdictFor(container, crashed())}
        expose={expose}
      />
    );
    await act(async () => {});

    expect(expose.current.diagnosis.ruleId).toBe('volume-permission-denied');
  });
});

describe('useDiagnostics — caching', () => {
  beforeEach(() => {
    mockGetLogsTail.mockReset().mockResolvedValue(LOG);
  });

  test('moving away and back does not re-read the log', async () => {
    const broken = row({ id: 'bad' });
    const brokenVerdict = verdictFor(broken, crashed());
    const healthy = row({ id: 'ok', state: 'running', status: 'Up 1 hour' });
    const healthyVerdict = verdictFor(healthy, null);
    const expose = { current: null };

    const { rerender } = render(
      <HookTester container={broken} verdict={brokenVerdict} expose={expose} />
    );
    await act(async () => {});
    expect(mockGetLogsTail).toHaveBeenCalledTimes(1);

    // Arrowing down to a healthy container.
    rerender(
      <HookTester
        container={healthy}
        verdict={healthyVerdict}
        expose={expose}
      />
    );
    await act(async () => {});
    expect(expose.current.diagnosis).toBeNull();

    // And back up: the answer is already known.
    rerender(
      <HookTester container={broken} verdict={brokenVerdict} expose={expose} />
    );
    await act(async () => {});
    expect(expose.current.diagnosis.ruleId).toBe('postgres-missing-password');
    expect(mockGetLogsTail).toHaveBeenCalledTimes(1);
  });

  test('a re-render with a ticking status does not re-read the log', async () => {
    const container = row();
    const verdict = verdictFor(container, crashed());
    const expose = { current: null };
    const { rerender } = render(
      <HookTester container={container} verdict={verdict} expose={expose} />
    );
    await act(async () => {});
    expect(mockGetLogsTail).toHaveBeenCalledTimes(1);

    // The list refreshes every 3 s and Docker's status string has ticked on.
    rerender(
      <HookTester
        container={{ ...container, status: 'Exited (1) 1 minute ago' }}
        verdict={verdict}
        expose={expose}
      />
    );
    await act(async () => {});
    expect(mockGetLogsTail).toHaveBeenCalledTimes(1);
  });

  test('a crash-restart-crash cycle is read again', async () => {
    const container = row();
    const first = verdictFor(container, crashed());
    const expose = { current: null };
    const { rerender } = render(
      <HookTester container={container} verdict={first} expose={expose} />
    );
    await act(async () => {});
    expect(mockGetLogsTail).toHaveBeenCalledTimes(1);

    // Docker restarted it: the verdict now counts one more restart.
    rerender(
      <HookTester
        container={container}
        verdict={{
          ...first,
          facts: { ...first.facts, restartCount: 1 },
        }}
        expose={expose}
      />
    );
    await act(async () => {});
    expect(mockGetLogsTail).toHaveBeenCalledTimes(2);
  });

  test('refresh drops the cache so the next read happens', async () => {
    const container = row();
    const expose = { current: null };
    const { rerender } = render(
      <HookTester
        container={container}
        verdict={verdictFor(container, crashed())}
        expose={expose}
      />
    );
    await act(async () => {});
    expect(expose.current.diagnosis).not.toBeNull();

    await act(async () => {
      expose.current.refresh();
    });
    rerender(
      <HookTester
        container={container}
        verdict={verdictFor(container, crashed())}
        expose={expose}
      />
    );
    await act(async () => {});
    expect(mockGetLogsTail).toHaveBeenCalledTimes(2);
  });

  test('the verdict arriving late does not trigger a second read', async () => {
    // The health map fills in after the list renders, so the panel must not
    // treat "no verdict yet" as a reason to read the log.
    const container = row();
    const expose = { current: null };
    const { rerender } = render(
      <HookTester container={container} verdict={null} expose={expose} />
    );
    await act(async () => {});
    expect(mockGetLogsTail).not.toHaveBeenCalled();

    rerender(
      <HookTester
        container={container}
        verdict={verdictFor(container, crashed())}
        expose={expose}
      />
    );
    await act(async () => {});
    expect(mockGetLogsTail).toHaveBeenCalledTimes(1);
  });
});

describe('useDiagnostics — when the read fails', () => {
  test('a rejected read still explains what happened, and admits no cause', async () => {
    // Not "no panel": the verdict alone can say the container died, and saying
    // that is more useful than a silent screen. What it cannot do is guess a
    // cause, so `why` stays null and the tail stays empty.
    mockGetLogsTail.mockReset().mockRejectedValue(new Error('boom'));
    const container = row();
    const expose = { current: null };
    render(
      <HookTester
        container={container}
        verdict={verdictFor(container, crashed())}
        expose={expose}
      />
    );
    await act(async () => {});

    expect(expose.current.diagnosis).not.toBeNull();
    expect(expose.current.diagnosis.what).toBeTruthy();
    expect(expose.current.diagnosis.why).toBeNull();
    expect(expose.current.diagnosis.tail).toEqual([]);
    expect(expose.current.diagnosis.ruleId).toBeNull();
    expect(expose.current.isLoading).toBe(false);
  });

  test('a container with an empty log still gets a what', async () => {
    mockGetLogsTail.mockReset().mockResolvedValue([]);
    const container = row();
    const expose = { current: null };
    render(
      <HookTester
        container={container}
        verdict={verdictFor(container, crashed())}
        expose={expose}
      />
    );
    await act(async () => {});

    expect(expose.current.diagnosis.why).toBeNull();
    expect(expose.current.diagnosis.tail).toEqual([]);
    // A container that dies inside CRASH_LOOP_MAX_UPTIME is a crash-loop, but
    // with no restarts the sentence must not claim Docker restarted it.
    expect(expose.current.diagnosis.what).toMatch(/^It died/);
    expect(expose.current.diagnosis.what).not.toMatch(/restart/i);
  });
});

describe('useDiagnostics — inspect data arriving late', () => {
  beforeEach(() => {
    mockGetLogsTail.mockReset().mockResolvedValue(['something unrecognised']);
  });

  const row = {
    id: 'c7',
    name: 'app-db',
    image: 'postgres:17-alpine',
    state: 'exited',
    status: 'Exited (1) 2 seconds ago',
    ports: ['5432:5432'],
  };
  const verdict = verdictFor(row, crashed(1, 60_000));

  test('the profile rule fires once inspect hands over the env', async () => {
    // A log that names nothing: only Config.Env can identify this one. The
    // rule used to read container.env, which getContainers() never provides,
    // so it matched only inside the tests.
    const expose = { current: null };
    const { rerender } = render(
      <HookTester container={row} verdict={verdict} expose={expose} />
    );
    await act(async () => {});
    expect(expose.current.diagnosis.why).toBeNull();

    rerender(
      <HookTester
        container={row}
        verdict={verdict}
        details={{ env: ['POSTGRES_DB=app'] }}
        expose={expose}
      />
    );
    await act(async () => {});

    expect(expose.current.diagnosis.ruleId).toBe('missing-required-env');
    expect(expose.current.diagnosis.why).toContain('POSTGRES_PASSWORD');
  });

  test('and the log is read exactly once across both passes', async () => {
    const expose = { current: null };
    const { rerender } = render(
      <HookTester container={row} verdict={verdict} expose={expose} />
    );
    await act(async () => {});
    expect(mockGetLogsTail).toHaveBeenCalledTimes(1);

    rerender(
      <HookTester
        container={row}
        verdict={verdict}
        details={{ env: ['POSTGRES_DB=app'] }}
        expose={expose}
      />
    );
    await act(async () => {});

    // Rebuilding the diagnosis must not re-read what we already have.
    expect(mockGetLogsTail).toHaveBeenCalledTimes(1);
  });

  test('inspect landing mid-read does not make the log be read twice', async () => {
    // The first effect is cancelled by the second one, and its result used to
    // be thrown away with it.
    let release;
    mockGetLogsTail.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve(['something unrecognised']);
      })
    );
    const expose = { current: null };
    const { rerender } = render(
      <HookTester container={row} verdict={verdict} expose={expose} />
    );
    await act(async () => {});

    // Inspect arrives before the log does.
    rerender(
      <HookTester
        container={row}
        verdict={verdict}
        details={{ env: ['POSTGRES_DB=app'] }}
        expose={expose}
      />
    );
    await act(async () => {
      release();
    });

    expect(mockGetLogsTail).toHaveBeenCalledTimes(1);
    expect(expose.current.diagnosis.ruleId).toBe('missing-required-env');
  });

  test('the fix still carries the variable that is missing', async () => {
    const expose = { current: null };
    const { rerender } = render(
      <HookTester container={row} verdict={verdict} expose={expose} />
    );
    await act(async () => {});
    rerender(
      <HookTester
        container={row}
        verdict={verdict}
        details={{ env: [] }}
        expose={expose}
      />
    );
    await act(async () => {});
    expect(expose.current.diagnosis.fix.patch.env).toHaveProperty(
      'POSTGRES_PASSWORD'
    );
  });

  test('a container stopped on purpose still gets no panel', async () => {
    const container = { ...row, status: 'Exited (0) 1 hour ago' };
    const expose = { current: null };
    render(
      <HookTester
        container={container}
        verdict={verdictFor(container, crashed(0, 60_000))}
        details={{ env: [] }}
        expose={expose}
      />
    );
    await act(async () => {});
    expect(expose.current.diagnosis).toBeNull();
  });
});
