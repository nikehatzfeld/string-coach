import {
  addToVault,
  createVault,
  decryptBytes,
  exportKey,
  importKey,
  openVault,
  unlockVault,
  type VaultEntry,
  type VaultFile,
} from './crypto';

/** Accès au coffre publié avec le site (public/vault/). */

const REMEMBER_KEY = 'string-coach:vault-key';
const base = () => `${import.meta.env.BASE_URL}vault/`;

export type VaultState =
  | { status: 'empty' }
  | { status: 'locked'; vault: VaultFile }
  | { status: 'unlocked'; vault: VaultFile; key: CryptoKey; entries: VaultEntry[] }
  | { status: 'error'; message: string };

let state: VaultState | null = null;

export async function loadVault(): Promise<VaultState> {
  if (state && state.status !== 'error') return state;
  try {
    const res = await fetch(`${base()}vault.json`, { cache: 'no-cache' });
    if (res.status === 404) return (state = { status: 'empty' });
    if (!res.ok) return (state = { status: 'error', message: `Coffre inaccessible (${res.status})` });
    let vault: VaultFile;
    try {
      vault = (await res.json()) as VaultFile;
    } catch {
      // Certains hébergeurs renvoient la page d'accueil au lieu d'une erreur 404.
      return (state = { status: 'empty' });
    }
    if (vault?.version !== 1 || !vault.kdf) return (state = { status: 'empty' });
    state = { status: 'locked', vault };
    // Clé mémorisée sur cet appareil ?
    const remembered = safeGet(REMEMBER_KEY);
    if (remembered) {
      try {
        const key = await importKey(remembered);
        state = { status: 'unlocked', vault, key, entries: await openVault(vault, key) };
      } catch {
        safeRemove(REMEMBER_KEY);
      }
    }
    return state;
  } catch {
    return (state = { status: 'error', message: 'Coffre inaccessible (hors ligne ?)' });
  }
}

export async function unlock(password: string, remember: boolean): Promise<VaultState> {
  if (!state || state.status === 'empty' || state.status === 'error') throw new Error('Pas de coffre');
  const { key, entries } = await unlockVault(state.vault, password);
  state = { status: 'unlocked', vault: state.vault, key, entries };
  if (remember) safeSet(REMEMBER_KEY, await exportKey(key));
  return state;
}

export function lock(): void {
  safeRemove(REMEMBER_KEY);
  if (state && state.status === 'unlocked') state = { status: 'locked', vault: state.vault };
}

export async function fetchEntry(entry: VaultEntry): Promise<Uint8Array<ArrayBuffer>> {
  if (!state || state.status !== 'unlocked') throw new Error('Coffre verrouillé');
  const res = await fetch(`${base()}${entry.id}.bin`);
  if (!res.ok) throw new Error(`Fichier introuvable (${res.status})`);
  return decryptBytes(state.key, new Uint8Array(await res.arrayBuffer()));
}

/**
 * Prépare l'ajout de fichiers : renvoie les fichiers à déposer dans public/vault/ du repo.
 * Si le coffre n'existe pas encore, il est créé avec newPassword.
 */
export async function prepareAddition(files: File[], newPassword?: string) {
  let vault: VaultFile;
  let key: CryptoKey;
  let entries: VaultEntry[];
  if (state?.status === 'unlocked') {
    ({ vault, key, entries } = state);
  } else if (state?.status === 'empty' && newPassword) {
    ({ vault, key } = await createVault(newPassword));
    entries = [];
  } else {
    throw new Error('Déverrouille d’abord le coffre');
  }
  const input = await Promise.all(files.map(async (f) => ({ fileName: f.name, data: new Uint8Array(await f.arrayBuffer()) })));
  const res = await addToVault(vault, key, entries, input);
  return {
    files: [{ path: 'vault.json', data: new TextEncoder().encode(JSON.stringify(res.vault, null, 2)) }, ...res.blobs],
    count: res.entries.length,
  };
}

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}
function safeRemove(k: string): void {
  try {
    localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
