import { chordNameFr, shapeFor } from '../songs/chords';
import { esc } from './dom';

/** Diagramme d'accord en SVG : cordes verticales (6e à gauche), cases horizontales, doigts numérotés. */
export function chordDiagram(name: string, opts: { size?: 'sm' | 'md' | 'lg'; label?: boolean } = {}): string {
  const shape = shapeFor(name);
  const label = opts.label !== false ? `<div class="cd-name">${esc(chordNameFr(name))} <small>${esc(name)}</small></div>` : '';
  if (!shape) return `<div class="chord-diagram cd-${opts.size ?? 'md'}">${label}<div class="muted">?</div></div>`;
  const played = shape.frets.filter((f) => f > 0);
  const min = played.length ? Math.min(...played) : 1;
  const max = played.length ? Math.max(...played) : 1;
  // Fenêtre de 4 cases ; à partir de la 1re si possible.
  const base = max <= 4 ? 1 : shape.barre?.fret ?? min;
  const W = 120;
  const H = 150;
  const x0 = 18;
  const y0 = 28;
  const dx = (W - 2 * x0) / 5;
  const dy = (H - y0 - 12) / 4;
  const parts: string[] = [];
  // Sillet ou numéro de case
  if (base === 1) parts.push(`<rect x="${x0 - 1}" y="${y0 - 4}" width="${5 * dx + 2}" height="5" class="cd-nut"/>`);
  else parts.push(`<text x="${x0 - 6}" y="${y0 + dy * 0.65}" class="cd-fret" text-anchor="end">${base}</text>`);
  for (let i = 0; i <= 4; i++) parts.push(`<line x1="${x0}" y1="${y0 + i * dy}" x2="${x0 + 5 * dx}" y2="${y0 + i * dy}" class="cd-line"/>`);
  for (let s = 0; s < 6; s++) parts.push(`<line x1="${x0 + s * dx}" y1="${y0}" x2="${x0 + s * dx}" y2="${y0 + 4 * dy}" class="cd-line"/>`);
  if (shape.barre) {
    const r = shape.barre.fret - base;
    const xa = x0 + (6 - shape.barre.from) * dx;
    const xb = x0 + (6 - shape.barre.to) * dx;
    parts.push(`<rect x="${xa - 7}" y="${y0 + (r + 0.5) * dy - 7}" width="${xb - xa + 14}" height="14" rx="7" class="cd-barre"/>`);
  }
  shape.frets.forEach((f, s) => {
    const x = x0 + s * dx;
    if (f < 0) parts.push(`<text x="${x}" y="${y0 - 9}" class="cd-mark" text-anchor="middle">×</text>`);
    else if (f === 0) parts.push(`<circle cx="${x}" cy="${y0 - 13}" r="4.5" class="cd-open"/>`);
    else {
      const r = f - base;
      const inBarre = shape.barre && f === shape.barre.fret && shape.fingers[s] === 1;
      if (!inBarre) {
        parts.push(`<circle cx="${x}" cy="${y0 + (r + 0.5) * dy}" r="8" class="cd-dot"/>`);
        if (shape.fingers[s]) parts.push(`<text x="${x}" y="${y0 + (r + 0.5) * dy + 4}" class="cd-finger" text-anchor="middle">${shape.fingers[s]}</text>`);
      }
    }
  });
  return `<div class="chord-diagram cd-${opts.size ?? 'md'}">${label}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Accord ${esc(name)}">${parts.join('')}</svg></div>`;
}
