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

/**
 * List of well-known database image names (without tags or registry prefixes).
 */
export const DB_IMAGES = [
  'mysql',
  'mariadb',
  'postgres',
  'mongo',
  'mssql',
  'redis',
];

/**
 * Per-image profiles with required env vars and default exposed port.
 * Keys are normalized image names (no tag, no registry prefix).
 *
 * @type {Record<string, { requiredEnv: string[], defaultPort: string }>}
 */
export const IMAGE_PROFILES = {
  mysql: { requiredEnv: ['MYSQL_ROOT_PASSWORD'], defaultPort: '3306' },
  mariadb: { requiredEnv: ['MARIADB_ROOT_PASSWORD'], defaultPort: '3306' },
  postgres: { requiredEnv: ['POSTGRES_PASSWORD'], defaultPort: '5432' },
  mongo: { requiredEnv: [], defaultPort: '27017' },
  mssql: { requiredEnv: ['ACCEPT_EULA', 'SA_PASSWORD'], defaultPort: '1433' },
  redis: { requiredEnv: [], defaultPort: '6379' },
};
