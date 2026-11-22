export type InstrumentId = 'violin' | 'guitar' | 'recorder' | 'voice';

export interface Instrument {
  id: InstrumentId;
  label: string;
  /** Instrument à cordes (manche, tablature) ou mélodique (partition seule). */
  kind: 'strings' | 'wind' | 'voice';
  icon: string;
  /** Tessiture écrite [grave, aigu] pour les instruments sans cordes. */
  range?: [number, number];
  /** Cordes de la plus aiguë à la plus grave (ordre alphaTex : corde 1 = plus aiguë). */
  tuning: number[];
  tuningNames: string[];
  stringNamesFr: string[];
  /** Case / demi-ton max conseillé pour un débutant. */
  maxFret: number;
  alphaTexInstrument: string;
  /** Profil d'affichage par défaut. */
  defaultView: 'score-tab' | 'score' | 'tab';
}

export const INSTRUMENTS: Record<InstrumentId, Instrument> = {
  violin: {
    id: 'violin',
    label: 'Violon',
    kind: 'strings',
    icon: '🎻',
    tuning: [76, 69, 62, 55],
    tuningNames: ['E5', 'A4', 'D4', 'G3'],
    stringNamesFr: ['Mi', 'La', 'Ré', 'Sol'],
    maxFret: 7,
    alphaTexInstrument: 'violin',
    defaultView: 'score-tab',
  },
  guitar: {
    id: 'guitar',
    label: 'Guitare',
    kind: 'strings',
    icon: '🎸',
    tuning: [64, 59, 55, 50, 45, 40],
    tuningNames: ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'],
    stringNamesFr: ['Mi aigu', 'Si', 'Sol', 'Ré', 'La', 'Mi grave'],
    maxFret: 12,
    alphaTexInstrument: 'acousticguitarsteel',
    defaultView: 'score-tab',
  },
  recorder: {
    id: 'recorder',
    label: 'Flûte à bec',
    kind: 'wind',
    icon: '🪈',
    // Soprano : écrite de Do4 à Ré6, sonne une octave plus haut.
    range: [60, 86],
    tuning: [],
    tuningNames: [],
    stringNamesFr: [],
    maxFret: 0,
    alphaTexInstrument: 'recorder',
    defaultView: 'score',
  },
  voice: {
    id: 'voice',
    label: 'Voix',
    kind: 'voice',
    icon: '🎤',
    // Voix « moyenne » : Sol3 à Sol5 ; une voix grave chante une octave plus bas (accepté).
    range: [55, 79],
    tuning: [],
    tuningNames: [],
    stringNamesFr: [],
    maxFret: 0,
    alphaTexInstrument: 'voiceoohs',
    defaultView: 'score',
  },
};

export const INSTRUMENT_IDS: InstrumentId[] = ['violin', 'guitar', 'recorder', 'voice'];

export interface Fingering {
  /** 1 = corde la plus aiguë. */
  string: number;
  fret: number;
}

/** Choisit la corde qui donne la case la plus basse (cordes à vide privilégiées, 1re position). */
export function fingerNote(midi: number, inst: Instrument): Fingering {
  let best: Fingering | null = null;
  inst.tuning.forEach((open, i) => {
    const fret = midi - open;
    if (fret < 0) return;
    if (!best || fret < best.fret) best = { string: i + 1, fret };
  });
  if (!best) throw new Error(`Note ${midi} trop grave pour ${inst.label}`);
  return best;
}

export function instrumentRange(inst: Instrument): [number, number] {
  if (inst.range) return inst.range;
  const low = Math.min(...inst.tuning);
  const high = Math.max(...inst.tuning) + inst.maxFret;
  return [low, high];
}

/** Décalage en octaves pour faire tenir une mélodie dans la tessiture de l'instrument. */
export function octaveShiftFor(minMidi: number, maxMidi: number, inst: Instrument): number {
  const [low, high] = instrumentRange(inst);
  let shift = 0;
  while (minMidi + shift < low) shift += 12;
  while (maxMidi + shift > high && minMidi + shift - 12 >= low) shift -= 12;
  return shift;
}
