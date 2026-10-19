/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { ContainerCreationPrompt } from '../src/components/ContainerCreationPrompt.jsx';

const ESC = '\u001b';
const CSI = `${ESC}[`;
/** The 8-bit heads: the same sequences with a shorter introducer. */
const C1_CSI = '\u009b';
const C1_OSC = '\u009d';

const IMAGE_LABEL = 'Name of the image to create (e.g., nginx:1.27-alpine):';
const ENV_LABEL = 'Environment variables (optional, format VAR1=val1,VAR2=val2):';

/**
 * The rendered text must carry no control byte at all: not the ESC that
 * starts an escape sequence, not the 8-bit heads (0x9B, 0x9D), not a stray
 * C0 control. Only TAB and LF are allowed — they are the two C0 controls
 * that carry meaning inside a line of text.
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
  // No C0 control (but TAB and LF) and no DEL.
  expect(text).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/);
}

/**
 * The text a wizard field shows: the value rendered right after its label.
 * The trailing space is the block cursor, so it is trimmed away.
 *
 * @param {HTMLElement} container - The root of the rendered tree
 * @param {string} label - The label of the field
 * @returns {string}
 */
function fieldValue(container, label) {
  const labelEl = Array.from(container.querySelectorAll('span')).find(
    (el) => el.textContent === label
  );
  return (labelEl?.nextElementSibling?.textContent ?? '').trim();
}

/**
 * Where the cursor sits in the text a wizard field shows.
 * The cursor is the character the field renders inverted.
 *
 * @param {HTMLElement} container - The root of the rendered tree
 * @param {string} label - The label of the field
 * @returns {number} The index of the cursor in the displayed text
 */
function cursorIndexIn(container, label) {
  const labelEl = Array.from(container.querySelectorAll('span')).find(
    (el) => el.textContent === label
  );
  const fieldEl = labelEl?.nextElementSibling;
  const cursorEl = fieldEl?.querySelector('[data-inverse="true"]');
  if (!fieldEl || !cursorEl) return -1;
  let index = 0;
  for (const node of fieldEl.childNodes) {
    if (node === cursorEl) break;
    index += node.textContent.length;
  }
  return index;
}

describe('ContainerCreationPrompt — SuggestionPanel wiring', () => {
  test('does NOT render SuggestionPanel when step > 0', () => {
    const { queryByText } = render(
      <ContainerCreationPrompt
        step={1}
        imageName="nginx"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={['nginx', 'node']}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    // On step 1, the imageName field is not active — no suggestion panel
    expect(queryByText(/^nginx$/)).toBeNull();
  });

  test('does NOT render SuggestionPanel on step 0 when suggestions is empty', () => {
    const { queryByTestId } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={[]}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    // No suggestion panel should render when suggestions array is empty
    expect(queryByTestId('suggestion-panel')).toBeNull();
  });

  test('renders SuggestionPanel items on step 0 when suggestions exist', () => {
    const { getAllByText, getByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={['nginx', 'golang']}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    // golang is not in any label — appears only in suggestion panel
    expect(getByText(/golang/)).toBeTruthy();
    // nginx appears in suggestion panel (may also appear in label text, but it does appear)
    const nginxEls = getAllByText(/nginx/);
    expect(nginxEls.length).toBeGreaterThan(0);
  });

  // FR8 — hubResults wiring
  test('when hubResults is provided, activeItems = hubResults (replaces suggestions)', () => {
    const { getByText, queryByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={['nginx', 'golang']}
        hubResults={['hub-nginx', 'hub-node']}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(getByText(/hub-nginx/)).toBeTruthy();
    expect(queryByText(/golang/)).toBeNull();
  });

  test('when hubResults is null, falls back to suggestions', () => {
    const { getByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={['nginx', 'golang']}
        hubResults={null}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(getByText(/golang/)).toBeTruthy();
  });

  test('when step===0 and isSearchingHub=true, SuggestionPanel is shown even if activeItems is empty', () => {
    const { getByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={[]}
        hubResults={null}
        isSearchingHub={true}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(getByText(/searching Docker Hub/)).toBeTruthy();
  });

  test('when step===0 and isSearchingHub=false and activeItems is empty, SuggestionPanel is NOT shown', () => {
    const { queryByTestId } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={[]}
        hubResults={null}
        isSearchingHub={false}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(queryByTestId('suggestion-panel')).toBeNull();
  });

  test('isLoading prop is passed down to SuggestionPanel when isSearchingHub=true', () => {
    const { getByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={['nginx']}
        hubResults={null}
        isSearchingHub={true}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(getByText(/searching Docker Hub/)).toBeTruthy();
  });
});

describe('ContainerCreationPrompt — ControlsHUD wiring', () => {
  test('step=0, no suggestions: renders ControlsHUD with [Tab] and Search Hub', () => {
    const { getByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName=""
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={[]}
        hubResults={null}
        isSearchingHub={false}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(getByText('[Tab]')).toBeTruthy();
    expect(getByText(/Search Hub/)).toBeTruthy();
  });

  test('does NOT render old static text "Press Enter to continue, Escape to cancel"', () => {
    const { queryByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName=""
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={[]}
        hubResults={null}
        isSearchingHub={false}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(queryByText(/Press Enter to continue, Escape to cancel/)).toBeNull();
  });

  test('step=0, hasSuggestions=true: renders [↑↓] not [Tab]', () => {
    const { getByText, queryByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={['nginx', 'golang']}
        hubResults={null}
        isSearchingHub={false}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(getByText('[↑↓]')).toBeTruthy();
    expect(queryByText('[Tab]')).toBeNull();
  });

  test('step=0, isSearchingHub=true, no suggestions: ControlsHUD does NOT render [Tab] or Navigate, DOES render [Enter] and [Esc]', () => {
    const { queryByText, getByText } = render(
      <ContainerCreationPrompt
        step={0}
        imageName="ng"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={[]}
        hubResults={null}
        isSearchingHub={true}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(queryByText('[Tab]')).toBeNull();
    expect(queryByText(/Navigate/)).toBeNull();
    expect(getByText('[Enter]')).toBeTruthy();
    expect(getByText('[Esc]')).toBeTruthy();
  });

  test('step=1: renders [Enter] and [Esc]', () => {
    const { getByText } = render(
      <ContainerCreationPrompt
        step={1}
        imageName="nginx"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={[]}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
      />
    );
    expect(getByText('[Enter]')).toBeTruthy();
    expect(getByText('[Esc]')).toBeTruthy();
  });

  test('step=3, hasSuggestedEnv=true: renders [Tab] in HUD', () => {
    const { getByText } = render(
      <ContainerCreationPrompt
        step={3}
        imageName="postgres:17-alpine"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={[]}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
        hasSuggestedEnv={true}
      />
    );
    expect(getByText('[Tab]')).toBeTruthy();
    expect(getByText(/Insert next env/)).toBeTruthy();
  });

  test('step=3, hasSuggestedEnv=false: does NOT render [Tab] in HUD', () => {
    const { queryByText } = render(
      <ContainerCreationPrompt
        step={3}
        imageName="nginx:1.27-alpine"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={[]}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
        hasSuggestedEnv={false}
      />
    );
    expect(queryByText('[Tab]')).toBeNull();
  });
});

describe('ContainerCreationPrompt — terminal control sequences in the wizard fields', () => {
  // The wizard can be prefilled from a container that was inspected, so a
  // field may hold text CDD did not write. The values are sanitised for the
  // screen only — the state keeps the original, so what is created does not
  // change. These tests are the regression: they must FAIL the moment the
  // `sanitizeTerminalText` call is removed from the component, and the ones
  // about the mask must also fail if the mask ranges are computed on the raw
  // text instead of the sanitised one (the ranges would then point at the
  // wrong characters and the secret would leak).

  const renderStep = (props) =>
    render(
      <ContainerCreationPrompt
        step={3}
        imageName="postgres:17-alpine"
        containerName=""
        portInput=""
        envInput=""
        message=""
        messageColor="yellow"
        suggestions={[]}
        selectedSuggestionIndex={-1}
        visibleOffset={0}
        revealSecrets={false}
        {...props}
      />
    );

  test('a secret that carries a colour escape is still fully masked', () => {
    const { container } = renderStep({
      envInput: `POSTGRES_PASSWORD=hunter2${CSI}31mFAKE${CSI}0m`,
    });
    const text = container.textContent;
    // The secret is not readable...
    expect(text).not.toContain('hunter2');
    // ...and the dots cover exactly the characters the field shows: the
    // sanitised value is 'hunter2FAKE', eleven characters.
    expect(fieldValue(container, ENV_LABEL)).toBe(
      `POSTGRES_PASSWORD=${'•'.repeat('hunter2FAKE'.length)}`
    );
    expectNoControlBytes(text);
  });

  test('an escape in an earlier entry cannot shift the mask off the secret', () => {
    // The escape sits BEFORE the secret, so it moves every index after it.
    // Ranges computed on the raw text would mask the wrong characters and
    // leave the first ones of the password in clear.
    const { container } = renderStep({
      envInput: `A=${CSI}31m1,POSTGRES_PASSWORD=hunter2`,
    });
    const text = container.textContent;
    expect(fieldValue(container, ENV_LABEL)).toBe(
      `A=1,POSTGRES_PASSWORD=${'•'.repeat('hunter2'.length)}`
    );
    expect(text).not.toContain('hunte');
    expectNoControlBytes(text);
  });

  test('the mask covers the secret and nothing else', () => {
    // The escape is inside the secret value, so the range has to stop at the
    // end of the secret: the next, non-secret entry stays readable.
    const { container } = renderStep({
      envInput: `POSTGRES_PASSWORD=hunter2${CSI}31m,DB_NAME=app`,
    });
    expect(fieldValue(container, ENV_LABEL)).toBe(
      `POSTGRES_PASSWORD=${'•'.repeat('hunter2'.length)},DB_NAME=app`
    );
    expectNoControlBytes(container.textContent);
  });

  test('a revealed secret is sanitised too', () => {
    const { container } = renderStep({
      envInput: `POSTGRES_PASSWORD=hunter2${CSI}31m`,
      revealSecrets: true,
    });
    expect(fieldValue(container, ENV_LABEL)).toBe('POSTGRES_PASSWORD=hunter2');
    expectNoControlBytes(container.textContent);
  });

  test('a cursor inside the secret does not shift the mask', () => {
    // The cursor position is an offset into the text the field shows, so it
    // must not move the dots that cover the secret.
    const { container } = renderStep({
      envInput: 'POSTGRES_PASSWORD=hunter2',
      cursors: { envInput: 18 },
    });
    expect(fieldValue(container, ENV_LABEL)).toBe(
      `POSTGRES_PASSWORD=${'•'.repeat('hunter2'.length)}`
    );
    expectNoControlBytes(container.textContent);
  });

  test('an escape in the image field is stripped and the words stay', () => {
    const { container } = renderStep({
      step: 0,
      imageName: `nginx:${CSI}31mFAKE${CSI}0m`,
    });
    const text = container.textContent;
    expect(fieldValue(container, IMAGE_LABEL)).toBe('nginx:FAKE');
    expectNoControlBytes(text);
  });

  test('legitimate text is not mutiled', () => {
    // The sanitiser must not touch what is legitimate: accents, emoji and
    // the symbols Ink escapes itself all have to come out as they went in.
    const value = 'AÑIDO=café & <crudo> 🐳';
    const { container } = renderStep({ envInput: value });
    expect(fieldValue(container, ENV_LABEL)).toBe(value);
    expectNoControlBytes(container.textContent);
  });

  test('the cursor keeps pointing at the same character', () => {
    // The cursor counts characters of the raw value, but the field shows the
    // sanitised one: without remapping it, the cursor would sit on a
    // different character after every removed sequence.
    const { container } = renderStep({
      envInput: `A${CSI}31mBCD`,
      cursors: { envInput: 6 },
    });
    // The raw position 6 is just before the "B", which is the second
    // character of what the field shows.
    expect(fieldValue(container, ENV_LABEL)).toBe('ABCD');
    expect(cursorIndexIn(container, ENV_LABEL)).toBe(1);
  });
});
