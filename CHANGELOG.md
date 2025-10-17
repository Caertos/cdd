# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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

## [Unreleased]

- Incoming fixes and smaller tests / docs updates

## [3.1.1] - 2025-10-16

### Fixed

- Minor docs typo fixes and README global install note added.

