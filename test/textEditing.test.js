import {
  applyKeyToText,
  insertAt,
  deleteBackward,
  deleteForward,
  wordStartBefore,
  wordStartAfter,
  textStateOf,
} from '../src/helpers/textEditing.js';

describe('textEditing', () => {
  describe('insertAt', () => {
    test('insert at end', () => {
      const s = insertAt({ value: 'abc', cursor: 3 }, 'd');
      expect(s).toEqual({ value: 'abcd', cursor: 4 });
    });

    test('insert at start', () => {
      const s = insertAt({ value: 'abc', cursor: 0 }, 'X');
      expect(s).toEqual({ value: 'Xabc', cursor: 1 });
    });

    test('insert in middle', () => {
      const s = insertAt({ value: 'abc', cursor: 1 }, 'X');
      expect(s).toEqual({ value: 'aXbc', cursor: 2 });
    });

    test('paste multi-char string', () => {
      const s = insertAt({ value: 'a', cursor: 1 }, 'bcdef');
      expect(s).toEqual({ value: 'abcdef', cursor: 6 });
    });

    test('empty text returns same state', () => {
      const state = { value: 'abc', cursor: 1 };
      const s = insertAt(state, '');
      expect(s).toBe(state);
    });
  });

  describe('deleteBackward', () => {
    test('backspace in middle', () => {
      const s = deleteBackward({ value: 'abc', cursor: 2 });
      expect(s).toEqual({ value: 'ac', cursor: 1 });
    });

    test('backspace at start returns same state', () => {
      const state = { value: 'abc', cursor: 0 };
      const s = deleteBackward(state);
      expect(s).toBe(state);
    });

    test('backspace at end', () => {
      const s = deleteBackward({ value: 'abc', cursor: 3 });
      expect(s).toEqual({ value: 'ab', cursor: 2 });
    });
  });

  describe('deleteForward', () => {
    test('delete under cursor', () => {
      const s = deleteForward({ value: 'abc', cursor: 1 });
      expect(s).toEqual({ value: 'ac', cursor: 1 });
    });

    test('delete at end returns same state', () => {
      const state = { value: 'abc', cursor: 3 };
      const s = deleteForward(state);
      expect(s).toBe(state);
    });
  });

  describe('wordStartBefore', () => {
    test('from end of "foo bar"', () => {
      expect(wordStartBefore('foo bar', 7)).toBe(4);
    });

    test('from start returns 0', () => {
      expect(wordStartBefore('foo bar', 0)).toBe(0);
    });

    test('from after a word (cursor on space)', () => {
      // cursor=5 is on the space; the word before is "hello" starting at 0
      expect(wordStartBefore('hello world', 5)).toBe(0);
    });

    test('from start of second word', () => {
      // cursor=6 is on 'w'; skip trailing space (i=5), then "hello" starts at 0
      expect(wordStartBefore('hello world', 6)).toBe(0);
    });
  });

  describe('wordStartAfter', () => {
    test('from start of "foo bar"', () => {
      expect(wordStartAfter('foo bar', 0)).toBe(4);
    });

    test('from end returns length', () => {
      expect(wordStartAfter('foo bar', 7)).toBe(7);
    });

    test('from middle of word', () => {
      expect(wordStartAfter('foobar baz', 3)).toBe(7);
    });
  });

  describe('textStateOf', () => {
    test('creates state with cursor at end', () => {
      expect(textStateOf('abc')).toEqual({ value: 'abc', cursor: 3 });
    });

    test('empty string', () => {
      expect(textStateOf('')).toEqual({ value: '', cursor: 0 });
    });

    test('default is empty', () => {
      expect(textStateOf()).toEqual({ value: '', cursor: 0 });
    });
  });

  describe('applyKeyToText', () => {
    describe('arrows', () => {
      test('left arrow moves cursor left', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 2 },
          '',
          { leftArrow: true }
        );
        expect(handled).toBe(true);
        expect(state.cursor).toBe(1);
      });

      test('left arrow at 0 stays at 0', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 0 },
          '',
          { leftArrow: true }
        );
        expect(handled).toBe(true);
        expect(state.cursor).toBe(0);
      });

      test('right arrow moves cursor right', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 1 },
          '',
          { rightArrow: true }
        );
        expect(handled).toBe(true);
        expect(state.cursor).toBe(2);
      });

      test('right arrow at end stays at end', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 3 },
          '',
          { rightArrow: true }
        );
        expect(handled).toBe(true);
        expect(state.cursor).toBe(3);
      });

      test('home goes to start', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 2 },
          '',
          { home: true }
        );
        expect(handled).toBe(true);
        expect(state.cursor).toBe(0);
      });

      test('end goes to end', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 1 },
          '',
          { end: true }
        );
        expect(handled).toBe(true);
        expect(state.cursor).toBe(3);
      });
    });

    describe('backspace', () => {
      test('backspace in middle', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 2 },
          '',
          { backspace: true }
        );
        expect(handled).toBe(true);
        expect(state).toEqual({ value: 'ac', cursor: 1 });
      });

      test('backspace at 0', () => {
        const state = { value: 'abc', cursor: 0 };
        const result = applyKeyToText(state, '', { backspace: true });
        expect(result.handled).toBe(true);
        expect(result.state).toBe(state);
      });

      test('\\x7f input treated as backspace', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 2 },
          '\x7f',
          {}
        );
        expect(handled).toBe(true);
        expect(state).toEqual({ value: 'ac', cursor: 1 });
      });

      test('\\b input treated as backspace', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 2 },
          '\b',
          {}
        );
        expect(handled).toBe(true);
        expect(state).toEqual({ value: 'ac', cursor: 1 });
      });

      test('\\x7f at end deletes last char', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 3 },
          '\x7f',
          {}
        );
        expect(handled).toBe(true);
        expect(state).toEqual({ value: 'ab', cursor: 2 });
      });

      test('\\x7f at start is no-op', () => {
        const state = { value: 'abc', cursor: 0 };
        const result = applyKeyToText(state, '\x7f', {});
        expect(result.handled).toBe(true);
        expect(result.state).toBe(state);
      });
    });

    describe('delete', () => {
      test('delete under cursor', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 1 },
          '',
          { delete: true }
        );
        expect(handled).toBe(true);
        expect(state).toEqual({ value: 'ac', cursor: 1 });
      });

      test('delete at end', () => {
        const state = { value: 'abc', cursor: 3 };
        const result = applyKeyToText(state, '', { delete: true });
        expect(result.handled).toBe(true);
        expect(result.state).toBe(state);
      });
    });

    describe('text input', () => {
      test('insert char at end', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 3 },
          'd',
          {}
        );
        expect(handled).toBe(true);
        expect(state).toEqual({ value: 'abcd', cursor: 4 });
      });

      test('insert char in middle', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 1 },
          'X',
          {}
        );
        expect(handled).toBe(true);
        expect(state).toEqual({ value: 'aXbc', cursor: 2 });
      });

      test('paste multi-char', () => {
        const { state, handled } = applyKeyToText(
          { value: 'a', cursor: 1 },
          'bcdef',
          {}
        );
        expect(handled).toBe(true);
        expect(state).toEqual({ value: 'abcdef', cursor: 6 });
      });
    });

    describe('ctrl/meta combos', () => {
      test('Ctrl+A goes to start', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 2 },
          'a',
          { ctrl: true }
        );
        expect(handled).toBe(true);
        expect(state.cursor).toBe(0);
      });

      test('Ctrl+E goes to end', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 1 },
          'e',
          { ctrl: true }
        );
        expect(handled).toBe(true);
        expect(state.cursor).toBe(3);
      });

      test('Ctrl+W deletes word before cursor', () => {
        const { state, handled } = applyKeyToText(
          { value: 'foo bar', cursor: 7 },
          'w',
          { ctrl: true }
        );
        expect(handled).toBe(true);
        expect(state).toEqual({ value: 'foo ', cursor: 4 });
      });

      test('Ctrl+U deletes from start to cursor', () => {
        const { state, handled } = applyKeyToText(
          { value: 'hello', cursor: 3 },
          'u',
          { ctrl: true }
        );
        expect(handled).toBe(true);
        // cursor=3 → after='lo', delete before → 'lo'
        expect(state).toEqual({ value: 'lo', cursor: 0 });
      });

      test('Ctrl+K deletes from cursor to end', () => {
        const { state, handled } = applyKeyToText(
          { value: 'hello', cursor: 2 },
          'k',
          { ctrl: true }
        );
        expect(handled).toBe(true);
        expect(state).toEqual({ value: 'he', cursor: 2 });
      });

      test('unknown ctrl combo returns handled: false', () => {
        const state = { value: 'abc', cursor: 1 };
        const result = applyKeyToText(state, 'x', { ctrl: true });
        expect(result.handled).toBe(false);
        expect(result.state).toBe(state);
      });

      test('meta key returns handled: false', () => {
        const state = { value: 'abc', cursor: 1 };
        const result = applyKeyToText(state, 'a', { meta: true });
        expect(result.handled).toBe(false);
        expect(result.state).toBe(state);
      });
    });

    describe('unhandled keys', () => {
      test('up arrow returns handled: false', () => {
        const state = { value: 'abc', cursor: 1 };
        const result = applyKeyToText(state, '', { upArrow: true });
        expect(result.handled).toBe(false);
        expect(result.state).toBe(state);
      });

    test('enter returns handled: false', () => {
      const state = { value: 'abc', cursor: 1 };
      const result = applyKeyToText(state, '\r', {});
      // Enter is a control character — must NOT be inserted as text.
      // The caller (useControls) routes it to wizard.next instead.
      expect(result.handled).toBe(false);
      expect(result.state.value).toBe('abc');
    });
    });

    describe('cursor bounds', () => {
      test('cursor never goes below 0', () => {
        let state = { value: 'abc', cursor: 0 };
        for (let i = 0; i < 5; i++) {
          const result = applyKeyToText(state, '', { leftArrow: true });
          state = result.state;
        }
        expect(state.cursor).toBe(0);
      });

      test('cursor never exceeds length', () => {
        let state = { value: 'abc', cursor: 3 };
        for (let i = 0; i < 5; i++) {
          const result = applyKeyToText(state, '', { rightArrow: true });
          state = result.state;
        }
        expect(state.cursor).toBe(3);
      });
    });

    describe('emojis and accents', () => {
      test('cursor moves over accented chars correctly', () => {
        const { state } = applyKeyToText(
          { value: 'áéíóú', cursor: 0 },
          '',
          { rightArrow: true }
        );
        expect(state.cursor).toBe(1);
        expect(state.value.slice(0, 1)).toBe('á');
      });

      test('insert around accented char', () => {
        const { state } = applyKeyToText(
          { value: 'ábc', cursor: 1 },
          'X',
          {}
        );
        expect(state.value).toBe('áXbc');
        expect(state.cursor).toBe(2);
      });

      test('backspace before emoji', () => {
        const emoji = '🚀';
        const { state } = applyKeyToText(
          { value: `a${emoji}b`, cursor: 2 },
          '',
          { backspace: true }
        );
        expect(state.value).toBe('ab');
        expect(state.cursor).toBe(1);
      });

      test('delete after emoji', () => {
        const emoji = '🚀';
        const { state } = applyKeyToText(
          { value: `a${emoji}b`, cursor: 2 },
          '',
          { delete: true }
        );
        expect(state.value).toBe(`a${emoji}`);
        expect(state.cursor).toBe(2);
      });
    });

    describe('control characters', () => {
      test('Enter (\\r) is not inserted as text', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 3 },
          '\r',
          { return: true }
        );
        expect(handled).toBe(false);
        expect(state.value).toBe('abc');
      });

      test('newline (\\n) is not inserted as text', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 3 },
          '\n',
          {}
        );
        expect(handled).toBe(false);
        expect(state.value).toBe('abc');
      });

      test('tab (\\t) is not inserted as text', () => {
        const { state, handled } = applyKeyToText(
          { value: 'abc', cursor: 3 },
          '\t',
          { tab: true }
        );
        expect(handled).toBe(false);
        expect(state.value).toBe('abc');
      });
    });
  });
});
