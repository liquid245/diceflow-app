import type { AnalyticsStorage } from '../storage/storage';

export interface AnalyticsConfig {
  enabled: boolean;
  endpoint: string;
  batchSize: number;
  flushIntervalMs: number;
  heartbeatIntervalMs: number;
}

export interface AnalyticsEvent {
  type: string;
  properties: Record<string, unknown>;
  timestamp: number;
}

export class AnalyticsService {
  private storage: AnalyticsStorage;
  private eventQueue: AnalyticsEvent[] = [];
  private flushInterval: number | null = null;
  private heartbeatInterval: number | null = null;
  private readonly endpoint: string;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly heartbeatIntervalMs: number;
  private installationId: string | null = null;
  private sessionId: string | null = null;

  constructor(storage: AnalyticsStorage, config: AnalyticsConfig) {
    this.storage = storage;
    this.endpoint = config.endpoint;
    this.batchSize = config.batchSize;
    this.flushIntervalMs = config.flushIntervalMs;
    this.heartbeatIntervalMs = config.heartbeatIntervalMs;
  }

  private async getOrCreateInstallationId(): Promise<string> {
    if (this.installationId) return this.installationId;
    const storedId = await this.storage.getInstallationId();
    if (storedId) {
      this.installationId = storedId;
      return this.installationId;
    }
    const newId = crypto.randomUUID();
    await this.storage.setInstallationId(newId);
    this.installationId = newId;
    return this.installationId;
  }

  private async getOrCreateSessionId(): Promise<string> {
    if (this.sessionId) return this.sessionId;
    const storedId = await this.storage.getSessionId();
    if (storedId) {
      this.sessionId = storedId;
      return this.sessionId;
    }
    const newId = crypto.randomUUID();
    await this.storage.setSessionId(newId);
    this.sessionId = newId;
    return this.sessionId;
  }

  trackEvent(type: string, properties: Record<string, unknown> = {}): void {
    // Do not track when tab is hidden
    if (document.hidden) return;
    this.addToQueue({ type, properties, timestamp: Date.now() });
  }

  private addToQueue(event: AnalyticsEvent): void {
    this.eventQueue.push(event);
    if (this.eventQueue.length >= this.batchSize) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    try {
      const installationId = await this.getOrCreateInstallationId();
      const sessionId = await this.getOrCreateSessionId();

      const payload = {
        installationId,
        sessionId,
        events: events.map(e => ({
          type: e.type,
          properties: e.properties,
          timestamp: e.timestamp,
        })),
      };

      const data = JSON.stringify(payload);
      const sent = navigator.sendBeacon(this.endpoint, data);
      if (!sent) {
        // If sendBeacon fails, we re-queue the events for retry
        this.eventQueue.unshift(...events);
      }
    } catch (error) {
      console.error('Error flushing analytics:', error);
      // Re-queue the events for retry
      this.eventQueue.unshift(...events);
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval !== null) return;
    this.heartbeatInterval = window.setInterval(() => {
      this.trackEvent('heartbeat', {});
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.stopHeartbeat();
    } else {
      this.startHeartbeat();
    }
  };

  private handleBeforeUnload = (): void => {
    // Flush any remaining events before page unload
    this.flush().catch(console.error);
  };

  start(): void {
    if (this.flushInterval !== null) return;
    this.flushInterval = window.setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);

    // Setup visibility change listener
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    // Setup beforeunload listener
    window.addEventListener('beforeunload', this.handleBeforeUnload);

    // Initial heartbeat if visible
    if (!document.hidden) {
      this.startHeartbeat();
    }
  }

  stop(): void {
    if (this.flushInterval !== null) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.stopHeartbeat();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
  }

  async forceFlush(): Promise<void> {
    await this.flush();
  }
}