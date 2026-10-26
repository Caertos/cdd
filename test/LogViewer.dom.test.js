/**
 * @jest-environment jsdom
 */
import React from 'react';
import { C0_EXCEPT_TAB_AND_DEL, controlCharsIn } from './support/controlChars.js';
import { render } from '@testing-library/react';
import LogViewer from '../src/components/LogViewer.jsx';
import { STRINGS } from '../src/helpers/strings.js';

const lines = (count) =>
  Array.from({ length: count }, (_, i) => `line-${i}`);

const ESC = '\u001b';
const BEL = '\u0007';
const CSI = `${ESC}[`;
const OSC = `${ESC}]`;
const ST = `${ESC}\\`;
/** The 8-bit heads: the same sequences with a shorter introducer. */
const C1_CSI = '\u009b';
const C1_OSC = '\u009d';

/**
 * The rendered text must carry no control byte at all: not the ESC that
 * starts an escape sequence, not the 8-bit heads (0x9B, 0x9D).
 *
 * @param {string} text - The text the rendered node actually shows
 */
function expectNoControlBytes(text) {
  expect(text).not.toContain(ESC);
  expect(text).not.toContain(C1_CSI);
  expect(text).not.toContain(C1_OSC);
  // The same check in a shape a human can read in the failure message: the
  // escaped bytes are visible there instead of invisible control characters.
  expect(JSON.stringify(text)).not.toMatch(/\\u001b|\\u009b|\\u009d/);
  // No C0 control (but TAB) and no DEL: a line feed would break the line of
  // the panel and let the text that follows draw itself as another line.
  expect(controlCharsIn(text, C0_EXCEPT_TAB_AND_DEL)).toEqual([]);
}

describe('LogViewer', () => {
  test('titles with the container name', () => {
    const { getByText } = render(
      <LogViewer logs={['a']} container={{ name: 'web' }} />
    );
    expect(getByText('web logs, press ESC to exit')).toBeTruthy();
  });

  test('falls back to "Container" without metadata', () => {
    const { getByText } = render(<LogViewer logs={['a']} />);
    expect(getByText('Container logs, press ESC to exit')).toBeTruthy();
  });

  test('renders only the last 15 lines', () => {
    const { container } = render(<LogViewer logs={lines(20)} />);
    expect(container.textContent).toContain('line-19');
    expect(container.textContent).toContain('line-5');
    expect(container.textContent).not.toContain('line-4');
  });

  test('renders all lines when there are 15 or fewer', () => {
    const { container } = render(<LogViewer logs={lines(15)} />);
    expect(container.textContent).toContain('line-0');
    expect(container.textContent).toContain('line-14');
  });

  test('empty logs → dimmed placeholder', () => {
    const { getByText, container } = render(<LogViewer logs={[]} />);
    const placeholder = getByText('No logs...');
    expect(placeholder.getAttribute('data-dim')).toBe('true');
    expect(container.textContent).not.toContain('line-');
  });
});

describe('LogViewer — scrolling', () => {
  test('height limits the visible lines', () => {
    const { container } = render(<LogViewer logs={lines(20)} height={5} />);
    expect(container.textContent).toContain('line-19');
    expect(container.textContent).toContain('line-15');
    expect(container.textContent).not.toContain('line-14');
  });

  test('scrollOffset moves the window toward older lines', () => {
    const { container } = render(
      <LogViewer logs={lines(20)} height={5} scrollOffset={5} />
    );
    expect(container.textContent).toContain('line-14');
    expect(container.textContent).toContain('line-10');
    expect(container.textContent).not.toContain('line-15');
    expect(container.textContent).not.toContain('line-9');
  });

  test('an offset past the oldest line stops at the first window', () => {
    const { container } = render(
      <LogViewer logs={lines(20)} height={5} scrollOffset={999} />
    );
    expect(container.textContent).toContain('line-0');
    expect(container.textContent).toContain('line-4');
    expect(container.textContent).not.toContain('line-5');
  });

  test('says so in the title while paused', () => {
    const { container } = render(
      <LogViewer logs={['a']} following={false} />
    );
    expect(container.textContent).toContain('paused');
  });

  test('counts the lines that arrived while paused', () => {
    const { container } = render(
      <LogViewer logs={['a']} following={false} pending={47} />
    );
    expect(container.textContent).toContain('47 new');
    expect(container.textContent).toContain('[End] latest');
  });

  test('says nothing about pending lines while following', () => {
    const { container } = render(<LogViewer logs={['a']} pending={47} />);
    expect(container.textContent).not.toContain('47 new');
    expect(container.textContent).not.toContain('paused');
  });
});

describe('LogViewer — search', () => {
  const search = (extra = {}) => ({
    open: false,
    query: '',
    cursor: 0,
    filter: false,
    matchCount: 0,
    matchPos: -1,
    ...extra,
  });

  test('shows the key hint when there is no search', () => {
    const { container } = render(<LogViewer logs={['a']} search={search()} />);
    expect(container.textContent).toContain(STRINGS.logsHint);
  });

  test('highlights every match, case-insensitively, keeping the text', () => {
    const { container } = render(
      <LogViewer
        logs={['Error: disk', 'fine']}
        search={search({ query: 'error', matchCount: 1 })}
      />
    );
    const marked = [...container.querySelectorAll('[data-inverse="true"]')];
    expect(marked.map((n) => n.textContent)).toEqual(['Error']);
    expect(container.textContent).toContain('Error: disk');
  });

  test('highlights nothing without a query', () => {
    const { container } = render(<LogViewer logs={['Error']} search={search()} />);
    expect(container.querySelectorAll('[data-inverse="true"]')).toHaveLength(0);
  });

  test('applied search shows the query, the counter and the filter state', () => {
    const { container } = render(
      <LogViewer
        logs={['x']}
        search={search({ query: 'x', matchCount: 12, matchPos: 2 })}
      />
    );
    expect(container.textContent).toContain('/x');
    expect(container.textContent).toContain('3 of 12 matches');
    expect(container.textContent).toContain('filter off');
  });

  test('open field shows the query being typed and Enter/Esc help', () => {
    const { container } = render(
      <LogViewer
        logs={['x']}
        search={search({
          open: true,
          query: 'abc',
          cursor: 3,
          filter: true,
          matchCount: 1,
        })}
      />
    );
    expect(container.textContent).toContain('abc');
    expect(container.textContent).toContain('1 match');
    expect(container.textContent).toContain('[Enter] keep');
    expect(container.textContent).toContain('filter on');
  });

  test('a filter with nothing to show says there are no matches', () => {
    const { container } = render(
      <LogViewer logs={[]} search={search({ query: 'zzz', filter: true })} />
    );
    expect(container.textContent).toContain('no matches');
    expect(container.textContent).not.toContain('No logs...');
  });

  test('control sequences in the query cannot reach the screen', () => {
    const { container } = render(
      <LogViewer
        logs={['x']}
        search={search({ query: `${ESC}[31mred`, matchCount: 0 })}
      />
    );
    expectNoControlBytes(container.textContent);
  });
});

describe('LogViewer — terminal control sequences', () => {
  // The log is written by the container, not by CDD. Ink writes it to stdout
  // verbatim, so a sequence the container prints would be executed by the
  // terminal. These tests are the regression: they must FAIL the moment the
  // `sanitizeTerminalText` call is removed from the component.

  test('a fake colour sequence is stripped and its words stay readable', () => {
    const { container } = render(
      <LogViewer logs={[`${CSI}31mFAKE-RED${CSI}0m`]} />
    );
    const text = container.textContent;
    expect(text).toContain('FAKE-RED');
    expectNoControlBytes(text);
  });

  test('an OSC-8 hyperlink is stripped, its label stays and the url does not', () => {
    const hostile = `${OSC}8;;https://evil.example/pwned${ST}CLICK-ME${OSC}8;;${ST}`;
    const { container } = render(<LogViewer logs={[hostile]} />);
    const text = container.textContent;
    expect(text).toContain('CLICK-ME');
    expect(text).not.toContain('evil.example');
    expectNoControlBytes(text);
  });

  test('a screen wipe is stripped and leaves no control byte behind', () => {
    const { container } = render(
      <LogViewer logs={[`${CSI}2J${CSI}Hcleared`]} />
    );
    const text = container.textContent;
    expect(text).toContain('cleared');
    expectNoControlBytes(text);
  });

  test('the 8-bit CSI and OSC heads are stripped too', () => {
    const { container } = render(
      <LogViewer logs={[`${C1_CSI}31mFAKE-RED${C1_OSC}0;title${BEL}after`]} />
    );
    const text = container.textContent;
    expect(text).toContain('FAKE-RED');
    expect(text).toContain('after');
    expectNoControlBytes(text);
  });

  test('a hostile container name cannot colour the title', () => {
    const { container } = render(
      <LogViewer logs={['a']} container={{ name: `${CSI}31mevil${CSI}0m` }} />
    );
    const text = container.textContent;
    expect(text).toContain('evil logs, press ESC to exit');
    expectNoControlBytes(text);
  });

  test('ordinary text is rendered verbatim, byte for byte', () => {
    // The sanitiser must not mutilate what is legitimate: the symbols Ink
    // escapes itself, the accents and the emoji all have to come out as they
    // went in.
    const line = 'a & b < c > d — ñandú 🐳 café';
    const { container } = render(<LogViewer logs={[line]} />);
    expect(container.textContent).toContain(line);
    expect(container.textContent).toBe(
      `Container logs, press ESC to exit${line}${STRINGS.logsHint}`
    );
  });
});
