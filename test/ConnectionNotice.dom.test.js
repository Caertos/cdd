/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { ConnectionNotice } from '../src/components/ConnectionNotice.jsx';
import {
  LEGIT,
  expectNoControlBytes,
  hostile,
  nodeWithText,
  sanitised,
} from './support/terminalControls.js';

const mockError = {
  kind: 'not-running',
  title: "🔌 Can't reach Docker",
  detail: "The Docker service doesn't seem to be running on this machine.",
  hints: ['sudo systemctl start docker', 'Or open Docker Desktop'],
  technical: 'ENOENT: connect ENOENT /var/run/docker.sock',
};

describe('ConnectionNotice', () => {
  test('renders title, detail, hints, and technical detail', () => {
    const { getByText } = render(
      <ConnectionNotice error={mockError} nextRetryIn={5} />
    );
    expect(getByText(mockError.title)).toBeTruthy();
    expect(getByText(mockError.detail)).toBeTruthy();
    expect(getByText(/sudo systemctl start docker/)).toBeTruthy();
    expect(getByText(/Or open Docker Desktop/)).toBeTruthy();
    expect(getByText(/ENOENT/)).toBeTruthy();
  });

  test('shows countdown when nextRetryIn > 0', () => {
    const { getByText } = render(
      <ConnectionNotice error={mockError} nextRetryIn={3} />
    );
    expect(getByText(/Retrying in 3 s/)).toBeTruthy();
  });

  test('shows "Retrying..." when nextRetryIn is 0', () => {
    const { getByText } = render(
      <ConnectionNotice error={mockError} nextRetryIn={0} />
    );
    expect(getByText('Retrying...')).toBeTruthy();
  });

  test('renders retry and quit key hints', () => {
    const { getByText } = render(
      <ConnectionNotice error={mockError} nextRetryIn={5} />
    );
    expect(getByText('[R] retry now')).toBeTruthy();
    expect(getByText('[Q] quit')).toBeTruthy();
  });
});

// The title, the detail and the hints are written by the daemon, not by CDD.
// A terminal executes part of what it is given, so they have to reach the
// screen without their control bytes.
describe('ConnectionNotice — the daemon error reaches the screen sanitised', () => {
  const hostileError = {
    kind: 'not-running',
    title: hostile('title'),
    detail: hostile('detail'),
    hints: [hostile('hint'), LEGIT],
    technical: 'ENOENT: connect ENOENT /var/run/docker.sock',
  };

  test('no control byte reaches the DOM', () => {
    const { container } = render(
      <ConnectionNotice error={hostileError} nextRetryIn={5} />
    );
    expectNoControlBytes(container.textContent);
  });

  test('the title, the detail and every hint keep their words', () => {
    const { container } = render(
      <ConnectionNotice error={hostileError} nextRetryIn={5} />
    );
    expect(nodeWithText(container, sanitised('title'))).toBeTruthy();
    expect(nodeWithText(container, sanitised('detail'))).toBeTruthy();
    expect(nodeWithText(container, sanitised('hint'))).toBeTruthy();
  });

  test('the url of the hyperlink does not stay on screen', () => {
    const { container } = render(
      <ConnectionNotice error={hostileError} nextRetryIn={5} />
    );
    expect(container.textContent).not.toContain('evil.example');
  });

  test('legitimate text is not mangled', () => {
    const { container } = render(
      <ConnectionNotice
        error={{
          ...mockError,
          title: LEGIT,
          detail: LEGIT,
          hints: [LEGIT],
        }}
        nextRetryIn={5}
      />
    );
    expect(nodeWithText(container, LEGIT)).toBeTruthy();
    expect(container.textContent).toContain(LEGIT);
    expectNoControlBytes(container.textContent);
  });
});
