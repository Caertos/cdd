/**
 * @jest-environment jsdom
 */
import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { useContainerCreation } from '../src/hooks/creation/useContainerCreation.js';
import { IMAGE_PROFILES } from '../src/helpers/constants.js';

function HookTester({ onCreate, onCancel, dbImages, imageProfiles, expose }) {
  const hook = useContainerCreation({ onCreate, onCancel, dbImages, imageProfiles });
  // keep exposing the latest hook values on every render
  useEffect(() => {
    if (expose) expose.current = hook;
  });
  return null;
}

describe('useContainerCreation (DOM render)', () => {
  test('image empty shows error and does not advance', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} expose={expose} />);

      expect(expose.current.step).toBe(0);

      act(() => {
        expose.current.nextStep();
      });

      expect(expose.current.message).toBe('Image name cannot be empty.');
      expect(expose.current.step).toBe(0);
  });

  test('ports validation: invalid ports shows error', () => {
    const expose = { current: null };
    render(<HookTester onCreate={() => {}} onCancel={() => {}} dbImages={[]} expose={expose} />);

      act(() => {
        expose.current.setImageName('nginx');
      });

      act(() => {
        expose.current.nextStep(); // to name
      });

      act(() => {
        expose.current.nextStep(); // to ports
      });

      expect(expose.current.step).toBe(2);

      act(() => {
        expose.current.setPortInput('notaport');
      });

      act(() => {
        expose.current.nextStep();
      });

      expect(expose.current.message).toBe('Port format must be host:container and both must be numbers (e.g. 8080:80)');
      expect(expose.current.step).toBe(2);
  });

  test('complete flow calls onCreate with data', () => {
    const created = [];
    const onCreate = (data) => created.push(data);
    const expose = { current: null };

    render(<HookTester onCreate={onCreate} onCancel={() => {}} dbImages={[]} expose={expose} />);

      act(() => {
        expose.current.setImageName('redis');
      });

      act(() => {
        expose.current.nextStep(); // to name
      });

      act(() => {
        expose.current.nextStep(); // to ports
      });

      act(() => {
        expose.current.setPortInput('');
      });

      act(() => {
        expose.current.nextStep(); // to env
      });

      act(() => {
        expose.current.setEnvInput('FOO=bar');
      });

      act(() => {
        expose.current.nextStep(); // final create
      });

      expect(created.length).toBe(1);
      expect(created[0]).toEqual({ imageName: 'redis', containerName: '', portInput: '', envInput: 'FOO=bar' });
  });

  test('step 3 with mysql image: missing MYSQL_ROOT_PASSWORD blocks creation', () => {
    const created = [];
    const expose = { current: null };

    render(<HookTester onCreate={(d) => created.push(d)} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    // advance to step 3 (env) with mysql image
    act(() => { expose.current.setImageName('mysql:8'); });
    act(() => { expose.current.nextStep(); }); // step 0 → 1
    act(() => { expose.current.nextStep(); }); // step 1 → 2
    act(() => { expose.current.nextStep(); }); // step 2 → 3

    expect(expose.current.step).toBe(3);

    // try to advance without required env var
    act(() => { expose.current.nextStep(); });

    expect(expose.current.step).toBe(3); // still blocked
    expect(expose.current.message).toMatch(/MYSQL_ROOT_PASSWORD/i);
    expect(created.length).toBe(0);
  });

  test('step 3 with mysql image: valid env advances and calls onCreate', () => {
    const created = [];
    const expose = { current: null };

    render(<HookTester onCreate={(d) => created.push(d)} onCancel={() => {}} dbImages={[]} imageProfiles={IMAGE_PROFILES} expose={expose} />);

    act(() => { expose.current.setImageName('mysql:8'); });
    act(() => { expose.current.nextStep(); });
    act(() => { expose.current.nextStep(); });
    act(() => { expose.current.nextStep(); }); // at step 3

    act(() => { expose.current.setEnvInput('MYSQL_ROOT_PASSWORD=secret'); });
    act(() => { expose.current.nextStep(); }); // should call onCreate

    expect(created.length).toBe(1);
    expect(created[0].imageName).toBe('mysql:8');
  });
});
