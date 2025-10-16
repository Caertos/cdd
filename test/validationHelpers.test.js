let validatePorts;

beforeAll(async () => {
  const mod = await import('../src/helpers/validationHelpers.js');
  validatePorts = mod.validatePorts;
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
