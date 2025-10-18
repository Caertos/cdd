## CDD-CLI — Docker Dashboard (Terminal)

<p align="center">
  <img src="https://img.shields.io/npm/v/cdd-cli?color=blue&label=npm%20package" alt="npm version"/>
  <img src="https://img.shields.io/npm/dt/cdd-cli?color=green&label=downloads" alt="npm downloads"/>
  <a href="https://github.com/caertos/cdd/actions/workflows/ci.yml">
    <img src="https://github.com/caertos/cdd/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" />
  </a>
  <!-- Documentation published to GitHub Pages -->
  <a href="https://caertos.github.io/cdd/">
    <img src="https://img.shields.io/badge/docs-GitHub%20Pages-blue" alt="Docs" />
  </a>
</p>

Short, bilingual README with quickstart, development and tests.

---

## Quick start (local)

1. Clone the repo and install dependencies:

```bash
git clone https://github.com/caertos/cdd.git
cd cdd
npm install
```

2. Build and run locally:

```bash
npm run build
node dist/index.js
```

3. To test the CLI as a globally available command during development:

```bash
npm link
cdd
```

---

## Usage (interactive)

- Use ↑/↓ to navigate containers.
- I: start selected container
- P: stop selected container
- R: restart selected container
- C: create container (interactive prompt)
- L: view logs for selected container
- D: toggle the on-screen debug log panel
- E: erase (remove) selected container (confirmation required)
- Q: quit

The dashboard auto-refreshes container list every few seconds.

---

## Install globally

To install the CLI globally so you can run `cdd` from any terminal, use:

```bash
npm install -g cdd-cli
```

After installing globally, run the CLI with:

```bash
cdd
```

---

## Development

- Node.js >= 18 is recommended.
- To run the app from source during development:

```bash
npm install
npm run build
node dist/index.js
```

If you change source files, re-run `npm run build` before running the CLI.

---

## Tests

We use Jest for unit tests. Run:

```bash
npm test
```

Tests are located in `test/` and cover utility helpers.

---

## Contributing

1. Fork the repo and create a feature branch.
2. Add tests for new behavior.
3. Ensure `npm test` and `npm run build` pass.
4. Open a Pull Request with a clear description.

---

## Troubleshooting

- If you don't see containers, ensure Docker is running and that your user has access to the Docker socket.
- If Docker permissions are required, run the CLI with `sudo` (Linux/macOS) or as Administrator (Windows).
- The project generates `dist/` — keep it out of version control (it's in .gitignore).

---

## Logging

- The CLI logs high-level `info`, `warn`, and `error` messages by default so you see meaningful feedback without noise.
- When you need deeper diagnostics (for example, to troubleshoot why stats or logs are not updating), start the CLI with debug logging enabled:

```bash
CDD_LOG_LEVEL=debug cdd          # if you installed globally
# or
CDD_LOG_LEVEL=debug node dist/index.js
```

- The same effect can be achieved with `LOG_LEVEL=debug`. Set `LOG_LEVEL=warn` if you only want to see warnings and errors.
- Inside the CLI, press `D` to toggle the live debug log panel; press `D` again or `Esc` to hide it.
- Redirect output to a file when users report issues so they can share the log easily:

```bash
CDD_LOG_LEVEL=debug cdd > cdd-debug.log 2>&1
```

---

## License

This project is MIT/ISC licensed (see `LICENSE`).

   ```

## Usage
- When you run `cdd`, you'll see a table with all your Docker containers.
- Running containers show live CPU and memory stats.
- Use `Ctrl+C` to exit.

## Main features
- 🐳 Clear, compact visualization of all containers.
- 🔄 Automatic data refresh (every 2 seconds).
- ⌨️ Keyboard shortcuts for fast actions (navigate, start, stop, logs, quit).
- 📊 Live resource usage stats for running containers.
- 🪵 Real-time log streaming for selected containers.
- 🎨 Visual interface with colors and emojis for states.
- 👤 Author: Carlos Cochero (2025)

## Requirements
- Node.js >= 18
- Docker installed and running (CLI connects to local Docker socket)

## Troubleshooting
- If you don't see containers, make sure Docker is running and your user has permission to access the Docker socket.
- If you have issues with global install, try with `sudo` (Linux/macOS) or run terminal as administrator (Windows).

---

¡Disfruta monitoreando tus contenedores Docker desde la terminal con estilo! / Enjoy monitoring your Docker containers from the terminal in style!
