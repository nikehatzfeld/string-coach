import type { Song } from '../songs/alphatex';

/**
 * Morceaux personnels (transcriptions, imports) : sur l'appareil, et synchronisés dans le compte
 * de l'utilisateur quand il est connecté (sauf les instrus audio, trop lourdes, qui restent locales).
 */
const KEY = 'string-coach:user-songs';
const DELETED = 'string-coach:user-songs-deleted';

export type UserSong = Song & { savedAt?: number };

const read = <T>(k: string, def: T): T => {
  try {
    const v = JSON.parse(localStorage.getItem(k) ?? 'null');
    return v ?? def;
  } catch {
    return def;
  }
};

export function userSongs(): UserSong[] {
  const v = read<UserSong[]>(KEY, []);
  return Array.isArray(v) ? v : [];
}

/** Identifiants supprimés (pour ne pas les faire revenir depuis un autre appareil). */
export function deletedUserSongs(): string[] {
  const v = read<string[]>(DELETED, []);
  return Array.isArray(v) ? v : [];
}

function write(all: UserSong[], deleted = deletedUserSongs()): void {
  localStorage.setItem(KEY, JSON.stringify(all));
  localStorage.setItem(DELETED, JSON.stringify(deleted.slice(-500)));
  dispatchEvent(new Event('user-songs-changed'));
}

export function saveUserSong(song: Song): void {
  const all = userSongs().filter((s) => s.id !== song.id);
  all.unshift({ ...song, savedAt: Date.now() });
  write(all, deletedUserSongs().filter((id) => id !== song.id));
}

export function deleteUserSong(id: string): void {
  write(
    userSongs().filter((s) => s.id !== id),
    [...deletedUserSongs().filter((x) => x !== id), id],
  );
}

/** Ajoute ou remplace plusieurs morceaux d'un coup (import de bibliothèque). */
export function saveUserSongs(songs: Song[]): void {
  const now = Date.now();
  const ids = new Set(songs.map((s) => s.id));
  write(
    [...songs.map((s) => ({ ...s, savedAt: now })), ...userSongs().filter((s) => !ids.has(s.id))],
    deletedUserSongs().filter((id) => !ids.has(id)),
  );
}

/** Fusion de deux appareils : le plus récent de chaque morceau, sans ceux supprimés d'un côté ou de l'autre. */
export function mergeUserSongs(local: UserSong[], remote: UserSong[], deleted: string[]): UserSong[] {
  const gone = new Set(deleted);
  const by = new Map<string, UserSong>();
  for (const s of [...remote, ...local]) {
    if (gone.has(s.id)) continue;
    const cur = by.get(s.id);
    if (!cur || (s.savedAt ?? 0) >= (cur.savedAt ?? 0)) by.set(s.id, s);
  }
  return [...by.values()].sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
}

/** Remplace les morceaux locaux par le résultat d'une fusion (sans redéclencher de synchronisation). */
export function replaceUserSongs(all: UserSong[], deleted: string[]): void {
  localStorage.setItem(KEY, JSON.stringify(all));
  localStorage.setItem(DELETED, JSON.stringify(deleted.slice(-500)));
}
