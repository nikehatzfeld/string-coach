import type { Instrument, InstrumentId } from './instruments';
import { bestOctaveShift, placeMelody, positionLabel, solfege, type Placed } from './positions';
import { backingKindFor, backingTracks, hasChords, type BackingKind } from './backing';
import { parseNotation, type ParsedBar } from './notation';
import { lyricsOf, lyricSyllables } from './lyrics';
import { harmonize, needsHarmony } from './harmonize';

export const STYLE_ORDER = [
  'Raps originaux',
  'Mes morceaux',
  'Comptines',
  'Chanson française',
  'Classique',
  'Cinéma & TV',
  'Années 80',
  'Années 90',
  'Pop & rock',
  'Variété française',
  'Rap US',
  'Rap français',
  'R&B & soul',
  'Reggae',
  'Électro & dance',
  'Comédies musicales',
  'Noël',
  'Folk & monde',
  'Chants & cantiques',
  'Gospel & jazz',
  'Blues',
  'Fêtes',
  'Gammes & arpèges',
  'Exercices',
] as const;
export type Style = (typeof STYLE_ORDER)[number];

export type Level = 1 | 2 | 3 | 4 | 5;

export interface Song {
  id: string;
  title: string;
  composer: string;
  style: Style;
  level: Level;
  tempo: number;
  timeSignature: [number, number];
  /** Armure alphaTex : 'G', 'Bb', 'eminor'… */
  key?: string;
  notation: string;
  /** Accompagnement : déduit du style si absent ; false pour aucun. */
  backing?: BackingKind | false;
  /** Parties pour apprendre par morceaux : [nom, 1re mesure, dernière mesure] (1 = première mesure). */
  sections?: [string, number, number][];
  /** Exercice joué sur une seule corde (1 = la plus aiguë) ou dans une position imposée. */
  string?: number;
  position?: number;
  /** Incontournable (filtre « ⭐ Incontournables » de l'accueil). */
  famous?: boolean;
  /** Instrument d'origine de la partition importée (catalogue Mutopia : Violin, Flute, Voice, Piano…). */
  origin?: string;
  /** Instru audio personnelle (IndexedDB) jouée en play-along ; offset = instant (s) de la 1re note de la mélodie. */
  audio?: { id: string; offset: number };
  /** Passages chantés détectés dans l'audio (s, temps de la partition) : sert à recaler des paroles. */
  voiceSegments?: [number, number][];
  /** Karaoké calé dans le temps (s depuis le début de la partition). */
  timedLyrics?: { t: number; s: string; line?: boolean }[];
  /** Paroles importées (une syllabe par note, tirets entre syllabes d'un mot). */
  lyrics?: string;
  /** Grille d'accords importée (« G | D | Em | C ») pour le lecteur d'accords. */
  chords?: string;
  /** Partition complète prête à afficher (guitare classique : basse + mélodie), prioritaire sur la notation. */
  tex?: string;
  /** Instruments pour lesquels le morceau est proposé (sinon déduit du style et de l'origine). */
  instruments?: InstrumentId[];
  /** Morceau complet importé d'une partition libre (source et licence à créditer). */
  source?: { url: string; license: string };
}

export interface Section {
  name: string;
  first: number; // index de mesure, à partir de 0
  last: number;
}

/** Parties d'un morceau : celles définies, sinon des tranches de 4 mesures (8 si le morceau est long). */
export function sectionsFor(barCount: number, defined?: [string, number, number][]): Section[] {
  if (defined?.length) return defined.map(([name, a, b]) => ({ name, first: a - 1, last: Math.min(b, barCount) - 1 }));
  if (barCount <= 8) return [];
  const size = barCount > 40 ? 8 : 4;
  const out: Section[] = [];
  for (let first = 0; first < barCount; first += size) {
    let last = Math.min(barCount, first + size) - 1;
    // Une dernière tranche trop courte rejoint la précédente.
    if (barCount - 1 - last > 0 && barCount - 1 - last < size / 2) last = barCount - 1;
    out.push({ name: `Partie ${out.length + 1}`, first, last });
    if (last === barCount - 1) break;
  }
  return out;
}

/** Le morceau a-t-il un accompagnement (accords notés) ? */
export function songHasBacking(song: Song): boolean {
  return !!backingBars(song, parseNotation(song.notation));
}

/** Accords de l'accompagnement : ceux notés, sinon harmonisation automatique (pas pour les exercices). */
function backingBars(song: Song, bars: ParsedBar[]): ParsedBar[] | null {
  if (song.backing === false) return null;
  if (!needsHarmony(bars)) return hasChords(bars) ? bars : null;
  if (song.style === 'Exercices' || song.style === 'Gammes & arpèges' || song.id.startsWith('ex-') || song.id.startsWith('tx-')) return hasChords(bars) ? bars : null;
  const h = harmonize(bars, song.timeSignature);
  return hasChords(h) ? h : null;
}

const NAMES_PLACEHOLDER = '%%NOMS%%';

/** 2e ligne de texte : paroles (domaine public) si le morceau en a, une syllabe par note. */
function lyricsLine(song: Song, bars: ParsedBar[]): string {
  const text = lyricsOf(song);
  if (!text) return '';
  const syl = lyricSyllables(text);
  let k = 0;
  const out: string[] = [];
  for (const ev of bars.flat()) {
    if (ev.kind === 'note') out.push(syl[k++] ?? '');
    else if (ev.kind === 'tie') out.push('_');
  }
  return `\\lyrics "${escape(out.join(' '))}"`;
}
const DUR_TEX: Record<number, string> = { 1: '1', 2: '2', 4: '4', 8: '8', 16: '16' };

function escape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function songMidiRange(bars: ParsedBar[]): [number, number] {
  const notes = bars.flat().filter((e) => e.kind === 'note').map((e) => e.midi as number);
  return [Math.min(...notes), Math.max(...notes)];
}

/** Convertit un morceau de la bibliothèque en alphaTex pour un instrument. */
export function songToAlphaTex(song: Song, inst: Instrument, opts: { backing?: boolean; keySignature?: boolean } = {}): string {
  if (song.tex && inst.id === 'guitar') return song.tex;
  if (inst.kind !== 'strings') return melodicToAlphaTex(song, inst, opts);
  const bars = parseNotation(song.notation);
  // Exercices à corde ou position imposée : hauteurs telles qu'écrites.
  const shift =
    song.string || song.position
      ? 0
      : bestOctaveShift(
          bars.flat().filter((e) => e.kind === 'note').map((e) => e.midi as number),
          inst,
        );
  const [num, den] = song.timeSignature;

  const header = [
    `\\title "${escape(song.title)}"`,
    `\\artist "${escape(song.composer)}"`,
    `\\tempo ${song.tempo}`,
    `\\ts (${num} ${den})`,
    ...(song.key && opts.keySignature !== false ? [`\\ks ${song.key}`] : []),
    `\\track "${inst.label}"`,
    `\\lyrics "${NAMES_PLACEHOLDER}"`,
    ...(lyricsOf(song) ? [lyricsLine(song, bars)] : []),
    `\\staff {score tabs}`,
    `\\instrument ${inst.alphaTexInstrument}`,
    `\\tuning (${inst.tuningNames.join(' ')})`,
  ].join('\n');

  // Doigtés et positions calculés sur toute la mélodie (les liaisons gardent la note précédente).
  const events = bars.flat();
  const sounding = events.filter((e) => e.kind === 'note');
  // Notes hors tessiture (au-delà de la 17e case, ou sous la corde la plus grave) : ramenées d'une octave.
  // Passages hors tessiture : on décale la mesure entière d'une octave (pas note par note, ce qui
  // créerait des sauts absurdes), en gardant le même décalage tant qu'il convient.
  const ceiling = Math.max(...inst.tuning) + 17;
  const floor = Math.min(...inst.tuning);
  const fits = (lo: number, hi: number, t: number) => lo + t >= floor && hi + t <= ceiling;
  let barShift = 0;
  const shiftByEvent = new Map<object, number>();
  for (const bar of bars) {
    const ms = bar.filter((e) => e.kind !== 'rest').map((e) => (e.midi as number) + shift);
    if (ms.length) {
      const lo = Math.min(...ms);
      const hi = Math.max(...ms);
      if (!fits(lo, hi, barShift)) {
        const options = [0, -12, 12, -24, 24].filter((t) => fits(lo, hi, t));
        barShift = options.length ? options[0] : 0;
      }
    }
    for (const e of bar) shiftByEvent.set(e, barShift);
  }
  const fold = (m: number) => {
    while (m > ceiling) m -= 12;
    while (m < floor) m += 12;
    return m;
  };
  const placed = placeMelody(sounding.map((e) => fold((e.midi as number) + shift + (shiftByEvent.get(e) ?? 0))), inst, { onlyString: song.string, position: song.position });
  const usesShifts = placed.some((p) => p.position !== 1);

  // 1re passe : effets de chaque événement. Un changement de position est annoncé sur l'événement
  // précédent (note, silence ou liaison) pour être lu avant de jouer la note d'arrivée.
  type Tok = { ev: (typeof bars)[number][number]; effects: string[]; p?: Placed; string: number };
  const toks: Tok[][] = [];
  const flatToks: Tok[] = [];
  let k = 0;
  let lastString = 1;
  let lastPosition = 1;
  const names: string[] = [];
  for (const bar of bars) {
    const row: Tok[] = [];
    for (const ev of bar) {
      const effects: string[] = [];
      if (ev.dotted) effects.push('d');
      if (ev.chord) effects.push(`ch "${escape(ev.chord)}"`);
      const tok: Tok = { ev, effects, string: lastString };
      if (ev.kind === 'tie') names.push('_');
      if (ev.kind === 'note') {
        const p = placed[k];
        const first = k === 0;
        k++;
        // Une corde à vide ne change pas la position de la main.
        if (p.finger !== 0 && (p.position !== lastPosition || (first && usesShifts))) {
          const prev = flatToks[flatToks.length - 1];
          if (first || !prev) effects.push(`txt "${positionLabel(p.position, inst)}"`);
          else prev.effects.push(`txt "→ ${positionLabel(p.position, inst)}"`);
          lastPosition = p.position;
        }
        lastString = p.string;
        tok.p = p;
        tok.string = p.string;
        names.push(solfege(p.midi, !!ev.flat));
      }
      row.push(tok);
      flatToks.push(tok);
    }
    toks.push(row);
  }
  const body = toks
    .map((row) =>
      row
        .map(({ ev, effects, p, string }) => {
          const dur = DUR_TEX[ev.duration];
          const fx = effects.length ? `{${effects.join(' ')}}` : '';
          if (ev.kind === 'rest') return `r.${dur}${fx}`;
          if (ev.kind === 'tie') return `-.${string}.${dur}${fx}`;
          const lf = p!.finger > 0 ? `{lf ${p!.finger + 1}}` : '';
          return `${p!.fret}.${p!.string}${lf}.${dur}${fx}`;
        })
        .join(' '),
    )
    .join(' |\n');

  const melody = `${header.replace(NAMES_PLACEHOLDER, escape(names.join(' ')))}\n${body}`;
  const harm = backingBars(song, bars);
  if (!(opts.backing ?? true) || !harm) return melody;
  return `${melody}\n${backingTracks(harm, song.timeSignature, song.backing || backingKindFor(song.style))}`;
}

const TEX_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const TEX_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Flûte, voix : partition seule (hauteurs écrites), mélodie ramenée dans la tessiture,
 * mesure par mesure pour éviter les sauts d'octave au milieu d'une phrase.
 */
function melodicToAlphaTex(song: Song, inst: Instrument, opts: { backing?: boolean; keySignature?: boolean }): string {
  const bars = parseNotation(song.notation);
  const [low, high] = inst.range ?? [55, 84];
  const [num, den] = song.timeSignature;
  const all = bars.flat().filter((e) => e.kind === 'note').map((e) => e.midi as number);
  const count = (t: number) => all.filter((m) => m + t >= low && m + t <= high).length;
  const global = [0, 12, -12, 24, -24].reduce((b, t) => (count(t) > count(b) ? t : b), 0);
  const fits = (lo: number, hi: number, t: number) => lo + t >= low && hi + t <= high;
  let barShift = global;
  const fold = (m: number) => {
    while (m > high) m -= 12;
    while (m < low) m += 12;
    return m;
  };
  const names: string[] = [];
  let last = '';
  const body = bars
    .map((bar) => {
      const ms = bar.filter((e) => e.kind === 'note').map((e) => e.midi as number);
      if (ms.length) {
        const lo = Math.min(...ms);
        const hi = Math.max(...ms);
        if (!fits(lo, hi, barShift)) {
          const o = [global, global - 12, global + 12, global - 24, global + 24].filter((t) => fits(lo, hi, t));
          barShift = o.length ? o[0] : global;
        }
      }
      return bar
        .map((ev) => {
          const dur = DUR_TEX[ev.duration];
          const effects: string[] = [];
          if (ev.dotted) effects.push('d');
          if (ev.chord) effects.push(`ch "${escape(ev.chord)}"`);
          const fx = effects.length ? `{${effects.join(' ')}}` : '';
          if (ev.kind === 'rest') return `r.${dur}${fx}`;
          if (ev.kind === 'tie') {
            names.push('_');
            return last ? `${last}{-}.${dur}${fx}` : `r.${dur}${fx}`;
          }
          const m = fold((ev.midi as number) + barShift);
          last = `${(ev.flat ? TEX_FLAT : TEX_SHARP)[m % 12]}${Math.floor(m / 12) - 1}`;
          names.push(solfege(m, !!ev.flat));
          return `${last}.${dur}${fx}`;
        })
        .join(' ');
    })
    .join(' |\n');
  const header = [
    `\\title "${escape(song.title)}"`,
    `\\artist "${escape(song.composer)}"`,
    `\\tempo ${song.tempo}`,
    `\\ts (${num} ${den})`,
    ...(song.key && opts.keySignature !== false ? [`\\ks ${song.key}`] : []),
    `\\track "${inst.label}"`,
    `\\lyrics "${escape(names.join(' '))}"`,
    ...(lyricsOf(song) ? [lyricsLine(song, bars)] : []),
    `\\staff {score}`,
    `\\instrument ${inst.alphaTexInstrument}`,
  ].join('\n');
  const melody = `${header}\n${body}`;
  const harm = backingBars(song, bars);
  if (!(opts.backing ?? true) || !harm) return melody;
  return `${melody}\n${backingTracks(harm, song.timeSignature, song.backing || backingKindFor(song.style))}`;
}
