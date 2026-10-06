/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { DiagnosticPanel } from '../src/components/DiagnosticPanel.jsx';

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

  test('no fix key is advertised before there is one to apply', () => {
    // The F key arrives with the fix, and showing a key that does nothing
    // would be worse than showing nothing.
    const { queryByText } = render(
      <DiagnosticPanel diagnosis={diagnosis()} containerName="db" />
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
