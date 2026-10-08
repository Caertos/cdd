/**
 * @jest-environment jsdom
 */
import fs from 'fs';
import path from 'path';
import {
  getActiveContext,
  getBindings,
  resolveKey,
  keyNameOf,
  KEYMAP,
} from '../src/helpers/keymap.js';
import { displayKeys } from '../src/helpers/keyLabels.js';

describe('getActiveContext — pure function', () => {
  test('returns list when no special state is active', () => {
    expect(getActiveContext({})).toBe('list');
  });

  test('confirm wins over everything', () => {
    expect(
      getActiveContext({
        confirmErase: true,
        showLogs: true,
        creatingContainer: true,
      })
    ).toBe('confirm');
  });

  test('help wins over logs and wizard', () => {
    expect(getActiveContext({ showHelp: true, showLogs: true })).toBe('help');
  });

  test('logs wins over list', () => {
    expect(getActiveContext({ showLogs: true })).toBe('logs');
  });

  test('wizard-list wins over wizard', () => {
    expect(
      getActiveContext({ creatingContainer: true, hasActiveList: true })
    ).toBe('wizard-list');
  });

  test('wizard when creating without active list', () => {
    expect(getActiveContext({ creatingContainer: true })).toBe('wizard');
  });

  test('debug when showDebugLogs is true', () => {
    expect(getActiveContext({ showDebugLogs: true })).toBe('debug');
  });

  test('list when only showDebugLogs is false', () => {
    expect(
      getActiveContext({ creatingContainer: false, showLogs: false })
    ).toBe('list');
  });

  test('disconnected when Docker is unreachable with empty list', () => {
    expect(getActiveContext({ disconnected: true })).toBe('disconnected');
  });

  test('wizard wins over disconnected', () => {
    expect(
      getActiveContext({ creatingContainer: true, disconnected: true })
    ).toBe('wizard');
  });

  test('disconnected wins over list', () => {
    expect(
      getActiveContext({ disconnected: true, creatingContainer: false })
    ).toBe('disconnected');
  });
});

describe('getBindings — filters and sorts', () => {
  test('filters out bindings where when() returns false', () => {
    const bindings = getBindings('list', { hasSelection: false });
    const ids = bindings.map((b) => b.id);
    expect(ids).not.toContain('container.start');
    expect(ids).not.toContain('container.stop');
    expect(ids).toContain('container.create');
  });

  test('includes bindings where when() returns true', () => {
    const bindings = getBindings('list', { hasSelection: true });
    const ids = bindings.map((b) => b.id);
    expect(ids).toContain('container.start');
    expect(ids).toContain('container.stop');
  });

  test('sorts by priority descending', () => {
    const bindings = getBindings('list', { hasSelection: true });
    const priorities = bindings.map((b) => b.priority ?? 50);
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeLessThanOrEqual(priorities[i - 1]);
    }
  });
});

describe('resolveKey — maps keypress to binding', () => {
  test('resolves i to container.start in list context', () => {
    const binding = resolveKey('list', 'i', {}, { hasSelection: true });
    expect(binding).not.toBeNull();
    expect(binding.id).toBe('container.start');
  });

  test('returns null for unmapped key', () => {
    const binding = resolveKey('list', 'z', {}, {});
    expect(binding).toBeNull();
  });

  test('resolves up arrow to nav.up', () => {
    const binding = resolveKey('list', '', { upArrow: true }, {});
    expect(binding).not.toBeNull();
    expect(binding.id).toBe('nav.up');
  });

  test('resolves escape in logs context to logs.close', () => {
    const binding = resolveKey('logs', '', { escape: true }, {});
    expect(binding).not.toBeNull();
    expect(binding.id).toBe('logs.close');
  });
});

describe('keyNameOf — normalizes Ink keys', () => {
  test('returns "up" for upArrow', () => {
    expect(keyNameOf('', { upArrow: true })).toBe('up');
  });

  test('returns "down" for downArrow', () => {
    expect(keyNameOf('', { downArrow: true })).toBe('down');
  });

  test('returns "escape" for escape', () => {
    expect(keyNameOf('', { escape: true })).toBe('escape');
  });

  test('returns "enter" for return', () => {
    expect(keyNameOf('', { return: true })).toBe('enter');
  });

  test('returns "enter" for \\r', () => {
    expect(keyNameOf('\r', {})).toBe('enter');
  });

  test('returns "tab" for tab', () => {
    expect(keyNameOf('', { tab: true })).toBe('tab');
  });

  test('returns "backspace" for delete', () => {
    expect(keyNameOf('', { delete: true })).toBe('backspace');
  });

  test('returns ctrl+w for ctrl+w', () => {
    expect(keyNameOf('w', { ctrl: true })).toBe('ctrl+w');
  });

  test('returns plain input for regular key', () => {
    expect(keyNameOf('i', {})).toBe('i');
  });
});

describe('KEYMAP integrity — no duplicate keys per context', () => {
  const contexts = Object.keys(KEYMAP);

  test.each(contexts)('context "%s" has no duplicate key names', (ctx) => {
    const bindings = KEYMAP[ctx];

    // Unconditional (always-active) bindings must have unique keys: they are
    // always resolved, so a collision there is genuinely ambiguous.
    const unconditional = bindings.filter((b) => !b.when);
    const unconditionalKeys = unconditional.flatMap((b) => b.keys);
    expect(new Set(unconditionalKeys).size).toBe(unconditionalKeys.length);

    // A `when`-guarded binding may share keys with OTHER guarded bindings
    // (their guards are mutually exclusive by UI state — e.g. the launcher's
    // Enter/Esc per status), but never with an unconditional binding.
    const unconditionalKeySet = new Set(unconditionalKeys);
    for (const binding of bindings) {
      if (!binding.when) continue;
      for (const key of binding.keys) {
        expect(unconditionalKeySet.has(key)).toBe(false);
      }
    }
  });
});

describe('KEYMAP — coverage gaps', () => {
  test.each([
    'wizard-discard',
    'wizard-review',
    'confirm-quit',
    'disconnected',
    'debug',
    'confirm',
  ])('context %s has bindings', (ctx) => {
    expect(getBindings(ctx, {}).length).toBeGreaterThan(0);
  });

  test('Tab exists in the wizard and only on steps 0 and 3', () => {
    expect(getBindings('wizard', { wizardStep: 0 }).map((b) => b.id)).toContain(
      'wizard.tab'
    );
    expect(getBindings('wizard', { wizardStep: 3 }).map((b) => b.id)).toContain(
      'wizard.tab'
    );
    expect(
      getBindings('wizard', { wizardStep: 1 }).map((b) => b.id)
    ).not.toContain('wizard.tab');
  });

  test('every binding has id, keys and label', () => {
    for (const b of Object.values(KEYMAP).flat()) {
      expect(b.id).toBeTruthy();
      expect(Array.isArray(b.keys) && b.keys.length).toBeTruthy();
      expect(b.label).toBeTruthy();
    }
  });

  test('getActiveContext resolves the discard, review and quit contexts', () => {
    expect(getActiveContext({ creatingContainer: true, wizardStep: 4 })).toBe(
      'wizard-review'
    );
    expect(
      getActiveContext({ creatingContainer: true, confirmDiscard: true })
    ).toBe('wizard-discard');
    expect(getActiveContext({ confirmQuit: true })).toBe('confirm-quit');
  });
});

describe('keymap ↔ useControls handlers', () => {
  const src = fs.readFileSync(path.resolve('src/hooks/useControls.js'), 'utf8');
  const hasHandler = (id) => src.includes(`'${id}':`);

  // Control: the source scan finds handlers that do exist.
  test('scan finds existing handlers (logs.close, app.quit)', () => {
    expect(hasHandler('logs.close')).toBe(true);
    expect(hasHandler('app.quit')).toBe(true);
  });

  // §5.4 (D21) — fixed by TASK-10 (log viewer scroll).
  test.failing('every keymap binding has a handler in useControls', () => {
    const ids = [
      ...new Set(
        Object.values(KEYMAP)
          .flat()
          .map((b) => b.id)
      ),
    ];
    expect(ids.filter((id) => !hasHandler(id))).toEqual([]); // today: logs.up/down/pageup/pagedown/follow
  });
});

describe('the fix key (TASK-8)', () => {
  const state = { hasSelection: true, canFix: true };

  test('F opens the fix only when a fix is available', () => {
    const ids = getBindings('list', state).map((b) => b.id);
    expect(ids).toContain('container.fix');
    expect(
      getBindings('list', { ...state, canFix: false }).map((b) => b.id)
    ).not.toContain('container.fix');
  });

  test('F needs a selection', () => {
    expect(
      getBindings('list', { hasSelection: false, canFix: true }).map(
        (b) => b.id
      )
    ).not.toContain('container.fix');
  });

  test('both uppercase spellings resolve', () => {
    // keyNameOf() turns shift+f into 'shift+F', not 'F'.
    expect(resolveKey('list', 'F', { shift: true }, state).id).toBe(
      'container.fix'
    );
    expect(resolveKey('list', 'F', {}, state).id).toBe('container.fix');
  });

  test('lowercase f is left free for the filter TASK-9 adds', () => {
    expect(resolveKey('list', 'f', {}, state)).toBeNull();
  });

  test('the cleanup question only appears once asked', () => {
    const asked = getBindings('list', { confirmCleanup: true }).map(
      (b) => b.id
    );
    expect(asked).toContain('cleanup.delete');
    expect(asked).toContain('cleanup.keep');
    const idle = getBindings('list', { confirmCleanup: false }).map(
      (b) => b.id
    );
    expect(idle).not.toContain('cleanup.delete');
    expect(idle).not.toContain('cleanup.keep');
  });

  test('no binding repeats its own key as its label', () => {
    for (const [context, bindings] of Object.entries(KEYMAP)) {
      for (const b of bindings) {
        const shown = displayKeys(b.keys)[0];
        expect(`${context}/${b.id}: ${String(b.label).toLowerCase()}`).not.toBe(
          `${context}/${b.id}: ${String(shown).toLowerCase()}`
        );
        expect(String(b.label).trim()).not.toBe('');
      }
    }
  });

  test('the cleanup question is labelled Yes and No', () => {
    const byId = Object.fromEntries(
      getBindings('list', { confirmCleanup: true }).map((b) => [b.id, b])
    );
    expect(byId['cleanup.delete'].label).toBe('Yes');
    expect(byId['cleanup.keep'].label).toBe('No');
  });

  test('y and n answer the question rather than starting an erase', () => {
    const asked = { confirmCleanup: true };
    expect(resolveKey('list', 'y', {}, asked).id).toBe('cleanup.delete');
    expect(resolveKey('list', 'n', {}, asked).id).toBe('cleanup.keep');
    // Without the question, y does nothing at all: erasing needs 'e' + confirm.
    expect(resolveKey('list', 'y', {}, { confirmCleanup: false })).toBeNull();
  });

  test('the bindings added here all have handlers', () => {
    // The whole-keymap assertion belongs to D21 and stays test.failing until
    // TASK-10 adds the log scroll handlers. This one covers only what this
    // change introduced.
    const source = fs.readFileSync(
      path.resolve('src/hooks/useControls.js'),
      'utf8'
    );
    for (const id of ['container.fix', 'cleanup.delete', 'cleanup.keep']) {
      expect(source).toContain(`'${id}'`);
    }
  });
});

describe('the stop key (D24)', () => {
  // Mirrors the derivation useControls performs on the selected container, so
  // each state below reaches the keymap as the uiState the hook would hand it.
  // The derivation itself lives in useControls; what is pinned here is which
  // states the keymap reacts to.
  const NOT_STOPPABLE = ['exited', 'stopped', 'created'];
  const running = { hasSelection: true, canStop: true };
  const idsOf = (state) => getBindings('list', state).map((b) => b.id);
  const uiStateFor = (containerState) => ({
    hasSelection: true,
    canStop: !NOT_STOPPABLE.includes(containerState),
  });

  test('p stops a running container', () => {
    expect(idsOf(running)).toContain('container.stop');
    expect(resolveKey('list', 'p', {}, running).id).toBe('container.stop');
  });

  test.each(['exited', 'stopped', 'created'])(
    'p is not offered for a container that is %s',
    (containerState) => {
      expect(idsOf(uiStateFor(containerState))).not.toContain('container.stop');
      expect(
        resolveKey('list', 'p', {}, uiStateFor(containerState))
      ).toBeNull();
    }
  );

  test.each([true, false])(
    'p needs a selection whatever canStop says (%s)',
    (canStop) => {
      expect(idsOf({ hasSelection: false, canStop })).not.toContain(
        'container.stop'
      );
    }
  );

  test('the binding is unchanged apart from its guard', () => {
    const binding = KEYMAP.list.find((b) => b.id === 'container.stop');
    expect(binding.keys).toEqual(['p']);
    expect(binding.label).toBe('Stop');
    expect(binding.help).toBe('Stop the selected container');
    expect(binding.priority).toBe(85);
  });

  test('no canStop data keeps p available', () => {
    // Absent data means "not known to be unstoppable", never "stopped": a key
    // that vanishes wrongly would take stopping away, which no test flag can undo.
    expect(idsOf({ hasSelection: true })).toContain('container.stop');
    expect(idsOf({ hasSelection: true, canStop: undefined })).toContain(
      'container.stop'
    );
    expect(idsOf({ hasSelection: true, canStop: null })).toContain(
      'container.stop'
    );
  });

  test('the help panel for a stopped container does not list Stop', () => {
    // getBindings() is exactly what the help panel renders.
    const stopped = uiStateFor('exited');
    const helpContext = getActiveContext({ ...stopped, showHelp: false });
    const helpIds = getBindings(helpContext, stopped).map((b) => b.id);
    expect(helpIds).not.toContain('container.stop');
    // Only Stop goes: the rest of the container keys stay on offer.
    expect(helpIds).toContain('container.start');
    expect(helpIds).toContain('container.restart');
  });
});

describe('the sort key (TASK-9 PR C)', () => {
  const state = { hasSelection: true };

  test('O resolves with and without Shift, and plain o too', () => {
    // keyNameOf() turns shift+o into 'shift+O', not 'O', so both spellings
    // must be listed for one physical key. Plain lowercase 'o' is accepted as
    // well, so the key never depends on the user guessing they need Shift.
    expect(resolveKey('list', 'O', {}, state).id).toBe('sort.cycle');
    expect(resolveKey('list', 'O', { shift: true }, state).id).toBe(
      'sort.cycle'
    );
    expect(resolveKey('list', 'o', {}, state).id).toBe('sort.cycle');
  });

  test('the keys this change added have a handler in useControls', () => {
    // Scoped on purpose. Converting the whole-keymap `test.failing` above is
    // D21 (TASK-10): `app.search` and `sort.cycle` are what this change wires,
    // and `logs.up/down/pageup/pagedown/follow` are still D21's to add.
    const source = fs.readFileSync(
      path.resolve('src/hooks/useControls.js'),
      'utf8'
    );
    for (const id of ['app.search', 'sort.cycle']) {
      expect(source).toContain(`'${id}':`);
    }
  });
});

describe('the filter context (TASK-9 PR D)', () => {
  test('getActiveContext returns filter while the field is open', () => {
    expect(getActiveContext({ isFiltering: true })).toBe('filter');
  });

  test('filter sits above list but below confirm, help and logs', () => {
    expect(getActiveContext({ isFiltering: true, showLogs: true })).toBe(
      'logs'
    );
    expect(getActiveContext({ isFiltering: true, showHelp: true })).toBe(
      'help'
    );
    expect(getActiveContext({ isFiltering: true, confirmErase: true })).toBe(
      'confirm'
    );
    // Without the field, the list is still the fallback.
    expect(getActiveContext({ isFiltering: false })).toBe('list');
  });

  test('Enter and Esc resolve to filter.apply and filter.clear', () => {
    const state = { isFiltering: true };
    expect(resolveKey('filter', '', { return: true }, state).id).toBe(
      'filter.apply'
    );
    expect(resolveKey('filter', '', { escape: true }, state).id).toBe(
      'filter.clear'
    );
    // And nothing else: a character is text, not a binding.
    expect(resolveKey('filter', 'p', {}, state)).toBeNull();
  });

  test('the filter keys have handlers in useControls', () => {
    const source = fs.readFileSync(
      path.resolve('src/hooks/useControls.js'),
      'utf8'
    );
    for (const id of ['app.search', 'filter.apply', 'filter.clear']) {
      expect(source).toContain(`'${id}':`);
    }
  });
});
