let validatePorts;
let validateEnvVars;
let isValidContainerId;
let validateContainerName;
let validateImageName;
let IMAGE_PROFILES;
let STRINGS;

beforeAll(async () => {
  const mod = await import('../src/helpers/validationHelpers.js');
  validatePorts = mod.validatePorts;
  validateEnvVars = mod.validateEnvVars;
  isValidContainerId = mod.isValidContainerId;
  validateContainerName = mod.validateContainerName;
  validateImageName = mod.validateImageName;
  const constants = await import('../src/helpers/constants.js');
  IMAGE_PROFILES = constants.IMAGE_PROFILES;
  const strings = await import('../src/helpers/strings.js');
  STRINGS = strings.STRINGS;
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

describe('isValidContainerId', () => {
  test.each([
    ['a'.repeat(64), true],          // full sha256
    ['abc123def456', true],          // short id of 12
    ['mi-contenedor_1.0', true],     // valid name
    ['org/app', true],               // with slash
    ['', false],
    [null, false],
    [undefined, false],
    [123, false],                    // not a string
    ['-empieza-con-guion', false],
    ['con espacio', false],
    ['drop;table', false],
  ])('%p → %p', (input, expected) => {
    expect(isValidContainerId(input)).toBe(expected);
  });
});

describe('validateContainerName', () => {
  test.each([['web'], ['web-1'], ['web_1.2'], [''], ['   ']])(
    '%p is valid',
    (name) => expect(validateContainerName(name).valid).toBe(true)
  );

  test('more than 128 chars → length error', () => {
    const r = validateContainerName('a'.repeat(129));
    expect(r.valid).toBe(false);
    expect(r.error).toBe(STRINGS.validation.containerNameTooLong);
  });

  test.each([['con espacio'], ['a@b'], ['-empieza-con-guion']])(
    '%p → invalid characters',
    (name) => {
      const r = validateContainerName(name);
      expect(r.valid).toBe(false);
      expect(r.error).toBe(STRINGS.validation.containerNameInvalid);
    }
  );
});

describe('validateImageName', () => {
  test.each([['nginx'], ['nginx:1.27-alpine'], ['docker.io/library/nginx:latest']])(
    '%p is valid',
    (n) => expect(validateImageName(n).valid).toBe(true)
  );

  test.each([[''], ['   '], [null]])('%p → "required"', (n) => {
    expect(validateImageName(n).error).toBe(STRINGS.validation.imageRequired);
  });

  test.each([['nginx;rm -rf /'], ['ng|inx'], ['$(whoami)'], ['a`b`']])(
    '%p → invalid characters',
    (n) => expect(validateImageName(n).error).toBe(STRINGS.validation.imageInvalidChars)
  );

  test('starts with -- → specific error', () => {
    expect(validateImageName('--rm').error).toBe(STRINGS.validation.imageDashDash);
  });

  test('impossible format → "Invalid format"', () => {
    expect(validateImageName('nginx::').error).toBe(
      STRINGS.validation.imageInvalidFormat
    );
  });
});

describe('validatePorts — range', () => {
  test.each([['0:80'], ['80:0'], ['65536:80'], ['80:65536'], ['-1:80'], ['abc:80']])(
    '%p is invalid',
    (p) => expect(validatePorts(p)).toBe(false)
  );

  test.each([['1:1'], ['65535:65535'], ['8080:80,443:443'], ['8080:80,,443:443']])(
    '%p is valid',
    (p) => expect(validatePorts(p)).toBe(true)
  );

  // see §5.7 for the two cases that pass today and should not
});

describe('validateEnvVars extras', () => {
  test('empty value "KEY=" is syntactically valid', () => {
    expect(validateEnvVars('KEY=')).toBe(true);
  });

  test('value keeps all "=" except the first', () => {
    const r = validateEnvVars('K=a=b=c', 'nginx', IMAGE_PROFILES);
    expect(r.parsedEnv.K).toBe('a=b=c');
  });

  test('missing "=" → syntax error', () => {
    expect(validateEnvVars('SOLOCLAVE')).toBe(false);
  });

  test('invalid name → syntax error', () => {
    expect(validateEnvVars('1BAD=x')).toBe(false);
  });

  test('contextual: missing requiredEnv → descriptive error', () => {
    const r = validateEnvVars('', 'postgres:17-alpine', IMAGE_PROFILES);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('Missing required env var: POSTGRES_PASSWORD');
  });

  test('contextual: requiredEnv present but empty → still fails', () => {
    const r = validateEnvVars('POSTGRES_PASSWORD=   ', 'postgres', IMAGE_PROFILES);
    expect(r.valid).toBe(false);
  });

  test('legacy (1 arg) returns boolean, not object', () => {
    expect(typeof validateEnvVars('A=1')).toBe('boolean');
  });
});
