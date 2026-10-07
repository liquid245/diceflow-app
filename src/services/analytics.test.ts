import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsService, type AnalyticsConfig } from './analytics';
import type { AnalyticsStorage } from '../storage/storage';

interface TestStorage extends AnalyticsStorage {
  data: Record<string, string>;
}

function createStorage(initial: Record<string, string> = {}): TestStorage {
  const data: Record<string, string> = { ...initial };
  return {
    data,
    getInstallationId: async () => data.installationId ?? null,
    setInstallationId: async (id: string) => {
      data.installationId = id;
    },
    getSessionId: async () => data.sessionId ?? null,
    setSessionId: async (id: string) => {
      data.sessionId = id;
    },
  };
}

const baseConfig: AnalyticsConfig = {
  enabled: true,
  endpoint: '/api/analytics/event',
  batchSize: 100,
  flushIntervalMs: 1_000_000,
  heartbeatIntervalMs: 1_000_000,
};

describe('AnalyticsService', () => {
  let sent: Array<{ url: string; data: string }>;
  let sendBeaconResult: boolean;
  let hidden: boolean;
  let setIntervalSpy: ReturnType<typeof vi.fn>;
  let clearIntervalSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sent = [];
    sendBeaconResult = true;
    hidden = false;
    setIntervalSpy = vi.fn(() => 1);
    clearIntervalSpy = vi.fn();

    vi.stubGlobal('navigator', {
      sendBeacon: (url: string, data?: string) => {
        sent.push({ url, data: data ?? '' });
        return sendBeaconResult;
      },
    });
    vi.stubGlobal('document', {
      get hidden() {
        return hidden;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('window', {
      setInterval: setIntervalSpy,
      clearInterval: clearIntervalSpy,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('clearInterval', clearIntervalSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('assigns and persists installation and session ids on flush', async () => {
    const storage = createStorage();
    const analytics = new AnalyticsService(storage, baseConfig);

    analytics.trackEvent('launch');
    await analytics.forceFlush();

    expect(sent).toHaveLength(1);
    const payload = JSON.parse(sent[0].data);
    expect(payload.installationId).toBeTruthy();
    expect(payload.sessionId).toBeTruthy();
    expect(storage.data.installationId).toBe(payload.installationId);
    expect(storage.data.sessionId).toBe(payload.sessionId);
  });

  it('reuses existing ids from storage', async () => {
    const storage = createStorage({ installationId: 'i-1', sessionId: 's-1' });
    const analytics = new AnalyticsService(storage, baseConfig);

    analytics.trackEvent('launch');
    await analytics.forceFlush();

    const payload = JSON.parse(sent[0].data);
    expect(payload.installationId).toBe('i-1');
    expect(payload.sessionId).toBe('s-1');
  });

  it('sends queued events together with their properties', async () => {
    const analytics = new AnalyticsService(createStorage(), baseConfig);

    analytics.trackEvent('action_roll');
    analytics.trackEvent('action_add', { count: 2 });
    await analytics.forceFlush();

    expect(sent).toHaveLength(1);
    const payload = JSON.parse(sent[0].data);
    expect(payload.events.map((e: { type: string }) => e.type)).toEqual([
      'action_roll',
      'action_add',
    ]);
    expect(payload.events[1].properties).toEqual({ count: 2 });
  });

  it('does not queue events while the tab is hidden', async () => {
    hidden = true;
    const analytics = new AnalyticsService(createStorage(), baseConfig);

    analytics.trackEvent('action_roll');
    await analytics.forceFlush();

    expect(sent).toHaveLength(0);
  });

  it('re-queues events when sendBeacon fails', async () => {
    const analytics = new AnalyticsService(createStorage(), baseConfig);

    sendBeaconResult = false;
    analytics.trackEvent('action_roll');
    await analytics.forceFlush();
    expect(sent).toHaveLength(1);

    sendBeaconResult = true;
    await analytics.forceFlush();
    expect(sent).toHaveLength(2);
    const payload = JSON.parse(sent[1].data);
    expect(payload.events).toHaveLength(1);
  });

  it('starts and stops timers', () => {
    const analytics = new AnalyticsService(createStorage(), baseConfig);

    analytics.start();
    analytics.stop();

    expect(setIntervalSpy).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
