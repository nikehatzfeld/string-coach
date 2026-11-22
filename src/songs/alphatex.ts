import type { Instrument } from './instruments';
import { bestOctaveShift, placeMelody, positionLabel, solfege } from './positions';
import { backingKindFor, backingTracks, hasChords, type BackingKind } from './backing';
import { parseNotation, type ParsedBar } from './notation';

export const STYLE_ORDER = [
  'Comptines',
  'Chanson française',
  'Classique',
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
  return song.backing !== false && hasChords(parseNotation(song.notation));
}

const NAMES_PLACEHOLDER = '%%NOMS%%';
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

  let k = 0;
  let lastString = 1;
  let lastPosition = 1;
  const names: string[] = [];
  const body = bars
    .map((bar) =>
      bar
        .map((ev) => {
          const dur = DUR_TEX[ev.duration];
          const effects: string[] = [];
          if (ev.dotted) effects.push('d');
          if (ev.chord) effects.push(`ch "${escape(ev.chord)}"`);
          if (ev.kind === 'rest') {
            const fx = effects.length ? `{${effects.join(' ')}}` : '';
            return `r.${dur}${fx}`;
          }
          if (ev.kind === 'tie') {
            names.push('_');
            const fx = effects.length ? `{${effects.join(' ')}}` : '';
            return `-.${lastString}.${dur}${fx}`;
          }
          const p = placed[k];
          const first = k === 0;
          k++;
          // Changement de position (une corde à vide ne change pas la position de la main).
          if (p.finger !== 0 && (p.position !== lastPosition || (first && usesShifts))) {
            effects.push(`txt "${first ? '' : '→ '}${positionLabel(p.position, inst)}"`);
            lastPosition = p.position;
          }
          lastString = p.string;
          names.push(solfege(p.midi, !!ev.flat));
          const fx = effects.length ? `{${effects.join(' ')}}` : '';
          const lf = p.finger > 0 ? `{lf ${p.finger + 1}}` : '';
          return `${p.fret}.${p.string}${lf}.${dur}${fx}`;
        })
        .join(' '),
    )
    .join(' |\n');

  const melody = `${header.replace(NAMES_PLACEHOLDER, escape(names.join(' ')))}\n${body}`;
  const withBacking = (opts.backing ?? true) && song.backing !== false && hasChords(bars);
  if (!withBacking) return melody;
  return `${melody}\n${backingTracks(bars, song.timeSignature, song.backing || backingKindFor(song.style))}`;
}
