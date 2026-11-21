import type { InstrumentId } from '../songs/instruments';
import type { ViewMode } from '../ui/score-view';

/** Préférences propres à chaque appareil. */
export interface Prefs {
  instrument: InstrumentId;
  view: ViewMode;
  tolerance: number;
  speed: number;
  showNeck: boolean;
  /** Mode jeu : la mélodie est jouée pendant qu'on joue (à couper avec des haut-parleurs). */
  guide: boolean;
  /** Mode jeu : retard du micro à compenser (ms). */
  latencyMs: number;
}

const KEY = 'string-coach:prefs';
const DEFAULTS: Prefs = {
  instrument: 'violin',
  view: 'score-tab',
  tolerance: 35,
  speed: 1,
  showNeck: true,
  guide: true,
  latencyMs: 80,
};

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const prefs: Prefs = load();

export function savePrefs(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}
