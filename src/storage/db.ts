const DB_NAME = 'diceflow';
const DB_VERSION = 1;
export const KV_STORE = 'kv';
export const INSTALLATION_ID_KEY = 'installationId';
export const SESSION_ID_KEY = 'sessionId';

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KV_STORE)) {
        db.createObjectStore(KV_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
