# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
