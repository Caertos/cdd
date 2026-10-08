/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useContainerSelection } from '../src/hooks/navigation/useContainerSelection.js';

// A fresh list on every render, like Docker replacing it wholesale.
const list = () => [
  { id: 'a', name: 'alpha' },
  { id: 'b', name: 'bravo' },
  { id: 'c', name: 'charlie' },
];

describe('useContainerSelection', () => {
  test('down and up move the selection', () => {
    const { result } = renderHook(() => useContainerSelection(list()));
    act(() => {
      result.current.move(1);
    });
    expect(result.current.selectedIndex).toBe(1);
    expect(result.current.selectedId).toBe('b');
    act(() => {
      result.current.move(-1);
    });
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.selectedId).toBe('a');
  });

  test('wraps around at both ends', () => {
    const { result } = renderHook(() => useContainerSelection(list()));
    act(() => {
      result.current.move(-1);
    });
    expect(result.current.selectedIndex).toBe(2);
    expect(result.current.selectedId).toBe('c');
    act(() => {
      result.current.move(1);
    });
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.selectedId).toBe('a');
  });

  test('an empty list consumes nothing and has no selection', () => {
    const { result } = renderHook(() => useContainerSelection([]));
    act(() => {
      result.current.move(1);
    });
    expect(result.current.selectedIndex).toBe(-1);
    expect(result.current.selectedId).toBeNull();
    expect(result.current.selectedContainer).toBeNull();
  });

  test('only an explicit selectId moves the selection', () => {
    const { result } = renderHook(() => useContainerSelection(list()));
    act(() => {
      result.current.selectId('c');
    });
    expect(result.current.selectedIndex).toBe(2);
    expect(result.current.selectedId).toBe('c');
    // An id that is not in the list changes nothing at all. Clearing the
    // anchor would drop the selection back to the top, and storing the
    // dangling id would let it derive to the vacated slot: either way the
    // highlight lands on a container nobody picked.
    act(() => {
      result.current.selectId('z');
    });
    expect(result.current.selectedId).toBe('c');
    expect(result.current.selectedIndex).toBe(2);
  });
});

// Docker hands over a brand-new array every few seconds, so "the list changed"
// is the normal case, not an event. Everything below is the fence for defect
// D8: an index-anchored selection silently jumped to a different container
// whenever one disappeared, and in a long list that is a route to pressing `E`
// on a container the user never picked.
describe('useContainerSelection anchored to the container id', () => {
  // A subset of `list()` built as a fresh array, like the polling layer does.
  const subset = (...ids) => list().filter((item) => ids.includes(item.id));
  // The same containers, in another order.
  const inOrder = (...ids) => ids.map((id) => list().find((c) => c.id === id));

  /**
   * `lostSelection` is true for exactly one commit, and `act` flushes that
   * commit before it returns. A log of what every render saw is the only place
   * the pulse is observable, so the tests below read the log, not the flag.
   */
  const renderLoggingPulse = (items) => {
    const pulses = [];
    const hook = renderHook(
      ({ items: current }) => {
        const value = useContainerSelection(current);
        pulses.push(value.lostSelection);
        return value;
      },
      { initialProps: { items } }
    );
    return { ...hook, pulses };
  };

  test('keeps the selection when a container above it is erased', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useContainerSelection(items),
      { initialProps: { items: list() } }
    );
    act(() => {
      result.current.selectId('b');
    });
    expect(result.current.selectedIndex).toBe(1);

    // `a` is gone, so `b` slid up into slot 0. The index-anchored hook this
    // replaces answered `c` here: same slot, container nobody picked, and the
    // next keypress would have acted on it. That is defect D8.
    rerender({ items: subset('b', 'c') });
    expect(result.current.selectedId).toBe('b');
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.selectedContainer.id).toBe('b');
  });

  test('reordering the list does not lose the selection', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useContainerSelection(items),
      { initialProps: { items: list() } }
    );
    act(() => {
      result.current.selectId('c');
    });
    expect(result.current.selectedIndex).toBe(2);

    // Nothing was lost, only moved: a rotation must not cost the user the
    // container they were looking at.
    rerender({ items: inOrder('c', 'a', 'b') });
    expect(result.current.selectedId).toBe('c');
    expect(result.current.selectedIndex).toBe(0);
  });

  test('a brand-new array with identical contents keeps the selection', () => {
    const before = list();
    const { result, rerender } = renderHook(
      ({ items }) => useContainerSelection(items),
      { initialProps: { items: before } }
    );
    act(() => {
      result.current.selectId('b');
    });

    // A poll that changed nothing still hands over a different array. If any
    // part of the anchor keyed off array identity, three seconds of polling
    // would reset the selection under the user's hands.
    const after = list();
    expect(after).not.toBe(before);
    expect(after).toEqual(before);
    rerender({ items: after });
    expect(result.current.selectedId).toBe('b');
    expect(result.current.selectedIndex).toBe(1);
  });

  test('losing the selection lands on the neighbour in its slot', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useContainerSelection(items),
      { initialProps: { items: list() } }
    );
    act(() => {
      result.current.selectId('c');
    });

    // The anchored container is gone, so nothing can keep the highlight where
    // the user left it. It falls on whatever slid into the vacated slot:
    // min(2, 2 - 1) = 1, which is `b`, the closest thing to what was picked.
    rerender({ items: subset('a', 'b') });
    expect(result.current.selectedId).toBe('b');
    expect(result.current.selectedIndex).toBe(1);
  });

  test('losing the last containers never goes out of range', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useContainerSelection(items),
      { initialProps: { items: list() } }
    );
    act(() => {
      result.current.selectId('c');
    });

    rerender({ items: subset('a', 'b') });
    expect(result.current.selectedIndex).toBe(1);

    // Shrinking below the stored slot: min(1, 1 - 1) = 0, not slot 1, which
    // would be `undefined` and would hand a null container to the layers below.
    rerender({ items: subset('a') });
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.selectedId).toBe('a');

    // Emptying the list is the only case with no selection at all, and the
    // selection must not resurrect itself against an empty list.
    rerender({ items: [] });
    expect(result.current.selectedIndex).toBe(-1);
    expect(result.current.selectedId).toBeNull();
    expect(result.current.selectedContainer).toBeNull();
  });

  test('lostSelection pulses once and is not left stuck', () => {
    const { result, rerender, pulses } = renderLoggingPulse(list());
    act(() => {
      result.current.selectId('c');
    });
    pulses.length = 0;

    // `c` vanished and the selection moved to `b`, so the pulse has to be
    // visible to whatever warns the user.
    rerender({ items: subset('a', 'b') });
    expect(pulses).toContain(true);
    expect(result.current.selectedId).toBe('b');

    // It must not stick: the hook re-anchors itself on `b`, so a further poll
    // that loses a container again starts from a clean `false` and can pulse
    // again. A held flag would silence every warning after the first loss.
    expect(result.current.lostSelection).toBe(false);
    rerender({ items: subset('a', 'b') });
    expect(result.current.lostSelection).toBe(false);
    rerender({ items: subset('a') });
    expect(result.current.lostSelection).toBe(false);
    expect(result.current.selectedId).toBe('a');
  });

  test('lostSelection does not pulse when another container vanishes', () => {
    const { result, rerender, pulses } = renderLoggingPulse(list());
    act(() => {
      result.current.selectId('b');
    });
    pulses.length = 0;

    // The common case, and the whole point of anchoring by id: something above
    // the selection went away and the selection did not move, so there is
    // nothing to warn about.
    rerender({ items: subset('b', 'c') });
    expect(pulses).not.toContain(true);
    expect(result.current.lostSelection).toBe(false);
    expect(result.current.selectedId).toBe('b');
  });

  test('lostSelection does not pulse when the list reorders', () => {
    const { result, rerender, pulses } = renderLoggingPulse(list());
    act(() => {
      result.current.selectId('c');
    });
    pulses.length = 0;

    // The slot changed, the container did not. Warning here would train the
    // user to ignore the warning.
    rerender({ items: inOrder('c', 'a', 'b') });
    expect(pulses).not.toContain(true);
    expect(result.current.lostSelection).toBe(false);
    expect(result.current.selectedId).toBe('c');
  });

  test('first paint selects the top of the list', () => {
    // Long-standing behaviour: nothing chosen yet means the top is selected.
    // Anchoring by id must not regress it into "no selection until you press
    // a key".
    const { result } = renderHook(() => useContainerSelection(list()));
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.selectedId).toBe('a');
    expect(result.current.lostSelection).toBe(false);
    // The deprecated positional alias stays the same number, not a second
    // source of truth that can drift from `selectedIndex`.
    expect(result.current.selected).toBe(result.current.selectedIndex);
  });

  test('a list that arrives after being empty selects the top', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useContainerSelection(items),
      { initialProps: { items: [] } }
    );
    expect(result.current.selectedIndex).toBe(-1);

    // Docker reporting containers for the first time is not a loss of a
    // selection, so the pulse must stay quiet and the top must be selected.
    rerender({ items: list() });
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.selectedId).toBe('a');
    expect(result.current.lostSelection).toBe(false);
  });

  test('an empty list has no selection at all', () => {
    const { result } = renderHook(() => useContainerSelection([]));
    expect(result.current.selectedIndex).toBe(-1);
    expect(result.current.selected).toBe(-1);
    expect(result.current.selectedContainer).toBeNull();
    expect(result.current.selectedId).toBeNull();
  });

  test('selectId with an unknown id changes nothing', () => {
    const { result, rerender } = renderHook(
      ({ items }) => useContainerSelection(items),
      { initialProps: { items: list() } }
    );
    act(() => {
      result.current.selectId('c');
    });
    act(() => {
      result.current.selectId('zzz');
    });
    expect(result.current.selectedId).toBe('c');
    expect(result.current.selectedIndex).toBe(2);
    expect(result.current.lostSelection).toBe(false);

    // Clearing the anchor was the rejected alternative: it would drop the
    // highlight back to the top of the list, the very jump this hook exists to
    // prevent. The anchor is left untouched instead, so it survives the next
    // poll with `c` still selected.
    rerender({ items: subset('a', 'c') });
    expect(result.current.selectedId).toBe('c');
    expect(result.current.selectedIndex).toBe(1);
  });

  test('move wraps at both ends onto a real container id', () => {
    const items = list();
    const { result } = renderHook(() => useContainerSelection(items));

    // From the top, up wraps to the bottom, and it must land on the container
    // at that slot rather than on a stale slot of a list that has since been
    // rebuilt.
    act(() => {
      result.current.move(-1);
    });
    expect(result.current.selectedIndex).toBe(2);
    expect(result.current.selectedId).toBe('c');
    expect(result.current.selectedContainer).toBe(items[2]);

    // From the bottom, down wraps back to the top.
    act(() => {
      result.current.move(1);
    });
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.selectedId).toBe('a');
    expect(result.current.selectedContainer).toBe(items[0]);
  });

  test('move on an empty list does nothing', () => {
    const { result } = renderHook(() => useContainerSelection([]));
    // No modulo by zero, and no anchor written from a list with no slot to
    // anchor to: the empty list has to stay inert.
    act(() => {
      result.current.move(1);
    });
    act(() => {
      result.current.move(-1);
    });
    act(() => {
      result.current.move(5);
    });
    expect(result.current.selectedIndex).toBe(-1);
    expect(result.current.selectedId).toBeNull();
    expect(result.current.selectedContainer).toBeNull();
  });

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['an object', {}],
    ['a string', 'abc'],
    ['a number', 42],
  ])('a non-array items value (%s) has no selection', (_label, items) => {
    // A torn-down container source can hand over anything at all. It must not
    // throw and must not invent a selection out of a non-list.
    const { result } = renderHook(() => useContainerSelection(items));
    expect(result.current.selectedIndex).toBe(-1);
    expect(result.current.selectedContainer).toBeNull();
    expect(result.current.selectedId).toBeNull();
    act(() => {
      result.current.move(1);
    });
    act(() => {
      result.current.selectId('a');
    });
    expect(result.current.selectedIndex).toBe(-1);
  });

  test('an item without an id cannot be selected by id', () => {
    // A malformed entry from the source must not break the derivation.
    const items = () => [
      { id: 'a', name: 'alpha' },
      { name: 'ghost' },
      { id: 'b', name: 'bravo' },
    ];
    const { result } = renderHook(() => useContainerSelection(items()));
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.selectedId).toBe('a');

    // There is no id to ask for.
    act(() => {
      result.current.selectId('ghost');
    });
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.selectedId).toBe('a');

    // Not even the id-less item's implicit `undefined` can claim the anchor:
    // the id-less container can never hold the highlight.
    act(() => {
      result.current.selectId(undefined);
    });
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.selectedContainer.id).toBe('a');
    expect(result.current.lostSelection).toBe(false);

    // Its neighbours are unaffected.
    act(() => {
      result.current.selectId('b');
    });
    expect(result.current.selectedIndex).toBe(2);
    expect(result.current.selectedId).toBe('b');
  });

  test('move steps over an item that cannot be identified', () => {
    // An item with no id cannot hold the anchor. Stopping on it would write a
    // null id, which the derivation reads as "nothing ever chosen" and sends
    // the highlight back to the top — leaving a malformed row that the user
    // can never walk past. Stepping over it keeps the list navigable.
    const items = () => [
      { id: 'a', name: 'alpha' },
      { name: 'ghost' },
      { id: 'b', name: 'bravo' },
    ];
    const { result } = renderHook(() => useContainerSelection(items()));
    expect(result.current.selectedId).toBe('a');

    // Down from 'a' lands on 'b': the id-less slot in between is skipped.
    act(() => {
      result.current.move(1);
    });
    expect(result.current.selectedId).toBe('b');
    expect(result.current.selectedIndex).toBe(2);

    // And back up the same way.
    act(() => {
      result.current.move(-1);
    });
    expect(result.current.selectedId).toBe('a');
    expect(result.current.selectedIndex).toBe(0);
  });

  test('a list with nothing selectable keeps the selection where it was', () => {
    // No item carries an id, so there is nowhere to anchor. The anchor is left
    // untouched rather than nulled, because a null id reads as "nothing was
    // ever chosen" and would collapse the derivation to the top of the list.
    const items = [{ name: 'one' }, { name: 'two' }];
    const { result } = renderHook(() => useContainerSelection(items));
    expect(result.current.selectedIndex).toBe(0);
    act(() => {
      result.current.move(1);
    });
    act(() => {
      result.current.move(-1);
    });
    // Still derived, still inert, and no exception escaped the walk.
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.selectedContainer).not.toBeUndefined();
    expect(result.current.lostSelection).toBe(false);
  });
});
