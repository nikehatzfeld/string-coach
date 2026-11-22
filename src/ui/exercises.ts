import { INSTRUMENTS } from '../songs/instruments';
import { persist, progress } from '../game/store';
import { EXERCISE_CATEGORIES, exercisesFor, type Exercise } from '../songs/exercise-bank';
import { prefs, savePrefs } from '../state/prefs';
import { esc, LEVEL_LABEL, on } from './dom';
import type { OpenFn } from './home';

let levelFilter = 0;
let catFilter: string | null = null;
let hideValidated = false;

export function isExercise(id: string): boolean {
  return id.startsWith('ex-');
}

export function renderExercises(app: HTMLElement, open: OpenFn, back: () => void): void {
  const all = exercisesFor(prefs.instrument);
  const validated = progress.validated ?? {};
  const done = all.filter((e) => validated[e.id]).length;
  const list = all.filter(
    (e) => (!levelFilter || e.level === levelFilter) && (!catFilter || e.category === catFilter) && (!hideValidated || !validated[e.id]),
  );
  const cats = EXERCISE_CATEGORIES.filter((c) => all.some((e) => e.category === c));

  app.innerHTML = `
    <header class="top">
      <button id="xBack" class="ghost" aria-label="Retour">←</button>
      <div class="ptitle"><h1>💪 Exercices · ${INSTRUMENTS[prefs.instrument].label}</h1><span class="pbest">${done} / ${all.length} validés</span></div>
    </header>
    <main class="home">
      <div class="session-bar"><div style="width:${(done / all.length) * 100}%"></div></div>
      <p class="hint">Un exercice est <strong>validé</strong> avec 3 étoiles en pas à pas ou en jeu, <strong>au tempo cible ou plus vite</strong>. On démarre plus lentement ; le tempo monte tout seul de 4 BPM après 3 passages propres.</p>
      <div class="filters chips">
        <button class="chip" data-cat="" aria-pressed="${!catFilter}">Toutes</button>
        ${cats.map((c) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${catFilter === c}">${esc(c)} <span class="muted">${all.filter((e) => e.category === c && validated[e.id]).length}/${all.filter((e) => e.category === c).length}</span></button>`).join('')}
      </div>
      <div class="filters chips">
        ${[0, 1, 2, 3, 4, 5].map((l) => `<button class="chip" data-lvl="${l}" aria-pressed="${levelFilter === l}">${l ? LEVEL_LABEL[l] : 'Tous niveaux'}</button>`).join('')}
        <button class="chip" data-hide aria-pressed="${hideValidated}">Masquer les validés</button>
        <span class="count">${list.length} exercice${list.length > 1 ? 's' : ''}</span>
      </div>
      <div class="grid">${list.map((e) => card(e, !!validated[e.id])).join('')}</div>
    </main>`;

  const rerender = () => renderExercises(app, open, back);
  app.querySelector('#xBack')!.addEventListener('click', back);
  on(app, '[data-cat]', 'click', (b) => {
    catFilter = b.dataset.cat || null;
    rerender();
  });
  on(app, '[data-lvl]', 'click', (b) => {
    levelFilter = Number(b.dataset.lvl);
    rerender();
  });
  on(app, '[data-hide]', 'click', () => {
    hideValidated = !hideValidated;
    rerender();
  });
  on(app, '[data-ex]', 'click', (b) => {
    const ex = all.find((e) => e.id === b.dataset.ex)!;
    // Tempo de départ : celui atteint précédemment, sinon un peu sous la cible.
    if (!prefs.bpmBySong[ex.id]) {
      prefs.bpmBySong[ex.id] = ex.tempo;
      savePrefs();
    }
    persist();
    open({ kind: 'library', song: ex }, 'step');
  });
}

function card(e: Exercise, ok: boolean): string {
  const rec = progress.songs[e.id];
  return `<button class="card ex-card ${ok ? 'validated' : ''}" data-ex="${e.id}" style="--hue:${ok ? 150 : 200}">
    <span class="cicon">${ok ? '✅' : '💪'}</span>
    <span class="style">${esc(e.category)}</span>
    <strong>${esc(e.title)}</strong>
    <span class="meta">${esc(e.how)}</span>
    <span class="card-foot"><span class="lvl l${e.level}">${LEVEL_LABEL[e.level]}</span><span class="muted">🎯 ${e.targetBpm} BPM${rec ? ` · ${'★'.repeat(rec.stars)}` : ''}</span></span>
  </button>`;
}
