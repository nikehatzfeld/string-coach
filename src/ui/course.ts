import { BLOCK_LABEL, buildSession, COURSES, resolveSong } from '../courses/plans';
import { dayKey, dueReviews, type CourseState } from '../game/progress';
import { persist, progress } from '../game/store';
import { prefs, savePrefs } from '../state/prefs';
import { esc, on } from './dom';
import type { OpenFn } from './home';
import { confetti, toast } from './results';


function state(): CourseState {
  progress.course ??= {};
  return (progress.course[prefs.instrument] ??= { week: 1, length: 20, done: {}, sessions: [] });
}

let timer: { key: string; end: number; id: number } | null = null;

export function renderCourse(app: HTMLElement, open: OpenFn, back: () => void): void {
  const st = state();
  const course = COURSES[prefs.instrument];
  const today = dayKey(new Date());
  const { stage, items } = buildSession(prefs.instrument, st.week, st.length, dueReviews(progress));
  const done = new Set(st.done[today] ?? []);
  const doneCount = items.filter((i) => done.has(i.key)).length;
  const weekSessions = st.sessions.filter((d) => d >= weekStart(today)).length;

  app.innerHTML = `
    <header class="top">
      <button id="cBack" class="ghost" aria-label="Retour">←</button>
      <div class="ptitle"><h1>🎓 ${esc(course.title)}</h1><span class="pbest">Séances faites cette semaine : ${weekSessions} / 5</span></div>
    </header>
    <main class="home course">
      <section class="course-head">
        <div class="weeks" role="group" aria-label="Semaine">
          ${Array.from({ length: 12 }, (_, i) => i + 1)
            .map((w) => `<button class="chip ${w < st.week ? 'past' : ''}" data-week="${w}" aria-pressed="${w === st.week}">S${w}</button>`)
            .join('')}
        </div>
        <div class="tile stage-tile">
          <div><span class="tile-label">Semaines ${stage.weeks[0]}–${stage.weeks[1]}</span><strong>${esc(stage.goal)}</strong>
          <span class="tile-sub">Tempos indicatifs. Règle de progression : +4 BPM après 3 passages propres, −2 après un passage raté.</span></div>
        </div>
      </section>
      <section>
        <h2>Séance du jour <span class="muted">${doneCount} / ${items.length} faits</span></h2>
        <div class="filters chips">
          ${([15, 20, 30] as const).map((l) => `<button class="chip" data-len="${l}" aria-pressed="${st.length === l}">${l} min</button>`).join('')}
        </div>
        <div class="session-bar"><div style="width:${items.length ? (doneCount / items.length) * 100 : 0}%"></div></div>
        <ol class="session">
          ${items
            .map((it) => {
              const song = resolveSong(it.song);
              const isDone = done.has(it.key);
              return `<li class="sitem ${isDone ? 'done' : ''}">
                <button class="check-btn" data-done="${it.key}" aria-pressed="${isDone}" aria-label="Marquer comme fait">${isDone ? '✔' : ''}</button>
                <div class="sbody">
                  <span class="sblock b-${it.block}">${BLOCK_LABEL[it.block]} · ${it.minutes} min${it.bpm ? ` · ♩ ${it.bpm}` : ''}</span>
                  <strong>${esc(it.title)}</strong>
                  <span class="muted">${esc(it.how)}</span>
                </div>
                ${
                  it.offline || !song
                    ? `<button class="timer-btn" data-timer="${it.key}" data-min="${it.minutes}">⏱ ${it.minutes}:00</button>`
                    : `<button class="primary" data-open="${it.key}">${it.mode === 'game' ? '🎮' : it.mode === 'step' ? '🎯' : '🎧'} Ouvrir</button>`
                }
              </li>`;
            })
            .join('')}
        </ol>
        <p class="hint">Fin de séance : nomme une chose réussie aujourd'hui et note ton tempo. S'enregistrer et se réécouter une fois par séance aide beaucoup.</p>
      </section>
      <section>
        <h2>Le parcours</h2>
        <div class="grid stages">
          ${course.stages
            .map((s) => `<div class="tile ${st.week >= s.weeks[0] && st.week <= s.weeks[1] ? 'current' : ''}"><div><span class="tile-label">S${s.weeks[0]}–${s.weeks[1]}</span><strong>${esc(s.goal)}</strong></div></div>`)
            .join('')}
        </div>
        <p class="hint">Construit d'après des sources pédagogiques (Suzuki, ABRSM, JustinGuitar, recherches sur la pratique) : <a href="https://github.com/nikehatzfeld/string-coach/blob/main/docs/pedagogie.md" target="_blank" rel="noopener">docs/pedagogie.md</a>.</p>
      </section>
    </main>`;

  const rerender = () => renderCourse(app, open, back);
  app.querySelector('#cBack')!.addEventListener('click', back);
  on(app, '[data-week]', 'click', (b) => {
    st.week = Number(b.dataset.week);
    persist();
    rerender();
  });
  on(app, '[data-len]', 'click', (b) => {
    st.length = Number(b.dataset.len) as 15 | 20 | 30;
    persist();
    rerender();
  });
  const markDone = (key: string, value?: boolean) => {
    const list = new Set(st.done[today] ?? []);
    const now = value ?? !list.has(key);
    if (now) list.add(key);
    else list.delete(key);
    st.done = { [today]: [...list] }; // on ne garde que le jour courant
    if (items.every((i) => list.has(i.key)) && !st.sessions.includes(today)) {
      st.sessions.push(today);
      st.sessions = st.sessions.slice(-60);
      progress.xp += 50;
      confetti(90);
      toast('🎓 Séance terminée : <strong>+50 XP</strong>');
      if (st.sessions.filter((d) => d >= weekStart(today)).length >= 5 && st.week < 12) toast('Semaine bouclée : tu peux passer à la semaine suivante 👉', 5000);
    }
    persist();
    rerender();
  };
  on(app, '[data-done]', 'click', (b) => markDone(b.dataset.done!));
  on(app, '[data-open]', 'click', (b) => {
    const it = items.find((i) => i.key === b.dataset.open)!;
    const song = resolveSong(it.song)!;
    // Tempo de départ du parcours, sauf si un tempo plus rapide a déjà été atteint.
    if (it.bpm && (prefs.bpmBySong[song.id] ?? 0) < it.bpm && song.tempo !== it.bpm) {
      prefs.bpmBySong[song.id] = it.bpm;
      savePrefs();
    }
    markDoneLater = it.key;
    open({ kind: 'library', song }, it.mode ?? 'step');
  });
  on(app, '[data-timer]', 'click', (b) => {
    const key = b.dataset.timer!;
    if (timer) clearInterval(timer.id);
    const end = Date.now() + Number(b.dataset.min) * 60000;
    timer = {
      key,
      end,
      id: window.setInterval(() => {
        const el = app.querySelector<HTMLElement>(`[data-timer="${key}"]`);
        const left = Math.max(0, end - Date.now());
        if (el) el.textContent = `⏱ ${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
        if (left === 0) {
          clearInterval(timer!.id);
          timer = null;
          toast('⏱ Temps écoulé');
          markDone(key, true);
        }
      }, 250),
    };
  });
}

/** Élément ouvert depuis la séance : marqué comme fait au retour. */
export let markDoneLater: string | null = null;

export function consumeMarkDone(): string | null {
  const k = markDoneLater;
  markDoneLater = null;
  if (k) {
    const st = state();
    const today = dayKey(new Date());
    const list = new Set(st.done[today] ?? []);
    list.add(k);
    st.done = { [today]: [...list] };
    persist();
  }
  return k;
}

function weekStart(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const shift = (date.getDay() + 6) % 7; // lundi
  return dayKey(new Date(y, m - 1, d - shift));
}
