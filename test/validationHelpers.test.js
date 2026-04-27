let validatePorts;
let validateEnvVars;
let IMAGE_PROFILES;

beforeAll(async () => {
  const mod = await import('../src/helpers/validationHelpers.js');
  validatePorts = mod.validatePorts;
  validateEnvVars = mod.validateEnvVars;
  const constants = await import('../src/helpers/constants.js');
  IMAGE_PROFILES = constants.IMAGE_PROFILES;
});

describe('validatePorts', () => {
  test('valid single port mapping', () => {
    expect(validatePorts('8080:80')).toBe(true);
  });

  test('valid multiple port mappings', () => {
    expect(validatePorts('8080:80,443:443')).toBe(true);
  });

  test('invalid mapping missing host', () => {
    expect(validatePorts(':80')).toBe(false);
  });

  test('invalid mapping non-numeric', () => {
    expect(validatePorts('eighty:80')).toBe(false);
  });

  test('empty input is valid (ports are optional)', () => {
    expect(validatePorts('')).toBe(true);
  });
});

describe('validateEnvVars', () => {
  test('empty input is valid', () => {
    expect(validateEnvVars('')).toBe(true);
  });

  test('valid single env var', () => {
    expect(validateEnvVars('NODE_ENV=production')).toBe(true);
  });

  test('valid multiple env vars', () => {
    expect(validateEnvVars('NODE_ENV=production,PORT=3000')).toBe(true);
  });

  test('valid env var with underscores', () => {
    expect(validateEnvVars('MY_VAR_NAME=value')).toBe(true);
  });

  test('invalid env var without equals sign', () => {
    expect(validateEnvVars('NOEQUALS')).toBe(false);
  });

  test('invalid env var with invalid name', () => {
    expect(validateEnvVars('123INVALID=value')).toBe(false);
  });

  test('invalid env var with special characters in name', () => {
    expect(validateEnvVars('MY-VAR=value')).toBe(false);
  });
});

describe('validateEnvVars — contextual validation with IMAGE_PROFILES', () => {
  test('mysql:8 — missing MYSQL_ROOT_PASSWORD is invalid', () => {
    const result = validateEnvVars('FOO=bar', 'mysql:8', IMAGE_PROFILES);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('MYSQL_ROOT_PASSWORD'))).toBe(true);
  });

  test('mysql:8 — with MYSQL_ROOT_PASSWORD is valid', () => {
    const result = validateEnvVars('MYSQL_ROOT_PASSWORD=secret', 'mysql:8', IMAGE_PROFILES);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('docker.io/library/postgres:16 — missing POSTGRES_PASSWORD is invalid', () => {
    const result = validateEnvVars('', 'docker.io/library/postgres:16', IMAGE_PROFILES);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('POSTGRES_PASSWORD'))).toBe(true);
  });

  test('docker.io/library/postgres:16 — with POSTGRES_PASSWORD is valid', () => {
    const result = validateEnvVars('POSTGRES_PASSWORD=pass', 'docker.io/library/postgres:16', IMAGE_PROFILES);
    expect(result.valid).toBe(true);
  });

  test('TOKEN=a=b is preserved (split on first = only)', () => {
    const result = validateEnvVars('TOKEN=a=b', 'nginx', IMAGE_PROFILES);
    expect(result.valid).toBe(true);
    expect(result.parsedEnv['TOKEN']).toBe('a=b');
  });

  test('image not in profiles — only syntactic validation applies', () => {
    const result = validateEnvVars('FOO=bar', 'nginx', IMAGE_PROFILES);
    expect(result.valid).toBe(true);
    expect(result.parsedEnv['FOO']).toBe('bar');
  });

  test('empty input for image not in profiles — valid', () => {
    const result = validateEnvVars('', 'nginx', IMAGE_PROFILES);
    expect(result.valid).toBe(true);
    expect(result.parsedEnv).toEqual({});
  });

  test('syntactically invalid var is still rejected', () => {
    const result = validateEnvVars('INVALID-VAR=x', 'nginx', IMAGE_PROFILES);
    expect(result.valid).toBe(false);
  });
});
