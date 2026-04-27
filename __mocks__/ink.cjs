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
