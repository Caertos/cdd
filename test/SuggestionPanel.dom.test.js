/**
 * @jest-environment jsdom
 */
import React from 'react';
import { C0_EXCEPT_TAB_AND_DEL, controlCharsIn } from './support/controlChars.js';
import { render } from '@testing-library/react';
import { SuggestionPanel } from '../src/components/SuggestionPanel.jsx';

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

describe('SuggestionPanel', () => {
  const items = ['caddy', 'elasticsearch', 'golang', 'httpd', 'kafka', 'mariadb', 'memcached', 'minio'];

  test('renders nothing when items is empty', () => {
    const { container } = render(
      <SuggestionPanel items={[]} selectedIndex={-1} visibleOffset={0} maxVisible={5} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('renders only maxVisible items from visibleOffset', () => {
    const { getByText, queryByText } = render(
      <SuggestionPanel items={items} selectedIndex={-1} visibleOffset={0} maxVisible={5} />
    );
    expect(getByText(/caddy/)).toBeTruthy();
    expect(getByText(/elasticsearch/)).toBeTruthy();
    expect(getByText(/kafka/)).toBeTruthy();
    expect(queryByText(/mariadb/)).toBeNull();
  });

  test('respects visibleOffset by skipping early items', () => {
    const { queryByText, getByText } = render(
      <SuggestionPanel items={items} selectedIndex={-1} visibleOffset={2} maxVisible={3} />
    );
    expect(getByText(/golang/)).toBeTruthy();
    expect(getByText(/httpd/)).toBeTruthy();
    expect(getByText(/kafka/)).toBeTruthy();
    expect(queryByText(/caddy/)).toBeNull();
  });

  test('focused row has › prefix marker', () => {
    const { getByText } = render(
      <SuggestionPanel items={items} selectedIndex={1} visibleOffset={0} maxVisible={5} />
    );
    const el = getByText(/› elasticsearch/);
    expect(el).toBeTruthy();
  });

  test('non-focused rows do NOT have › prefix', () => {
    const { getByText } = render(
      <SuggestionPanel items={items} selectedIndex={1} visibleOffset={0} maxVisible={5} />
    );
    const el = getByText(/caddy/);
    expect(el.textContent).not.toMatch(/›/);
  });

  // FR8 — isLoading prop
  test('renders [searching Docker Hub...] row when isLoading=true', () => {
    const { getByText } = render(
      <SuggestionPanel items={[]} selectedIndex={-1} visibleOffset={0} isLoading={true} />
    );
    expect(getByText(/searching Docker Hub/)).toBeTruthy();
  });

  test('loading row is NOT selectable — no › prefix on loading row', () => {
    const { getByText } = render(
      <SuggestionPanel items={items} selectedIndex={-1} visibleOffset={0} maxVisible={5} isLoading={true} />
    );
    const loadingEl = getByText(/searching Docker Hub/);
    expect(loadingEl.textContent).not.toMatch(/›/);
  });

  test('does NOT render loading row when isLoading=false', () => {
    const { queryByText } = render(
      <SuggestionPanel items={items} selectedIndex={-1} visibleOffset={0} maxVisible={5} isLoading={false} />
    );
    expect(queryByText(/searching Docker Hub/)).toBeNull();
  });

  test('renders panel even when items is empty but isLoading=true', () => {
    const { getByText } = render(
      <SuggestionPanel items={[]} selectedIndex={-1} visibleOffset={0} isLoading={true} />
    );
    expect(getByText(/searching Docker Hub/)).toBeTruthy();
  });
});

describe('SuggestionPanel — terminal control sequences', () => {
  // The suggestions come from Docker Hub, so the name of a repository is text
  // somebody else wrote. Ink writes it to stdout verbatim, so a sequence in
  // there would be executed by the terminal. These tests are the regression:
  // they must FAIL the moment the `sanitizeTerminalText` call is removed from
  // the component.

  test('a fake colour sequence is stripped and its words stay readable', () => {
    const { container } = render(
      <SuggestionPanel
        items={[`${CSI}31mFAKE-RED${CSI}0m`]}
        selectedIndex={-1}
        visibleOffset={0}
        maxVisible={5}
      />
    );
    const text = container.textContent;
    expect(text).toContain('FAKE-RED');
    expectNoControlBytes(text);
  });

  test('an OSC-8 hyperlink is stripped, its label stays and the url does not', () => {
    const hostile = `${OSC}8;;https://evil.example/pwned${ST}CLICK-ME${OSC}8;;${ST}`;
    const { container } = render(
      <SuggestionPanel
        items={[hostile]}
        selectedIndex={-1}
        visibleOffset={0}
        maxVisible={5}
      />
    );
    const text = container.textContent;
    expect(text).toContain('CLICK-ME');
    expect(text).not.toContain('evil.example');
    expectNoControlBytes(text);
  });

  test('a screen wipe is stripped and leaves no control byte behind', () => {
    const { container } = render(
      <SuggestionPanel
        items={[`${CSI}2J${CSI}Hcleared`]}
        selectedIndex={-1}
        visibleOffset={0}
        maxVisible={5}
      />
    );
    const text = container.textContent;
    expect(text).toContain('cleared');
    expectNoControlBytes(text);
  });

  test('the 8-bit CSI and OSC heads are stripped too', () => {
    const { container } = render(
      <SuggestionPanel
        items={[`${C1_CSI}31mFAKE-RED${C1_OSC}0;title${BEL}after`]}
        selectedIndex={-1}
        visibleOffset={0}
        maxVisible={5}
      />
    );
    const text = container.textContent;
    expect(text).toContain('FAKE-RED');
    expect(text).toContain('after');
    expectNoControlBytes(text);
  });

  test('ordinary text is rendered verbatim, byte for byte', () => {
    // The sanitiser must not mutilate what is legitimate: the symbols Ink
    // escapes itself, the accents and the emoji all have to come out as they
    // went in.
    const item = 'a & b < c > d — ñandú 🐳 café';
    const { container } = render(
      <SuggestionPanel
        items={[item]}
        selectedIndex={-1}
        visibleOffset={0}
        maxVisible={5}
      />
    );
    expect(container.textContent).toContain(item);
  });
});
