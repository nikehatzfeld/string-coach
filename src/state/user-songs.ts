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
