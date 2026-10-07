import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { Storage } from './storage';

describe('Storage (analytics)', () => {
  let storage: Storage;

  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    storage = new Storage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('installationId', () => {
    it('returns null when not set', async () => {
      const id = await storage.getInstallationId();
      expect(id).toBeNull();
    });

    it('can set and get installationId', async () => {
      const testId = 'test-installation-id-123';
      await storage.setInstallationId(testId);
      const id = await storage.getInstallationId();
      expect(id).toBe(testId);
    });

    it('can overwrite installationId', async () => {
      await storage.setInstallationId('first-id');
      await storage.setInstallationId('second-id');
      const id = await storage.getInstallationId();
      expect(id).toBe('second-id');
    });
  });

  describe('sessionId', () => {
    it('returns null when not set', async () => {
      const id = await storage.getSessionId();
      expect(id).toBeNull();
    });

    it('can set and get sessionId', async () => {
      const testId = 'test-session-id-456';
      await storage.setSessionId(testId);
      const id = await storage.getSessionId();
      expect(id).toBe(testId);
    });

    it('can overwrite sessionId', async () => {
      await storage.setSessionId('first-session');
      await storage.setSessionId('second-session');
      const id = await storage.getSessionId();
      expect(id).toBe('second-session');
    });
  });

  it('installationId and sessionId are isolated', async () => {
    await storage.setInstallationId('installation-id');
    await storage.setSessionId('session-id');

    const storedInstallationId = await storage.getInstallationId();
    const storedSessionId = await storage.getSessionId();

    expect(storedInstallationId).toBe('installation-id');
    expect(storedSessionId).toBe('session-id');
  });
});
