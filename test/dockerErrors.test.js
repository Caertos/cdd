import { classifyDockerError } from '../src/helpers/dockerErrors.js';

function makeErr(fields) {
  const e = new Error(fields.message ?? '');
  if (fields.code) e.code = fields.code;
  if (fields.statusCode) e.statusCode = fields.statusCode;
  return e;
}

describe('classifyDockerError', () => {
  // ── not-running ──
  test('ENOENT → not-running', () => {
    const err = makeErr({ code: 'ENOENT', message: 'connect ENOENT /var/run/docker.sock' });
    const info = classifyDockerError(err, 'linux');
    expect(info.kind).toBe('not-running');
    expect(info.title).toBeTruthy();
    expect(info.detail).toBeTruthy();
    expect(info.hints).toBeInstanceOf(Array);
    expect(info.hints.length).toBeGreaterThan(0);
    expect(info.technical).toContain('ENOENT');
  });

  test('ECONNREFUSED → not-running', () => {
    const err = makeErr({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' });
    const info = classifyDockerError(err, 'darwin');
    expect(info.kind).toBe('not-running');
  });

  // ── permission ──
  test('EACCES → permission', () => {
    const err = makeErr({ code: 'EACCES', message: 'EACCES: permission denied' });
    const info = classifyDockerError(err, 'linux');
    expect(info.kind).toBe('permission');
    expect(info.hints.some((h) => h.includes('docker'))).toBe(true);
  });

  test('EPERM → permission', () => {
    const err = makeErr({ code: 'EPERM', message: 'operation not permitted' });
    const info = classifyDockerError(err, 'win32');
    expect(info.kind).toBe('permission');
  });

  test('statusCode 403 → permission', () => {
    const err = makeErr({ statusCode: 403, message: 'Forbidden' });
    const info = classifyDockerError(err, 'linux');
    expect(info.kind).toBe('permission');
  });

  // ── timeout ──
  test('ETIMEDOUT → timeout', () => {
    const err = makeErr({ code: 'ETIMEDOUT', message: 'connect ETIMEDOUT' });
    const info = classifyDockerError(err, 'linux');
    expect(info.kind).toBe('timeout');
  });

  test('message containing "Operation timed out" → timeout', () => {
    const err = makeErr({ message: 'Operation timed out after 30s' });
    const info = classifyDockerError(err, 'darwin');
    expect(info.kind).toBe('timeout');
  });

  // ── unknown ──
  test('unrecognized error → unknown', () => {
    const err = makeErr({ code: 'EPIPE', message: 'broken pipe' });
    const info = classifyDockerError(err, 'linux');
    expect(info.kind).toBe('unknown');
  });

  test('error without code → unknown', () => {
    const err = makeErr({ message: 'something weird happened' });
    const info = classifyDockerError(err, 'linux');
    expect(info.kind).toBe('unknown');
  });

  // ── platform adaptation ──
  test('hints differ by platform', () => {
    const err = makeErr({ code: 'ENOENT', message: 'no socket' });
    const linux = classifyDockerError(err, 'linux');
    const darwin = classifyDockerError(err, 'darwin');
    const win32 = classifyDockerError(err, 'win32');
    // At least darwin and win32 should differ from linux
    expect(darwin.hints).not.toEqual(linux.hints);
    expect(win32.hints).not.toEqual(linux.hints);
  });

  // ── technical preserves original ──
  test('technical preserves the original error message', () => {
    const original = 'connect ENOENT /var/run/docker.sock';
    const err = makeErr({ code: 'ENOENT', message: original });
    const info = classifyDockerError(err, 'linux');
    expect(info.technical).toContain(original);
  });
});
