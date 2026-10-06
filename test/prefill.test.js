/**
 * @jest-environment node
 */
import {
  containerToCreationValues,
  ownEnvOf,
  portInputOf,
  applyFix,
  withFreeName,
  FIELD_STEPS,
} from '../src/helpers/diagnostics/prefill.js';
import { DIAGNOSTIC_RULES } from '../src/helpers/diagnostics/rules.js';

const container = {
  id: 'c1',
  name: 'mi-basedatos',
  image: 'postgres:17-alpine',
  ports: ['5432:5432', '8080:8080'],
};

const config = {
  env: [
    'POSTGRES_USER=app',
    'POSTGRES_PASSWORD=hunter2',
    'POSTGRES_DB=app',
    'PATH=/usr/local/bin',
    'PG_VERSION=17',
  ],
  cmd: ['postgres'],
};

const imageEnv = ['PATH=/usr/local/bin', 'PG_VERSION=17'];

const addEnvFix = {
  kind: 'add-env',
  label: 'Recreate with POSTGRES_PASSWORD',
  patch: { env: { POSTGRES_PASSWORD: '' } },
  needsUserInput: true,
};

describe('ownEnvOf', () => {
  test('drops the variables the image ships', () => {
    expect(ownEnvOf(config.env, imageEnv)).toEqual([
      'POSTGRES_USER=app',
      'POSTGRES_PASSWORD=hunter2',
      'POSTGRES_DB=app',
    ]);
  });

  test('an image env we could not read keeps everything rather than nothing', () => {
    // null means "unknown", not "the image sets nothing". Dropping everything
    // would silently delete real configuration.
    expect(ownEnvOf(config.env, null)).toEqual(config.env);
  });

  test('a container with only image variables yields nothing', () => {
    expect(ownEnvOf(imageEnv, imageEnv)).toEqual([]);
  });

  test('missing inputs do not throw', () => {
    expect(ownEnvOf(null, null)).toEqual([]);
    expect(ownEnvOf(undefined, [])).toEqual([]);
  });

  test('it does not mutate the array it was given', () => {
    const input = [...config.env];
    ownEnvOf(input, imageEnv);
    expect(input).toEqual(config.env);
  });
});

describe('portInputOf', () => {
  test('maps published bindings to the wizard format', () => {
    expect(portInputOf(['5432:5432', '8080:8080'])).toBe('5432:5432,8080:8080');
  });

  test('a container with no ports yields an empty field', () => {
    expect(portInputOf([])).toBe('');
  });

  test('an exposed-but-unpublished port is not a mapping', () => {
    // A bare "80" is exposed, not published: there is no host side to map.
    expect(portInputOf(['80'])).toBe('');
  });

  test('a missing field does not throw', () => {
    expect(portInputOf(null)).toBe('');
  });
});

describe('containerToCreationValues', () => {
  test('rebuilds every wizard field', () => {
    const values = containerToCreationValues(container, config, imageEnv);
    expect(values).toEqual({
      imageName: 'postgres:17-alpine',
      containerName: 'mi-basedatos',
      portInput: '5432:5432,8080:8080',
      envInput: 'POSTGRES_USER=app,POSTGRES_PASSWORD=hunter2,POSTGRES_DB=app',
    });
  });

  test('the image variables never reach the form', () => {
    const values = containerToCreationValues(container, config, imageEnv);
    expect(values.envInput).not.toContain('PATH=');
    expect(values.envInput).not.toContain('PG_VERSION');
  });

  test('a container with no config still yields a usable form', () => {
    const values = containerToCreationValues(container, null, null);
    expect(values.imageName).toBe('postgres:17-alpine');
    expect(values.envInput).toBe('');
  });

  test('a missing container does not throw', () => {
    expect(() => containerToCreationValues(null, null, null)).not.toThrow();
    expect(containerToCreationValues(null, null, null).imageName).toBe('');
  });

  test('the command is not put in the form', () => {
    // The wizard has no command field; carrying it here would invent one.
    const values = containerToCreationValues(container, config, imageEnv);
    expect(Object.keys(values).sort()).toEqual([
      'containerName',
      'envInput',
      'imageName',
      'portInput',
    ]);
  });
});

describe('withFreeName', () => {
  test('an unused name is kept', () => {
    expect(withFreeName('web', ['db'])).toBe('web');
  });

  test('a taken name moves to name-2', () => {
    expect(withFreeName('web', ['web', 'db'])).toBe('web-2');
  });

  test('name-2 is skipped when it is taken too', () => {
    expect(withFreeName('web', ['web', 'web-2', 'web-3'])).toBe('web-4');
  });

  test('an empty name stays empty', () => {
    expect(withFreeName('', ['web'])).toBe('');
    expect(withFreeName(undefined, ['web'])).toBe('');
  });

  test('no list at all leaves the name alone', () => {
    expect(withFreeName('web')).toBe('web');
  });
});

describe('applyFix — adding an env variable', () => {
  const base = {
    imageName: 'postgres:17-alpine',
    containerName: 'mi-basedatos',
    portInput: '5432:5432',
    envInput: 'POSTGRES_USER=app',
  };

  test('adds the variable the diagnosis asked for', () => {
    const { values } = applyFix(base, addEnvFix);
    expect(values.envInput).toBe('POSTGRES_USER=app,POSTGRES_PASSWORD=');
  });

  test('reports which field changed', () => {
    expect(applyFix(base, addEnvFix).changedFields).toEqual(['envInput']);
  });

  test('a variable that is already there is not duplicated', () => {
    const { values, changedFields } = applyFix(
      { ...base, envInput: 'POSTGRES_USER=app,POSTGRES_PASSWORD=x' },
      addEnvFix
    );
    expect(values.envInput).toBe('POSTGRES_USER=app,POSTGRES_PASSWORD=x');
    expect(changedFields).not.toContain('envInput');
  });

  test('a fix with a value writes it', () => {
    const { values } = applyFix(base, {
      kind: 'add-env',
      patch: { env: { ACCEPT_EULA: 'Y' } },
      label: 'x',
      needsUserInput: false,
    });
    expect(values.envInput).toBe('POSTGRES_USER=app,ACCEPT_EULA=Y');
  });

  test('an empty env field gains the variable', () => {
    const { values } = applyFix({ ...base, envInput: '' }, addEnvFix);
    expect(values.envInput).toBe('POSTGRES_PASSWORD=');
  });

  test('nothing is added when the variable is already present', () => {
    const withSecret = { ...base, envInput: 'POSTGRES_PASSWORD=old' };
    const { values } = applyFix(withSecret, addEnvFix);
    expect(values.envInput).toBe('POSTGRES_PASSWORD=old');
  });
});

describe('applyFix — changing a busy port', () => {
  const base = {
    imageName: 'nginx:1.27-alpine',
    containerName: 'web',
    portInput: '8080:80',
    envInput: '',
  };
  const portFix = {
    kind: 'change-port',
    label: 'Recreate with another host port',
    patch: { ports: { 8080: null } },
    needsUserInput: false,
  };

  test('moves the binding to a free port', () => {
    const { values } = applyFix(base, portFix, {
      usedHostPorts: new Set(['8080']),
    });
    expect(values.portInput).toBe('8081:80');
  });

  test('reports which field changed', () => {
    const { changedFields } = applyFix(base, portFix, {
      usedHostPorts: new Set(['8080']),
    });
    expect(changedFields).toEqual(['portInput']);
  });

  test('skips consecutive taken ports', () => {
    const { values } = applyFix(base, portFix, {
      usedHostPorts: new Set(['8080', '8081', '8082']),
    });
    expect(values.portInput).toBe('8083:80');
  });

  test('only the busy pair is touched', () => {
    const { values } = applyFix(
      { ...base, portInput: '8080:80,9090:90' },
      portFix,
      { usedHostPorts: new Set(['8080']) }
    );
    expect(values.portInput).toBe('8081:80,9090:90');
  });

  test('a port that is not in the form is left alone', () => {
    const { values, changedFields } = applyFix(
      { ...base, portInput: '3000:3000' },
      portFix,
      { usedHostPorts: new Set(['8080']) }
    );
    expect(values.portInput).toBe('3000:3000');
    expect(changedFields).not.toContain('portInput');
  });

  test('no free port leaves the field untouched', () => {
    const used = new Set(['8080']);
    for (let p = 8081; p <= 65535; p += 1) used.add(String(p));
    const { values, changedFields } = applyFix(base, portFix, {
      usedHostPorts: used,
    });
    expect(values.portInput).toBe('8080:80');
    expect(changedFields).not.toContain('portInput');
  });
});

describe('applyFix — the name a failed container still owns', () => {
  const base = {
    imageName: 'postgres:17-alpine',
    containerName: 'mi-basedatos',
    portInput: '5432:5432',
    envInput: '',
  };

  test('proposes name-2 when the old container still exists', () => {
    const { values, changedFields } = applyFix(base, addEnvFix, {
      takenNames: ['mi-basedatos', 'otra'],
    });
    expect(values.containerName).toBe('mi-basedatos-2');
    expect(changedFields).toContain('containerName');
  });

  test('keeps the name when nothing is taken', () => {
    const { values, changedFields } = applyFix(base, addEnvFix, {
      takenNames: ['otra'],
    });
    expect(values.containerName).toBe('mi-basedatos');
    expect(changedFields).not.toContain('containerName');
  });

  test('reports the name even with no fix at all', () => {
    // A recreation always needs this, fix or no fix.
    const { changedFields } = applyFix(base, null, {
      takenNames: ['mi-basedatos'],
    });
    expect(changedFields).toEqual(['containerName']);
  });

  test('no fix still returns the values untouched otherwise', () => {
    const { values } = applyFix(base, null, {});
    expect(values).toEqual(base);
  });
});

describe('applyFix — shapes it must survive', () => {
  const base = {
    imageName: 'x',
    containerName: 'y',
    portInput: '',
    envInput: '',
  };

  test('no values and no fix do not throw', () => {
    expect(() => applyFix(null, null, {})).not.toThrow();
    expect(applyFix(null, null, {}).values.imageName).toBeUndefined();
  });

  test('a fix with no patch changes nothing', () => {
    const { values, changedFields } = applyFix(base, {
      kind: 'add-env',
      label: 'x',
      needsUserInput: false,
    });
    expect(values.envInput).toBe('');
    expect(changedFields).toEqual([]);
  });

  test('a fix of an unknown kind is ignored rather than guessed at', () => {
    const { values } = applyFix(base, {
      kind: 'delete-everything',
      patch: { env: { A: '1' } },
      label: 'x',
    });
    expect(values.envInput).toBe('');
  });

  test('it does not mutate the values it was given', () => {
    const original = { ...base, envInput: 'A=1' };
    applyFix(original, addEnvFix, { takenNames: [] });
    expect(original.envInput).toBe('A=1');
  });

  test('changedFields has no duplicates', () => {
    const { changedFields } = applyFix(
      base,
      {
        kind: 'add-env',
        patch: { env: { A: '', B: '' } },
        label: 'x',
        needsUserInput: true,
      },
      { takenNames: ['y'] }
    );
    expect(changedFields).toEqual(['envInput', 'containerName']);
  });
});

describe('FIELD_STEPS', () => {
  test('every wizard field points at its step', () => {
    expect(FIELD_STEPS).toEqual({
      imageName: 0,
      containerName: 1,
      portInput: 2,
      envInput: 3,
    });
  });
});

describe('applyFix — a fix that needs the user to type something', () => {
  const base = {
    imageName: 'postgres:17-alpine',
    containerName: 'db-2',
    portInput: '',
    envInput: 'POSTGRES_USER=app',
  };

  test('the variable is written with a value, never as a bare key', () => {
    // "POSTGRES_PASSWORD" with no '=' made validateEnvVars report a syntax
    // error for something the diagnosis itself had written.
    const { values } = applyFix(base, addEnvFix);
    expect(values.envInput).toContain('POSTGRES_PASSWORD=');
    for (const entry of values.envInput.split(',')) {
      expect(entry).toContain('=');
    }
  });

  test('it says it needs input when the fix is marked that way', () => {
    const context = {
      container: { id: 'p', name: 'db', image: 'postgres:17-alpine' },
      logLines: ['superuser password is not specified'],
    };
    const rule = DIAGNOSTIC_RULES.find((r) => r.id === 'postgres-missing-password');
    const fix = rule.fix(context);
    expect(fix.needsUserInput).toBe(true);
    // The label must not promise a working container it cannot build.
    expect(fix.label).toMatch(/set|fill|enter/i);
  });

  test('a fix with a value needs no input and says so', () => {
    const context = {
      container: { id: 'm', name: 'sql', image: 'mssql:2022-latest' },
      logLines: ['ACCEPT_EULA is not set'],
    };
    const rule = DIAGNOSTIC_RULES.find((r) => r.id === 'mssql-missing-eula');
    const fix = rule.fix(context);
    expect(fix.needsUserInput).toBe(false);
    expect(fix.label).not.toMatch(/set|fill|enter/i);
  });
});
