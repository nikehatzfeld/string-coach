import type { GameNote } from './judge';
import type { Judgment } from './scoring';

/**
 * Piste du mode jeu : un couloir par corde, les notes descendent vers la ligne de frappe.
 * La position suit le lecteur alphaTab (ticks), interpolée entre ses événements pour rester fluide.
 */

const LANE_COLORS = ['#ff6b6b', '#ffb547', '#4fd1a5', '#6ea8ff', '#c084fc', '#f472b6'];
const LABEL: Record<Judgment, string> = { perfect: 'Parfait !', good: 'Bien', ok: 'OK', miss: 'Raté' };
const LABEL_COLOR: Record<Judgment, string> = { perfect: '#4fd1a5', good: '#ffb547', ok: '#ffb547', miss: '#ff6b6b' };

interface Popup {
  lane: number;
  text: string;
  color: string;
  born: number;
}

export class Highway {
  private readonly ctx: CanvasRenderingContext2D;
  private raf = 0;
  private anchorTick = 0;
  private anchorTime = 0;
  private ticksPerMs = 1.6;
  private playing = false;
  private popups: Popup[] = [];
  private flashes: { lane: number; born: number; color: string }[] = [];
  /** Ticks visibles au-dessus de la ligne de frappe. */
  lookahead = 960 * 4;
  /** Hauteur entendue, pour l'indicateur (MIDI flottant). */
  heard: number | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly notes: GameNote[],
    private readonly laneNames: string[],
  ) {
    this.ctx = canvas.getContext('2d')!;
    const loop = () => {
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Position annoncée par le lecteur. */
  sync(tick: number, ticksPerMs: number, playing: boolean): void {
    this.anchorTick = tick;
    this.anchorTime = performance.now();
    if (ticksPerMs > 0) this.ticksPerMs = ticksPerMs;
    this.playing = playing;
  }

  get tick(): number {
    return this.playing ? this.anchorTick + (performance.now() - this.anchorTime) * this.ticksPerMs : this.anchorTick;
  }

  get speed(): number {
    return this.ticksPerMs;
  }

  feedback(note: GameNote, j: Judgment): void {
    const now = performance.now();
    this.popups.push({ lane: note.lane, text: LABEL[j], color: LABEL_COLOR[j], born: now });
    if (j !== 'miss') this.flashes.push({ lane: note.lane, born: now, color: LANE_COLORS[note.lane % LANE_COLORS.length] });
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
  }

  private draw(): void {
    const { canvas, ctx } = this;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const lanes = this.laneNames.length;
    const top = 8;
    const hitY = h - 56;
    // Perspective légère : la piste se resserre vers le haut.
    const spreadBottom = Math.min(w - 24, lanes * 110);
    const spreadTop = spreadBottom * 0.55;
    const cx = w / 2;
    const laneX = (lane: number, y: number) => {
      const t = (y - top) / (hitY - top);
      const spread = spreadTop + (spreadBottom - spreadTop) * Math.max(0, Math.min(1.2, t));
      return cx - spread / 2 + (spread / lanes) * (lane + 0.5);
    };
    const laneW = (y: number) => {
      const t = (y - top) / (hitY - top);
      return (spreadTop + (spreadBottom - spreadTop) * Math.max(0, Math.min(1.2, t))) / lanes;
    };

    // Fond de piste
    const grad = ctx.createLinearGradient(0, top, 0, h);
    grad.addColorStop(0, 'rgba(110,168,255,0.02)');
    grad.addColorStop(1, 'rgba(110,168,255,0.12)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - spreadTop / 2, top);
    ctx.lineTo(cx + spreadTop / 2, top);
    ctx.lineTo(cx + spreadBottom / 2 + 10, h);
    ctx.lineTo(cx - spreadBottom / 2 - 10, h);
    ctx.closePath();
    ctx.fill();

    // Séparateurs de couloirs
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= lanes; i++) {
      const xt = cx - spreadTop / 2 + (spreadTop / lanes) * i;
      const xb = cx - spreadBottom / 2 + (spreadBottom / lanes) * i;
      ctx.beginPath();
      ctx.moveTo(xt, top);
      ctx.lineTo(xb + (xb - cx) * 0.1, h);
      ctx.stroke();
    }

    const now = this.tick;
    const yFor = (tick: number) => hitY - ((tick - now) / this.lookahead) * (hitY - top);

    // Mesures (lignes de temps)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    const firstBeat = Math.ceil(now / 960) * 960;
    for (let t = firstBeat; t < now + this.lookahead; t += 960) {
      const y = yFor(t);
      ctx.beginPath();
      ctx.moveTo(laneX(0, y) - laneW(y) / 2, y);
      ctx.lineTo(laneX(lanes - 1, y) + laneW(y) / 2, y);
      ctx.stroke();
    }

    // Ligne de frappe
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(cx - spreadBottom / 2, hitY - 2, spreadBottom, 4);
    for (let l = 0; l < lanes; l++) {
      const x = laneX(l, hitY);
      ctx.beginPath();
      ctx.arc(x, hitY, Math.min(26, laneW(hitY) * 0.32), 0, Math.PI * 2);
      ctx.strokeStyle = LANE_COLORS[l % LANE_COLORS.length];
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(233,236,242,0.8)';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.laneNames[l], x, h - 18);
    }

    // Éclairs de réussite
    const t0 = performance.now();
    this.flashes = this.flashes.filter((f) => t0 - f.born < 300);
    for (const f of this.flashes) {
      const a = 1 - (t0 - f.born) / 300;
      const x = laneX(f.lane, hitY);
      ctx.beginPath();
      ctx.arc(x, hitY, 26 + (1 - a) * 30, 0, Math.PI * 2);
      ctx.fillStyle = hexA(f.color, a * 0.45);
      ctx.fill();
    }

    // Notes
    for (const n of this.notes) {
      if (n.tick > now + this.lookahead) break;
      const endY = yFor(n.tick + Math.max(0, n.duration - 240));
      const y = yFor(n.tick);
      if (endY > h + 40) continue;
      if (n.judged && n.judged !== 'miss' && y > hitY) continue;
      const color = LANE_COLORS[n.lane % LANE_COLORS.length];
      const x = laneX(n.lane, Math.min(y, hitY));
      const lw = laneW(Math.min(y, hitY));
      // Traîne (durée)
      if (n.duration >= 1440) {
        ctx.fillStyle = hexA(color, n.judged === 'miss' ? 0.12 : 0.3);
        const x2 = laneX(n.lane, endY);
        ctx.beginPath();
        ctx.moveTo(x - lw * 0.08, Math.min(y, hitY));
        ctx.lineTo(x2 - laneW(endY) * 0.08, endY);
        ctx.lineTo(x2 + laneW(endY) * 0.08, endY);
        ctx.lineTo(x + lw * 0.08, Math.min(y, hitY));
        ctx.fill();
      }
      const r = Math.max(9, Math.min(24, lw * 0.3));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = n.judged === 'miss' ? 'rgba(120,120,130,0.5)' : color;
      ctx.shadowColor = color;
      ctx.shadowBlur = n.judged === 'miss' ? 0 : 12;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#14161c';
      ctx.font = `700 ${Math.round(r * 0.95)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.label, x, y + 1);
      ctx.textBaseline = 'alphabetic';
    }

    // Textes de jugement
    this.popups = this.popups.filter((p) => t0 - p.born < 700);
    for (const p of this.popups) {
      const a = 1 - (t0 - p.born) / 700;
      ctx.fillStyle = hexA(p.color, a);
      ctx.font = '800 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, laneX(p.lane, hitY), hitY - 34 - (1 - a) * 30);
    }
  }
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}
