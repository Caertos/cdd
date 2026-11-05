# CDD — CLI Docker Dashboard

🇪🇸 [Ver en Español](README.es.md)

<p align="center">
  <img src="https://img.shields.io/npm/v/cdd-cli?color=blue&label=npm%20package" alt="npm version"/>
  <img src="https://img.shields.io/npm/dt/cdd-cli?color=green&label=downloads" alt="npm downloads"/>
  <a href="https://github.com/Caertos/cdd/actions/workflows/ci.yml"><img src="https://github.com/Caertos/cdd/actions/workflows/ci.yml/badge.svg" alt="tests"/></a>
  <a href="https://deepwiki.com/Caertos/cdd"><img src="https://img.shields.io/badge/DeepWiki-Ask-2f6feb?logo=data%3Aimage%2Fpng%3Bbase64%2CiVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAMAAAAQhsnYAAAAG1BMVEX%2F%2F%2F8qbs0qbc4pbc4ewZsdwpwdwZwYleEXluKUtKvnAAAAAXRSTlMAQObYZgAAAQtJREFUSMfVltsSwiAMRLlsoP%2F%2FxQICDSS0dPRB91HPbDZhZ9QYTdZsy7qkTdS7Ir9ru4kz1jn7H7C%2Fh22%2Fq1NgEM2z%2FRyiwqCQRFrMQYUNVRCDB99sHJjUyf7MQBzGBPdgdbcrWLTh6zAaHO5htLviFq4EGYxsmNogzEZjXh4rUiZ%2FGtn6MFZJSf0i4M1sbcScsuDQ%2BwxhfCHIlYTicRUDNKBZqwXBh7zRpKicuZ%2BORvZtvn6UjDO2eDccGDuXo3DjmjtDUIukwWdHt%2BBF%2BT%2BAYztQ3IAzFNmQCTbHUvM55lcRY4wo%2F%2FnVoWwgyt83UuB8bb2sKrxS%2FEH49uf4gTHH494fgwdoia5%2B%2BgJ3fRfe3V5gGAAAAABJRU5ErkJggg%3D%3D" alt="Ask DeepWiki"/>
</p>

> **A terminal dashboard for Docker containers — monitor, manage, and create, all without leaving your keyboard.**

---

## 🎉 What's new in v4.13

**You see a stopped container's whole log, and when something is missing, CDD tells you.**

- **A stopped container is read whole.** Open its logs and `Home` takes you to its very first line: the log of a container that has stopped is finite, and it is the one you read to find out why. A running container opens with its last 2,000 lines (it was 100).
- **A cut is never silent.** The top of the log always says what it is: `start of log`, or `N earlier lines dropped (memory limit)`. Before, the viewer kept the last 1,000 lines and told you nothing.
- **`Ctrl+U` loads earlier lines** of a running container, 2,000 at a time, without moving the lines you are reading.
- **The limit is memory, not lines.** The buffer is capped in bytes (16 MB by default) and one huge line is cut with a mark (`… [line cut: 3.2 MB]`) instead of eating the memory. Both limits can be changed — see [Log viewer limits](#log-viewer-limits).
- **A noisy container says so.** If a container writes so fast that the buffer is renewed within a minute, the header warns that lines are being dropped: the problem is the container, not the viewer.

**Requires Node 22 or newer** (`ink` 8 and `chalk` 6 need it).

Older release notes are kept in [`CHANGELOG.md`](CHANGELOG.md).

---

## Features

- 🐳 Live view of all Docker containers with CPU/memory stats
- 🔄 Auto-refresh every few seconds — always up to date
- ⌨️ Keyboard-driven actions: start, stop, restart, log streaming, removal
- 🗂️ Views — Containers, Projects and Images tabs; the header and tabs stay visible whatever you open
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

### Views

Under the header there are three tabs, always visible: **Containers**, **Projects** and **Images**. Projects and Images are placeholders for now and arrive in upcoming versions. Every action keeps its key (`C` create, `L` logs…) and only acts in Containers.

| Key                | Action                                            |
| ------------------ | ------------------------------------------------- |
| `Tab` / `Shift+Tab` | Next / previous view                             |
| `1` `2` `3`        | Jump to Containers / Projects / Images            |
| `?` `Q`            | Help and quit, in every view                      |

The creation wizard, the help and the logs open inside the view, with the header and tabs still on screen (`Tab` inside the wizard still searches Docker Hub or inserts an env var; it does not switch views). On a terminal under 20 rows the footer and inner margin are dropped; the header, tabs and key hints stay. Going to another view and coming back keeps the selection, the filter and the sort order as you left them.

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
| `U`       | **Update CDD** — only shown when a newer version is on npm |
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

It opens inside the Containers view: header and tabs stay visible.

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

The log opens in the content area, in place of the list; the header, tabs and key hints stay on screen. Scrolling up pauses following (the header says so and counts the lines that arrive meanwhile); `End` goes back to the newest line and follows again.

| Key             | Action                                              |
| --------------- | --------------------------------------------------- |
| `↑` / `↓`       | Scroll one line                                     |
| `PgUp` / `PgDn` | Scroll one page                                     |
| `Home` / `End`  | First line / newest line (and follow again)         |
| `Ctrl+U`        | Load earlier lines (when the log's start is not loaded) |
| `f`             | Toggle auto-follow                                  |
| `/`             | Search: matches are highlighted and counted         |
| `n` / `N`       | Next / previous match                               |
| `Ctrl+F`        | Show only the matching lines (toggle)               |
| `Enter` / `Esc` | In the search field: keep the search / clear it     |
| `Esc` / `Q`     | Close logs viewer                                   |
| `?`             | Show help panel                                     |

### Confirmation

| Key | Action                |
| --- | --------------------- |
| `y` | Confirm the action    |
| `n` | Cancel the action     |

---

## Updates

On start, CDD checks the npm registry in the background for a newer release — at most once a day, with a 3 second timeout, and no data beyond the public version manifest. When one exists, the header shows it next to the version (`v4.11.1 · ↑ v4.12.0 [U]`) and `U` runs the install command for the package manager that installed CDD (npm, pnpm, yarn or bun) after asking. Running through npx or from a source checkout? CDD shows the command instead of running it.

Turn the check off with `CDD_NO_UPDATE_CHECK=1` or `NO_UPDATE_NOTIFIER=1`.

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

- Node.js >= 22
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

### Log viewer limits

The log viewer keeps what it receives in a buffer with a memory ceiling, and always says when it had to throw lines away. Two variables change the ceiling:

| Variable | Default | Meaning |
| --- | --- | --- |
| `CDD_LOG_BUFFER_BYTES` | `16777216` (16 MB) | Memory the buffer may use, in bytes |
| `CDD_LOG_MAX_LINES` | `100000` | Second safety net, in lines |

```bash
CDD_LOG_BUFFER_BYTES=1048576 cdd
```

A value that is not a positive whole number is ignored. When the ceiling is reached the oldest lines are dropped and the top of the viewer says how many. A single line over 1 MB is cut and marked.

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
