/**
 * Time intervals used across the app (milliseconds).
 * - CONTAINER_LIST: how often to refresh the list of containers
 * - CONTAINER_STATS: how often to fetch stats for running containers
 */
export const REFRESH_INTERVALS = {
  CONTAINER_LIST: 3000,
  CONTAINER_STATS: 1500,
};

/**
 * Timeout values for UI messages before they disappear.
 */
export const MESSAGE_TIMEOUTS = {
  SHORT: 2000,
  DEFAULT: 3000,
};

/**
 * Delay used before exiting the process when showing an exit message.
 */
export const EXIT_DELAY = 500;

/**
 * Operational timeouts for Docker operations and image pulls.
 */
export const TIMEOUTS = {
  CONTAINER_OP: 30000,
  PULL_IMAGE: 300000,
};
