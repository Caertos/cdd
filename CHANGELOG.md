# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]
- Nothing yet.

## [3.2.0] - 2026-04-25

### Added

- `IMAGE_PROFILES` map in `src/helpers/constants.js` — defines `requiredEnv` and `defaultPort` per image type (mysql, mariadb, postgres, mongo, mssql, redis).
- `DB_IMAGES` constant exported from `src/helpers/constants.js`.
- Contextual validation in wizard: if image matches a known profile, required env vars are enforced before creation.
- Auto-assigned port feedback: after successful container creation, the success message shows which ports were mapped (e.g. `Ports: 3306→3306/tcp`).
- Image name normalization: tags and registry prefixes are stripped before profile lookup (`mysql:8`, `docker.io/library/postgres:16` → `mysql`, `postgres`).
- New test files: `test/containerOptionsBuilder.test.js`, `test/useControls.dom.test.js`.

### Fixed

- `validateEnvVars()` was never called in the container creation wizard step 3 — now connected and blocks on invalid input.
- Env var parsing split on all `=` characters — fixed to split only on the first `=`, preserving values like `JWT=abc=def`.
- `dbImages` was hardcoded in `useControls.js` — now imports `DB_IMAGES` from constants.

## [3.1.9] - 2026-04-11

### Changed

- CI: added lint step to the test-and-build job; docs deploy now waits for CI to pass successfully via `workflow_run` trigger.

## [3.1.8] - 2026-04-11

### Refactored

- Removed dead code: `actionHelpers`, `useLogsStream`, and esbuild-related artifacts that were no longer in use.
- Consolidated Babel configuration into a single env-aware file, eliminating duplicate/split config files.
- Decomposed `useControls` god hook into focused single-responsibility hooks, each owning one concern.
- Extracted `useContainerStats` hook from `ContainerRow` to separate data-fetching from rendering.
- Set Jest default environment to `node`; `jsdom` is now opt-in per test file, reducing unnecessary DOM overhead.

### Changed

- Removed generated JSDoc output from the repository; added the generated docs directory to `.gitignore`.
- Enabled `react/prop-types` ESLint rule project-wide and resolved all resulting warnings.
- Rewrote `README.md` and `CONTRIBUTING.md`: consolidated overlapping content, removed duplication, and updated both for accuracy.
- Various `docs(style)` and `docs` commits between v3.1.5 and the refactor wave: dark theme, sticky nav, landing page rewrite, CSS consolidation, and English translation for the JSDoc home (GitHub Pages site).

## [3.1.5] - 2025-10-18
_Note: I'm sorry about the issues you've run into; this is a brand-new app and I'm still learning, but I'm moving as quickly as I can to deliver a quality experience._

### Added

- `safeCall` utility to safely invoke optional callbacks and avoid uncaught errors from consumer callbacks.
- PropTypes added to core React components for runtime prop validation (ContainerRow, ContainerList, LogViewer, StatsBar, ContainerCreationPrompt, PromptField, MessageFeedback, Header, ContainerSection).

### Changed

- Container creation now inspects image `EXPOSE` declarations and auto-binds ports when the user leaves the ports step empty, reusing the next free host port to avoid conflicts (e.g. second `nginx` gets `81:80`).
- CLI clears the terminal when starting and again after exiting with `q` for a cleaner shell experience.
- Replaced direct optional callback invocations and stream destruction calls with `safeCall` in several modules (`containerLogs`, `useLogsStream`, `useLogsViewer`, `useContainerCreation`, `useContainerActions`, `LogViewer`).
- ESLint config updated to include `jest` env and allow keeping `import React` for build compatibility.
- Extracted common magic numbers into `src/helpers/constants.js` and replaced hardcoded values across the codebase:
	- `REFRESH_INTERVALS.CONTAINER_LIST` (3000)
	- `REFRESH_INTERVALS.CONTAINER_STATS` (1500)
	- `MESSAGE_TIMEOUTS.SHORT` (2000) and `MESSAGE_TIMEOUTS.DEFAULT` (3000)
	- `EXIT_DELAY` (500)
	- `TIMEOUTS.CONTAINER_OP` (30000) and `TIMEOUTS.PULL_IMAGE` (300000)
- Files updated to use constants: `useContainers`, `ContainerRow`, `actionHelpers`, `useControls`, `exitWithMessage`, `containerActions`.

### Fixed

- Added unit tests for `safeCall` and adjusted several components to silence lint warnings (unused variables).
- Clamp `StatsBar` CPU/memory percentages to avoid negative repeat errors when streaming container stats (also refreshed component JSDoc to note the clamping).

### Testing

- Added additional unit tests for Docker service functions and hooks. All tests pass locally (5 suites, 26 tests).
- Removed generated `dist/` artifacts and deleted obsolete test files that referenced incompatible test helpers.

Incoming fixes and smaller tests / docs updates

## [3.1.4] - 2025-10-17

### Changed

- Documentation cleanup: translate `FIXES_APPLIED.md` to English, remove Spanish duplicate and references to internal audit doc.
- No functional code changes.

## [3.1.3] - 2025-10-17

### Fixed

- Addressed critical security and stability issues identified in internal audit.
- Improved Docker service components robustness (`containerActions`, `containerList`, `containerLogs`, `containerStats`).
- Strengthened validation helpers and extended unit tests.

### Added

- Documentation: `FIXES_APPLIED.md` summarizing analysis and mitigations.

### Changed

- Minor code refactors and clarifications across components and hooks.

## [3.1.2] - 2025-10-16

### Changed

- Docs cleanup: remove Spanish inline comments; add English JSDoc across source files.

## [3.1.0] - 2025-10-16

### Added

- Modularized hooks: `useContainerCreation`, `useContainerActions`, `useLogsViewer`.
- Validation helpers and unit tests for port validation.
- CI workflow (GitHub Actions) and README improvements.

### Changed

- Container creation UX: English feedback messages, mandatory/validated port input, DB image warnings.
- Added erase action (key `E`) with confirmation to delete containers.
- Normalized source imports to include explicit `.js`/`.jsx` extensions for ESM compatibility.

### Fixed

- Various runtime & build issues after modularization (import fixes, exposing container action functions, creation flow wiring).

## [3.1.1] - 2025-10-16

### Fixed

- Minor docs typo fixes and README global install note added.

