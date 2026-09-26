/**
 * @jest-environment node
 */
import { normalizeImageName } from '../src/helpers/imageNameUtils.js';

describe('normalizeImageName', () => {
  test.each([
    ['docker.io/library/postgres:16-alpine', 'postgres'],
    ['myregistry.io/myorg/myapp:latest', 'myapp'],
    ['nginx:alpine', 'nginx'],
    ['redis:7', 'redis'],
    ['nginx', 'nginx'],
    ['docker.io/library/nginx', 'nginx'],
    ['myorg/myapp', 'myapp'],
    // Registry with port has ':' BEFORE the last '/': lastIndexOf('/') wins first.
    ['registry:5000/name:tag', 'name'],
    ['Nginx:Alpine', 'nginx'],
    ['ghcr.io/org/Sub-App:v1.2.3', 'sub-app'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeImageName(input)).toBe(expected);
  });

  test.each([['', ''], [null, ''], [undefined, ''], [0, '']])(
    'falsy value %p → empty string',
    (input) => {
      expect(normalizeImageName(input)).toBe('');
    }
  );

  test('only tag ":latest" → empty string', () => {
    expect(normalizeImageName(':latest')).toBe('');
  });

  test('multiple ":" → cuts at the first', () => {
    expect(normalizeImageName('app:1:2')).toBe('app');
  });
});
