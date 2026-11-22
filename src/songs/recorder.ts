/**
 * Doigtés de la flûte à bec soprano, système baroque (« anglais »), notes écrites Do4 → Ré6
 * (la soprano sonne une octave plus haut).
 * Source : The Woodwind Fingering Guide, tableaux de base de la flûte à bec
 * (wfg.woodwind.org/recorder/rec_bas_1.html à rec_bas_3.html).
 * Trous : pouce (0), main gauche 1-2-3, main droite 4-5-6-7 (6 et 7 sont doubles).
 * X = bouché, O = ouvert, H = demi-bouché (pouce entrouvert, ou un seul petit trou pour 6 et 7).
 */
export type Hole = 'X' | 'O' | 'H';

const CHART: [string, string][] = [
  ['C4', 'XXXX XXXX'],
  ['C#4', 'XXXX XXXH'],
  ['D4', 'XXXX XXXO'],
  ['D#4', 'XXXX XXHO'],
  ['E4', 'XXXX XXOO'],
  ['F4', 'XXXX XOXX'],
  ['F#4', 'XXXX OXXO'],
  ['G4', 'XXXX OOOO'],
  ['G#4', 'XXXO XXHO'],
  ['A4', 'XXXO OOOO'],
  ['A#4', 'XXOX XOOO'],
  ['B4', 'XXOO OOOO'],
  ['C5', 'XOXO OOOO'],
  ['C#5', 'OXXO OOOO'],
  ['D5', 'OOXO OOOO'],
  ['D#5', 'OOXX XXXO'],
  ['E5', 'HXXX XXOO'],
  ['F5', 'HXXX XOXO'],
  ['F#5', 'HXXX OXOO'],
  ['G5', 'HXXX OOOO'],
  ['G#5', 'HXXO XOOO'],
  ['A5', 'HXXO OOOO'],
  ['A#5', 'HXXO XXXO'],
  ['B5', 'HXXO XXOO'],
  ['C6', 'HXOO XXOO'],
  ['C#6', 'HXOX XOXO'],
  ['D6', 'HXOX XOXO'],
];

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const RECORDER_FINGERINGS: Map<number, Hole[]> = new Map(
  CHART.map(([n, f]) => {
    const m = /^([A-G]#?)(\d)$/.exec(n)!;
    const midi = NAMES.indexOf(m[1]) + (Number(m[2]) + 1) * 12;
    return [midi, [...f.replace(' ', '')] as Hole[]];
  }),
);

/** Remarque de jeu pour certaines notes. */
export function recorderTip(midi: number): string {
  if (midi === 60) return 'Tout bouché, souffle très doux';
  if (midi === 61) return 'Do♯ : la moitié du double trou du bas';
  if (midi === 65) return 'Fa : doigté fourché';
  if (midi === 73) return 'Do♯ aigu : sans le pouce';
  if (midi === 85) return 'Do♯ aigu : boucher aussi le pavillon contre la jambe';
  if (midi >= 76) return 'Pouce entrouvert (ongle contre le trou), souffle un peu plus';
  return '';
}

export const RECORDER_RANGE: [number, number] = [60, 86];
