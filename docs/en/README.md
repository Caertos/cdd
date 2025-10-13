# README (ENGLISH)
*Generated: 2025-10-13*

## Table of Contents
- [Project Scope](#project-scope)
- [Objectives & Roadmap](#objectives--roadmap)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Use Cases](#use-cases)
- [Technical Documentation](#technical-documentation)
- [API Reference](#api-reference)
- [License](#license)
- [Contributing](#contributing)
- [Code of Conduct](#code-of-conduct)
- [Changelog](#changelog)
- [FAQ](#faq)
- [Publishing & Maintenance](#publishing--maintenance)

---

## Project Scope
This project is a cross-platform CLI tool for managing Docker containers with real-time log streaming and keyboard shortcuts. It is designed for developers and DevOps engineers who need fast, scriptable, and interactive container management from the terminal.

**What it does:**
- Lists, starts, stops, and removes Docker containers.
- Streams logs in real time.
- Provides keyboard shortcuts for common actions.
- Offers feedback and stats in the terminal.

**What it does NOT do:**
- Does not replace Docker Compose or advanced orchestration tools.
- Does not manage images or networks directly.
- No GUI; terminal only.

## Objectives & Roadmap
**Short-term (3 months):**
- Polish CLI UX and error handling.
- Add more keyboard shortcuts.
- Improve documentation and add more use cases.

**Medium-term (6 months):**
- Add plugin system for custom actions.
- Support for container stats export (JSON/CSV).
- Integration with CI/CD pipelines.

**Known limitations:**
- Requires Docker daemon running locally.
- Only supports local containers (no remote).
- Limited to Node.js LTS versions.

## Requirements
| Requirement         | Minimum         | Recommended      |
|--------------------|----------------|-----------------|
| Node.js            | 16.x           | 18.x+           |
| npm                | 7.x            | 8.x+            |
| OS                 | Linux, macOS, Windows | Linux, macOS |
| Docker             | 20.x           | Latest stable   |
| Permissions        | Docker group or sudo | Docker group |

**Development:**
- ESLint, Prettier
- Jest or Mocha for tests
- GitHub Actions for CI

**Production:**
- Only Node.js and Docker required

## Installation
### Global install
```bash
npm install -g cdd-cli
```

### Update
```bash
npm update -g cdd-cli
```

### Uninstall
```bash
npm uninstall -g cdd-cli
```

### Check version
```bash
cdd -v
cdd --version
```

#### Notes
- On Linux/macOS, you may need `sudo` for global install.
- Ensure your global npm bin is in your PATH.
- On Windows, use an Administrator terminal if needed.

## Quick Start
```bash
cdd list
cdd logs <container>
cdd start <container>
cdd stop <container>
cdd remove <container>
```

## Use Cases
1. **List all containers**
   - `cdd list`
   - *Shows all containers with status.*
2. **Start a container**
   - `cdd start my_container`
   - *Starts the specified container.*
3. **Stop a container**
   - `cdd stop my_container`
   - *Stops the specified container.*
4. **Stream logs in real time**
   - `cdd logs my_container`
   - *Shows live logs with color highlighting.*
5. **Remove a container**
   - `cdd remove my_container`
   - *Deletes the container after confirmation.*
6. **Use keyboard shortcuts**
   - While viewing logs, press `q` to quit, `r` to restart, etc.

## Technical Documentation
See inline JSDoc comments in source files. Example:
```js
/**
 * Start a Docker container by name.
 * @param {string} name - Container name
 * @returns {Promise<boolean>} True if started
 * @throws {Error} If Docker is not running
 * @example
 * await startContainer('my_container');
 */
```

## API Reference
See [API Reference](./api.md) for all exported functions and CLI commands.

## License
MIT License. See [LICENSE](../../LICENSE).

## Contributing
See [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Code of Conduct
See [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## Changelog
See [CHANGELOG.md](../../CHANGELOG.md).

## FAQ
- **Does it work with Docker Desktop?**
  - Yes, as long as Docker CLI is available.
- **Can I use it in CI?**
  - Yes, see examples below.
- **How do I add my own commands?**
  - Plugin system coming soon.

## Publishing & Maintenance
To publish to npm:
```bash
npm login
npm publish --access public
```

Keep documentation updated with every release. See CONTRIBUTING.md for details.
