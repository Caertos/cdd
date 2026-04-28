# CDD — CLI Docker Dashboard

<p align="center">
  <img src="https://img.shields.io/npm/v/cdd-cli?color=blue&label=npm%20package" alt="npm version"/>
  <img src="https://img.shields.io/npm/dt/cdd-cli?color=green&label=downloads" alt="npm downloads"/>
  <a href="https://github.com/caertos/cdd/actions/workflows/ci.yml">
    <img src="https://github.com/caertos/cdd/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" />
  </a>
  <a href="https://caertos.github.io/cdd/">
    <img src="https://img.shields.io/badge/docs-GitHub%20Pages-blue" alt="Docs" />
  </a>
  <a href="https://deepwiki.com/Caertos/cdd"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
</p>

> **A terminal dashboard for Docker containers — monitor, manage, and create, all without leaving your keyboard.**

---

## 🎉 What's new in v3.2

**v3.2 ships the interactive creation wizard — and it's a game changer.**

Forget `docker run` flags, forgotten env vars, and broken `:latest` tags. Press `C` and CDD guides you through creating a container in seconds:

- **20 curated image profiles** available offline — postgres, redis, nginx, node, mysql, mongo, and more
- **Smart default tags** that actually work: `postgres:17-alpine`, `redis:7-alpine`, `nginx:1.27-alpine` — no more silent `:latest` failures
- **Live Docker Hub search** with a single `Tab` keystroke — with a `[searching Docker Hub...]` indicator so you always know what's happening
- **Contextual env var hints** — creating a Postgres container? CDD suggests `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` automatically
- **Context-sensitive HUD** — only the keys that make sense right now are shown, nothing more

This is what developer experience should feel like.

---

## Features

- 🐳 Live view of all Docker containers with CPU/memory stats
- 🔄 Auto-refresh every few seconds — always up to date
- ⌨️ Keyboard-driven actions: start, stop, restart, log streaming, removal
- 🎨 Color-coded container states and visual feedback
- ✨ **Interactive creation wizard** — step-by-step container setup with curated profiles and live Hub search
- 🪵 Real-time log streaming for any selected container
- 🐛 Toggleable live debug panel (`D` key)

---

## Install globally

```bash
npm install -g cdd-cli
cdd
```

---

## Quick start (local)

```bash
git clone https://github.com/caertos/cdd.git
cd cdd
npm install
npm run build
node dist/index.js
```

To use as a global command during development:

```bash
npm link
cdd
```

---

## Usage

Use `↑` / `↓` to navigate containers. Available keyboard shortcuts:

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate container list |
| `I` | Start selected container |
| `P` | Stop selected container |
| `R` | Restart selected container |
| `C` | Open creation wizard |
| `L` | Stream logs for selected container |
| `E` | Erase (remove) selected container — confirmation required |
| `D` | Toggle live debug panel |
| `Q` | Quit |

---

## The Creation Wizard

Press `C` from the dashboard to launch the wizard. A **context-sensitive HUD** at the bottom always shows which keys are active at each step — no guessing required.

### Step 0 — Image

Type to filter through **20 curated offline profiles** (postgres, redis, nginx, node, mysql, mongo, python, golang, and more). Results appear instantly.

Press **`Tab`** at any time to search Docker Hub live. A `[searching Docker Hub...]` indicator confirms the search is running. Use `↑` / `↓` to navigate suggestions, `Enter` to select.

**Smart default tags:** selecting an image profile automatically applies a known-good tag — `postgres:17-alpine`, `redis:7-alpine`, `nginx:1.27-alpine`, etc. No more containers that fail silently because of a stale `:latest`.

### Step 1 — Container name

Free-text input. Give your container a memorable name.

### Step 2 — Port mapping

Enter a port mapping in `HOST:CONTAINER` format, e.g. `8080:80`, `5432:5432`. Leave blank to skip.

### Step 3 — Environment variables

Enter `KEY=VALUE` pairs one at a time. **Contextual hints** show recommended variables for the selected image:

| Image | Suggested vars |
|-------|---------------|
| postgres | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| mysql | `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE` |
| redis | *(no required vars)* |
| mongo | `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD` |
| node / nginx / others | Common runtime vars as applicable |

Press `Enter` on an empty line to finish and create the container.

---

## Requirements

- Node.js >= 18
- Docker installed and running (CDD connects to the local Docker socket)

---

## Development

```bash
npm install
npm run build        # compile src/ → dist/
node dist/index.js   # run from compiled output
```

Re-run `npm run build` after any source changes. Use `npm link` to test the global `cdd` command locally.

---

## Tests

```bash
npm test
```

Tests live in `test/` and cover helpers, services, and hooks.

---

## Logging

By default CDD shows `info`, `warn`, and `error` messages. For deeper diagnostics:

```bash
CDD_LOG_LEVEL=debug cdd
```

Press `D` inside the dashboard to toggle the live debug panel in real time. Press `D` again to hide it.

To capture logs to a file:

```bash
CDD_LOG_LEVEL=debug cdd > cdd-debug.log 2>&1
```

---

## Troubleshooting

- **No containers visible?** Make sure Docker is running and your user has access to the Docker socket.
- **Permission errors on Linux/macOS?** Try `sudo cdd` or add your user to the `docker` group.
- **Windows?** Run your terminal as Administrator.
- **`dist/` missing?** Run `npm run build` — it's in `.gitignore` and not committed.
- **Wizard search not working?** Check your internet connection. Offline profiles always work without network access.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT/ISC — see [`LICENSE`](LICENSE).

---

🇪🇸 [Ver en Español](README.es.md)
