import type { Level, Song, Style } from './alphatex';
import { STYLE_ORDER } from './alphatex';
import { parseChordName } from './chords';
import type { InstrumentId } from './instruments';
import { lyricSyllables } from './lyrics';
import { barBeats, parseNotation } from './notation';

/**
 * Import d'une bibliothèque au format « string-coach-library » (voir docs/format-bibliotheque.md).
 * Chaque morceau est vérifié : mélodie lisible et mesures complètes, accords connus, paroles calées.
 */
export interface ImportSong {
  title: string;
  artist?: string;
  year?: number;
  instruments?: InstrumentId[];
  style?: string;
  level?: number;
  tempo?: number;
  timeSignature?: [number, number];
  key?: string;
  notation?: string;
  lyrics?: string;
  chords?: string;
  source?: { url?: string; license?: string };
}

export interface ImportReport {
  songs: Song[];
  errors: string[];
  warnings: string[];
}

const IDS: InstrumentId[] = ['violin', 'guitar', 'recorder', 'voice'];

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

/** Grille d'accords « G | D Em | C » → notation en silences portant les accords (accompagnement seul). */
export function chordsToNotation(grid: string, ts: [number, number]): string {
  const beats = (ts[0] * 4) / ts[1];
  return grid
    .split('|')
    .map((b) => b.trim().split(/\s+/).filter(Boolean))
    .filter((b) => b.length)
    .map((cs) => {
      const each = beats / cs.length;
      return cs
        .map((c) => {
          const d = each >= 4 ? 'r:1' : each >= 3 ? 'r:2.' : each >= 2 ? 'r:2' : each >= 1.5 ? 'r:4.' : 'r:4';
          return c === '.' || c === '%' ? d : `${d}@${c}`;
        })
        .join(' ');
    })
    .join(' | ');
}

export function importLibrary(json: unknown): ImportReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const songs: Song[] = [];
  const data = json as { format?: string; songs?: ImportSong[] };
  const list = Array.isArray(json) ? (json as ImportSong[]) : data?.songs;
  if (!Array.isArray(list)) return { songs, errors: ['Fichier non reconnu : il faut un objet { "format": "string-coach-library", "songs": [...] }.'], warnings };
  list.forEach((s, i) => {
    const name = `#${i + 1} « ${s?.title ?? '?'} »`;
    if (!s || typeof s.title !== 'string' || !s.title.trim()) return void errors.push(`${name} : titre manquant`);
    const ts: [number, number] = Array.isArray(s.timeSignature) && s.timeSignature.length === 2 ? [Number(s.timeSignature[0]), Number(s.timeSignature[1])] : [4, 4];
    let notation = (s.notation ?? '').trim();
    // Accords : tous reconnus ?
    if (s.chords) {
      const bad = s.chords
        .split(/[\s|]+/)
        .filter((c) => c && c !== '.' && c !== '%')
        .filter((c) => !parseChordName(c));
      if (bad.length) return void errors.push(`${name} : accords inconnus ${[...new Set(bad)].join(', ')}`);
    }
    if (!notation && s.chords) notation = chordsToNotation(s.chords, ts);
    if (!notation) return void errors.push(`${name} : ni mélodie (notation) ni accords (chords)`);
    let bars;
    try {
      bars = parseNotation(notation);
    } catch (e) {
      return void errors.push(`${name} : notation illisible (${(e as Error).message})`);
    }
    const full = (ts[0] * 4) / ts[1];
    const wrong = bars.map((b, k) => ({ k, v: barBeats(b) })).filter(({ k, v }, _, arr) => Math.abs(v - full) > 0.01 && k !== 0 && k !== arr.length - 1);
    if (wrong.length) return void errors.push(`${name} : mesures ${wrong.slice(0, 5).map((w) => w.k + 1).join(', ')} incomplètes (${full} temps attendus)`);
    let lyrics = s.lyrics?.trim() || undefined;
    if (lyrics) {
      const n = bars.flat().filter((e) => e.kind === 'note').length;
      const syl = lyricSyllables(lyrics).length;
      if (n === 0) {
        warnings.push(`${name} : paroles sans mélodie, ignorées (seule la grille d'accords est gardée)`);
        lyrics = undefined;
      } else if (syl !== n) warnings.push(`${name} : ${syl} syllabes pour ${n} notes, le calage sera approximatif`);
    }
    const instruments = (s.instruments ?? []).filter((x) => IDS.includes(x));
    const style: Style = (STYLE_ORDER as readonly string[]).includes(s.style ?? '') ? (s.style as Style) : 'Mes morceaux';
    songs.push({
      id: `lib-${slug(`${s.title}-${s.artist ?? ''}`)}`,
      title: s.title.trim(),
      composer: [s.artist, s.year].filter(Boolean).join(' · ') || 'Import',
      style,
      level: Math.max(1, Math.min(5, Math.round(Number(s.level) || 2))) as Level,
      tempo: Math.max(30, Math.min(240, Math.round(Number(s.tempo) || 90))),
      timeSignature: ts,
      ...(s.key ? { key: s.key } : {}),
      notation,
      ...(lyrics ? { lyrics } : {}),
      ...(s.chords ? { chords: s.chords } : {}),
      ...(instruments.length ? { instruments } : {}),
      ...(s.source?.url ? { source: { url: s.source.url, license: s.source.license ?? '' } } : {}),
    });
  });
  return { songs, errors, warnings };
}
