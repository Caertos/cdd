let validatePorts;
let validateEnvVars;

beforeAll(async () => {
  const mod = await import('../src/helpers/validationHelpers.js');
  validatePorts = mod.validatePorts;
  validateEnvVars = mod.validateEnvVars;
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

  test('empty input returns false (must specify at least one port)', () => {
    expect(validatePorts('')).toBe(false);
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
