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
 * Per-image profiles with required env vars, default exposed port, and suggested env vars.
 * Keys are normalized image names (no tag, no registry prefix).
 *
 * @type {Record<string, { requiredEnv: string[], defaultPort: string, suggestedEnv: string[] }>}
 */
export const IMAGE_PROFILES = {
  nginx:         { requiredEnv: [], defaultPort: '80',    suggestedEnv: [],                                                                                                                  defaultTag: '1.27-alpine' },
  httpd:         { requiredEnv: [], defaultPort: '80',    suggestedEnv: [],                                                                                                                  defaultTag: '2.4-alpine' },
  caddy:         { requiredEnv: [], defaultPort: '80',    suggestedEnv: [],                                                                                                                  defaultTag: '2-alpine' },
  node:          { requiredEnv: [], defaultPort: '3000',  suggestedEnv: ['NODE_ENV=production'],                                                                                              defaultTag: '22-alpine' },
  python:        { requiredEnv: [], defaultPort: '8000',  suggestedEnv: ['PYTHONUNBUFFERED=1'],                                                                                               defaultTag: '3.12-slim' },
  openjdk:       { requiredEnv: [], defaultPort: '8080',  suggestedEnv: ['JAVA_OPTS=-Xms256m -Xmx512m'],                                                                                     defaultTag: '21-slim' },
  golang:        { requiredEnv: [], defaultPort: '8080',  suggestedEnv: ['GOMAXPROCS=2'],                                                                                                     defaultTag: '1.22-alpine' },
  redis:         { requiredEnv: [], defaultPort: '6379',  suggestedEnv: ['REDIS_PASSWORD=change-me'],                                                                                         defaultTag: '7-alpine' },
  memcached:     { requiredEnv: [], defaultPort: '11211', suggestedEnv: [],                                                                                                                  defaultTag: '1.6-alpine' },
  postgres:      { requiredEnv: ['POSTGRES_PASSWORD'], defaultPort: '5432', suggestedEnv: ['POSTGRES_USER=postgres', 'POSTGRES_DB=app'],                                                     defaultTag: '17-alpine' },
  mysql:         { requiredEnv: ['MYSQL_ROOT_PASSWORD'], defaultPort: '3306', suggestedEnv: ['MYSQL_DATABASE=app', 'MYSQL_USER=app', 'MYSQL_PASSWORD=app123'],                               defaultTag: '8.0' },
  mariadb:       { requiredEnv: ['MARIADB_ROOT_PASSWORD'], defaultPort: '3306', suggestedEnv: ['MARIADB_DATABASE=app', 'MARIADB_USER=app', 'MARIADB_PASSWORD=app123'],                       defaultTag: '11-alpine' },
  mongo:         { requiredEnv: [], defaultPort: '27017', suggestedEnv: ['MONGO_INITDB_ROOT_USERNAME=admin', 'MONGO_INITDB_ROOT_PASSWORD=secret'],                                           defaultTag: '7.0' },
  mssql:         { requiredEnv: ['ACCEPT_EULA', 'SA_PASSWORD'], defaultPort: '1433', suggestedEnv: ['ACCEPT_EULA=Y', 'MSSQL_PID=Developer'],                                                 defaultTag: '2022-latest' },
  rabbitmq:      { requiredEnv: [], defaultPort: '5672',  suggestedEnv: ['RABBITMQ_DEFAULT_USER=guest', 'RABBITMQ_DEFAULT_PASS=guest'],                                                      defaultTag: '3-management-alpine' },
  kafka:         { requiredEnv: [], defaultPort: '9092',  suggestedEnv: ['KAFKA_CFG_LISTENERS=PLAINTEXT://:9092', 'KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092'],              defaultTag: '3.7' },
  zookeeper:     { requiredEnv: [], defaultPort: '2181',  suggestedEnv: ['ALLOW_ANONYMOUS_LOGIN=yes'],                                                                                        defaultTag: '3.9' },
  elasticsearch: { requiredEnv: [], defaultPort: '9200',  suggestedEnv: ['discovery.type=single-node', 'xpack.security.enabled=false'],                                                      defaultTag: '8.13.0' },
  minio:         { requiredEnv: ['MINIO_ROOT_USER', 'MINIO_ROOT_PASSWORD'], defaultPort: '9000', suggestedEnv: ['MINIO_CONSOLE_ADDRESS=:9001'],                                              defaultTag: 'latest' },
  wordpress:     { requiredEnv: ['WORDPRESS_DB_HOST', 'WORDPRESS_DB_USER', 'WORDPRESS_DB_PASSWORD', 'WORDPRESS_DB_NAME'], defaultPort: '8080', suggestedEnv: ['WORDPRESS_TABLE_PREFIX=wp_'], defaultTag: '6.5-apache' },
};

/**
 * Given an image name (with or without tag), returns the image name with a
 * default tag appended when the image matches a known profile and has no
 * explicit tag. Returns the input unchanged otherwise.
 *
 * @param {string} imageName - e.g. 'postgres', 'postgres:15', 'unknownimage'
 * @param {Record<string, { defaultTag: string }>} profiles
 * @returns {string}
 */
export function resolveImageTag(imageName, profiles = IMAGE_PROFILES) {
  if (!imageName) return imageName;
  if (imageName.includes(':')) return imageName;
  const baseName = imageName.trim().toLowerCase().split('/').pop();
  const profile = profiles[baseName];
  if (!profile?.defaultTag) return imageName;
  return `${imageName}:${profile.defaultTag}`;
}
