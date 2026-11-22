import type { Progress, SongRecord } from '../game/progress';

/** Données synchronisées d'un compte. */
export interface CloudData {
  progress: Progress;
  bpmBySong: Record<string, number>;
  updatedAt: number;
}

const maxStr = (a?: string | null, b?: string | null) => (!a ? b ?? null : !b ? a : a > b ? a : b);

function mergeSong(a: SongRecord | undefined, b: SongRecord | undefined): SongRecord {
  if (!a) return b!;
  if (!b) return a;
  const newer = a.lastPlayed >= b.lastPlayed ? a : b;
  return {
    best: Math.max(a.best, b.best),
    stars: Math.max(a.stars, b.stars) as SongRecord['stars'],
    plays: Math.max(a.plays, b.plays),
    lastPlayed: Math.max(a.lastPlayed, b.lastPlayed),
    cleanStreak: newer.cleanStreak,
    reviewStage: newer.reviewStage,
    nextReview: newer.nextReview,
  };
}

/** Fusion de deux progressions (deux appareils) sans rien perdre : on garde le meilleur de chaque. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const songs: Record<string, SongRecord> = {};
  for (const id of new Set([...Object.keys(a.songs), ...Object.keys(b.songs)])) songs[id] = mergeSong(a.songs[id], b.songs[id]);
  const badges: Record<string, number> = { ...b.badges };
  for (const [id, t] of Object.entries(a.badges)) badges[id] = badges[id] ? Math.min(badges[id], t) : t;
  const streakSrc = (a.streak.lastDay ?? '') >= (b.streak.lastDay ?? '') ? a.streak : b.streak;
  const daily =
    a.daily.day === b.daily.day
      ? { day: a.daily.day, minutes: Math.max(a.daily.minutes, b.daily.minutes), goal: Math.max(a.daily.goal, b.daily.goal) }
      : a.daily.day > b.daily.day
        ? a.daily
        : b.daily;
  const course = { ...(b.course ?? {}) };
  for (const [inst, c] of Object.entries(a.course ?? {})) {
    const o = course[inst];
    course[inst] = !o ? c : { ...c, week: Math.max(c.week, o.week), sessions: [...new Set([...c.sessions, ...o.sessions])].sort().slice(-60) };
  }
  return {
    version: 1,
    xp: Math.max(a.xp, b.xp),
    streak: { count: streakSrc.count, lastDay: streakSrc.lastDay, best: Math.max(a.streak.best, b.streak.best) },
    daily,
    songs,
    badges,
    totals: {
      notes: Math.max(a.totals.notes, b.totals.notes),
      perfect: Math.max(a.totals.perfect, b.totals.perfect),
      songsFinished: Math.max(a.totals.songsFinished, b.totals.songsFinished),
      minutes: Math.max(a.totals.minutes, b.totals.minutes),
      bestCombo: Math.max(a.totals.bestCombo, b.totals.bestCombo),
    },
    challengeDoneDay: maxStr(a.challengeDoneDay, b.challengeDoneDay),
    validated: { ...(b.validated ?? {}), ...(a.validated ?? {}) },
    course,
  };
}
