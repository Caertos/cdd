/**
 * Centralized user-facing strings.
 * Single source of truth for all UI text.
 *
 * When i18n is needed later, this file's implementation changes
 * but every consumer stays untouched.
 */

export const STRINGS = {
  // ── App ──
  appTitle: 'CLI Docker Dashboard',

  // ── Header ──
  containerFound: (n) => `${n} container${n === 1 ? '' : 's'} found`,
  // Wording for the active sort mode shown in the header. Keys are the
  // SortMode values from containerFilters.js.
  sortMode: {
    state: 'sorted: problems first',
    name: 'sorted: by name',
    created: 'sorted: newest first',
  },

  // ── ContainerSection ──
  noContainers: 'No containers found',

  // ── Selection (TASK-9) ──
  // Copy for the message line when the selection is anchored to a container
  // that no longer exists and has fallen back to the neighbour that took its
  // slot. It sits next to the list's own strings because it is about the list
  // losing a row, not about any single component.
  selection: {
    lostTarget: 'The selected container no longer exists',
  },

  // ── ContainerRow ──
  stateRunning: '🟢 RUNNING',
  stateExited: '🔴 EXITED',
  statePaused: '🟠 PAUSED',

  // ── Health engine (TASK-7) ──
  // Short headlines for the row; keep them within the state column.
  // The icon/colour come from levelStyle(level).
  health: {
    running: 'RUNNING',
    starting: 'starting',
    stopped: 'stopped',
    crashed: (code) => `exit ${code}`,
    crashLoop: (seconds) => `died ${seconds}s`,
    restarting: (count) => `restart ×${count}`,
    unhealthy: 'unhealthy',
    paused: 'PAUSED',
    unknown: 'UNKNOWN',
  },

  // ── Diagnostics (TASK-8) ──
  // Copy for the diagnosis engine and its panel. Panel chrome lives here too
  // so that every sentence CDD shows about a failure is rewordable in one
  // place, and so the "I don't recognise it" wording is never improvised in a
  // component.
  diagnostics: {
    panelTitle: (name) => `Diagnosis: ${name}`,
    likelyCause: 'Likely cause:',
    // The most important sentence in the feature. Saying "I don't know" plus
    // the evidence is useful; inventing a plausible cause is not.
    notRecognized:
      "I don't recognise it. This is the last thing the container said before it died:",
    lastLines: 'Last lines:',
    readingLog: 'Reading the log...',
    noOutput: 'The container wrote nothing to its log.',
    viewFullLog: '[L] Full log',
    // Fix labels — shown on the key that applies them.
    fix: {
      addEnv: (key) => `Recreate with ${key}`,
      // Used when the fix cannot invent the value — a password. The button has
      // to admit that, or it promises a container that will fail again.
      addEnvInputNeeded: (key) => `Recreate and set ${key}`,
      changePort: (port) => `Recreate with another host port (${port} is busy)`,
    },
    // One explanation per rule id. Plain language, no jargon.
    explain: {
      'postgres-missing-password':
        'Postgres refuses to start without a password. The image needs POSTGRES_PASSWORD defined.',
      'mysql-missing-password':
        'MySQL/MariaDB refuses to start without a root password. The image needs the password variable defined.',
      'mssql-missing-eula':
        'SQL Server will not start until you accept its licence terms with ACCEPT_EULA=Y.',
      'port-in-use':
        'Another process already listens on that host port. Docker cannot bind it twice.',
      'no-command':
        'The image has no default command, so there was nothing for Docker to run.',
      'out-of-memory':
        'The container ran out of memory and was killed (exit 137 is the usual sign). Raising its memory limit would let it finish.',
      'volume-permission-denied':
        'The container was denied access to a volume path. The file is probably owned by a different user than the one in the image.',
      'executable-not-found':
        'The command names an executable that does not exist inside the image.',
      'clean-exit':
        'The image finished its work and exited on purpose. It is a job, not a service — leave it stopped or run it with a command that stays alive.',
      'connection-refused':
        'The container could not reach another host. That service is probably not running, or the two are not on a shared network.',
    },
  },

  // ── EmptyState ──
  emptyTitle: 'No containers yet.',
  emptyHint: 'Press [C] to create the first one — CDD guides you step by step.',

  // ── ConnectionNotice ──
  connection: {
    notRunning: {
      title: "🔌 Can't reach Docker",
      detail: "The Docker service doesn't seem to be running on this machine.",
      hints: {
        linux: [
          'sudo systemctl start docker',
          'Or open Docker Desktop if you use it',
        ],
        darwin: ['Open Docker Desktop', 'Or brew services start docker'],
        win32: ['Open Docker Desktop', 'Or check that the service is running'],
      },
    },
    permission: {
      title: "🔒 Docker is running, but I can't access it",
      detail: "Your user doesn't have permission to use the Docker socket.",
      hints: {
        linux: [
          'sudo usermod -aG docker $USER (then log out and back in)',
          'Or run CDD with sudo',
        ],
        darwin: [
          'Make sure your user is in the docker group',
          'Or run CDD with sudo',
        ],
        win32: [
          'Run the terminal as administrator',
          'Or check Docker Desktop permissions',
        ],
      },
    },
    timeout: {
      title: '⏱️ Docker is taking too long to respond',
      detail: 'The connection is taking longer than expected.',
      hints: {
        linux: ['Check system load with top'],
        darwin: ['Restart Docker Desktop'],
        win32: ['Restart Docker Desktop'],
      },
    },
    unknown: {
      title: '❓ Could not connect to Docker',
      detail: 'An unexpected error occurred while connecting to the daemon.',
      hints: {
        linux: ['Check Docker logs: journalctl -u docker'],
        darwin: ['Check Docker Desktop logs'],
        win32: ['Check Docker Desktop logs'],
      },
    },
    retrying: (s) => `Retrying in ${s} s...`,
    retryNow: '[R] retry now',
    exit: '[Q] quit',
    staleWarning: 'Lost connection to Docker — retrying',
  },

  // ── DockerLauncher ──
  dockerLauncher: {
    confirmingTitle: 'Start Docker?',
    confirmingExplain: 'This will run:',
    passwordPrompt: 'You will be asked for your password.',
    passwordWhy:
      'The command is shown because you should never type an admin password without seeing what runs.',
    confirmHint: '[Enter] confirm  ·  [Esc] cancel',
    launching: 'Starting Docker...',
    waitingStarted: (s) => `Started ${s}s ago.`,
    waitingNote: (s) => `This usually takes up to ${s} seconds.`,
    waitingCancel: '[Esc] stop waiting (Docker keeps starting)',
    ready: 'Docker is ready.',
    failedHint: 'Try again.',
    timeoutExplain: 'Docker started but is not responding yet.',
    timeoutWsl2:
      'On Windows this is usually the WSL2 engine still initializing.',
    timeoutKeepWaiting: '[Enter] keep waiting',
    timeoutGiveUp: '[Esc] give up waiting (Docker keeps starting)',
    launchFailed: 'Failed to start Docker.',
  },

  // ── HelpPanel ──
  helpTitle: 'Help',
  helpClose: 'Press ? or Esc to close',
  contextLabels: {
    list: 'Container List',
    wizard: 'Creation Wizard',
    'wizard-list': 'Suggestion List',
    'wizard-discard': 'Discard Confirmation',
    'wizard-review': 'Review',
    logs: 'Logs Viewer',
    confirm: 'Confirmation',
    'confirm-quit': 'Quit Confirmation',
    help: 'Help',
    debug: 'Debug Panel',
    disconnected: 'Disconnected',
  },

  // ── LogViewer ──
  logsTitle: (name) => `${name ?? 'Container'} logs, press ESC to exit`,
  noLogs: 'No logs...',

  // ── Debug ──
  debugTitle: 'Debug log — press D or ESC to close',
  debugEmpty:
    'No debug entries yet. Run with CDD_LOG_LEVEL=debug for verbose output.',

  // ── Wizard ──
  wizard: {
    stepOf: (step, total) => `Step ${step} of ${total}`,
    discardTitle: 'Discard this container?',
    discardDetail: 'All progress will be lost.',
    reviewTitle: 'Review and confirm',
    checkingPorts: 'Checking image for exposed ports...',
    prompts: {
      image: 'Name of the image to create (e.g., nginx:1.27-alpine):',
      name: 'Name of the container (optional):',
      ports: 'Ports (optional, format 8080:80,443:443):',
      env: 'Environment variables (optional, format VAR1=val1,VAR2=val2):',
    },
  },

  // ── ControlsHUD ──
  hud: {
    yes: 'Yes',
    no: 'No',
    navigate: 'Navigate',
    select: 'Select',
    exit: 'Exit',
    searchHub: 'Search Hub',
    browse: 'Browse',
    confirm: 'Confirm',
    generateSecret: 'Generate secret',
    revealSecrets: 'Reveal secrets',
    insertNextEnv: 'Insert next env',
    continue: 'Continue',
    back: 'Back',
  },

  // ── Validation ──
  validation: {
    containerNameTooLong: 'Container name too long (max 128 chars)',
    containerNameInvalid:
      'Container name can only contain letters, numbers, underscores, dots, and hyphens',
    imageRequired: 'Image name is required',
    imageInvalidChars: 'Image name contains invalid characters',
    imageDashDash: 'Image name cannot start with --',
    imageInvalidFormat: 'Invalid image name format',
  },
};
