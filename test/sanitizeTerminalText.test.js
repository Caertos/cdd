/**
 * @jest-environment node
 */
import {
  sanitizeTerminalText,
  sanitizedCursorIndex,
} from '../src/helpers/sanitizeTerminalText.js';

const ESC = '\u001b';
const BEL = '\u0007';
const CSI = `${ESC}[`;
const OSC = `${ESC}]`;
const ST = `${ESC}\\`;
/** The 8-bit heads: the same sequences with a shorter introducer. */
const C1_CSI = '\u009b';
const C1_OSC = '\u009d';

describe('sanitizeTerminalText — text that must survive untouched', () => {
  test('plain text is returned as it came in', () => {
    expect(sanitizeTerminalText('hello world')).toBe('hello world');
  });

  test('the characters an Ink tree would interpret are left alone', () => {
    // Ink escapes these itself; the sanitiser must not touch them.
    const text = 'a & b < c > d';
    expect(sanitizeTerminalText(text)).toBe(text);
  });

  test('accents and emoji are left alone', () => {
    const text = 'ñandú 🐳 café — ünïcodé';
    expect(sanitizeTerminalText(text)).toBe(text);
  });

  test('the controls that mean something in a line of text are kept', () => {
    expect(sanitizeTerminalText('a\tb')).toBe('a\tb');
  });

  test('a line feed is removed: it would break the line of the panel', () => {
    // A line feed in text CDD did not write would draw the rest of the text
    // as another line of the panel — a fake row, a fake prompt.
    expect(sanitizeTerminalText('safe\nFAKE ROW')).toBe('safeFAKE ROW');
  });

  test('a carriage return is removed: it would overwrite the line', () => {
    expect(sanitizeTerminalText('safe\rFAKE')).toBe('safeFAKE');
  });

  test('an empty string stays empty', () => {
    expect(sanitizeTerminalText('')).toBe('');
  });
});

describe('sanitizeTerminalText — ANSI sequences', () => {
  test('a colour sequence is removed and the words stay', () => {
    expect(sanitizeTerminalText(`${CSI}31mFAKE-RED${CSI}0m`)).toBe('FAKE-RED');
  });

  test('the screen wipe and the cursor home are removed', () => {
    expect(sanitizeTerminalText(`${CSI}2J${CSI}H`)).toBe('');
  });

  test('a sequence that only moves the cursor is removed', () => {
    expect(sanitizeTerminalText(`before${CSI}3;5Hafter`)).toBe('beforeafter');
  });

  test('the escape byte itself never survives', () => {
    const hostile = `${CSI}31mred${CSI}0m ${CSI}2J ${CSI}?25l`;
    expect(sanitizeTerminalText(hostile)).not.toContain(ESC);
  });

  test('a two-byte escape is removed', () => {
    // ESC c is RIS: it resets the whole terminal.
    expect(sanitizeTerminalText(`a${ESC}cb`)).toBe('ab');
  });

  test('a charset designation is removed whole', () => {
    // ESC ( B selects the ASCII charset.
    expect(sanitizeTerminalText(`a${ESC}(Bb`)).toBe('ab');
  });

  test('a lone escape at the end of the text is removed', () => {
    expect(sanitizeTerminalText(`text${ESC}`)).toBe('text');
  });
});

describe('sanitizeTerminalText — OSC sequences', () => {
  test('a hyperlink is removed whole and its text stays', () => {
    // The shape from the audit: a link that points at a phishing site.
    const hostile = `${OSC}8;;https://evil.example/pwned${ST}CLICK-ME${OSC}8;;${ST}`;
    expect(sanitizeTerminalText(hostile)).toBe('CLICK-ME');
  });

  test('a hyperlink closed with BEL is removed whole too', () => {
    const hostile = `${OSC}8;;https://evil.example${BEL}CLICK-ME${OSC}8;;${BEL}`;
    expect(sanitizeTerminalText(hostile)).toBe('CLICK-ME');
  });

  test('the url itself does not stay on screen as text', () => {
    const hostile = `${OSC}8;;https://evil.example/pwned${ST}CLICK-ME`;
    expect(sanitizeTerminalText(hostile)).not.toContain('evil.example');
  });

  test('a title change and a screen wipe are removed', () => {
    expect(
      sanitizeTerminalText(`${OSC}0;pwned-title${BEL}${CSI}2J${CSI}H`)
    ).toBe('');
  });

  test('an unterminated OSC takes the rest of the line with it', () => {
    // The terminal would still be inside the OSC, so the tail is its payload.
    expect(sanitizeTerminalText(`text${OSC}8;;https://evil.example`)).toBe('text');
  });
});

describe('sanitizeTerminalText — other control characters', () => {
  test('the bell is removed', () => {
    expect(sanitizeTerminalText(`ding${BEL}dong`)).toBe('dingdong');
  });

  test('the C0 controls that mean nothing are removed', () => {
    expect(sanitizeTerminalText('a\u0000b\u0001c\u007fd')).toBe('abcd');
  });

  test('DEL is removed', () => {
    expect(sanitizeTerminalText('a\u007fb')).toBe('ab');
  });

  test('the 8-bit CSI is removed with its sequence', () => {
    expect(sanitizeTerminalText(`${C1_CSI}31mred`)).toBe('red');
  });

  test('the 8-bit OSC is removed with its sequence', () => {
    expect(sanitizeTerminalText(`${C1_OSC}0;title${BEL}after`)).toBe('after');
  });

  test('the latin-1 shadow of a UTF-8 C1 byte goes with the control', () => {
    // 0xC2 0x9B read as latin-1 is 'Â' + 0x9B.
    expect(sanitizeTerminalText('Â\u009b31mred')).toBe('red');
  });
});

describe('sanitizeTerminalText — broken sequences', () => {
  test('an escape split across two chunks cannot execute', () => {
    // The head of the sequence arrives in one chunk and its tail in the next.
    // The ESC is dropped, so the tail is only ever text.
    const head = sanitizeTerminalText(`${CSI}3`);
    const tail = sanitizeTerminalText('1m');
    expect(head).not.toContain(ESC);
    expect(tail).not.toContain(ESC);
    expect(`${head}${tail}`).not.toContain(ESC);
  });

  test('a sequence inside the parameters of another one is removed', () => {
    expect(sanitizeTerminalText(`${CSI}31${CSI}1mred`)).toBe('red');
  });

  test('an escape inside an OSC ends the OSC and is handled on its own', () => {
    expect(sanitizeTerminalText(`${OSC}0;title${CSI}2Jafter`)).toBe('after');
  });
});

describe('sanitizeTerminalText — values that are not text', () => {
  test('null and undefined are returned unchanged, so a fallback still works', () => {
    expect(sanitizeTerminalText(null)).toBeNull();
    expect(sanitizeTerminalText(undefined)).toBeUndefined();
    // The idiom that depends on it: a missing name falls back to a label.
    const name = undefined;
    expect(`${name ?? 'Container'} logs`).toBe('Container logs');
  });

  test('a number or a boolean becomes its text form', () => {
    expect(sanitizeTerminalText(42)).toBe('42');
    expect(sanitizeTerminalText(8080)).toBe('8080');
    expect(sanitizeTerminalText(true)).toBe('true');
  });

  test('anything that is not text becomes an empty string', () => {
    expect(sanitizeTerminalText({})).toBe('');
    expect(sanitizeTerminalText([])).toBe('');
    expect(sanitizeTerminalText(() => {})).toBe('');
  });

  test('it never throws', () => {
    const inputs = [null, undefined, 0, NaN, '', {}, [], true];
    for (const input of inputs) {
      expect(() => sanitizeTerminalText(input)).not.toThrow();
    }
  });
});

describe('sanitizeTerminalText — properties', () => {
  const corpus = [
    'plain text',
    `${CSI}31mred${CSI}0m`,
    `${OSC}8;;https://evil.example${ST}CLICK-ME${OSC}8;;${ST}`,
    `${OSC}0;title${BEL}`,
    `a${ESC}cb`,
    `bell${BEL}done`,
    `${C1_CSI}31m8-bit`,
    `${C1_OSC}0;title${BEL}`,
    `unterminated ${OSC}8;;https://evil.example`,
    'mixed & <text> 🐳 with\nnewlines',
  ];

  test('it is idempotent', () => {
    for (const text of corpus) {
      const once = sanitizeTerminalText(text);
      expect(sanitizeTerminalText(once)).toBe(once);
    }
  });

  test('no control byte survives a pass', () => {
    for (const text of corpus) {
      const out = sanitizeTerminalText(text);
      expect(out).not.toContain(ESC);
      expect(out).not.toContain(BEL);
      // Only LF, CR and TAB may remain: the controls that mean something
      // inside a line of text.
      // eslint-disable-next-line no-control-regex
      expect(out.replace(/[\n\r\t]/g, '')).not.toMatch(
        /[\u0000-\u001f\u007f-\u009f]/
      );
    }
  });
});

describe('sanitizedCursorIndex — the cursor in the text the field shows', () => {
  test('a cursor in plain text keeps its position', () => {
    expect(sanitizedCursorIndex('hello', 3)).toBe(3);
  });

  test('a removed sequence shortens the distance to the cursor', () => {
    // The raw position 6 is just before the "B", which is the second
    // character of what the field shows.
    expect(sanitizedCursorIndex(`A${CSI}31mBCD`, 6)).toBe(1);
  });

  test('the cursor counts code points, not UTF-16 units', () => {
    // The editor that moves the cursor counts code points, so an emoji is
    // one character: the cursor must land on the same one.
    expect(sanitizedCursorIndex('\u{1F511}abc', 2)).toBe(2);
    // An emoji before a removed sequence: the raw position 6 is just before
    // the "a", which is the second character of what the field shows.
    expect(sanitizedCursorIndex(`\u{1F511}${CSI}31mab`, 6)).toBe(1);
  });

  test('a cursor outside the text is left alone', () => {
    expect(sanitizedCursorIndex('abc', -1)).toBe(-1);
    expect(sanitizedCursorIndex('abc', undefined)).toBeUndefined();
  });
});
