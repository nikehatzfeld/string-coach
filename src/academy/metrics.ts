/**
 * Mesures fines d'un passage : justesse (écart en cents), stabilité du son, placement rythmique, fluidité.
 * Collectées note par note pendant le pas à pas et le jeu, puis résumées en indicateurs 0-100.
 */
export interface NoteLog {
  midi: number;
  /** Écart moyen à la note juste (cents, + = trop haut). */
  cents: number | null;
  /** Dispersion de la hauteur pendant la note (cents). */
  spread?: number;
  /** Jeu : avance (−) ou retard (+) en ms. */
  deltaMs?: number;
  /** Pas à pas : temps pour trouver la note (ms). */
  findMs?: number;
  /** Doigt joué (0 = corde à vide) et corde (1 = Mi). */
  finger?: number;
  string?: number;
  miss?: boolean;
  /** Mesure (1 = première). */
  bar?: number;
}

export interface Metrics {
  notes: number;
  /** Écart absolu moyen (cents). */
  intonation: number | null;
  /** Tendance : moyenne signée (cents). */
  bias: number | null;
  /** Stabilité : dispersion moyenne (cents). */
  stability: number | null;
  /** Placement : écart absolu moyen (ms) et tendance (ms). */
  timing: number | null;
  rush: number | null;
  /** Pas à pas : temps médian pour trouver une note (ms). */
  find: number | null;
  missRate: number;
  /** Écart moyen par doigt (cents, signé). */
  byFinger: Record<number, number>;
  byString: Record<number, number>;
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const median = (a: number[]) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

export function summarize(log: NoteLog[]): Metrics {
  const hit = log.filter((n) => !n.miss);
  const c = hit.map((n) => n.cents).filter((x): x is number => x !== null);
  const groupBy = (k: 'finger' | 'string') => {
    const out: Record<number, number[]> = {};
    for (const n of hit) if (n[k] !== undefined && n.cents !== null) (out[n[k]!] ??= []).push(n.cents);
    return Object.fromEntries(Object.entries(out).filter(([, v]) => v.length >= 3).map(([f, v]) => [f, Math.round(mean(v)!)]));
  };
  const d = hit.map((n) => n.deltaMs).filter((x): x is number => x !== undefined);
  return {
    notes: log.length,
    intonation: c.length ? Math.round(mean(c.map(Math.abs))!) : null,
    bias: c.length ? Math.round(mean(c)!) : null,
    stability: mean(hit.map((n) => n.spread).filter((x): x is number => x !== undefined)),
    timing: d.length ? Math.round(mean(d.map(Math.abs))!) : null,
    rush: d.length ? Math.round(mean(d)!) : null,
    find: median(hit.map((n) => n.findMs).filter((x): x is number => x !== undefined)),
    missRate: log.length ? (log.length - hit.length) / log.length : 0,
    byFinger: groupBy('finger'),
    byString: groupBy('string'),
  };
}

/** Indicateurs 0-100 (100 = parfait). */
export const scoreIntonation = (cents: number) => Math.max(0, Math.min(100, Math.round(100 - (cents - 5) * 3)));
export const scoreTiming = (ms: number) => Math.max(0, Math.min(100, Math.round(100 - (ms - 20) * 0.6)));
export const scoreStability = (cents: number) => Math.max(0, Math.min(100, Math.round(100 - (cents - 4) * 4)));

/** Moyenne et dispersion des cents d'une note tenue. */
export function centsStats(samples: number[]): { mean: number; spread: number } | null {
  if (!samples.length) return null;
  const m = samples.reduce((a, b) => a + b, 0) / samples.length;
  const v = samples.reduce((a, b) => a + (b - m) ** 2, 0) / samples.length;
  return { mean: Math.round(m), spread: Math.round(Math.sqrt(v)) };
}
