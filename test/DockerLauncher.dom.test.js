/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { DockerLauncher } from '../src/components/DockerLauncher.jsx';

const METHOD = {
  kind: 'linux-system',
  command: 'sudo',
  args: ['systemctl', 'start', 'docker'],
  needsPrivileges: true,
  display: 'sudo systemctl start docker',
  typicalWaitMs: 30000,
};

const WINDOWS_METHOD = {
  ...METHOD,
  kind: 'windows-desktop',
  needsPrivileges: false,
  display: '"C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"',
  typicalWaitMs: 60000,
};

describe('DockerLauncher', () => {
  test('idle renders nothing', () => {
    const { container } = render(
      <DockerLauncher method={null} status="idle" elapsedMs={0} error={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  test('confirming shows the command and the password note when privileged', () => {
    const { getByText } = render(
      <DockerLauncher
        method={METHOD}
        status="confirming"
        elapsedMs={0}
        error={null}
      />
    );
    expect(getByText(METHOD.display)).toBeTruthy();
    expect(getByText(/You will be asked for your password/)).toBeTruthy();
    expect(getByText(/never type an admin password/)).toBeTruthy();
  });

  test('confirming omits the password note when no privileges are needed', () => {
    const { queryByText } = render(
      <DockerLauncher
        method={WINDOWS_METHOD}
        status="confirming"
        elapsedMs={0}
        error={null}
      />
    );
    expect(queryByText(/You will be asked for your password/)).toBeNull();
  });

  test('waiting shows the elapsed counter and the Esc hint', () => {
    const { getByText } = render(
      <DockerLauncher
        method={METHOD}
        status="waiting"
        elapsedMs={5000}
        error={null}
      />
    );
    expect(getByText(/Started 5s ago/)).toBeTruthy();
    expect(getByText('[Esc] stop waiting (Docker keeps starting)')).toBeTruthy();
  });

  test('failed shows the error message', () => {
    const { getByText } = render(
      <DockerLauncher
        method={METHOD}
        status="failed"
        elapsedMs={0}
        error="ENOENT: no such file"
      />
    );
    expect(getByText('ENOENT: no such file')).toBeTruthy();
    expect(getByText(/Try again/)).toBeTruthy();
  });

  test('timeout shows the note and includes the WSL2 note for windows-desktop', () => {
    const { getByText } = render(
      <DockerLauncher
        method={WINDOWS_METHOD}
        status="timeout"
        elapsedMs={90000}
        error={null}
      />
    );
    expect(getByText(/Docker started but is not responding yet/)).toBeTruthy();
    expect(getByText(/WSL2 engine still initializing/)).toBeTruthy();
    expect(getByText('[Enter] keep waiting')).toBeTruthy();
    expect(getByText('[Esc] give up waiting (Docker keeps starting)')).toBeTruthy();
  });

  test('timeout omits the WSL2 note for non-windows platforms', () => {
    const { queryByText } = render(
      <DockerLauncher
        method={METHOD}
        status="timeout"
        elapsedMs={90000}
        error={null}
      />
    );
    expect(queryByText(/WSL2 engine/)).toBeNull();
  });

  test('ready shows a ready message', () => {
    const { getByText } = render(
      <DockerLauncher
        method={METHOD}
        status="ready"
        elapsedMs={0}
        error={null}
      />
    );
    expect(getByText('Docker is ready.')).toBeTruthy();
  });
});
