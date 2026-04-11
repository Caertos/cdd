# Contributing to CDD-CLI

Thanks for your interest in contributing! Here are the guidelines to make collaboration smooth.

## Getting started

1. Fork the repo and create a branch for your feature or fix:

```bash
git checkout -b feat/my-feature
```

2. Install dependencies and verify everything works before making changes:

```bash
npm install
npm test
npm run build
```

## Guidelines

- Keep changes small and focused — one concern per PR.
- Write tests for any new behavior and ensure existing tests pass (`npm test`).
- Run `npm run build` and verify the CLI starts (`node dist/index.js`) before opening a PR.
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.
- For large or design-changing contributions, open an issue first to discuss the approach.

## Opening a Pull Request

- Describe the motivation and what changed.
- Link any related issues.
- Tag reviewers if applicable.

We appreciate clear, well-tested contributions.
