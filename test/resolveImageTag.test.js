/**
 * @jest-environment node
 */
import { resolveImageTag, IMAGE_PROFILES } from '../src/helpers/constants.js';

describe('resolveImageTag', () => {
  test('appends defaultTag when image has no tag', () => {
    expect(resolveImageTag('postgres', IMAGE_PROFILES)).toBe('postgres:17-alpine');
  });

  test('preserves explicit tag when image already has one', () => {
    expect(resolveImageTag('postgres:15', IMAGE_PROFILES)).toBe('postgres:15');
  });

  test('returns image name unchanged when no matching profile', () => {
    expect(resolveImageTag('unknownimage', IMAGE_PROFILES)).toBe('unknownimage');
  });

  test('appends defaultTag for nginx', () => {
    expect(resolveImageTag('nginx', IMAGE_PROFILES)).toBe('nginx:1.27-alpine');
  });

  test('passes through empty string unchanged', () => {
    expect(resolveImageTag('', IMAGE_PROFILES)).toBe('');
  });
});
