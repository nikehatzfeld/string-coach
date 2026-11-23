/** Pistes audio personnelles (instrus) dans IndexedDB : elles restent sur l'appareil. */
const DB = 'string-coach-audio';
const STORE = 'audio';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = f(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const saveAudio = (id: string, blob: Blob) => run('readwrite', (s) => s.put(blob, id));
export const loadAudio = (id: string) => run<Blob | undefined>('readonly', (s) => s.get(id));
export const deleteAudio = (id: string) => run('readwrite', (s) => s.delete(id));
