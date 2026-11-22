/**
 * Progression du joueur : XP, niveaux, série de jours, objectif quotidien,
 * records par morceau, badges et défi du jour. Logique pure (testable),
 * sauvegarde dans le stockage local de l'appareil.
 */

export type Stars = 0 | 1 | 2 | 3;

export interface SongRecord {
  best: number;
  stars: Stars;
  plays: number;
  lastPlayed: number;
  /** Passages propres consécutifs (justesse ≥ 95 %) au tempo courant. */
  cleanStreak?: number;
  /** Étape de révision espacée (0 = pas encore maîtrisé) et prochain jour de révision. */
  reviewStage?: number;
  nextReview?: string;
}

/** Règle de montée de tempo (sources : voir docs/pedagogie.md) : +4 BPM après 3 passages propres, −2 après un passage raté. */
export const TEMPO_RULE = { cleanAccuracy: 0.95, failAccuracy: 0.8, cleanNeeded: 3, up: 4, down: 2 };
/** Révisions espacées : J+1, J+3, J+7, J+14, puis tous les 30 jours. */
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30];

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

/** Morceaux à réviser aujourd'hui (les plus en retard d'abord). */
export function dueReviews(p: Progress, now = new Date()): string[] {
  const today = dayKey(now);
  return Object.entries(p.songs)
    .filter(([, r]) => r.nextReview && r.nextReview <= today)
    .sort((a, b) => (a[1].nextReview! < b[1].nextReview! ? -1 : 1))
    .map(([id]) => id);
}

export interface Progress {
  version: 1;
  xp: number;
  streak: { count: number; best: number; lastDay: string | null };
  daily: { day: string; minutes: number; goal: number };
  songs: Record<string, SongRecord>;
  badges: Record<string, number>;
  totals: { notes: number; perfect: number; songsFinished: number; minutes: number; bestCombo: number };
  challengeDoneDay: string | null;
  /** Parcours suivi par instrument : semaine courante, durée de séance, éléments faits par jour. */
  course?: Record<string, CourseState>;
}

export interface CourseState {
  week: number;
  length: 15 | 20 | 30;
  /** jour → clés des éléments faits */
  done: Record<string, string[]>;
  /** Jours où la séance complète a été faite. */
  sessions: string[];
}

export interface SongMeta {
  id: string;
  title: string;
  style: string;
  level: number;
}

export interface ResultInput {
  songId: string;
  style?: string;
  mode: 'step' | 'game';
  score: number;
  stars: Stars;
  notes: number;
  perfect: number;
  accuracy: number; // 0..1
  maxCombo: number;
}

export interface ResultOutcome {
  /** Changement de tempo conseillé (BPM) selon la règle de progression, 0 si aucun. */
  tempoChange: number;
  xpGained: number;
  newBest: boolean;
  newBadges: Badge[];
  challengeCompleted: boolean;
  levelBefore: number;
  levelAfter: number;
}

export const DAILY_GOAL_DEFAULT = 15;

export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

export function emptyProgress(now = new Date()): Progress {
  return {
    version: 1,
    xp: 0,
    streak: { count: 0, best: 0, lastDay: null },
    daily: { day: dayKey(now), minutes: 0, goal: DAILY_GOAL_DEFAULT },
    songs: {},
    badges: {},
    totals: { notes: 0, perfect: 0, songsFinished: 0, minutes: 0, bestCombo: 0 },
    challengeDoneDay: null,
  };
}

// ---------- Niveaux ----------
/** XP nécessaire pour passer du niveau n au niveau n+1. */
export function xpToNext(level: number): number {
  return 100 + 50 * (level - 1);
}

export function levelInfo(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let rest = xp;
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, into: rest, needed: xpToNext(level) };
}

const TITLES = ['Débutant', 'Apprenti', 'Musicien', 'Ménestrel', 'Virtuose', 'Maestro', 'Légende'];
export function levelTitle(level: number): string {
  return TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 3))];
}

// ---------- Série et temps de jeu ----------
function rollDay(p: Progress, now: Date): void {
  const today = dayKey(now);
  if (p.daily.day !== today) p.daily = { day: today, minutes: 0, goal: p.daily.goal };
}

/** Série en cours, en tenant compte d'un jour manqué. */
export function currentStreak(p: Progress, now = new Date()): number {
  const today = dayKey(now);
  if (p.streak.lastDay === today || p.streak.lastDay === previousDay(today)) return p.streak.count;
  return 0;
}

export function touchStreak(p: Progress, now: Date): void {
  const today = dayKey(now);
  if (p.streak.lastDay === today) return;
  p.streak.count = p.streak.lastDay === previousDay(today) ? p.streak.count + 1 : 1;
  p.streak.lastDay = today;
  p.streak.best = Math.max(p.streak.best, p.streak.count);
}

/** Ajoute du temps de pratique ; renvoie les badges débloqués. */
export function addPracticeTime(p: Progress, minutes: number, now = new Date()): Badge[] {
  rollDay(p, now);
  p.daily.minutes += minutes;
  p.totals.minutes += minutes;
  touchStreak(p, now);
  return checkBadges(p, null);
}

export function dailyMinutes(p: Progress, now = new Date()): number {
  return p.daily.day === dayKey(now) ? p.daily.minutes : 0;
}

// ---------- Défi du jour ----------
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface Challenge {
  day: string;
  songId: string;
  stars: Stars;
}

/** Un morceau par jour, identique sur tous les appareils, à réussir avec 2 étoiles. */
export function dailyChallenge(songs: SongMeta[], now = new Date()): Challenge | null {
  const pool = songs.filter((s) => s.level <= 2 && s.style !== 'Gammes & arpèges' && s.style !== 'Exercices');
  if (!pool.length) return null;
  const day = dayKey(now);
  return { day, songId: pool[hash(day) % pool.length].id, stars: 2 };
}

// ---------- Badges ----------
export interface Badge {
  id: string;
  icon: string;
  name: string;
  description: string;
}

interface BadgeDef extends Badge {
  check: (p: Progress, last: ResultInput | null) => boolean;
}

const finishedCount = (p: Progress, pred: (id: string) => boolean = () => true) =>
  Object.entries(p.songs).filter(([id, r]) => r.stars > 0 && pred(id)).length;

export const BADGES: BadgeDef[] = [
  { id: 'first-song', icon: '🎵', name: 'Premières notes', description: 'Terminer un premier morceau', check: (p) => p.totals.songsFinished >= 1 },
  { id: 'ten-songs', icon: '📚', name: 'Répertoire', description: 'Réussir 10 morceaux différents', check: (p) => finishedCount(p) >= 10 },
  { id: 'thirty-songs', icon: '🏛️', name: 'Grand répertoire', description: 'Réussir 30 morceaux différents', check: (p) => finishedCount(p) >= 30 },
  { id: 'three-stars', icon: '⭐', name: 'Sans faute', description: 'Obtenir 3 étoiles sur un morceau', check: (p) => Object.values(p.songs).some((r) => r.stars === 3) },
  { id: 'ten-three-stars', icon: '🌟', name: 'Collection d’étoiles', description: '3 étoiles sur 10 morceaux', check: (p) => Object.values(p.songs).filter((r) => r.stars === 3).length >= 10 },
  { id: 'combo-25', icon: '🔥', name: 'En feu', description: 'Combo de 25 notes justes', check: (p) => p.totals.bestCombo >= 25 },
  { id: 'combo-100', icon: '☄️', name: 'Inarrêtable', description: 'Combo de 100 notes justes', check: (p) => p.totals.bestCombo >= 100 },
  { id: 'golden-ear', icon: '👂', name: 'Oreille d’or', description: '100 % de justesse sur un morceau', check: (_p, l) => !!l && l.accuracy >= 0.999 && l.notes >= 16 },
  { id: 'game-mode', icon: '🎮', name: 'Joueur', description: 'Terminer un morceau en mode jeu', check: (_p, l) => !!l && l.mode === 'game' && l.stars > 0 },
  { id: 'streak-3', icon: '📅', name: 'Régulier', description: '3 jours d’affilée', check: (p) => p.streak.best >= 3 },
  { id: 'streak-7', icon: '🗓️', name: 'Une semaine', description: '7 jours d’affilée', check: (p) => p.streak.best >= 7 },
  { id: 'streak-30', icon: '🏆', name: 'Discipline', description: '30 jours d’affilée', check: (p) => p.streak.best >= 30 },
  { id: 'notes-1000', icon: '🎻', name: 'Mille notes', description: 'Jouer 1 000 notes justes', check: (p) => p.totals.notes >= 1000 },
  { id: 'hour', icon: '⏱️', name: 'Une heure de pratique', description: '60 minutes au total', check: (p) => p.totals.minutes >= 60 },
  { id: 'scales', icon: '🎼', name: 'Gammiste', description: 'Réussir 10 gammes ou arpèges', check: (p) => finishedCount(p, (id) => id.startsWith('gamme-') || id.startsWith('arpege-') || id.startsWith('penta-') || id.startsWith('blues-')) >= 10 },
  { id: 'challenge', icon: '🎯', name: 'Défi relevé', description: 'Réussir un défi du jour', check: (p) => p.challengeDoneDay !== null },
];

export function checkBadges(p: Progress, last: ResultInput | null, now = Date.now()): Badge[] {
  const unlocked: Badge[] = [];
  for (const b of BADGES) {
    if (p.badges[b.id]) continue;
    if (b.check(p, last)) {
      p.badges[b.id] = now;
      unlocked.push({ id: b.id, icon: b.icon, name: b.name, description: b.description });
    }
  }
  return unlocked;
}

// ---------- Résultat d'un morceau ----------
export function recordResult(p: Progress, r: ResultInput, challenge: Challenge | null, now = new Date()): ResultOutcome {
  const levelBefore = levelInfo(p.xp).level;
  const prev = p.songs[r.songId];
  const newBest = !prev || r.score > prev.best;
  // Montée de tempo et révisions espacées.
  let cleanStreak = prev?.cleanStreak ?? 0;
  let tempoChange = 0;
  if (r.accuracy >= TEMPO_RULE.cleanAccuracy) {
    cleanStreak++;
    if (cleanStreak >= TEMPO_RULE.cleanNeeded) {
      tempoChange = TEMPO_RULE.up;
      cleanStreak = 0;
    }
  } else if (r.accuracy < TEMPO_RULE.failAccuracy) {
    tempoChange = -TEMPO_RULE.down;
    cleanStreak = 0;
  }
  const today = dayKey(now);
  let reviewStage = prev?.reviewStage ?? 0;
  let nextReview = prev?.nextReview;
  if (r.stars === 3) {
    // Maîtrisé : on avance d'une étape (au plus une fois par jour).
    if (!nextReview || nextReview <= today) {
      reviewStage = Math.min(reviewStage + 1, REVIEW_INTERVALS.length);
      nextReview = addDays(today, REVIEW_INTERVALS[reviewStage - 1]);
    }
  } else if (r.stars <= 1 && reviewStage > 0) {
    // Oublié : on revient au début du cycle.
    reviewStage = 1;
    nextReview = addDays(today, 1);
  }
  p.songs[r.songId] = {
    best: Math.max(prev?.best ?? 0, r.score),
    stars: Math.max(prev?.stars ?? 0, r.stars) as Stars,
    plays: (prev?.plays ?? 0) + 1,
    lastPlayed: now.getTime(),
    cleanStreak,
    reviewStage,
    nextReview,
  };
  p.totals.notes += Math.round(r.notes * r.accuracy);
  p.totals.perfect += r.perfect;
  p.totals.bestCombo = Math.max(p.totals.bestCombo, r.maxCombo);
  if (r.stars > 0) p.totals.songsFinished++;
  touchStreak(p, now);

  let xp = Math.round(r.notes * r.accuracy * 2) + r.stars * 20 + (newBest && prev ? 10 : 0);
  const challengeCompleted =
    !!challenge && challenge.day === today && challenge.songId === r.songId && r.stars >= challenge.stars && p.challengeDoneDay !== today;
  if (challengeCompleted) {
    p.challengeDoneDay = today;
    xp += 100;
  }
  p.xp += xp;
  const newBadges = checkBadges(p, r, now.getTime());
  return { tempoChange, xpGained: xp, newBest, newBadges, challengeCompleted, levelBefore, levelAfter: levelInfo(p.xp).level };
}

// ---------- Sauvegarde ----------
const KEY = 'string-coach:progress';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyProgress(), ...JSON.parse(raw) };
  } catch {
    /* stockage indisponible */
  }
  return emptyProgress();
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
