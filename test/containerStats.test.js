/**
 * @jest-environment node
 */
import { jest } from '@jest/globals';

afterEach(() => jest.resetModules());

async function loadStats(statsPayload, { reject = false } = {}) {
  const stats = reject
    ? jest.fn().mockRejectedValue(statsPayload)
    : jest.fn().mockResolvedValue(statsPayload);
  await jest.unstable_mockModule('../src/helpers/dockerService/dockerService.js', () => ({
    docker: { getContainer: jest.fn().mockReturnValue({ stats }) },
  }));
  const mod = await import(
    '../src/helpers/dockerService/serviceComponents/containerStats.js'
  );
  return { ...mod, stats };
}

/** Minimal valid payload of `docker stats --no-stream`. */
const payload = (over = {}) => ({
  cpu_stats: {
    cpu_usage: { total_usage: 200, percpu_usage: [1, 1] },
    system_cpu_usage: 2000,
    online_cpus: 4,
  },
  precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 1000 },
  memory_stats: { usage: 50, limit: 200 },
  networks: { eth0: { rx_bytes: 10, tx_bytes: 20 } },
  ...over,
});

describe('getStats', () => {
  test('computes cpuPercent, memPercent and netIO', async () => {
    const { getStats } = await loadStats(payload());
    // cpuDelta=100, systemDelta=1000, 4 CPUs → 100/1000*4*100 = 40.0
    await expect(getStats('cid')).resolves.toEqual({
      cpuPercent: '40.0',
      memPercent: '25.0',
      netIO: { rx: 10, tx: 20 },
    });
  });

  test('systemDelta = 0 → cpuPercent "0.0"', async () => {
    const { getStats } = await loadStats(
      payload({
        cpu_stats: {
          cpu_usage: { total_usage: 200 },
          system_cpu_usage: 1000,
          online_cpus: 2,
        },
        precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 1000 },
      })
    );
    await expect(getStats('cid')).resolves.toMatchObject({ cpuPercent: '0.0' });
  });

  test('without online_cpus uses percpu_usage.length', async () => {
    const { getStats } = await loadStats(
      payload({
        cpu_stats: {
          cpu_usage: { total_usage: 200, percpu_usage: [1, 1] },
          system_cpu_usage: 2000,
        },
      })
    );
    await expect(getStats('cid')).resolves.toMatchObject({ cpuPercent: '20.0' });
  });

  test('without online_cpus nor percpu_usage assumes 1 CPU', async () => {
    const { getStats } = await loadStats(
      payload({
        cpu_stats: { cpu_usage: { total_usage: 200 }, system_cpu_usage: 2000 },
      })
    );
    await expect(getStats('cid')).resolves.toMatchObject({ cpuPercent: '10.0' });
  });

  test('no networks → rx/tx = 0', async () => {
    const { getStats } = await loadStats(payload({ networks: undefined }));
    await expect(getStats('cid')).resolves.toMatchObject({ netIO: { rx: 0, tx: 0 } });
  });

  test('several interfaces → sums rx/tx', async () => {
    const { getStats } = await loadStats(
      payload({
        networks: {
          eth0: { rx_bytes: 10, tx_bytes: 20 },
          eth1: { rx_bytes: 5, tx_bytes: 5 },
        },
      })
    );
    await expect(getStats('cid')).resolves.toMatchObject({
      netIO: { rx: 15, tx: 25 },
    });
  });

  test('missing memory_stats.limit → uses 1 and avoids divide-by-zero', async () => {
    const { getStats } = await loadStats(payload({ memory_stats: {} }));
    await expect(getStats('cid')).resolves.toMatchObject({ memPercent: '0.0' });
  });

  test('daemon error → propagates the rejection', async () => {
    const { getStats } = await loadStats(new Error('no such container'), {
      reject: true,
    });
    await expect(getStats('cid')).rejects.toThrow('no such container');
  });
});
