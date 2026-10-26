/**
 * @jest-environment jsdom
 */
import React from 'react';
import { C0_EXCEPT_TAB_AND_DEL, controlCharsIn } from './support/controlChars.js';
import { render } from '@testing-library/react';
import { DiagnosticPanel } from '../src/components/DiagnosticPanel.jsx';

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

function diagnosis(overrides = {}) {
  return {
    what: 'It died after 2s with exit code 1.',
    why: 'Postgres refuses to start without a password.',
    ruleId: 'postgres-missing-password',
    evidence: ['Error: superuser password is not specified'],
    fix: { kind: 'add-env', label: 'Recreate' },
    tail: ['superuser password is not specified'],
    ...overrides,
  };
}

describe('DiagnosticPanel — when there is a cause', () => {
  test('names the container and what happened', () => {
    const { getByText } = render(
      <DiagnosticPanel diagnosis={diagnosis()} containerName="mi-basedatos" />
    );
    expect(getByText(/Diagnosis: mi-basedatos/)).toBeTruthy();
    expect(getByText(/died after 2s with exit code 1/)).toBeTruthy();
  });

  test('shows the cause under its heading', () => {
    const { getByText } = render(
      <DiagnosticPanel diagnosis={diagnosis()} containerName="db" />
    );
    expect(getByText('Likely cause:')).toBeTruthy();
    expect(getByText(/Postgres refuses to start/)).toBeTruthy();
  });

  test('shows the log tail under its heading', () => {
    const { getByText } = render(
      <DiagnosticPanel diagnosis={diagnosis()} containerName="db" />
    );
    expect(getByText('Last lines:')).toBeTruthy();
    expect(getByText('superuser password is not specified')).toBeTruthy();
  });

  test('offers the full log, which the L key already opens', () => {
    const { getByText } = render(
      <DiagnosticPanel diagnosis={diagnosis()} containerName="db" />
    );
    expect(getByText('[L] Full log')).toBeTruthy();
  });
});

describe('DiagnosticPanel — when nothing was recognised', () => {
  test('says so instead of inventing a cause', () => {
    const { getByText } = render(
      <DiagnosticPanel
        diagnosis={diagnosis({ why: null, ruleId: null })}
        containerName="weird"
      />
    );
    expect(getByText(/I don't recognise it/)).toBeTruthy();
    // The heading stays: the section is there, we just have nothing to put
    // under it but the admission.
    expect(getByText('Likely cause:')).toBeTruthy();
  });

  test('and still shows the lines that led there', () => {
    const { getByText } = render(
      <DiagnosticPanel
        diagnosis={diagnosis({ why: null, tail: ['segfault at 0x0'] })}
        containerName="weird"
      />
    );
    expect(getByText('segfault at 0x0')).toBeTruthy();
  });

  test('a container with no output at all says so plainly', () => {
    const { getByText, queryByText } = render(
      <DiagnosticPanel
        diagnosis={diagnosis({ why: null, tail: [] })}
        containerName="quiet"
      />
    );
    expect(getByText(/wrote nothing to its log/)).toBeTruthy();
    expect(queryByText(/I don't recognise it/)).toBeNull();
  });

  test('no tail section is rendered when there are no lines', () => {
    const { queryByText } = render(
      <DiagnosticPanel
        diagnosis={diagnosis({ why: null, tail: [] })}
        containerName="quiet"
      />
    );
    expect(queryByText('Last lines:')).toBeNull();
  });
});

describe('DiagnosticPanel — states without content', () => {
  test('renders nothing while loading with no diagnosis yet', () => {
    const { container } = render(
      <DiagnosticPanel diagnosis={null} containerName="db" />
    );
    expect(container.firstChild).toBeNull();
  });

  test('shows the loading line while the log is being read', () => {
    const { getByText } = render(
      <DiagnosticPanel diagnosis={null} containerName="db" isLoading />
    );
    expect(getByText(/Reading the log/)).toBeTruthy();
  });

  test('the title appears even before the diagnosis does', () => {
    const { getByText } = render(
      <DiagnosticPanel
        diagnosis={null}
        containerName="mi-basedatos"
        isLoading
      />
    );
    expect(getByText(/Diagnosis: mi-basedatos/)).toBeTruthy();
  });

  test('an empty container name does not crash the title', () => {
    const { getByText } = render(
      <DiagnosticPanel diagnosis={diagnosis()} containerName="" />
    );
    expect(getByText(/Diagnosis:/)).toBeTruthy();
  });

  test('no fix key is advertised when there is no fix', () => {
    // Showing a key that does nothing would be worse than showing nothing.
    const { queryByText } = render(
      <DiagnosticPanel diagnosis={diagnosis()} containerName="db" />
    );
    expect(queryByText(/\[F\]/)).toBeNull();
  });

  test('the fix key appears with the label when a fix exists', () => {
    const { getByText } = render(
      <DiagnosticPanel
        diagnosis={diagnosis()}
        containerName="db"
        fixLabel="Recreate with POSTGRES_PASSWORD"
      />
    );
    expect(getByText(/\[F\] Recreate with POSTGRES_PASSWORD/)).toBeTruthy();
  });

  test('the log key stays available alongside the fix key', () => {
    const { getByText } = render(
      <DiagnosticPanel
        diagnosis={diagnosis()}
        containerName="db"
        fixLabel="Recreate with POSTGRES_PASSWORD"
      />
    );
    expect(getByText('[L] Full log')).toBeTruthy();
  });

  test('a null fixLabel is not advertised either', () => {
    const { queryByText } = render(
      <DiagnosticPanel diagnosis={diagnosis()} containerName="db" fixLabel={null} />
    );
    expect(queryByText(/\[F\]/)).toBeNull();
  });
});

describe('DiagnosticPanel — long content', () => {
  test('renders every tail line it is given', () => {
    const tail = Array.from({ length: 5 }, (_, i) => `line ${i}`);
    const { getByText } = render(
      <DiagnosticPanel
        diagnosis={diagnosis({ why: null, tail })}
        containerName="db"
      />
    );
    for (const line of tail) expect(getByText(line)).toBeTruthy();
  });

  test('a very long cause is passed through in one piece', () => {
    const why = 'x'.repeat(400);
    const { getByText } = render(
      <DiagnosticPanel diagnosis={diagnosis({ why })} containerName="db" />
    );
    expect(getByText(why)).toBeTruthy();
  });
});

describe('DiagnosticPanel — terminal control sequences', () => {
  // The panel shows text CDD did not write: the words of a daemon error and
  // the tail of a container log. Ink writes them to stdout verbatim, so a
  // sequence in there would be executed by the terminal. These tests are the
  // regression: they must FAIL the moment the `sanitizeTerminalText` calls
  // are removed from the component.

  test('a fake colour sequence in the diagnosis is stripped', () => {
    const { container } = render(
      <DiagnosticPanel
        diagnosis={diagnosis({ what: `${CSI}31mFAKE-RED${CSI}0m` })}
        containerName="db"
      />
    );
    const text = container.textContent;
    expect(text).toContain('FAKE-RED');
    expectNoControlBytes(text);
  });

  test('a fake colour sequence in the cause is stripped', () => {
    const { container } = render(
      <DiagnosticPanel
        diagnosis={diagnosis({ why: `${CSI}35mFAKE-MAGENTA${CSI}0m` })}
        containerName="db"
      />
    );
    const text = container.textContent;
    expect(text).toContain('FAKE-MAGENTA');
    expectNoControlBytes(text);
  });

  test('an OSC-8 hyperlink in the log tail is stripped', () => {
    const hostile = `${OSC}8;;https://evil.example/pwned${ST}CLICK-ME${OSC}8;;${ST}`;
    const { container } = render(
      <DiagnosticPanel
        diagnosis={diagnosis({ why: null, tail: [hostile] })}
        containerName="db"
      />
    );
    const text = container.textContent;
    expect(text).toContain('CLICK-ME');
    expect(text).not.toContain('evil.example');
    expectNoControlBytes(text);
  });

  test('a screen wipe in the log tail is stripped', () => {
    const { container } = render(
      <DiagnosticPanel
        diagnosis={diagnosis({ why: null, tail: [`${CSI}2J${CSI}Hcleared`] })}
        containerName="db"
      />
    );
    const text = container.textContent;
    expect(text).toContain('cleared');
    expectNoControlBytes(text);
  });

  test('the 8-bit CSI and OSC heads are stripped too', () => {
    const { container } = render(
      <DiagnosticPanel
        diagnosis={diagnosis({
          what: `${C1_CSI}31mFAKE-RED${C1_OSC}0;title${BEL}after`,
        })}
        containerName="db"
      />
    );
    const text = container.textContent;
    expect(text).toContain('FAKE-RED');
    expect(text).toContain('after');
    expectNoControlBytes(text);
  });

  test('a hostile container name cannot smuggle a sequence into the title', () => {
    const { container } = render(
      <DiagnosticPanel
        diagnosis={diagnosis()}
        containerName={`${CSI}31mevil${CSI}0m`}
      />
    );
    const text = container.textContent;
    expect(text).toContain('Diagnosis: evil');
    expectNoControlBytes(text);
  });

  test('ordinary text is rendered verbatim, byte for byte', () => {
    // The sanitiser must not mutilate what is legitimate: the symbols Ink
    // escapes itself, the accents and the emoji all have to come out as they
    // went in.
    const what = 'It died & said <why> — ñandú 🐳';
    const why = 'a & b < c > d — café ünïcodé';
    const tail = 'Error: <boom> & friends 🐛';
    const { container } = render(
      <DiagnosticPanel
        diagnosis={diagnosis({ what, why, tail: [tail] })}
        containerName="db"
      />
    );
    const text = container.textContent;
    expect(text).toContain(what);
    expect(text).toContain(why);
    expect(text).toContain(tail);
  });
});
