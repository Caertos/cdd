#!/usr/bin/env node
/**
 * Entry point for the CDD CLI application.
 *
 * @module index
 * @example
 * // Run the CLI
 * node index.js
 */

import React from "react";
import { render } from "ink";
import App from './App';

console.clear();
render(<App />);