/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { ConnectionNotice } from '../src/components/ConnectionNotice.jsx';

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
