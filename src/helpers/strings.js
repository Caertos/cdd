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

  // ── ContainerSection ──
  noContainers: 'No containers found',

  // ── ContainerRow ──
  stateRunning: '🟢 RUNNING',
  stateExited: '🔴 EXITED',
  statePaused: '🟠 PAUSED',

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

  // ── HelpPanel ──
  helpTitle: 'Help',
  helpClose: 'Press ? or Esc to close',
  contextLabels: {
    list: 'Container List',
    wizard: 'Creation Wizard',
    'wizard-list': 'Suggestion List',
    logs: 'Logs Viewer',
    confirm: 'Confirmation',
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
