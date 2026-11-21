import type { InstrumentId } from '../songs/instruments';
import type { ViewMode } from '../ui/score-view';

/** Préférences propres à chaque appareil. */
export interface Prefs {
  instrument: InstrumentId;
  /** Affichage par instrument : au violon, la partition avec doigtés est plus claire que la tablature en demi-tons. */
  views: Record<InstrumentId, ViewMode>;
  tolerance: number;
  speed: number;
  /** Tempo choisi par morceau (BPM). */
  bpmBySong: Record<string, number>;
  showNeck: boolean;
  /** Mode jeu : la mélodie est jouée pendant qu'on joue (à couper avec des haut-parleurs). */
  guide: boolean;
  /** Accompagnement play-along activé. */
  backing: boolean;
  /** Mode jeu : retard du micro à compenser (ms). */
  latencyMs: number;
}

const KEY = 'string-coach:prefs';
const DEFAULTS: Prefs = {
  instrument: 'violin',
  views: { violin: 'score', guitar: 'score-tab' },
  tolerance: 35,
  speed: 1,
  bpmBySong: {},
  showNeck: true,
  guide: true,
  backing: true,
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
