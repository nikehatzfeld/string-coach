import { VIOLIN_PATH, type Domain, type VExercise } from './curriculum';

/**
 * Évaluation de placement (≈ 6-8 min) : pour chaque domaine, un court test au palier présumé,
 * puis un second plus difficile (réussite) ou plus facile (échec). On en déduit un palier par domaine.
 */
export const PROBED: Domain[] = ['intonation', 'scales', 'fingers', 'bow', 'rhythm', 'positions'];
const MIN_STAGE: Partial<Record<Domain, number>> = { positions: 5, double: 5 };
export const PASS = 0.75;

export const EXPERIENCE = [
  { label: 'Je débute (moins de 6 mois)', stage: 1 },
  { label: 'Environ 1 an', stage: 2 },
  { label: '2 à 3 ans', stage: 4 },
  { label: '4 à 6 ans', stage: 6 },
  { label: '7 ans et plus', stage: 8 },
  { label: 'Niveau conservatoire / pro', stage: 10 },
] as const;

export interface ProbeResult {
  domain: Domain;
  stage: number;
  acc: number;
  pass: boolean;
}

export interface Placement {
  guess: number;
  results: ProbeResult[];
}

/** Exercice de test : la clé (ou le premier exercice) du domaine au palier demandé, raccourci à 4 mesures. */
export function probeExercise(domain: Domain, stage: number): VExercise | null {
  const cands = VIOLIN_PATH.filter((e) => e.domain === domain);
  const at = (s: number) => cands.find((e) => e.stage === s && e.core) ?? cands.find((e) => e.stage === s);
  let ex: VExercise | undefined;
  for (let s = stage; s >= 1 && !ex; s--) ex = at(s);
  if (!ex) return null;
  const bars = ex.notation.split('|').slice(0, 4).join('|');
  return { ...ex, id: `assess-${ex.id}`, notation: bars, title: ex.title, tempo: Math.round(ex.targetBpm * 0.85), core: false };
}

/** Prochain test à faire, ou null si l'évaluation est finie. */
export function nextProbe(p: Placement): { domain: Domain; stage: number } | null {
  for (const d of PROBED) {
    const min = MIN_STAGE[d] ?? 1;
    if (d === 'positions' && p.guess < 4 && !p.results.some((r) => r.domain === 'scales' && r.pass && r.stage >= 4)) continue;
    const done = p.results.filter((r) => r.domain === d);
    if (done.length === 0) return { domain: d, stage: Math.max(min, Math.min(12, p.guess)) };
    if (done.length === 1) {
      const r = done[0];
      const s = r.pass ? r.stage + 2 : r.stage - 2;
      if (s >= min && s <= 12) return { domain: d, stage: s };
    }
  }
  return null;
}

export function totalProbes(p: Placement): number {
  return PROBED.length * 2 - (p.guess < 4 ? 2 : 0);
}

/** Palier estimé dans chaque domaine. */
export function placementSkills(p: Placement): Record<Domain, number> {
  const out = {} as Record<Domain, number>;
  for (const d of PROBED) {
    const rs = p.results.filter((r) => r.domain === d);
    const passed = rs.filter((r) => r.pass).map((r) => r.stage);
    if (passed.length) out[d] = Math.max(...passed) + 0.5;
    else if (rs.length) out[d] = Math.max(1, Math.min(...rs.map((r) => r.stage)) - 1 + 0.3);
    else out[d] = d === 'positions' ? Math.min(4, p.guess + 0.5) : p.guess;
  }
  out.double = Math.max(1, Math.min(out.scales, out.positions) - 0.5);
  return out;
}

/** Palier de départ du parcours : celui du domaine médian (les paliers en dessous sont considérés acquis). */
export function placementStage(skills: Record<Domain, number>): number {
  const v = Object.values(skills).sort((a, b) => a - b);
  return Math.max(1, Math.floor(v[Math.floor(v.length / 2) - 1]));
}
