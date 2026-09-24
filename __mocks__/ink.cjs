const React = require('react');
exports.Box = ({ children, ...props }) =>
  React.createElement('div', { ...props }, children);
exports.Text = ({ children, color }) =>
  React.createElement('span', { 'data-color': color }, children);

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
