// Minimal test setup for React/DOM environment
// Could add more global matchers here
import '@testing-library/jest-dom';

// Silence act() warnings in environments where receiver isn't concurrent
// (react-test-renderer/act warnings are printed, but tests can proceed)
// If needed, configure global helpers here.
