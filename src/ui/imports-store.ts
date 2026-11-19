/** Stockage local (IndexedDB) des fichiers importés : Guitar Pro, MusicXML, alphaTex. */
export interface ImportedSong {
  id: string;
  name: string;
  addedAt: number;
  data: ArrayBuffer;
}

const DB = 'string-coach';
const STORE = 'imports';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listImports(): Promise<ImportedSong[]> {
  try {
    const all = await tx<ImportedSong[]>('readonly', (s) => s.getAll());
    return all.sort((a, b) => b.addedAt - a.addedAt);
  } catch {
    return [];
  }
}

export async function saveImport(file: File): Promise<ImportedSong> {
  const song: ImportedSong = {
    id: `${Date.now()}-${file.name}`,
    name: file.name.replace(/\.[^.]+$/, ''),
    addedAt: Date.now(),
    data: await file.arrayBuffer(),
  };
  try {
    await tx('readwrite', (s) => s.put(song));
  } catch {
    /* stockage indisponible (navigation privée) : le morceau reste jouable pour la session */
  }
  return song;
}

export async function deleteImport(id: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(id));
  } catch {
    /* ignore */
  }
}
