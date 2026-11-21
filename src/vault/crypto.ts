/**
 * Coffre chiffré : les chansons protégées sont publiées chiffrées (AES-256-GCM),
 * clé dérivée du mot de passe (PBKDF2-SHA256, 600 000 itérations).
 * Le nom des chansons est lui aussi chiffré (index). Fonctionne dans le navigateur
 * et dans Node 22 (Web Crypto natif). Le mot de passe n'est jamais stocké.
 */

export interface VaultEntry {
  id: string;
  name: string;
  /** Nom de fichier d'origine (extension utile pour le format). */
  fileName: string;
  size: number;
  addedAt: number;
}

export interface Sealed {
  iv: string;
  data: string;
}

export interface VaultFile {
  version: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  /** Texte connu chiffré, pour vérifier le mot de passe. */
  check: Sealed;
  index: Sealed;
}

const CHECK_TEXT = 'string-coach-vault-v1';
export const DEFAULT_ITERATIONS = 600_000;
const subtle = () => globalThis.crypto.subtle;

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

export function randomId(): string {
  return [...randomBytes(12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations = DEFAULT_ITERATIONS): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function exportKey(key: CryptoKey): Promise<string> {
  return toB64(new Uint8Array(await subtle().exportKey('raw', key)));
}

export async function importKey(raw: string): Promise<CryptoKey> {
  return subtle().importKey('raw', fromB64(raw), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

/** Chiffre des octets : iv (12 octets) + texte chiffré. */
export async function encryptBytes(key: CryptoKey, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, data));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv, 0);
  out.set(ct, 12);
  return out;
}

export async function decryptBytes(key: CryptoKey, blob: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const iv = blob.slice(0, 12);
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv }, key, blob.slice(12)));
}

async function seal(key: CryptoKey, text: string): Promise<Sealed> {
  const iv = randomBytes(12);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return { iv: toB64(iv), data: toB64(new Uint8Array(ct)) };
}

async function unseal(key: CryptoKey, s: Sealed): Promise<string> {
  const pt = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(s.iv) }, key, fromB64(s.data));
  return new TextDecoder().decode(pt);
}

export class WrongPasswordError extends Error {
  constructor() {
    super('Mot de passe incorrect');
  }
}

/** Crée un coffre vide protégé par un mot de passe. */
export async function createVault(password: string, iterations = DEFAULT_ITERATIONS): Promise<{ vault: VaultFile; key: CryptoKey }> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt, iterations);
  const vault: VaultFile = {
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toB64(salt) },
    check: await seal(key, CHECK_TEXT),
    index: await seal(key, '[]'),
  };
  return { vault, key };
}

/** Vérifie la clé et renvoie la liste des chansons. */
export async function openVault(vault: VaultFile, key: CryptoKey): Promise<VaultEntry[]> {
  try {
    if ((await unseal(key, vault.check)) !== CHECK_TEXT) throw new WrongPasswordError();
  } catch {
    throw new WrongPasswordError();
  }
  return JSON.parse(await unseal(key, vault.index)) as VaultEntry[];
}

export async function unlockVault(vault: VaultFile, password: string): Promise<{ key: CryptoKey; entries: VaultEntry[] }> {
  const key = await deriveKey(password, fromB64(vault.kdf.salt), vault.kdf.iterations);
  return { key, entries: await openVault(vault, key) };
}

/** Ajoute des fichiers : renvoie le nouveau vault.json et les fichiers chiffrés à publier. */
export async function addToVault(
  vault: VaultFile,
  key: CryptoKey,
  entries: VaultEntry[],
  files: { fileName: string; data: Uint8Array<ArrayBuffer> }[],
): Promise<{ vault: VaultFile; entries: VaultEntry[]; blobs: { path: string; data: Uint8Array<ArrayBuffer> }[] }> {
  const added: VaultEntry[] = [];
  const blobs: { path: string; data: Uint8Array<ArrayBuffer> }[] = [];
  for (const f of files) {
    const id = randomId();
    blobs.push({ path: `${id}.bin`, data: await encryptBytes(key, f.data) });
    added.push({ id, name: f.fileName.replace(/\.[^.]+$/, ''), fileName: f.fileName, size: f.data.length, addedAt: Date.now() });
  }
  const all = [...entries, ...added].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return { vault: { ...vault, index: await seal(key, JSON.stringify(all)) }, entries: all, blobs };
}

export async function removeFromVault(vault: VaultFile, key: CryptoKey, entries: VaultEntry[], id: string) {
  const all = entries.filter((e) => e.id !== id);
  return { vault: { ...vault, index: await seal(key, JSON.stringify(all)) }, entries: all };
}
