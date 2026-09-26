/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import chalk from 'chalk';
import StatsBar from '../src/components/StatsBar.jsx';

// jsdom has no TTY, so chalk disables colors; force them on for the
// threshold assertions and restore the level afterwards (tests run in band).
const previousLevel = chalk.level;

beforeEach(() => {
  chalk.level = 1;
});

afterEach(() => {
  chalk.level = previousLevel;
});

describe('StatsBar', () => {
  test('clamps values outside 0–100', () => {
    const { container } = render(<StatsBar cpu={150} mem={-20} />);
    const text = container.textContent;
    expect(text).toContain(' 100%');
    expect(text).toContain(' 0%');
    expect(text).toContain('████████');
    expect(text).toContain('░░░░░░░░');
  });

  test('NaN renders as 0', () => {
    const { container } = render(<StatsBar cpu={NaN} mem={0} />);
    expect(container.textContent).toContain(' 0%');
  });

  test('one decimal below 10, rounded integer from 10 up', () => {
    const low = render(<StatsBar cpu={7.26} mem={4} />);
    expect(low.container.textContent).toContain(' 7.3%');
    expect(low.container.textContent).toContain(' 4%');

    const high = render(<StatsBar cpu={45.6} mem={0} />);
    expect(high.container.textContent).toContain(' 46%');
  });

  test('color thresholds: <50 green, <80 yellow, ≥80 red', () => {
    const a = render(<StatsBar cpu={49} mem={80} />);
    expect(a.container.textContent).toContain(chalk.greenBright(' 49%'));
    expect(a.container.textContent).toContain(chalk.redBright(' 80%'));

    const b = render(<StatsBar cpu={50} mem={0} />);
    expect(b.container.textContent).toContain(chalk.yellowBright(' 50%'));
  });
});
