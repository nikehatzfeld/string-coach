import type { NoteLog } from './metrics';

/** Résultat d'un passage, transmis par le lecteur (pas à pas ou jeu). */
export interface PlayResult {
  songId: string;
  mode: 'step' | 'game';
  accuracy: number;
  stars: number;
  bpm: number;
  log: NoteLog[];
}

/** Un écran (évaluation, séance guidée) peut prendre la main à la fin d'un passage. */
type Hook = (r: PlayResult) => boolean | Promise<boolean>;
let hook: Hook | null = null;
export const setPlayHook = (h: Hook | null): void => void (hook = h);
export const playHook = (): Hook | null => hook;
