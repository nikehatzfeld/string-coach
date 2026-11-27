import { midiName } from '../songs/notation';
import { scoreIntonation, scoreStability, scoreTiming, summarize, type NoteLog } from './metrics';

/**
 * Bilan critique d'un passage : ce qui est bien, ce qui est à reprendre, et les notes précises à revoir
 * (mesure, note, doigt, corde, écart). Basé uniquement sur ce que le micro a mesuré.
 */
export interface Critique {
  scores: { label: string; value: number }[];
  good: string[];
  fix: string[];
  worst: string[];
}

const STR: Record<number, string> = { 1: 'Mi', 2: 'La', 3: 'Ré', 4: 'Sol' };
const fingerTxt = (n: NoteLog, violin: boolean) => (!violin || n.finger === undefined ? '' : n.finger === 0 ? 'corde à vide' : `${n.finger}${n.finger === 1 ? 'er' : 'e'} doigt${n.string ? `, corde de ${STR[n.string]}` : ''}`);

export function critique(log: NoteLog[], mode: 'step' | 'game', violin: boolean): Critique | null {
  if (log.length < 3) return null;
  const m = summarize(log);
  const scores: Critique['scores'] = [];
  const good: string[] = [];
  const fix: string[] = [];
  if (m.intonation !== null) scores.push({ label: 'Justesse', value: scoreIntonation(m.intonation) });
  if (m.stability !== null) scores.push({ label: 'Stabilité du son', value: scoreStability(m.stability) });
  if (m.timing !== null) scores.push({ label: 'Rythme', value: scoreTiming(m.timing) });
  if (m.missRate > 0) scores.push({ label: 'Notes trouvées', value: Math.round((1 - m.missRate) * 100) });

  if (m.intonation !== null) {
    if (m.intonation <= 8) good.push(`Justesse très précise : ±${m.intonation} cents en moyenne.`);
    else if (m.intonation <= 15) good.push(`Justesse correcte (±${m.intonation} cents) : on peut encore affiner.`);
    else fix.push(`Justesse à travailler : ±${m.intonation} cents en moyenne. Ralentis et vérifie chaque note longue.`);
  }
  if (m.bias !== null && Math.abs(m.bias) >= 7) fix.push(`Tu joues globalement trop ${m.bias < 0 ? 'bas' : 'haut'} (${m.bias > 0 ? '+' : ''}${m.bias} cents) : ${m.bias < 0 ? 'avance un peu les doigts vers le chevalet' : 'détends la main, les doigts remontent'}.`);
  const fingers = Object.entries(m.byFinger).filter(([f]) => f !== '0').sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  if (violin && fingers[0] && Math.abs(fingers[0][1]) >= 10) {
    const [f, c] = fingers[0];
    fix.push(`Le ${f}${f === '1' ? 'er' : 'e'} doigt est souvent trop ${c < 0 ? 'bas' : 'haut'} (${c > 0 ? '+' : ''}${c} cents).`);
  }
  // Cordes à vide fausses : c'est l'accordage, pas les doigts.
  if (violin) {
    const opens = new Map<number, number[]>();
    for (const n of log) if (!n.miss && n.finger === 0 && n.string && n.cents !== null) opens.set(n.string, [...(opens.get(n.string) ?? []), n.cents]);
    for (const [str, cs] of opens) {
      const avg = Math.round(cs.reduce((a, b) => a + b, 0) / cs.length);
      if (cs.length >= 2 && Math.abs(avg) >= 12) fix.unshift(`Ta corde de ${STR[str]} à vide sonne ${avg > 0 ? '+' : ''}${avg} cents : elle est désaccordée. Accorde-toi (🎚 Accordeur) avant de juger tes doigts.`);
    }
  }
  if (m.stability !== null) {
    if (m.stability <= 6) good.push('Son stable pendant les notes : archet régulier.');
    else if (m.stability >= 12) fix.push(`La hauteur bouge pendant les notes (±${Math.round(m.stability)} cents) : vitesse et poids d’archet constants, doigt bien posé.`);
  }
  if (m.timing !== null) {
    if (m.timing <= 60) good.push(`Bon placement rythmique (±${m.timing} ms).`);
    if (m.rush !== null && m.rush <= -40) fix.push(`Tu es en avance de ${-m.rush} ms en moyenne : tu précipites, écoute la pulsation.`);
    if (m.rush !== null && m.rush >= 50) fix.push(`Tu es en retard de ${m.rush} ms en moyenne : prépare la note suivante plus tôt.`);
  }
  if (mode === 'step' && m.find !== null) {
    if (m.find <= 900) good.push('Notes trouvées rapidement : lecture fluide.');
    else if (m.find >= 1800) fix.push(`Il te faut ${Math.round(m.find / 100) / 10} s par note : lis la phrase en entier avant de jouer.`);
  }
  if (m.missRate >= 0.15) fix.push(`${Math.round(m.missRate * 100)} % de notes manquées : baisse le tempo de 10 BPM.`);
  if (!fix.length) good.push('Rien de marquant à corriger sur ce passage : monte le tempo !');

  // Notes à revoir : notes manquées regroupées par mesure, puis les plus grands écarts de justesse ou de placement.
  const name = (n: NoteLog) => midiName(n.midi, 'fr').replace('#', '♯');
  const missByBar = new Map<number, NoteLog[]>();
  for (const n of log) if (n.miss) missByBar.set(n.bar ?? 0, [...(missByBar.get(n.bar ?? 0) ?? []), n]);
  const missLines = [...missByBar.entries()]
    .sort((x, y) => y[1].length - x[1].length || x[0] - y[0])
    .map(([bar, ns]) => `${bar ? `Mesure ${bar}` : 'Passage'} : ${ns.length} note${ns.length > 1 ? 's' : ''} manquée${ns.length > 1 ? 's' : ''} (${[...new Set(ns.map(name))].join(', ')})`);
  const offLines = log
    .filter((n) => !n.miss && ((n.cents !== null && Math.abs(n.cents) >= 15) || (n.deltaMs !== undefined && Math.abs(n.deltaMs) >= 120)))
    .map((n) => ({ n, w: Math.max(Math.abs(n.cents ?? 0), Math.abs(n.deltaMs ?? 0) / 4) }))
    .sort((x, y) => y.w - x.w)
    .map(({ n }) => {
      const what = [n.cents !== null && Math.abs(n.cents) >= 15 ? `${n.cents > 0 ? '+' : ''}${n.cents} cents (trop ${n.cents > 0 ? 'haut' : 'bas'})` : '', n.deltaMs !== undefined && Math.abs(n.deltaMs) >= 120 ? `${Math.abs(n.deltaMs)} ms ${n.deltaMs < 0 ? 'en avance' : 'en retard'}` : ''].filter(Boolean).join(', ');
      const fi = fingerTxt(n, violin);
      return `${n.bar ? `Mesure ${n.bar} · ` : ''}${name(n)}${fi ? ` (${fi})` : ''} : ${what}`;
    });
  const bad = [...offLines.slice(0, 4), ...missLines.slice(0, 3)].slice(0, 6);
  return { scores, good, fix, worst: bad };
}
