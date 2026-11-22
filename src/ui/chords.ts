import { StrumSynth } from '../audio/strum';
import { chart, chartChords, chartFromSong, chordLessons, CHORD_CHARTS, type ChordChart } from '../courses/chords-content';
import { mdToHtml } from '../courses/harmony-content';
import { persist, progress, setPracticeActive } from '../game/store';
import { ChordListener, matchChord } from '../practice/chord-detector';
import { CHORD_FAMILIES, chordNameFr } from '../songs/chords';
import { LIBRARY } from '../songs/library';
import { prefs } from '../state/prefs';
import { chordDiagram } from './chord-diagram';
import { esc } from './dom';

type Tab = 'dict' | 'course' | 'changes' | 'songs';
const DONE_KEY = 'string-coach:chords-done';
const doneSet = (): Set<number> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
};

let stopAll: (() => void) | null = null;

export function renderChords(app: HTMLElement, back: () => void, play: (c: ChordChart) => void, tab: Tab = 'dict', lessonN?: number): void {
  stopAll?.();
  stopAll = null;
  const go = (t: Tab, n?: number) => renderChords(app, back, play, t, n);
  const tabs: [Tab, string][] = [
    ['dict', '📖 Accords'],
    ['course', '🎓 Cours'],
    ['changes', '🔁 Changements'],
    ['songs', '🎵 Morceaux'],
  ];
  const head = `
    <header class="top">
      <button id="chBack" class="ghost" aria-label="Retour">←</button>
      <div class="ptitle"><h1>🎸 Accords de guitare</h1><span class="pbest">Diagrammes, cours, rythmes et morceaux · vérification au micro</span></div>
    </header>
    <nav class="seg ch-tabs">${tabs.map(([t, l]) => `<button data-tab="${t}" aria-pressed="${t === tab}">${l}</button>`).join('')}</nav>`;
  let body = '';
  if (tab === 'dict') body = dictHtml();
  else if (tab === 'course') body = lessonN ? lessonHtml(lessonN) : courseHtml();
  else if (tab === 'changes') body = changesHtml();
  else body = songsHtml();
  app.innerHTML = `${head}<main class="home chords-page">${body}</main>`;
  app.querySelector('#chBack')!.addEventListener('click', () => {
    stopAll?.();
    back();
  });
  app.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab as Tab)));

  // ---------- Dictionnaire ----------
  if (tab === 'dict') {
    app.querySelectorAll<HTMLButtonElement>('[data-chord]').forEach((b) => b.addEventListener('click', () => openChord(b.dataset.chord!)));
  }
  // ---------- Cours ----------
  if (tab === 'course') {
    app.querySelectorAll<HTMLButtonElement>('[data-lesson]').forEach((b) => b.addEventListener('click', () => go('course', Number(b.dataset.lesson))));
    const l = lessonN ? chordLessons().find((x) => x.n === lessonN) : null;
    if (l) {
      app.querySelector('#lPractice')?.addEventListener('click', () => play(l.practice));
      app.querySelector('#lDone')?.addEventListener('click', () => {
        const d = doneSet();
        if (!d.has(l.n)) {
          d.add(l.n);
          try {
            localStorage.setItem(DONE_KEY, JSON.stringify([...d]));
          } catch {
            /* ignore */
          }
          progress.xp += 30;
          persist();
        }
        go('course', Math.min(chordLessons().length, l.n + 1));
      });
      app.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) => b.addEventListener('click', () => go('course', Number(b.dataset.go))));
      app.querySelectorAll<HTMLButtonElement>('[data-chord]').forEach((b) => b.addEventListener('click', () => openChord(b.dataset.chord!)));
    }
  }
  // ---------- Changements ----------
  if (tab === 'changes') wireChanges(app, play);
  // ---------- Morceaux ----------
  if (tab === 'songs') {
    const all = allCharts();
    app.querySelectorAll<HTMLButtonElement>('[data-chart]').forEach((b) => b.addEventListener('click', () => play(all.find((c) => c.id === b.dataset.chart)!)));
    const search = app.querySelector<HTMLInputElement>('#chSearch');
    search?.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      app.querySelectorAll<HTMLElement>('[data-chart]').forEach((el) => (el.hidden = !!q && !el.textContent!.toLowerCase().includes(q)));
    });
  }
  window.scrollTo({ top: 0 });
}

function dictHtml(): string {
  return `<p class="hint">Clique sur un accord pour l'écouter et vérifier au micro que tu le joues bien.</p>
    ${CHORD_FAMILIES.map(
      (f) => `<h2>${esc(f.name)}</h2><div class="cd-grid">${f.chords.map((c) => `<button class="cd-card" data-chord="${esc(c)}">${chordDiagram(c)}</button>`).join('')}</div>`,
    ).join('')}`;
}

function courseHtml(): string {
  const d = doneSet();
  const ls = chordLessons();
  return `<p class="hint">${ls.length} leçons pour passer du premier accord aux morceaux connus. Chaque leçon a son exercice en rythme, avec vérification au micro. ${d.size} / ${ls.length} terminées.</p>
    <div class="grid">${ls
      .map(
        (l) => `<button class="card" data-lesson="${l.n}" style="--hue:${d.has(l.n) ? 150 : 30}"><span class="cicon">${d.has(l.n) ? '✅' : '🎸'}</span><span class="style">Leçon ${l.n}</span><strong>${esc(l.title)}</strong></button>`,
      )
      .join('')}</div>`;
}

function lessonHtml(n: number): string {
  const ls = chordLessons();
  const l = ls.find((x) => x.n === n)!;
  const d = doneSet();
  const chords = chartChords(l.practice);
  return `<div class="lesson">
      <h2>Leçon ${l.n} · ${esc(l.title)}</h2>
      <div class="cd-grid">${chords.map((c) => `<button class="cd-card" data-chord="${esc(c)}">${chordDiagram(c, { size: 'sm' })}</button>`).join('')}</div>
      ${mdToHtml(l.body)}
      <div class="lesson-nav">
        ${l.n > 1 ? `<button data-go="${l.n - 1}">← Leçon ${l.n - 1}</button>` : '<span></span>'}
        <button id="lPractice" class="primary">🎸 Pratiquer : ${esc(l.practice.title)}</button>
        <button id="lDone">${d.has(l.n) ? '✔ Terminée' : 'Terminée (+30 XP)'}</button>
        ${l.n < ls.length ? `<button data-go="${l.n + 1}">Leçon ${l.n + 1} →</button>` : '<span></span>'}
      </div></div>`;
}

const CHANGE_CHORDS = ['Em', 'Am', 'E', 'A', 'D', 'G', 'C', 'Dm', 'E7', 'A7', 'D7', 'G7', 'B7', 'F', 'Bm', 'Cmaj7', 'Fmaj7'];

function changesHtml(): string {
  const opt = (sel: string) => CHANGE_CHORDS.map((c) => `<option value="${c}" ${c === sel ? 'selected' : ''}>${esc(chordNameFr(c))} (${c})</option>`).join('');
  const best = progress as unknown as { chordChanges?: Record<string, number> };
  const records = Object.entries(best.chordChanges ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, v]) => `<li>${esc(k.replace('-', ' ↔ '))} : <strong>${v}</strong> changements / minute</li>`)
    .join('');
  return `<p class="hint">La méthode la plus efficace pour progresser : changer d'accord le plus de fois possible en une minute, en grattant une fois chaque accord. Le micro compte les changements réussis.</p>
    <div class="toolbar ch-pick">
      <label>Accord 1 <select id="cA">${opt('Am')}</select></label>
      <label>Accord 2 <select id="cB">${opt('C')}</select></label>
      <button id="cMinute" class="primary">⏱ 1 minute au micro</button>
      <button id="cRhythm">🎸 En rythme (lecteur)</button>
    </div>
    <div class="ch-duo"><div id="cdA"></div><div id="cdB"></div></div>
    <div class="ch-minute"><strong id="cCount">0</strong><span id="cTime" class="muted">changements · 60 s</span><span id="cMsg" class="muted"></span></div>
    ${records ? `<h3>Tes records</h3><ul>${records}</ul>` : ''}`;
}

function wireChanges(app: HTMLElement, play: (c: ChordChart) => void) {
  const $ = <T extends HTMLElement>(id: string) => app.querySelector<T>(`#${id}`)!;
  const pair = () => [$<HTMLSelectElement>('cA').value, $<HTMLSelectElement>('cB').value];
  const draw = () => {
    const [a, b] = pair();
    $('cdA').innerHTML = chordDiagram(a, { size: 'lg' });
    $('cdB').innerHTML = chordDiagram(b, { size: 'lg' });
  };
  draw();
  $('cA').addEventListener('change', draw);
  $('cB').addEventListener('change', draw);
  $('cRhythm').addEventListener('click', () => {
    const [a, b] = pair();
    play(chart(`ch-${a}-${b}`, `Changements ${a} ↔ ${b}`, `${a} | ${b} | ${a} | ${b}`, [4, 4], 60, { pattern: 'plaque' }));
  });
  let listener: ChordListener | null = null;
  let timer = 0;
  const finish = () => {
    clearInterval(timer);
    void listener?.stop();
    listener = null;
    setPracticeActive(false);
    $('cMinute').textContent = '⏱ 1 minute au micro';
  };
  stopAll = finish;
  $('cMinute').addEventListener('click', async () => {
    if (listener) return finish();
    const [a, b] = pair();
    let count = 0;
    let expect = a;
    let stable = 0;
    let left = 60;
    const l = new ChordListener();
    try {
      await l.start((chroma) => {
        if (!chroma || left <= 0) return;
        const r = matchChord(chroma, expect);
        stable = r.ok ? stable + 1 : 0;
        // Accord tenu ~0,2 s : validé, on attend l'autre.
        if (stable >= 4) {
          count++;
          expect = expect === a ? b : a;
          stable = 0;
          $('cCount').textContent = String(Math.max(0, count - 1));
          $('cMsg').textContent = `→ maintenant ${chordNameFr(expect)}`;
        }
      }, prefs.micId || undefined);
    } catch {
      $('cMsg').textContent = 'Micro refusé ou indisponible.';
      return;
    }
    listener = l;
    setPracticeActive(true);
    $('cMinute').textContent = '⏹ Arrêter';
    $('cMsg').textContent = `Joue ${chordNameFr(a)} pour démarrer`;
    timer = window.setInterval(() => {
      left--;
      $('cTime').textContent = `changements · ${left} s`;
      if (left <= 0) {
        const n = Math.max(0, count - 1);
        const key = `${a}-${b}`;
        const p = progress as unknown as { chordChanges?: Record<string, number> };
        p.chordChanges = p.chordChanges ?? {};
        const record = n > (p.chordChanges[key] ?? 0);
        if (record) p.chordChanges[key] = n;
        progress.xp += Math.min(40, n);
        persist();
        $('cMsg').textContent = record ? `🏆 Nouveau record : ${n} !` : `Terminé : ${n} changements`;
        finish();
      }
    }, 1000);
  });
}

function allCharts(): ChordChart[] {
  const fromLib = LIBRARY.filter((s) => !s.id.startsWith('ex') && !s.id.endsWith('~facile'))
    .map((s) => ({ s, c: chartFromSong(s) }))
    .filter((x): x is { s: (typeof LIBRARY)[number]; c: ChordChart } => !!x.c && chartChords(x.c).length >= 2)
    .sort((a, b) => Number(!!b.s.famous) - Number(!!a.s.famous) || a.s.level - b.s.level)
    .map((x) => x.c);
  return [...CHORD_CHARTS, ...fromLib];
}

function songsHtml(): string {
  const all = allCharts();
  const card = (c: ChordChart) => {
    const chords = chartChords(c);
    return `<button class="ch-song" data-chart="${esc(c.id)}"><strong>${esc(c.title)}</strong><span class="muted">${esc(c.subtitle ?? '')}</span><span class="ch-chords">${chords.slice(0, 8).map((x) => esc(chordNameFr(x))).join(' · ')}${chords.length > 8 ? ' …' : ''}</span></button>`;
  };
  return `<p class="hint">Grilles célèbres, morceaux traditionnels, et tous les morceaux de la bibliothèque qui ont des accords. Le lecteur propose une <strong>tonalité facile</strong> (capodastre) et plusieurs façons de jouer (plaqué, pop, arpège, basse-accord…).</p>
    <input id="chSearch" type="search" placeholder="🔎 Rechercher" />
    <h2>Grilles et morceaux à connaître</h2><div class="ch-songs">${CHORD_CHARTS.map(card).join('')}</div>
    <h2>Morceaux de la bibliothèque</h2><div class="ch-songs">${all.slice(CHORD_CHARTS.length).map(card).join('')}</div>`;
}

/** Fenêtre d'un accord : grand diagramme, écoute, vérification au micro. */
function openChord(name: string) {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `<div class="modal ch-modal">${chordDiagram(name, { size: 'lg' })}
    <p id="chHeard" class="muted">Gratte l'accord : le micro vérifie.</p>
    <div class="mic-meter big"><span class="lvl" id="chLvl"></span></div>
    <div class="modal-actions"><button id="chHear">🔊 Écouter</button><button id="chMic" class="primary">🎤 Vérifier</button><button id="chClose" class="ghost">Fermer</button></div></div>`;
  document.body.appendChild(back);
  const q = <T extends HTMLElement>(id: string) => back.querySelector<T>(`#${id}`)!;
  let synth: StrumSynth | null = null;
  let l: ChordListener | null = null;
  let streak = 0;
  q('chHear').addEventListener('click', () => {
    synth = synth ?? new StrumSynth();
    void synth.ctx.resume();
    synth.play(name, 'D', synth.ctx.currentTime + 0.05, 0.5);
  });
  q('chMic').addEventListener('click', async () => {
    if (l) return;
    l = new ChordListener();
    try {
      await l.start((chroma, level) => {
        q('chLvl').style.width = `${Math.round(level * 100)}%`;
        if (!chroma) return;
        const r = matchChord(chroma, name);
        streak = r.ok ? streak + 1 : 0;
        q('chHeard').innerHTML = r.ok
          ? streak > 6
            ? `✅ <strong>${esc(chordNameFr(name))}</strong> reconnu !`
            : `✔ ça ressemble à ${esc(chordNameFr(name))}…`
          : `j'entends plutôt <strong>${esc(chordNameFr(r.best))}</strong> : vérifie chaque corde`;
      }, prefs.micId || undefined);
      q('chMic').textContent = '🎤 J’écoute…';
    } catch {
      q('chHeard').textContent = 'Micro refusé ou indisponible.';
      l = null;
    }
  });
  const close = () => {
    void l?.stop();
    void synth?.ctx.close();
    back.remove();
  };
  q('chClose').addEventListener('click', close);
  back.addEventListener('click', (e) => e.target === back && close());
}
