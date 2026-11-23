import type { Song } from '../songs/alphatex';

/** Morceaux personnels (transcriptions) : gardés uniquement sur cet appareil. */
const KEY = 'string-coach:user-songs';

export function userSongs(): Song[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveUserSong(song: Song): void {
  const all = userSongs().filter((s) => s.id !== song.id);
  all.unshift(song);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteUserSong(id: string): void {
  localStorage.setItem(KEY, JSON.stringify(userSongs().filter((s) => s.id !== id)));
}

/** Ajoute ou remplace plusieurs morceaux d'un coup (import de bibliothèque). */
export function saveUserSongs(songs: Song[]): void {
  const ids = new Set(songs.map((s) => s.id));
  const all = [...songs, ...userSongs().filter((s) => !ids.has(s.id))];
  localStorage.setItem(KEY, JSON.stringify(all));
}
