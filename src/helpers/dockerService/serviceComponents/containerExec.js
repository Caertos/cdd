import { spawn } from 'child_process';
import { docker } from '../dockerService.js';
import { logger } from '../../logger.js';
import { TIMEOUTS } from '../../constants.js';

/**
 * Detect the default shell available inside a running container.
 * Tries `bash` first, falls back to `sh`.
 *
 * @param {string} containerId - Docker container id
 * @returns {Promise<string>} The shell command (e.g. 'bash' or 'sh')
 */
export async function detectShell(containerId) {
  const container = docker.getContainer(containerId);

  const tryShell = (shell) =>
    new Promise((resolve) => {
      container.exec(
        {
          Cmd: ['which', shell],
          AttachStdout: true,
          AttachStderr: false,
          Tty: false,
        },
        (err, exec) => {
          if (err) {
            resolve(false);
            return;
          }
          exec.start({ Tty: false }, (startErr, stream) => {
            if (startErr) {
              resolve(false);
              return;
            }
            let output = '';
            stream.on('data', (chunk) => {
              output += chunk.toString();
            });
            stream.on('end', () => {
              resolve(output.trim().length > 0);
            });
            stream.on('error', () => resolve(false));
          });
        }
      );
    });

  try {
    const hasBash = await Promise.race([
      tryShell('bash'),
      new Promise((r) => setTimeout(() => r(false), TIMEOUTS.CONTAINER_OP)),
    ]);
    if (hasBash) {
      logger.debug('Detected bash in container %s', containerId);
      return 'bash';
    }
  } catch {
    // ignore
  }

  logger.debug('Falling back to sh in container %s', containerId);
  return 'sh';
}

/**
 * Spawn an interactive shell inside a running container using `docker exec -it`.
 * Returns a promise that resolves when the user exits the shell.
 *
 * @param {string} containerId - Docker container id
 * @param {Object} [options]
 * @param {string} [options.shell] - Shell to use (auto-detected if omitted)
 * @param {string} [options.workingDir] - Working directory inside the container
 * @returns {Promise<{code: number|null, signal: string|null}>} Exit info
 */
export async function execInteractive(containerId, options = {}) {
  const shell = options.shell || (await detectShell(containerId));

  const args = ['exec', '-it', containerId, shell];
  if (options.workingDir) {
    args.splice(3, 0, '-w', options.workingDir);
  }

  logger.info(
    'Opening interactive shell in container %s (shell=%s)',
    containerId,
    shell
  );

  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', (err) => {
      logger.error('Failed to spawn docker exec', err);
      reject(new Error(`Failed to open shell: ${err.message}`));
    });

    child.on('close', (code, signal) => {
      logger.info(
        'Interactive shell exited (code=%s, signal=%s)',
        code,
        signal
      );
      resolve({ code, signal });
    });
  });
}

/**
 * Execute a non-interactive command inside a running container.
 * Returns stdout and stderr as strings.
 *
 * @param {string} containerId - Docker container id
 * @param {string[]} cmd - Command to execute (e.g. ['ls', '-la'])
 * @param {Object} [options]
 * @param {number} [options.timeout] - Timeout in ms
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
export function execCommand(containerId, cmd, options = {}) {
  return new Promise((resolve, reject) => {
    const container = docker.getContainer(containerId);

    container.exec(
      {
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true,
        Tty: false,
      },
      (err, exec) => {
        if (err) {
          return reject(new Error(`Exec create failed: ${err.message}`));
        }

        exec.start({ Tty: false }, (startErr, stream) => {
          if (startErr) {
            return reject(new Error(`Exec start failed: ${startErr.message}`));
          }

          let stdout = '';
          let stderr = '';

          stream.on('data', (chunk) => {
            const str = chunk.toString();
            // Docker multiplexed streams use 8-byte headers.
            // For Tty=false, output is multiplexed; for simplicity we accumulate.
            stdout += str;
          });

          stream.on('end', () => {
            exec.inspect((inspectErr, info) => {
              resolve({
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: info?.ExitCode ?? -1,
              });
            });
          });

          stream.on('error', (streamErr) => {
            reject(new Error(`Stream error: ${streamErr.message}`));
          });

          if (options.timeout) {
            setTimeout(() => {
              reject(new Error('Command timed out'));
            }, options.timeout);
          }
        });
      }
    );
  });
}
