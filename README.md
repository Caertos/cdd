# CDD — CLI Docker Dashboard

<p align="center">
  <img src="https://img.shields.io/npm/v/cdd-cli?color=blue&label=npm%20package" alt="npm version"/>
  <img src="https://img.shields.io/npm/dt/cdd-cli?color=green&label=downloads" alt="npm downloads"/>
  <a href="https://deepwiki.com/Caertos/cdd"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
</p>

> **A terminal dashboard for Docker containers — monitor, manage, and create, all without leaving your keyboard.**

---

## 🎉 What's new in v4.7

**Live retry countdown and connection-screen keys.**

When Docker is unreachable, CDD no longer leaves you guessing. The connection screen counts down to the next automatic reconnect and gives you direct keys to act.

- **Live countdown** — seconds until the next automatic reconnect attempt
- **`R` retries immediately** — force a container fetch without waiting for the timer
- **`Q` quits directly** — no confirmation prompt; the app is already in a degraded state
- **Leaner notice** — `ConnectionNotice` only receives `{ error, nextRetryIn }`

### v4.6 — Secret management

**Secret management — passwords stay hidden.**

CDD now protects sensitive environment variables by default. Passwords, tokens, and API keys are masked in the wizard and review screen, and never appear in debug logs.

- **Automatic masking** — variables like `POSTGRES_PASSWORD`, `JWT_SECRET`, or `API_KEY` show as `••••••` while typing
- **`Ctrl+R` to reveal** — toggle visibility of secret values when you need to check them
- **`Ctrl+G` to generate** — create strong, unambiguous passwords directly in the wizard
- **No example passwords** — image profiles no longer suggest `secret` or `change-me` as defaults
- **Weak password warnings** — the review screen flags common or short passwords and suggests generating a stronger one
- **Debug-safe** — secrets are redacted from all log output, even in debug mode

### Why this matters

Before v4.6, selecting a Postgres profile would pre-fill `POSTGRES_PASSWORD=secret`. Most users accept this without thinking — and end up with a database protected by a literal `secret` password. Worse, if you share your screen or check your terminal history two days later, every password is visible in plain text.

Now CDD encourages secure practices without slowing you down: empty defaults for secrets, one-key generation, and masking that you can toggle when needed.

### v4.6.1 — Docker connection handling

**Clear error messages when Docker is unreachable.**

Before v4.6.1, if Docker was stopped or unreachable, CDD showed "No containers found" — a misleading message that made users think something was wrong with their containers. Now CDD detects connection failures and shows an actionable error screen.

- **Clear error screen** — "Can't reach Docker" with specific technical details
- **Actionable suggestions** — tells you exactly how to fix it (`sudo systemctl start docker`, open Docker Desktop)
- **Auto-retry** — CDD keeps trying to connect every 5 seconds in the background
- **Manual retry** — press `R` to retry immediately without waiting
- **Stale data indicator** — when reconnection happens, old container data is visually dimmed until fresh data arrives
- **Centralized strings** — all UI text moved to `src/helpers/strings.js` for future internationalization

---

## Previous releases

### v4.1 — Interactive shell

**Open a shell inside any container with a single keystroke.**

Press `S` and CDD drops you into a full interactive shell (`bash` or `sh`) inside the selected container — no `docker exec` typing needed.

- **Auto-detected shell** — CDD probes the container and picks `bash` or `sh` automatically
- **Full terminal support** — run `psql`, `python3`, `node`, `redis-cli`, or any command inside the container
- **Clean exit** — type `exit` or press `Ctrl+D` to return to the dashboard

### v4.5 — Interactive creation wizard

Forget `docker run` flags, forgotten env vars, and broken `:latest` tags. Press `C` and CDD guides you through creating a container in seconds:

- **20 curated image profiles** available offline — postgres, redis, nginx, node, mysql, mongo, and more
- **Smart default tags** that actually work: `postgres:17-alpine`, `redis:7-alpine`, `nginx:1.27-alpine` — no more silent `:latest` failures
- **Live Docker Hub search** with a single `Tab` keystroke — with a `[searching Docker Hub...]` indicator so you always know what's happening
- **Contextual env var hints** — creating a Postgres container? CDD suggests `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` automatically
- **Review before you create** — see exactly what will be created (resolved image tag, auto-assigned ports, warnings) before the container exists
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
- 🚨 **Smart connection handling** — clear error screen with actionable suggestions when Docker is unreachable

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

Use `↑` / `↓` to navigate containers. The **HUD** at the bottom shows available keys for the current context. Press `?` for full help.

### Container List

| Key       | Action                                                    |
| --------- | --------------------------------------------------------- |
| `↑` / `↓` | Navigate container list                                   |
| `I`       | Start selected container                                  |
| `P`       | Stop selected container                                   |
| `R`       | Restart selected container                                |
| `C`       | Open creation wizard                                      |
| `L`       | Stream logs for selected container                        |
| `S`       | Open interactive shell inside selected container          |
| `E`       | Erase (remove) selected container — confirmation required |
| `D`       | Toggle live debug panel                                   |
| `Q`       | Quit                                                      |
| `?`       | Show help panel                                           |

### Connection Screen

| Key       | Action                                              |
| --------- | --------------------------------------------------- |
| `R`       | Retry container fetch immediately                   |
| `Q`       | Quit CDD (no confirmation)                          |
| —         | Auto-retry every 5 seconds (shown as a live countdown) |

### Creation Wizard

| Key       | Action                                    |
| --------- | ----------------------------------------- |
| `Enter`   | Confirm and continue to next step (or create on review) |
| `Esc`     | Go back one step (or cancel on step 0)   |
| `Tab`     | Search Docker Hub (step 0) or insert env  |
| `↑` / `↓` | Navigate suggestions                      |
| `Ctrl+G`  | Generate a strong secret (step 3)         |
| `Ctrl+R`  | Toggle secret visibility (step 3)         |
| `1`–`4`   | Edit a field from the review screen       |
| `?`       | Show help panel                           |

### Logs Viewer

| Key       | Action                    |
| --------- | ------------------------- |
| `↑` / `↓` | Scroll up/down            |
| `PgUp` / `PgDn` | Page up/down        |
| `f`       | Toggle auto-follow        |
| `Esc` / `Q` | Close logs viewer      |
| `?`       | Show help panel           |

### Confirmation

| Key | Action                |
| --- | --------------------- |
| `y` | Confirm the action    |
| `n` | Cancel the action     |

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

| Image                 | Suggested vars                                             |
| --------------------- | ---------------------------------------------------------- |
| postgres              | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`        |
| mysql                 | `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`                    |
| redis                 | _(no required vars)_                                       |
| mongo                 | `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD` |
| node / nginx / others | Common runtime vars as applicable                          |

**Secret variables** (`PASSWORD`, `SECRET`, `TOKEN`, `API_KEY`, etc.) are automatically masked as you type. Use `Ctrl+R` to reveal them temporarily, or `Ctrl+G` to generate a strong password with one keystroke.

Press `Enter` on an empty line to finish and create the container.

---

## Interactive Shell

Press `S` from the dashboard while a running container is selected. CDD will:

1. Detect the available shell inside the container (`bash` or `sh`)
2. Open a full interactive terminal session
3. Drop you into the container's shell

From there you can run any command — `psql` for PostgreSQL, `python3` for Python, `node` for Node.js, `redis-cli` for Redis, etc.

Type `exit` or press `Ctrl+D` to leave the shell and return to the CDD dashboard.

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

- **No containers visible?** If Docker is running but no containers appear, you may have none running or created. Press `C` to create one. If Docker is unreachable, CDD now shows a clear error screen with instructions to fix it.
- **Docker connection error?** CDD will show "Can't reach Docker" with specific steps to resolve it. Press `R` to retry after fixing the issue, wait for the live countdown, or press `Q` to quit.
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
