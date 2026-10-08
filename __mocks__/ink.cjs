const React = require('react');
exports.Box = ({ children, ...props }) =>
  React.createElement('div', { ...props }, children);
exports.Text = ({ children, color, dimColor, inverse }) =>
  React.createElement(
    'span',
    // React drops boolean true on data-* attributes; coerce so tests can
    // assert <Text dimColor> (LogViewer's placeholder) and <Text inverse>
    // (TextField's cursor).
    {
      'data-color': color,
      'data-dim': dimColor === true ? 'true' : dimColor,
      'data-inverse': inverse === true ? 'true' : inverse,
    },
    children
  );

// Capture the last registered useInput handler so tests can simulate keypresses.
let _inputHandler = null;
exports.useInput = (fn) => { _inputHandler = fn; };
/** Simulate a keypress through the last registered useInput handler. */
exports.__triggerInput = (input, key = {}) => {
  if (_inputHandler) _inputHandler(input, key);
};
/** Reset captured handler between tests. */
exports.__resetInput = () => { _inputHandler = null; };

exports.useApp = () => ({ exit: () => {} });

// Non-TTY stdout under Jest: no measurable rows, but the shape real components
// expect (useTerminalHeight reads `.rows` and subscribes to `resize`).
exports.useStdout = () => ({
  stdout: { rows: undefined, on: () => {}, off: () => {} },
});

// Under ESM, named exports are validated at link time: this mock must export
// everything the app imports from 'ink', even if a test does not use it.
exports.Spacer = () => React.createElement('div', { 'data-spacer': true });
exports.Newline = () => React.createElement('br', null);
exports.Static = ({ children }) => React.createElement('div', null, children);
exports.render = () => ({
  unmount: () => {},
  rerender: () => {},
  clear: () => {},
  waitUntilExit: () => Promise.resolve(),
});
