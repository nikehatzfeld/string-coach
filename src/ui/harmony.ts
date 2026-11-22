import { persist, progress } from '../game/store';
import { esc } from './dom';
import { lessons, mdToHtml, type ImprovPreset } from '../courses/harmony-content';

const KEY = 'string-coach:harmony-done';
function done(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

export function renderHarmony(app: HTMLElement, back: () => void, openImprov: (p: ImprovPreset) => void, lessonN?: number): void {
  const all = lessons();
  const finished = done();
  if (lessonN) {
    const l = all.find((x) => x.n === lessonN)!;
    app.innerHTML = `
      <header class="top">
        <button id="hBack" class="ghost" aria-label="Retour">←</button>
        <div class="ptitle"><h1>Leçon ${l.n} · ${esc(l.title)}</h1><span class="pbest">Initiation à l'harmonie et à l'improvisation</span></div>
        <button id="hImprov" class="primary">🎼 Pratiquer dans l'atelier</button>
      </header>
      <main class="home lesson">${mdToHtml(l.body)}
        <div class="lesson-nav">
          ${l.n > 1 ? `<button data-go="${l.n - 1}">← Leçon ${l.n - 1}</button>` : '<span></span>'}
          <button id="hDone" class="${finished.has(l.n) ? '' : 'primary'}">${finished.has(l.n) ? '✔ Leçon terminée' : 'Marquer comme terminée (+30 XP)'}</button>
          ${l.n < all.length ? `<button data-go="${l.n + 1}">Leçon ${l.n + 1} →</button>` : '<span></span>'}
        </div>
        <p class="hint">Les références [S1]… renvoient aux sources du cours : <a href="https://github.com/nikehatzfeld/string-coach/blob/main/docs/cours-harmonie.md" target="_blank" rel="noopener">docs/cours-harmonie.md</a>.</p>
      </main>`;
    app.querySelector('#hBack')!.addEventListener('click', () => renderHarmony(app, back, openImprov));
    app.querySelector('#hImprov')!.addEventListener('click', () => openImprov(l.preset));
    app.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => b.addEventListener('click', () => renderHarmony(app, back, openImprov, Number(b.dataset.go))));
    app.querySelector('#hDone')!.addEventListener('click', () => {
      if (!finished.has(l.n)) {
        finished.add(l.n);
        try {
          localStorage.setItem(KEY, JSON.stringify([...finished]));
        } catch {
          /* ignore */
        }
        progress.xp += 30;
        persist();
      }
      renderHarmony(app, back, openImprov, Math.min(all.length, l.n + 1));
    });
    window.scrollTo({ top: 0 });
    return;
  }
  app.innerHTML = `
    <header class="top">
      <button id="hBack" class="ghost" aria-label="Retour">←</button>
      <div class="ptitle"><h1>🎼 Harmonie & improvisation</h1><span class="pbest">${finished.size} / ${all.length} leçons terminées</span></div>
      <button id="hImprov" class="primary">Atelier libre</button>
    </header>
    <main class="home">
      <p class="hint">Un cours original en ${all.length} leçons, construit à partir des meilleures ressources (Open Music Theory, musictheory.net, Hooktheory, Berklee, pédagogie blues et cordes improvisées). Chaque notion se joue tout de suite dans l'atelier : bourdon, grilles d'accords, cercle des notes et micro.</p>
      <div class="grid">
        ${all
          .map(
            (l) => `<button class="card" data-lesson="${l.n}" style="--hue:${finished.has(l.n) ? 150 : 280}">
          <span class="cicon">${finished.has(l.n) ? '✅' : '🎼'}</span><span class="style">Leçon ${l.n}</span><strong>${esc(l.title)}</strong></button>`,
          )
          .join('')}
      </div>
    </main>`;
  app.querySelector('#hBack')!.addEventListener('click', back);
  app.querySelector('#hImprov')!.addEventListener('click', () => openImprov({ tonic: 2, scale: 'major', progression: 'I-IV-V-I', bpm: 80 }));
  app.querySelectorAll<HTMLButtonElement>('[data-lesson]').forEach((b) => b.addEventListener('click', () => renderHarmony(app, back, openImprov, Number(b.dataset.lesson))));
}
