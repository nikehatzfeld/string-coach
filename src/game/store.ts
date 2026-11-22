import { LIBRARY } from '../songs/library';
import { addPracticeTime, dailyChallenge, loadProgress, saveProgress, type Badge, type Challenge } from './progress';

/** Progression partagée par toutes les vues + suivi du temps de pratique. */
export const progress = loadProgress();

export function todayChallenge(): Challenge | null {
  return dailyChallenge(LIBRARY.map((s) => ({ id: s.id, title: s.title, style: s.style, level: s.level })));
}

let activeSince: number | null = null;
let pendingMs = 0;
let onBadges: (b: Badge[]) => void = () => {};

export function onPracticeBadges(cb: (b: Badge[]) => void): void {
  onBadges = cb;
}

/** Marque le début / la fin d'une activité (lecture, micro). */
export function setPracticeActive(active: boolean): void {
  const now = performance.now();
  if (active && activeSince === null) activeSince = now;
  if (!active && activeSince !== null) {
    pendingMs += now - activeSince;
    activeSince = null;
    flushPractice();
  }
}

/** Reporte les minutes entières pratiquées dans la progression. */
export function flushPractice(): void {
  const now = performance.now();
  if (activeSince !== null) {
    pendingMs += now - activeSince;
    activeSince = now;
  }
  const minutes = Math.floor(pendingMs / 60000);
  if (minutes < 1) return;
  pendingMs -= minutes * 60000;
  const badges = addPracticeTime(progress, minutes);
  saveProgress(progress);
  afterSave();
  if (badges.length) onBadges(badges);
}

/** Appelé après chaque sauvegarde locale (synchronisation du compte). */
let afterSave: () => void = () => {};
export function onAfterSave(cb: () => void): void {
  afterSave = cb;
}

export function persist(): void {
  saveProgress(progress);
  afterSave();
}

setInterval(flushPractice, 30000);
addEventListener('pagehide', () => {
  setPracticeActive(false);
  persist();
});
