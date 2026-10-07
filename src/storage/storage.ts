import type { GameState } from '../core/game/state';
import { openDb, KV_STORE, INSTALLATION_ID_KEY, SESSION_ID_KEY } from './db';

const GAME_KEY = 'game';

export interface GameStorage {
  loadGame(): Promise<GameState | null>;
  saveGame(state: GameState): Promise<void>;
}

export interface AnalyticsStorage {
  getInstallationId(): Promise<string | null>;
  setInstallationId(id: string): Promise<void>;
  getSessionId(): Promise<string | null>;
  setSessionId(id: string): Promise<void>;
}

export class Storage implements GameStorage, AnalyticsStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openDb();
    return this.dbPromise;
  }

  async loadGame(): Promise<GameState | null> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const request = db.transaction(KV_STORE, 'readonly').objectStore(KV_STORE).get(GAME_KEY);
      request.onsuccess = () => resolve((request.result as GameState | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveGame(state: GameState): Promise<void> {
    const db = await this.db();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(KV_STORE, 'readwrite');
      transaction.objectStore(KV_STORE).put(state, GAME_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getInstallationId(): Promise<string | null> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const request = db.transaction(KV_STORE, 'readonly').objectStore(KV_STORE).get(INSTALLATION_ID_KEY);
      request.onsuccess = () => resolve((request.result as string | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async setInstallationId(id: string): Promise<void> {
    const db = await this.db();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(KV_STORE, 'readwrite');
      transaction.objectStore(KV_STORE).put(id, INSTALLATION_ID_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getSessionId(): Promise<string | null> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const request = db.transaction(KV_STORE, 'readonly').objectStore(KV_STORE).get(SESSION_ID_KEY);
      request.onsuccess = () => resolve((request.result as string | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async setSessionId(id: string): Promise<void> {
    const db = await this.db();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(KV_STORE, 'readwrite');
      transaction.objectStore(KV_STORE).put(id, SESSION_ID_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const storage = new Storage();
