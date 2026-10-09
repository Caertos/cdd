import { render } from 'ink-testing-library';

/** Byte sequences a real terminal sends; these are the ones Ink knows how to parse. */
export const KEY = {
  enter: '\r',
  escape: '\u001b',
  tab: '\t',
  backspace: '\u007f',
  up: '\u001b[A',
  down: '\u001b[B',
  left: '\u001b[D',
  right: '\u001b[C',
  pageUp: '\u001b[5~',
  pageDown: '\u001b[6~',
  ctrlG: '\u0007',
  ctrlR: '\u0012',
};

// ANSI escape-sequence stripper (strip-ansi equivalent).
const ANSI =
  // eslint-disable-next-line no-control-regex
  /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

export const stripAnsi = (s) => String(s ?? '').replace(ANSI, '');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Renders an Ink element and returns a driver with keyboard input and waits.
 * Remember to call `unmount()` in afterEach: App keeps intervals alive
 * (useContainers every 3 s, useSharedContainerStats every 1.5 s).
 */
export function renderApp(element) {
  const instance = render(element);

  const driver = {
    ...instance,

    /** Current frame, without ANSI codes. */
    frame: () => stripAnsi(instance.lastFrame()),

    /** Every rendered frame — useful for debugging a failure. */
    history: () => instance.frames.map(stripAnsi),

    /**
     * Sends raw keys: `await press(KEY.down, KEY.enter)`.
     * Async on purpose: every key gets a settle delay so React re-renders
     * before the next input, and ESC is given extra time because Ink holds a
     * lone escape byte "pending" for ~20 ms (its escape-flush timer) before
     * emitting it. Without the delay, Esc followed immediately by another key
     * is merged into a single escape sequence.
     */
    async press(...keys) {
      for (const k of keys) {
        instance.stdin.write(k);
        await delay(k === KEY.escape ? 40 : 25);
      }
      return driver;
    },

    /**
     * Types character by character (like a person). Needed because step 0
     * recalculates suggestions on every keystroke.
     */
    async type(text, { perKeyDelay = 15 } = {}) {
      for (const ch of text) {
        instance.stdin.write(ch);
        await delay(perKeyDelay);
      }
      return driver;
    },

    /** Waits until the predicate holds over the frame. */
    async waitFor(predicate, opts = {}) {
      const { timeout = 15000, interval = 50, label = 'the condition' } = opts;
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        if (predicate(driver.frame())) return driver.frame();
        await delay(interval);
      }
      throw new Error(
        `Timed out waiting for ${label} after ${timeout} ms.\nLast frame:\n${driver.frame()}`
      );
    },

    /** Waits for a piece of text to appear in the frame. */
    waitForText(needle, opts = {}) {
      return driver.waitFor((f) => f.includes(needle), {
        ...opts,
        label: `the text "${needle}"`,
      });
    },

    /** Waits for a piece of text to disappear from the frame. */
    waitForTextGone(needle, opts = {}) {
      return driver.waitFor((f) => !f.includes(needle), {
        ...opts,
        label: `"${needle}" to disappear`,
      });
    },
  };

  return driver;
}
