/**
 * @jest-environment jsdom
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render } from '@testing-library/react';
import { jest } from '@jest/globals';

afterEach(() => jest.resetModules());

// Header captures the version at module scope, so each case reloads it
// with a fresh appInfo implementation.
async function loadHeader(versionImpl) {
  await jest.unstable_mockModule('../src/helpers/appInfo.js', () => ({
    getAppVersion: versionImpl,
  }));
  const mod = await import('../src/components/Header.jsx');
  return mod.default;
}

describe('Header', () => {
  test('count=1 → singular "1 container found"', async () => {
    const Header = await loadHeader(() => '4.7.1');
    const { getByText } = render(<Header count={1} />);
    expect(getByText('1 container found')).toBeTruthy();
  });

  test('count=2 → plural "2 containers found"', async () => {
    const Header = await loadHeader(() => '4.7.1');
    const { getByText } = render(<Header count={2} />);
    expect(getByText('2 containers found')).toBeTruthy();
  });

  test('renders the package version as vX.Y.Z', async () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve('package.json'), 'utf8')
    );
    const Header = await loadHeader(() => pkg.version);
    const { getByText } = render(<Header count={0} />);
    expect(getByText(`v${pkg.version}`)).toBeTruthy();
  });

  test('unknown when getAppVersion fails (no v prefix)', async () => {
    const Header = await loadHeader(() => 'unknown');
    const { getByText, queryByText } = render(<Header count={0} />);
    expect(getByText('unknown')).toBeTruthy();
    expect(queryByText('vunknown')).toBeNull();
  });
});
