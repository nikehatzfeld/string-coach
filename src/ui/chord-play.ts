import { patternsFor, StrumSynth, type StrumPattern } from '../audio/strum';
import { chartChords, type ChordChart } from '../courses/chords-content';
import { ChordListener, matchChord } from '../practice/chord-detector';
import { chordNameFr, easiestTransposition, hardChords, transposeChord } from '../songs/chords';
import { persist, progress, setPracticeActive } from '../game/store';
import { prefs } from '../state/prefs';
import { chordDiagram } from './chord-diagram';
import { esc } from './dom';
import { setSuggestedTempo } from './metronome';

/**
 * Lecteur d'accords : grille qui défile en rythme, diagrammes de l'accord en cours et du suivant,
 * rythme de grattage joué par une guitare synthétique, tonalité facile (capo) et vérification au micro.
 */

let cleanup: (() => void) | null = null;
export function closeChordPlay(): void {
  cleanup?.();
  cleanup = null;
}

export function renderChordPlay(app: HTMLElement, chartIn: ChordChart, back: () => void): void {
  closeChordPlay();
  const patterns = patternsFor(chartIn.timeSignature);
  const easy = easiestTransposition(chartChords(chartIn));
  const st = {
    bpm: chartIn.bpm,
    pattern: patterns.find((p) => p.id === chartIn.pattern) ?? patterns.find((p) => p.id !== 'plaque') ?? patterns[0],
    shift: 0,
    capo: 0,
    click: true,
    loop: true,
  };
  const eighthsPerBar = chartIn.timeSignature[1] === 8 ? chartIn.timeSignature[0] : chartIn.timeSignature[0] * (8 / chartIn.timeSignature[1]);
  const chartNow = () => ({
    ...chartIn,
    bars: chartIn.bars.map((b) => b.map((x) => ({ ...x, chord: transposeChord(x.chord, st.shift) }))),
  });
  let chart = chartNow();

  app.innerHTML = `
    <div class="chordplay">
    <header class="top">
      <button id="cBack" class="ghost" aria-label="Retour">←</button>
      <div class="ptitle"><h1>🎸 ${esc(chartIn.title)}</h1><span class="pbest">${esc(chartIn.subtitle ?? '')}</span></div>
    </header>
    <div class="toolbar">
      <button id="cPlay" class="primary">▶ Jouer</button>
      <div class="bpm"><button id="cDown">−</button><label>♩ = <input id="cBpm" type="number" min="30" max="220" value="${st.bpm}" /> BPM</label><button id="cUp">+</button></div>
      <label>Rythme <select id="cPat">${patterns.map((p) => `<option value="${p.id}" ${p.id === st.pattern.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label>Tonalité <select id="cKey">
        <option value="0">D'origine${hardChords(chartChords(chartIn)).length ? ` (${hardChords(chartChords(chartIn)).length} barré${hardChords(chartChords(chartIn)).length > 1 ? 's' : ''})` : ''}</option>
        ${easy.shift ? `<option value="${easy.shift}">Facile : capo ${easy.capo}${easy.hard ? ` (${easy.hard} barré)` : ', sans barré'}</option>` : ''}
        ${[-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].filter((s) => s !== easy.shift).map((s) => `<option value="${s}">${s > 0 ? '+' : ''}${s} demi-ton${Math.abs(s) > 1 ? 's' : ''}</option>`).join('')}
      </select></label>
      <button id="cClick" aria-pressed="true">♩ Clic</button>
      <button id="cLoop" aria-pressed="true">🔁 Boucle</button>
      <button id="cMic" aria-pressed="false" title="Vérifie au micro que tu joues le bon accord">🎤 Vérifier</button>
    </div>
    <main class="cp-main">
      <section class="cp-now">
        <div class="cp-diagrams"><div id="cNow"></div><div id="cNext" class="cp-next"></div></div>
        <div id="cPattern" class="cp-pattern"></div>
        <p id="cTip" class="hint"></p>
        <div class="cp-mic"><div class="mic-meter"><span class="lvl" id="cLvl"></span></div><span id="cHeard" class="muted"></span></div>
        <p id="cScore" class="cp-score"></p>
      </section>
      <section id="cSheet" class="cp-sheet"></section>
    </main>
    </div>`;
  const $ = <T extends HTMLElement>(id: string) => app.querySelector<T>(`#${id}`)!;
  const synth = new StrumSynth();
  let playing = false;
  let timer = 0;
  let nextTime = 0;
  let step = 0; // croche absolue depuis le début
  let startBar = 0;
  let mic: ChordListener | null = null;
  const barResult: (boolean | null)[] = [];
  let barFrames = { ok: 0, total: 0 };
  let curBar = -1;

  const chordAt = (bar: number, e: number): string | null => {
    const b = chart.bars[bar];
    if (!b) return null;
    let c: string | null = null;
    for (const x of b) if (x.at <= e) c = x.chord;
    if (c) return c;
    // Pas d'accord en début de mesure : le dernier accord précédent continue.
    for (let k = bar - 1; k >= 0; k--) if (chart.bars[k].length) return chart.bars[k][chart.bars[k].length - 1].chord;
    return null;
  };
  const nextChordAfter = (bar: number, e: number): string | null => {
    const cur = chordAt(bar, e);
    for (let k = bar; k < chart.bars.length + bar; k++) {
      const kb = k % chart.bars.length;
      for (const x of chart.bars[kb]) if ((k > bar || x.at > e) && x.chord !== cur) return x.chord;
    }
    return null;
  };

  function renderSheet() {
    $('cSheet').innerHTML = chart.bars
      .map((b, i) => {
        const res = barResult[i];
        const label = b.length ? b.map((x) => esc(chordNameFr(x.chord))).join(' · ') : '%';
        return `<button class="cp-bar ${i === curBar ? 'on' : ''} ${res === true ? 'good' : res === false ? 'bad' : ''}" data-bar="${i}"><small>${i + 1}</small>${label}</button>`;
      })
      .join('');
    app.querySelectorAll<HTMLButtonElement>('.cp-bar').forEach((b) =>
      b.addEventListener('click', () => {
        startBar = Number(b.dataset.bar);
        if (playing) {
          stop();
          start();
        } else showAt(startBar, 0);
      }),
    );
  }

  function renderPattern(active = -1) {
    const p: StrumPattern = st.pattern;
    const steps = Array.from({ length: eighthsPerBar }, (_, i) => p.steps[i % p.steps.length]);
    const sym = (s: string) => ({ D: '↓', U: '↑', B: 'B', A: 'B′', C: '▪', X: '✕', '-': '·' })[s] ?? (s.startsWith('s') ? s.slice(1) : s);
    const counts = chartIn.timeSignature[1] === 8 ? steps.map((_, i) => String(i + 1)) : steps.map((_, i) => (i % 2 ? 'et' : String(i / 2 + 1)));
    $('cPattern').innerHTML = steps.map((s, i) => `<span class="${i === active ? 'on' : ''}"><b>${sym(s)}</b><small>${counts[i]}</small></span>`).join('');
    $('cTip').textContent = p.tip;
  }

  function showAt(bar: number, e: number) {
    const c = chordAt(bar, e);
    const n = nextChordAfter(bar, e);
    $('cNow').innerHTML = c ? chordDiagram(c, { size: 'lg' }) : '';
    $('cNext').innerHTML = n ? `<span class="muted">ensuite</span>${chordDiagram(n, { size: 'sm' })}` : '';
    if (bar !== curBar) {
      // Fin de mesure : verdict du micro.
      if (mic && curBar >= 0 && barFrames.total >= 4) barResult[curBar] = barFrames.ok / barFrames.total >= 0.35;
      barFrames = { ok: 0, total: 0 };
      curBar = bar;
      renderSheet();
      app.querySelector('.cp-bar.on')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      updateScore();
    }
  }

  function updateScore() {
    const done = barResult.filter((r) => r !== null && r !== undefined);
    if (!done.length) return void ($('cScore').textContent = mic ? 'Joue : chaque mesure passe au vert si l’accord est reconnu.' : '');
    const ok = done.filter(Boolean).length;
    $('cScore').textContent = `✔ ${ok} / ${done.length} mesures justes (${Math.round((ok / done.length) * 100)} %)`;
  }

  function schedule() {
    // En 6/8, le BPM est celui de la noire pointée : 3 croches par temps.
    const eighth = chartIn.timeSignature[1] === 8 ? 60 / st.bpm / 3 : 60 / st.bpm / 2;
    while (nextTime < synth.ctx.currentTime + 0.12) {
      const total = chart.bars.length * eighthsPerBar;
      const abs = startBar * eighthsPerBar + step;
      if (abs >= total) {
        if (!st.loop) {
          stop();
          return;
        }
        step = -startBar * eighthsPerBar; // reprend au début de la grille
        continue;
      }
      const bar = Math.floor(abs / eighthsPerBar);
      const e = abs % eighthsPerBar;
      const c = chordAt(bar, e);
      const s = st.pattern.steps[e % st.pattern.steps.length];
      if (c) synth.play(c, s, nextTime, eighth);
      const beatEvery = chartIn.timeSignature[1] === 8 ? 3 : 8 / chartIn.timeSignature[1];
      if (st.click && e % beatEvery === 0) synth.click(nextTime, e === 0);
      const t = nextTime;
      window.setTimeout(() => {
        if (!playing) return;
        showAt(bar, e);
        renderPattern(e);
      }, Math.max(0, (t - synth.ctx.currentTime) * 1000));
      nextTime += eighth;
      step++;
    }
  }

  function start() {
    void synth.ctx.resume();
    playing = true;
    step = 0;
    nextTime = synth.ctx.currentTime + 0.1;
    timer = window.setInterval(schedule, 25);
    $('cPlay').textContent = '⏹ Arrêter';
    setPracticeActive(true);
  }
  function stop() {
    playing = false;
    clearInterval(timer);
    $('cPlay').textContent = '▶ Jouer';
    renderPattern();
    setPracticeActive(!!mic);
    // XP pour une séance avec vérification
    const done = barResult.filter((r) => r === true).length;
    if (done >= 4) {
      progress.xp += Math.min(50, done * 2);
      persist();
    }
  }

  $('cPlay').addEventListener('click', () => (playing ? stop() : start()));
  const setBpm = (v: number) => {
    st.bpm = Math.max(30, Math.min(220, Math.round(v) || st.bpm));
    $<HTMLInputElement>('cBpm').value = String(st.bpm);
  };
  $('cDown').addEventListener('click', () => setBpm(st.bpm - 5));
  $('cUp').addEventListener('click', () => setBpm(st.bpm + 5));
  $('cBpm').addEventListener('change', () => setBpm(Number($<HTMLInputElement>('cBpm').value)));
  $('cPat').addEventListener('change', () => {
    st.pattern = patterns.find((p) => p.id === $<HTMLSelectElement>('cPat').value) ?? st.pattern;
    renderPattern();
  });
  $('cKey').addEventListener('change', () => {
    st.shift = Number($<HTMLSelectElement>('cKey').value);
    chart = chartNow();
    curBar = -1;
    showAt(Math.max(0, startBar), 0);
  });
  const toggle = (id: string, key: 'click' | 'loop') =>
    $(id).addEventListener('click', () => {
      st[key] = !st[key];
      $(id).setAttribute('aria-pressed', String(st[key]));
    });
  toggle('cClick', 'click');
  toggle('cLoop', 'loop');

  $('cMic').addEventListener('click', async () => {
    if (mic) {
      await mic.stop();
      mic = null;
      $('cMic').setAttribute('aria-pressed', 'false');
      $('cHeard').textContent = '';
      return;
    }
    const m = new ChordListener();
    try {
      await m.start((chroma, level) => {
        $('cLvl').style.width = `${Math.round(level * 100)}%`;
        const expected = curBar >= 0 ? chordAt(curBar, 0) : chordAt(startBar, 0);
        if (!chroma || !expected) return void ($('cHeard').textContent = level > 0.15 ? '…' : 'silence');
        const r = matchChord(chroma, expected);
        if (playing) {
          barFrames.total++;
          if (r.ok) barFrames.ok++;
        }
        $('cHeard').innerHTML = r.ok ? `✔ ${esc(chordNameFr(expected))}` : `j'entends plutôt <strong>${esc(chordNameFr(r.best))}</strong>`;
      }, prefs.micId || undefined);
      mic = m;
      $('cMic').setAttribute('aria-pressed', 'true');
      setPracticeActive(true);
      updateScore();
    } catch {
      $('cHeard').textContent = 'Micro refusé ou indisponible.';
    }
  });
  $('cBack').addEventListener('click', () => {
    closeChordPlay();
    back();
  });

  setSuggestedTempo(() => st.bpm);
  cleanup = () => {
    playing = false;
    clearInterval(timer);
    void mic?.stop();
    void synth.ctx.close();
    setSuggestedTempo(null);
    setPracticeActive(false);
  };
  renderPattern();
  showAt(0, 0);
}
