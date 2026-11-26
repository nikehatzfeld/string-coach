import { DOMAINS, STAGES, VIOLIN_PATH, byStage, coreOf, findExercise, type Domain, type VExercise } from './curriculum';
import type { Metrics } from './metrics';

/**
 * Coach violon : estime le niveau de l'élève dans chaque domaine, choisit les exercices et le tempo,
 * et tire des conclusions (points forts, points à travailler) des mesures fines.
 * Logique pure, testable ; l'état est rangé dans la progression du profil (synchronisée).
 */

export interface Attempt {
  id: string;
  t: number;
  bpm: number;
  acc: number;
  stars: number;
  mode: 'step' | 'game';
  m?: Pick<Metrics, 'intonation' | 'bias' | 'stability' | 'timing' | 'rush' | 'find' | 'byFinger' | 'byString'>;
}

export interface AcademyState {
  version: 1;
  /** Niveau estimé par domaine (palier 1 à 12, valeur continue). */
  skill: Record<Domain, number>;
  /** Palier atteint lors de l'évaluation (les paliers inférieurs sont considérés acquis). */
  placed?: number;
  placedAt?: string;
  attempts: Attempt[];
  /** Meilleur tempo réussi (≥ 90 %) par exercice. */
  bestBpm: Record<string, number>;
  /** Morceaux travaillés (les plus récents d'abord). */
  pieces: string[];
  minutes: 15 | 20 | 30 | 45;
  updatedAt: number;
}

export const emptyAcademy = (): AcademyState => ({
  version: 1,
  skill: Object.fromEntries(DOMAINS.map((d) => [d.id, 1])) as Record<Domain, number>,
  attempts: [],
  bestBpm: {},
  pieces: [],
  minutes: 20,
  updatedAt: 0,
});

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const levelOf = (skill: number) => clamp(Math.floor(skill + 1e-9), 1, 12);

/** Performance 0-1 : justesse × respect du tempo. */
export const performance = (acc: number, bpm: number, target: number) => acc * Math.min(1, bpm / target);

/** Met à jour l'état après un exercice du parcours (ou un morceau, avec `ex` absent). */
export function recordAttempt(st: AcademyState, a: Attempt, ex?: VExercise, now = Date.now()): AcademyState {
  st.attempts = [...st.attempts, { ...a, t: a.t || now }].slice(-500);
  st.updatedAt = now;
  if (!ex) {
    if (!st.pieces.includes(a.id)) st.pieces = [a.id, ...st.pieces].slice(0, 12);
    else st.pieces = [a.id, ...st.pieces.filter((p) => p !== a.id)];
    return st;
  }
  const p = performance(a.acc, a.bpm, ex.targetBpm);
  if (a.acc >= 0.9) st.bestBpm[ex.id] = Math.max(st.bestBpm[ex.id] ?? 0, a.bpm);
  const cur = st.skill[ex.domain];
  // Cible : palier dépassé (réussite nette), atteint, ou trop difficile.
  const target = p >= 0.9 ? ex.stage + 0.6 : p >= 0.75 ? ex.stage + 0.2 : p >= 0.55 ? ex.stage - 0.3 : ex.stage - 1;
  if (target > cur) st.skill[ex.domain] = cur + 0.35 * (target - cur);
  // Un échec ne fait baisser que s'il est au niveau de l'élève (pas un raté sur un exercice facile).
  else if (ex.stage >= cur - 1) st.skill[ex.domain] = Math.max(1, cur + 0.15 * (target - cur));
  return st;
}

export interface StageStatus {
  stage: number;
  done: number;
  total: number;
  coreDone: number;
  coreTotal: number;
  complete: boolean;
  /** Acquis par l'évaluation. */
  placed: boolean;
}

export function stageStatus(validated: Record<string, string>, st: AcademyState, stage: number): StageStatus {
  const all = byStage(stage);
  const core = coreOf(stage);
  const coreDone = core.filter((e) => validated[e.id]).length;
  const placed = !!st.placed && stage < st.placed;
  return { stage, done: all.filter((e) => validated[e.id]).length, total: all.length, coreDone, coreTotal: core.length, complete: placed || coreDone === core.length, placed };
}

/** Palier en cours : le premier dont les exercices clés ne sont pas tous validés. */
export function currentStage(validated: Record<string, string>, st: AcademyState): number {
  for (const s of STAGES) if (!stageStatus(validated, st, s.n).complete) return s.n;
  return 12;
}

/** Prochain exercice d'un domaine, au niveau de l'élève dans ce domaine. */
export function nextInDomain(d: Domain, validated: Record<string, string>, st: AcademyState, exclude = new Set<string>()): VExercise | undefined {
  const lvl = levelOf(st.skill[d]);
  const cands = VIOLIN_PATH.filter((e) => e.domain === d && !validated[e.id] && !exclude.has(e.id));
  // D'abord les clés du niveau, puis le reste du niveau, puis le palier au-dessus, puis en dessous.
  return (
    cands.find((e) => e.stage === lvl && e.core) ??
    cands.find((e) => e.stage === lvl) ??
    cands.find((e) => e.stage === lvl + 1) ??
    [...cands].reverse().find((e) => e.stage < lvl) ??
    cands[0]
  );
}

/** Tempo conseillé : dernier tempo réussi + 4, sinon une fraction de la cible selon l'écart de niveau. */
export function suggestedBpm(ex: VExercise, st: AcademyState): number {
  const best = st.bestBpm[ex.id];
  if (best) return Math.min(ex.targetBpm, best + 4);
  const gap = st.skill[ex.domain] - ex.stage;
  return Math.max(40, Math.round(ex.targetBpm * clamp(0.75 + 0.08 * gap, 0.6, 1)));
}

export interface SessionItem {
  ex: VExercise;
  why: string;
  bpm: number;
  mode: 'step' | 'game';
  minutes: number;
}

/** Domaines classés du plus faible au plus fort (les doubles cordes n'arrivent qu'au palier 5). */
export function rankedDomains(st: AcademyState): Domain[] {
  return DOMAINS.map((d) => d.id)
    .filter((d) => d !== 'double' || st.skill.scales >= 4.5)
    .filter((d) => d !== 'positions' || st.skill.scales >= 4.5)
    .sort((a, b) => st.skill[a] - st.skill[b]);
}

/** Séance du jour, personnalisée : échauffement, points faibles, palier en cours, point fort. */
export function planSession(validated: Record<string, string>, st: AcademyState, minutes = st.minutes): SessionItem[] {
  const per = 4;
  const slots = Math.max(3, Math.floor(minutes / per));
  const used = new Set<string>();
  const items: SessionItem[] = [];
  const push = (ex: VExercise | undefined, why: string) => {
    if (!ex || used.has(ex.id) || items.length >= slots) return;
    used.add(ex.id);
    const known = st.attempts.some((a) => a.id === ex.id && a.acc >= 0.8);
    items.push({ ex, why, bpm: suggestedBpm(ex, st), mode: known ? 'game' : 'step', minutes: per });
  };
  const ranked = rankedDomains(st);
  // 1. Échauffement : son et justesse, un cran sous le niveau.
  const warm = VIOLIN_PATH.find((e) => (e.domain === 'intonation' || e.domain === 'bow') && e.stage === Math.max(1, levelOf(st.skill.intonation) - 1) && !used.has(e.id));
  push(warm, 'Échauffement : son et justesse');
  // 2. Les deux domaines les plus faibles.
  for (const d of ranked.slice(0, 2)) push(nextInDomain(d, validated, st, used), `Point à travailler : ${DOMAINS.find((x) => x.id === d)!.label.toLowerCase()}`);
  // 3. Exercice clé du palier en cours.
  const cs = currentStage(validated, st);
  push(coreOf(cs).find((e) => !validated[e.id] && !used.has(e.id)), `Clé du palier ${cs}`);
  // 4. Révision : exercice validé il y a le plus longtemps.
  const lastById = new Map<string, number>();
  for (const a of st.attempts) lastById.set(a.id, a.t);
  const review = Object.keys(validated)
    .filter((id) => findExercise(id) && !used.has(id))
    .sort((a, b) => (lastById.get(a) ?? 0) - (lastById.get(b) ?? 0))[0];
  push(review ? findExercise(review) : undefined, 'Révision : garder l’acquis');
  // 5. Compléter avec les autres domaines, du plus faible au plus fort.
  for (const d of ranked) push(nextInDomain(d, validated, st, used), `Progression : ${DOMAINS.find((x) => x.id === d)!.label.toLowerCase()}`);
  return items;
}

/** Moyennes glissantes des mesures sur les derniers essais. */
export function rollingMetrics(st: AcademyState, n = 30) {
  const last = st.attempts.filter((a) => a.m).slice(-n);
  const avg = (f: (a: Attempt) => number | null | undefined) => {
    const v = last.map(f).filter((x): x is number => typeof x === 'number');
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  const byFinger: Record<number, number[]> = {};
  const byString: Record<number, number[]> = {};
  for (const a of last) {
    for (const [f, c] of Object.entries(a.m!.byFinger ?? {})) (byFinger[Number(f)] ??= []).push(c);
    for (const [s, c] of Object.entries(a.m!.byString ?? {})) (byString[Number(s)] ??= []).push(c);
  }
  const avgMap = (m: Record<number, number[]>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length)]));
  return {
    count: last.length,
    intonation: avg((a) => a.m!.intonation),
    bias: avg((a) => a.m!.bias),
    stability: avg((a) => a.m!.stability),
    timing: avg((a) => a.m!.timing),
    rush: avg((a) => a.m!.rush),
    find: avg((a) => a.m!.find),
    byFinger: avgMap(byFinger) as Record<number, number>,
    byString: avgMap(byString) as Record<number, number>,
  };
}

const STRING_FR: Record<number, string> = { 1: 'Mi', 2: 'La', 3: 'Ré', 4: 'Sol' };

/** Diagnostic en clair : ce qui va bien, ce qui est à travailler, et comment. */
export function diagnose(st: AcademyState): { strengths: string[]; weaknesses: string[]; tips: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const tips: string[] = [];
  const ranked = rankedDomains(st);
  const label = (d: Domain) => DOMAINS.find((x) => x.id === d)!;
  const best = [...ranked].reverse().slice(0, 2);
  const worst = ranked.slice(0, 2);
  if (st.attempts.length) {
    for (const d of best) strengths.push(`${label(d).icon} ${label(d).label} : palier ${levelOf(st.skill[d])}`);
    for (const d of worst) if (st.skill[d] < st.skill[best[0]] - 0.5) weaknesses.push(`${label(d).icon} ${label(d).label} : palier ${levelOf(st.skill[d])}`);
  }
  const m = rollingMetrics(st);
  if (m.count >= 3) {
    if (m.intonation !== null && m.intonation <= 10) strengths.push(`🎯 Justesse précise (±${m.intonation} cents en moyenne)`);
    if (m.bias !== null && m.bias <= -8) {
      weaknesses.push(`🎯 Tendance à jouer trop bas (${m.bias} cents)`);
      tips.push('Joue avec la corde à vide voisine et cherche la résonance ; avance légèrement les doigts.');
    }
    if (m.bias !== null && m.bias >= 8) {
      weaknesses.push(`🎯 Tendance à jouer trop haut (+${m.bias} cents)`);
      tips.push('Les doigts se crispent souvent vers l’aigu : relâche la main, vérifie chaque note à l’accordeur.');
    }
    const fingers = Object.entries(m.byFinger).filter(([f]) => f !== '0').sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    if (fingers[0] && Math.abs(fingers[0][1]) >= 10) {
      const [f, c] = fingers[0];
      weaknesses.push(`✋ ${f}${f === '1' ? 'er' : 'e'} doigt souvent trop ${c < 0 ? 'bas' : 'haut'} (${c > 0 ? '+' : ''}${c} c)`);
      tips.push(`Travaille les schémas de doigts lentement en surveillant le ${f}${f === '1' ? 'er' : 'e'} doigt ; ${c < 0 ? 'avance-le vers le chevalet' : 'recule-le vers le sillet'}.`);
    }
    const strs = Object.entries(m.byString).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    if (strs[0] && Math.abs(strs[0][1]) >= 12) weaknesses.push(`🎻 Corde de ${STRING_FR[Number(strs[0][0])] ?? strs[0][0]} : justesse moins bonne (${strs[0][1] > 0 ? '+' : ''}${strs[0][1]} c)`);
    if (m.stability !== null && m.stability >= 12) {
      weaknesses.push(`🏹 Son qui bouge pendant les notes (±${m.stability} cents)`);
      tips.push('Notes longues : vitesse et poids d’archet constants, point de contact fixe.');
    } else if (m.stability !== null && m.stability <= 6) strengths.push('🏹 Son stable et régulier');
    if (m.rush !== null && m.rush <= -40) {
      weaknesses.push(`⏱ Tu précipites (${-m.rush} ms d’avance)`);
      tips.push('Joue avec le métronome sur les temps 2 et 4 seulement ; ressens la pulsation avant de jouer.');
    }
    if (m.rush !== null && m.rush >= 50) {
      weaknesses.push(`⏱ Tu joues en retard (${m.rush} ms)`);
      tips.push('Anticipe : prépare le doigt et l’archet pendant la note précédente.');
    }
    if (m.timing !== null && m.timing <= 60) strengths.push('⏱ Placement rythmique solide');
    if (m.find !== null && m.find >= 1500) {
      weaknesses.push(`📖 Lecture : ${Math.round(m.find / 100) / 10} s pour trouver une note`);
      tips.push('Avant de jouer, lis la ligne en disant le nom des notes et les doigts.');
    }
  }
  return { strengths, weaknesses, tips };
}

/** Position dans le parcours : nombre validé, rang de l'exercice clé suivant. */
export function pathPosition(validated: Record<string, string>, st: AcademyState) {
  const cs = currentStage(validated, st);
  const next = coreOf(cs).find((e) => !validated[e.id]) ?? byStage(cs).find((e) => !validated[e.id]);
  const placedBelow = st.placed ? VIOLIN_PATH.filter((e) => e.stage < st.placed!).length : 0;
  const done = VIOLIN_PATH.filter((e) => validated[e.id]).length;
  return { stage: cs, rank: next?.rank ?? VIOLIN_PATH.length, total: VIOLIN_PATH.length, done, acquired: Math.max(done, placedBelow + VIOLIN_PATH.filter((e) => e.stage >= (st.placed ?? 99) && validated[e.id]).length) };
}

/** Niveau global (moyenne des domaines) et libellé. */
export function globalLevel(st: AcademyState): { value: number; stage: number; label: string } {
  const ds = rankedDomains(st);
  const v = ds.reduce((a, d) => a + st.skill[d], 0) / ds.length;
  const stage = levelOf(v);
  return { value: Math.round(v * 10) / 10, stage, label: STAGES[stage - 1].level };
}

/** Fusion entre deux appareils. */
export function mergeAcademy(a?: AcademyState, b?: AcademyState): AcademyState | undefined {
  if (!a) return b;
  if (!b) return a;
  const newer = a.updatedAt >= b.updatedAt ? a : b;
  const seen = new Set<string>();
  const attempts = [...a.attempts, ...b.attempts]
    .sort((x, y) => x.t - y.t)
    .filter((x) => {
      const k = `${x.id}@${x.t}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(-500);
  const bestBpm = { ...b.bestBpm };
  for (const [k, v] of Object.entries(a.bestBpm)) bestBpm[k] = Math.max(v, bestBpm[k] ?? 0);
  return { ...newer, attempts, bestBpm, placed: Math.max(a.placed ?? 0, b.placed ?? 0) || undefined, pieces: [...new Set([...newer.pieces, ...a.pieces, ...b.pieces])].slice(0, 12) };
}
