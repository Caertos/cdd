# CDD — CLI Docker Dashboard

<p align="center">
  <img src="https://img.shields.io/npm/v/cdd-cli?color=blue&label=npm%20package" alt="npm version"/>
  <img src="https://img.shields.io/npm/dt/cdd-cli?color=green&label=downloads" alt="npm downloads"/>
  <a href="https://github.com/Caertos/cdd/actions/workflows/ci.yml"><img src="https://github.com/Caertos/cdd/actions/workflows/ci.yml/badge.svg" alt="tests"/></a>
  <a href="https://deepwiki.com/Caertos/cdd"><img src="https://img.shields.io/badge/DeepWiki-Ask-2f6feb?logo=data%3Aimage%2Fpng%3Bbase64%2CiVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAMAAAAQhsnYAAAAG1BMVEX%2F%2F%2F8qbs0qbc4pbc4ewZsdwpwdwZwYleEXluKUtKvnAAAAAXRSTlMAQObYZgAAAQtJREFUSMfVltsSwiAMRLlsoP%2F%2FxQICDSS0dPRB91HPbDZhZ9QYTdZsy7qkTdS7Ir9ru4kz1jn7H7C%2Fh22%2Fq1NgEM2z%2FRyiwqCQRFrMQYUNVRCDB99sHJjUyf7MQBzGBPdgdbcrWLTh6zAaHO5htLviFq4EGYxsmNogzEZjXh4rUiZ%2FGtn6MFZJSf0i4M1sbcScsuDQ%2BwxhfCHIlYTicRUDNKBZqwXBh7zRpKicuZ%2BORvZtvn6UjDO2eDccGDuXo3DjmjtDUIukwWdHt%2BBF%2BT%2BAYztQ3IAzFNmQCTbHUvM55lcRY4wo%2F%2FnVoWwgyt83UuB8bb2sKrxS%2FEH49uf4gTHH494fgwdoia5%2B%2BgJ3fRfe3V5gGAAAAABJRU5ErkJggg%3D%3D" alt="Ask DeepWiki"/>
</p>

> **A terminal dashboard for Docker containers — monitor, manage, and create, all without leaving your keyboard.**

---

## 🎉 What's new in v4.10

**CDD explains why a container died — and offers to fix it.**

Every other tool here — lazydocker, ctop, Docker Desktop — shows you `EXITED (1)` and hands you the log. None of them tell you why. The person who installed a TUI to avoid typing `docker ps` is exactly the person who does not want to read 200 lines of Postgres startup to find out a variable was missing.

Select a failing container and a panel appears on its own:

```
╭─ Diagnosis: mi-basedatos ─────────────────────────────────────╮
│                                                                │
│  It keeps dying after 2s and Docker restarts it.              │
│                                                                │
│  Likely cause:                                                 │
│    Postgres refuses to start without a password. The image     │
│    needs POSTGRES_PASSWORD defined.                           │
│                                                                │
│  Last lines:                                                   │
│    Error: Database is uninitialized and superuser password…   │
│                                                                │
│  [F] Recreate and set POSTGRES_PASSWORD  [L] Full log          │
╰────────────────────────────────────────────────────────────────╯
```

- **No key to press.** If something is wrong, it explains itself. A container you stopped on purpose gets no panel at all.
- **`F` recreates it with the fix applied** — the wizard opens already filled in and already on the review step, with every changed value marked `↑ changed by CDD`. Nothing is applied behind your back, and the failed container keeps its name: the new one becomes `mi-basedatos-2`.
- **Then it asks.** *"Created mi-basedatos-2. Delete mi-basedatos, the container that failed?"* Answer "no" and it stays exactly where it was.
- **When it doesn't know, it says so** — and shows the last lines. That is the rule, not a fallback: a plausible-sounding wrong cause costs more trust than ten correct ones earn.

**Eleven rules ship now:** missing Postgres / MySQL / SQL Server credentials, busy host port, image with no command, out of memory, volume permission denied, executable not found, a job that finished instead of serving, and a refused connection to another host. The catalog is data — adding one is adding an element to a list, not touching the logic.

### v4.8 — Start Docker without leaving the terminal

When Docker is unreachable, CDD checks whether it knows how to start it. If it does, the `S` key appears on the connection screen and walks you through launching Docker.

- **Windows** — finds Docker Desktop in its standard install locations and starts it directly, no password (primary platform)
- **macOS** — opens Docker Desktop with `open -a Docker`
- **Linux (rootless)** — starts the user service without a password
- **Linux (system service)** — hands the terminal over to `sudo` so you can type your password
- **Live wait** — shows elapsed time and the typical wait, then reloads your containers automatically when Docker is ready

### v4.7 — Connection-screen keys

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
- 🎨 **Health verdicts** — running, starting, stopped, crashed, crash-loop, restarting or unhealthy, read from Docker's own data
- ⚪ Stopped vs crashed — a container you stopped is grey; red is reserved for real failures
- 🔍 **Explains why it failed** — a panel with the probable cause and the last log lines, unprompted, for every failing container
- 🔧 **One-key fix** — `F` recreates the container with the correction applied, on a review screen that shows exactly what changed
- 🤝 **"I don't recognise it"** — when no rule matches, CDD says so instead of guessing, and shows the evidence
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
pnpm install
pnpm run build
node dist/index.js
```

To use as a global command during development:

```bash
pnpm link --global
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
| `F`       | **Fix** — recreate with the diagnosis applied (only shown when there is a fix) |
| `L`       | Stream logs for selected container                        |
| `S`       | Open interactive shell inside selected container          |
| `E`       | Erase (remove) selected container — confirmation required |
| `D`       | Toggle live debug panel                                   |
| `Q`       | Quit                                                      |
| `?`       | Show help panel for the current screen                    |

After `F` creates the replacement, `y` deletes the container that failed and `n` keeps it. Those two keys only exist while the question is on screen.

### Connection Screen

| Key       | Action                                              |
| --------- | --------------------------------------------------- |
| `S`       | Start Docker (only when CDD knows how)              |
| `R`       | Retry container fetch immediately                   |
| `Q`       | Quit CDD (no confirmation)                          |
| —         | Auto-retry every 5 seconds (shown as a live countdown) |

### Starting Docker from the connection screen

When Docker is unreachable, CDD checks whether it knows how to start it. If it does, the `S` key appears and walks you through launching Docker without leaving the terminal.

- **Windows** — CDD finds Docker Desktop in its standard install locations and starts it directly, with no password. This is the primary platform.
- **macOS** — opens Docker Desktop with `open -a Docker`.
- **Linux (rootless)** — starts the user service (`systemctl --user start docker`) without a password.
- **Linux (system service)** — hands the terminal over to `sudo systemctl start docker` so you can type your password.

After starting, CDD waits for the daemon to respond, then reloads your containers automatically. On Windows, a slow start usually means the WSL2 engine is still initializing — CDD offers to keep waiting.

`S` only appears when CDD knows how to start Docker, and CDD never offers to stop Docker.

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

## The Diagnosis Panel

When the selected container is failing, CDD explains it. You do not press anything.

**It appears only when there is something to say.** A container you stopped, or one still starting up, gets no panel — there is nothing to explain and the space is better kept.

**It always has the same three parts**, in this order:

1. **What happened** — from the container's health verdict. Always present.
2. **Likely cause** — from the rule catalog. May be missing, and when it is, the panel says so.
3. **Last lines** — the last five lines of its log. It is what you were about to go and look at.

### When CDD doesn't know

```
  Likely cause:
    I don't recognise it. This is the last thing the container
    said before it died:
```

This is principle 5 of the project and it is not negotiable. A confident-sounding wrong cause costs more trust than ten correct ones build — and "I don't know, but here is the evidence" is still useful, because it saves you opening the log viewer.

### The rules

| Rule | Recognised by | What it offers |
|---|---|---|
| Missing Postgres password | `superuser password is not specified` | Recreate with `POSTGRES_PASSWORD` |
| Missing MySQL / MariaDB password | `you need to specify one of MYSQL_ROOT_PASSWORD` | Recreate with the variable |
| Missing SQL Server EULA | `ACCEPT_EULA` in the log | Recreate with `ACCEPT_EULA=Y` |
| Host port in use | `port is already allocated` / `address already in use` | Recreate with another free port |
| Image has no command | `no command specified` | Explains; no automatic fix |
| Out of memory | `OOMKilled` in Docker's own data | Explains; suggests raising the limit |
| Volume permission denied | `permission denied` on a path | Explains; no automatic fix |
| Executable not found | `executable file not found in $PATH` | Explains |
| Clean quick exit | Exit code 0 in under 2 seconds | Explains that the image finished its job and is not a service |
| Connection refused | `connection refused` | Explains; may mean a missing network |

They are **data**, not code: an array of rules with a priority. A rule only fires on evidence CDD actually read — a log line or an inspect fact. Adding one is adding an element to a list and a case to its test file.

### Recreating with the fix

`F` opens the wizard already filled in and **already on the review step**, because the interesting thing to check is the diff, not the image name:

```
[4] Env    POSTGRES_PASSWORD=••••••  ↑ changed by CDD
           POSTGRES_DB=app
```

- **Nothing is applied behind your back.** The fix goes through the review, you confirm it.
- **The failed container keeps its name**, so the replacement becomes `mi-basedatos-2`.
- **The wizard's own env field is filtered.** Docker merges the image's variables into the container's, so `PATH`, `LANG` and `PG_VERSION` would otherwise fill the form. CDD subtracts the image's own before showing yours.
- **Secrets start masked**, every time, even if you revealed them in an earlier wizard.
- **When the fix needs a value only you have** — a password — the key says *"Recreate and set POSTGRES_PASSWORD"* and the review warns that the variable is set but empty. CDD will not invent a password.

### Two limits worth knowing

- Recreating carries over the image, name, ports and variables. It does **not** carry over `Cmd`, `Entrypoint`, volumes, networks or restart policy — the wizard has no fields for them.
- The env field is comma-separated and Docker allows commas inside a value. A variable with a comma is split. The `kafka` profile already ships one.

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
pnpm install
pnpm run build        # compile src/ → dist/
node dist/index.js   # run from compiled output
```

Re-run `pnpm run build` after any source changes. Use `pnpm link --global` to test the global `cdd` command locally.

---

## Tests

```bash
pnpm test
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
- **The panel says "I don't recognise it"?** CDD only explains what its rule catalog recognises, and it would rather admit that than guess. The last lines are right there — press `L` for the full log.
- **`F` isn't showing?** The key appears only when the diagnosis carries a fix. Most causes are explained but not repairable (an image with no command, a denied volume), and a key that opens a wizard with nothing to change would be noise.
- **`F` says it couldn't read the container's configuration?** CDD refuses to recreate a container whose environment it could not read, rather than building one with no variables — which would die the same way. Press `C` to create one from scratch.
- **A fix left a password field empty on purpose.** CDD will not invent a password. Fill it in on the review screen before creating, or the container will fail again exactly as it just did.
- **Permission errors on Linux/macOS?** Try `sudo cdd` or add your user to the `docker` group.
- **Windows?** Run your terminal as Administrator.
- **`dist/` missing?** Run `pnpm run build` — it's in `.gitignore` and not committed.
- **Wizard search not working?** Check your internet connection. Offline profiles always work without network access.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT/ISC — see [`LICENSE`](LICENSE).

---

🇪🇸 [Ver en Español](README.es.md)
