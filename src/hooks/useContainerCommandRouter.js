import { useCallback } from 'react';

/**
 * Hook responsible solely for routing Docker action keystrokes to the correct handler.
 * Has no domain state of its own — it delegates every side-effect to its dependencies.
 *
 * Handled keys:
 *   i  — start container
 *   p  — stop container
 *   r  — restart container
 *   e  — request erase confirmation
 *   l  — open logs viewer and start log stream
 *   c  — open container creation wizard (reset + activate)
 *   d  — toggle debug log panel
 *
 * @param {Object} params
 * @param {Object} params.actions       - API from useContainerActions
 * @param {Array<Object>} params.containers - Current list of Docker containers
 * @param {number} params.selected      - Index of the currently selected container
 * @param {Object} params.creation      - API from useContainerCreation (must expose resetCreation)
 * @param {Object} params.logsViewer    - API from useLogsViewer
 * @param {Function} params.startLogsStream - Starts the log stream for a container id
 * @param {Function} params.onStartErase    - Callback: activates confirmErase state
 * @param {Function} params.onToggleDebug   - Callback: toggles showDebugLogs state
 * @param {Function} params.onStartCreate   - Callback: sets creatingContainer = true
 * @returns {{ handleDockerCommands: Function }}
 */
export function useContainerCommandRouter({
  actions,
  containers,
  selected,
  creation,
  logsViewer,
  startLogsStream,
  onStartErase,
  onToggleDebug,
  onStartCreate,
}) {
  const handleDockerCommands = useCallback(
    (input) => {
      const container = containers[selected];

      if (input === 'i') {
        actions.handleAction({
          actionFn: async (id) => await actions.startContainer(id),
          actionLabel: 'Starting',
          selected,
          stateCheck: (c) =>
            (c.state === 'running' || c.status === 'running') &&
            'Container is already running.',
        });
        return true;
      }

      if (input === 'p') {
        actions.handleAction({
          actionFn: async (id) => await actions.stopContainer(id),
          actionLabel: 'Stopping',
          selected,
          stateCheck: (c) =>
            (c.state === 'exited' ||
              c.status === 'exited' ||
              c.state === 'stopped' ||
              c.status === 'stopped') &&
            'Container is already stopped.',
        });
        return true;
      }

      if (input === 'r') {
        actions.handleAction({
          actionFn: async (id) => await actions.restartContainer(id),
          actionLabel: 'Restarting',
          selected,
        });
        return true;
      }

      if (input === 'e') {
        if (!container) {
          return true;
        }
        onStartErase();
        return true;
      }

      if (input === 'l') {
        if (!container) {
          return true;
        }
        logsViewer.openLogs();
        startLogsStream(container.id);
        return true;
      }

      if (input === 'c') {
        creation.resetCreation();
        onStartCreate();
        return true;
      }

      if (input === 'd') {
        onToggleDebug();
        return true;
      }

      return false;
    },
    [
      actions,
      containers,
      creation,
      logsViewer,
      onStartCreate,
      onStartErase,
      onToggleDebug,
      selected,
      startLogsStream,
    ]
  );

  return { handleDockerCommands };
}
