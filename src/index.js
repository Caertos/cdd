#!/usr/bin/env node
/**
 * Entry point for the CDD CLI application.
 *
 * @module index
 * @example
 * // Run the CLI
 * node index.js
 */

import React from 'react';
import { render } from 'ink';
import App from './App.jsx';
import { logger } from './helpers/logger.js';

process.on('uncaughtException', (err) => logger.error('Uncaught exception', err));
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', reason));

console.clear();
render(<App />);
