/**
 * @jest-environment jsdom
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render } from '@testing-library/react';
import { jest } from '@jest/globals';
import { STRINGS } from '../src/helpers/strings.js';
import {
  LEGIT,
  expectNoControlBytes,
  hostile,
  nodeWithText,
  sanitised,
} from './support/terminalControls.js';

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
  test('totalCount=1 → singular "1 container found"', async () => {
    const Header = await loadHeader(() => '4.7.1');
    const { getByText } = render(<Header totalCount={1} />);
    expect(getByText('1 container found')).toBeTruthy();
  });

  test('totalCount=2 → plural "2 containers found"', async () => {
    const Header = await loadHeader(() => '4.7.1');
    const { getByText } = render(<Header totalCount={2} />);
    expect(getByText('2 containers found')).toBeTruthy();
  });

  test('renders the package version as vX.Y.Z', async () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve('package.json'), 'utf8')
    );
    const Header = await loadHeader(() => pkg.version);
    const { getByText } = render(<Header totalCount={0} />);
    expect(getByText(`v${pkg.version}`)).toBeTruthy();
  });

  test('unknown when getAppVersion fails (no v prefix)', async () => {
    const Header = await loadHeader(() => 'unknown');
    const { getByText, queryByText } = render(<Header totalCount={0} />);
    expect(getByText('unknown')).toBeTruthy();
    expect(queryByText('vunknown')).toBeNull();
  });

  test('shows the active sort mode when given one', async () => {
    const Header = await loadHeader(() => '4.7.1');
    const { getByText } = render(<Header totalCount={2} sortMode="state" />);
    expect(getByText(STRINGS.sortMode.state)).toBeTruthy();
  });

  test('shows no sort line when no mode is given', async () => {
    const Header = await loadHeader(() => '4.7.1');
    const { queryByText } = render(<Header totalCount={2} />);
    expect(queryByText(STRINGS.sortMode.state)).toBeNull();
  });

  test('with a query it shows how many of the total are shown', async () => {
    const Header = await loadHeader(() => '4.7.1');
    const { getByText } = render(
      <Header visibleCount={12} totalCount={25} query="pg" />
    );
    expect(getByText(STRINGS.filter.summary(12, 25, 'pg'))).toBeTruthy();
  });
});

// The query is what the user typed, but it can also be a paste: a terminal
// executes part of what it is given, so the summary has to reach the screen
// without the control bytes of the query.
describe('Header — the filter query reaches the screen sanitised', () => {
  test('the summary leaves no control byte in the DOM', async () => {
    const Header = await loadHeader(() => '4.7.1');
    const { container } = render(
      <Header visibleCount={12} totalCount={25} query={hostile('query')} />
    );
    const summary = nodeWithText(container, 'search:');
    expect(summary).toBeTruthy();
    expectNoControlBytes(summary.textContent);
  });

  test('the words of the query survive', async () => {
    const Header = await loadHeader(() => '4.7.1');
    const { container } = render(
      <Header visibleCount={12} totalCount={25} query={hostile('query')} />
    );
    const summary = nodeWithText(container, 'search:');
    expect(summary.textContent).toContain(sanitised('query'));
  });

  test('the url of the hyperlink does not stay on screen', async () => {
    const Header = await loadHeader(() => '4.7.1');
    const { container } = render(
      <Header visibleCount={12} totalCount={25} query={hostile('query')} />
    );
    expect(container.textContent).not.toContain('evil.example');
  });

  test('legitimate text is not mangled', async () => {
    const Header = await loadHeader(() => '4.7.1');
    const { container } = render(
      <Header visibleCount={12} totalCount={25} query={LEGIT} />
    );
    const summary = nodeWithText(container, 'search:');
    expect(summary.textContent).toContain(LEGIT);
    expectNoControlBytes(summary.textContent);
  });
});
