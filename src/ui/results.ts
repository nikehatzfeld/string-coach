import { levelInfo, type ResultOutcome, type Stars } from '../game/progress';
import { esc } from './dom';

export interface ResultView {
  title: string;
  mode: 'step' | 'game';
  score: number;
  stars: Stars;
  accuracy: number;
  maxCombo: number;
  counts: { perfect: number; good: number; ok: number; miss: number };
  outcome: ResultOutcome;
  xpTotal: number;
  /** Message sur le tempo (montée ou baisse automatique). */
  tempoNote?: string;
  /** Bilan critique du passage (mesures du micro). */
  analysis?: import('../academy/critique').Critique | null;
  /** Enregistrement de la prise (URL locale). */
  recordingUrl?: string;
}

/** Fenêtre de fin de morceau. Renvoie l'action choisie. */
export function showResults(r: ResultView): Promise<'replay' | 'library'> {
  const lvl = levelInfo(r.xpTotal);
  const before = levelInfo(r.xpTotal - r.outcome.xpGained);
  const levelUp = r.outcome.levelAfter > r.outcome.levelBefore;
  const msg = ['Continue, ça viendra !', 'Pas mal !', 'Très bien !', 'Magnifique !'][r.stars];
  const dlg = document.createElement('div');
  dlg.className = 'modal-backdrop';
  dlg.innerHTML = `
    <div class="modal results" role="dialog" aria-modal="true" aria-labelledby="res-title">
      <p class="res-mode">${r.mode === 'game' ? '🎮 Mode jeu' : '🎯 Pas à pas'}</p>
      <h2 id="res-title">${esc(r.title)}</h2>
      <div class="big-stars">${[1, 2, 3].map((i) => `<span class="bstar ${i <= r.stars ? 'on' : ''}" style="animation-delay:${0.25 * i}s">★</span>`).join('')}</div>
      <p class="res-msg">${msg}${r.outcome.newBest && r.score > 0 ? ' <span class="pill">Nouveau record</span>' : ''}</p>
      <div class="res-grid">
        <div><strong class="count-up" data-to="${r.score}">0</strong><span>points</span></div>
        <div><strong>${Math.round(r.accuracy * 100)} %</strong><span>justesse</span></div>
        <div><strong>${r.maxCombo}</strong><span>meilleur combo</span></div>
      </div>
      ${r.tempoNote ? `<p class="tempo-note">${esc(r.tempoNote)}</p>` : ''}
      <p class="res-detail">${r.counts.perfect} parfaites · ${r.counts.good + r.counts.ok} correctes · ${r.counts.miss} ratées</p>
      ${analysisHtml(r)}
      <div class="xp-box">
        <div class="xp-line"><span>+${r.outcome.xpGained} XP${r.outcome.challengeCompleted ? ' (dont 100 du défi du jour 🎯)' : ''}</span><span>Niveau ${lvl.level}</span></div>
        <div class="xp-bar"><div class="xp-fill" style="width:${levelUp ? 0 : (before.into / before.needed) * 100}%" data-to="${(lvl.into / lvl.needed) * 100}"></div></div>
        ${levelUp ? `<p class="level-up">⬆️ Niveau ${r.outcome.levelAfter} atteint !</p>` : ''}
      </div>
      ${
        r.outcome.newBadges.length
          ? `<div class="new-badges"><p>Nouveaux badges</p>${r.outcome.newBadges
              .map((b) => `<div class="badge-new"><span class="bicon">${b.icon}</span><div><strong>${esc(b.name)}</strong><small>${esc(b.description)}</small></div></div>`)
              .join('')}</div>`
          : ''
      }
      <div class="modal-actions">
        <button data-act="replay">↻ Rejouer</button>
        <button data-act="library" class="primary">Continuer</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);

  // Animations : compteur de points et barre d'XP.
  const counter = dlg.querySelector<HTMLElement>('.count-up')!;
  const target = r.score;
  const t0 = performance.now();
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / 900);
    counter.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))).toLocaleString('fr-FR');
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(() => {
    const fill = dlg.querySelector<HTMLElement>('.xp-fill')!;
    fill.style.width = `${fill.dataset.to}%`;
  }, 400);
  if (r.stars >= 2 || levelUp) confetti(r.stars === 3 ? 160 : 80);

  dlg.querySelector<HTMLButtonElement>('[data-act="library"]')!.focus();
  return new Promise((resolve) => {
    dlg.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act as 'replay' | 'library' | undefined;
      if (!act) return;
      dlg.remove();
      resolve(act);
    });
  });
}

/** Petite pluie de confettis sur un canvas temporaire. */
export function confetti(count = 100): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  document.body.appendChild(c);
  const ctx = c.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const colors = ['#ffb547', '#4fd1a5', '#6ea8ff', '#ff6b6b', '#c084fc', '#f472b6'];
  const parts = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 200,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 12,
    vy: -Math.random() * 12 - 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    s: 6 + Math.random() * 6,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  const step = () => {
    const t = performance.now() - t0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - t / 2600);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    if (t < 2600) requestAnimationFrame(step);
    else c.remove();
  };
  requestAnimationFrame(step);
}

export function toast(html: string, ms = 3500): void {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = html;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

/** Bilan détaillé : écoute de la prise, indicateurs, points forts, à reprendre, notes précises. */
function analysisHtml(r: ResultView): string {
  const a = r.analysis;
  if (!a && !r.recordingUrl) return '';
  const bar = (v: number) => `<span class="an-bar"><span style="width:${v}%;background:${v >= 80 ? 'var(--ok)' : v >= 60 ? 'var(--accent)' : 'var(--bad)'}"></span></span>`;
  return `<details class="analysis" open><summary>🔍 Bilan détaillé</summary>
    ${r.recordingUrl ? `<p class="an-rec">🎙 Ta prise : <audio controls src="${r.recordingUrl}"></audio></p>` : ''}
    ${a ? `<div class="an-scores">${a.scores.map((s) => `<div><span>${esc(s.label)}</span>${bar(s.value)}<strong>${s.value}</strong></div>`).join('')}</div>
    ${a.good.length ? `<h4>👍 Ce qui est bien</h4><ul>${a.good.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${a.fix.length ? `<h4>🛠 À reprendre</h4><ul>${a.fix.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${a.worst.length ? `<h4>📍 Notes à revoir</h4><ul>${a.worst.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}` : ''}
  </details>`;
}
