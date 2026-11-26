import { MicPitchDetector } from '../practice/pitch-detector';
import { contourRange, contourSlope, harmonyLine, melodyTimeline, noteAt, voiceType, type TimedNote } from '../practice/voice-lib';
import { persist, progress, setPracticeActive } from '../game/store';
import { freqToMidiFloat } from '../songs/notation';
import { LIBRARY } from '../songs/library';
import { solfege } from '../songs/positions';
import { prefs } from '../state/prefs';
import { esc } from './dom';
import { PitchTrace } from './voice-board';

/** Studio voix : miroir de justesse, écho, sirène, parole, chant à deux voix. */

type Tab = 'mirror' | 'echo' | 'siren' | 'speech' | 'duet';
const RANGE_KEY = 'string-coach:voice-range';

function savedRange(): [number, number] {
  try {
    const r = JSON.parse(localStorage.getItem(RANGE_KEY) ?? 'null');
    if (Array.isArray(r) && r.length === 2) return r as [number, number];
  } catch {
    /* ignore */
  }
  return [57, 69];
}

const noteLabel = (m: number) => `${solfege(Math.round(m), false)}${Math.floor(Math.round(m) / 12) - 1}`;

/** Voix synthétique douce (« ou ») pour donner les notes et chanter l'autre voix. */
class VoiceSynth {
  readonly ctx: AudioContext;
  private out: GainNode;
  constructor() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.out = this.ctx.createGain();
    this.out.gain.value = 0.35;
    this.out.connect(this.ctx.destination);
  }
  set volume(v: number) {
    this.out.gain.value = v;
  }
  /** Note de `dur` secondes à l'instant `when` ; renvoie une fonction d'arrêt. */
  note(midi: number, when: number, dur: number): () => void {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = f * 0.006;
    lfo.connect(lfoGain).connect(o.frequency);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.5, when + 0.08);
    const end = when + dur;
    g.gain.setValueAtTime(0.5, Math.max(when + 0.08, end - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(lp).connect(g).connect(this.out);
    o.start(when);
    lfo.start(when);
    o.stop(end + 0.05);
    lfo.stop(end + 0.05);
    return () => {
      try {
        g.gain.cancelScheduledValues(this.ctx.currentTime);
        g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
        o.stop(this.ctx.currentTime + 0.2);
        lfo.stop(this.ctx.currentTime + 0.2);
      } catch {
        /* déjà arrêtée */
      }
    };
  }
}

let cleanup: (() => void) | null = null;
export function closeVoiceStudio(): void {
  cleanup?.();
  cleanup = null;
}

export function renderVoiceStudio(app: HTMLElement, back: () => void, tab: Tab = 'mirror'): void {
  closeVoiceStudio();
  const tabs: [Tab, string][] = [
    ['mirror', '🪞 Miroir'],
    ['echo', '🔁 Écho'],
    ['siren', '🌊 Sirène'],
    ['speech', '🗣 Parole'],
    ['duet', '👥 Deux voix'],
  ];
  app.innerHTML = `
    <div class="vstudio">
    <header class="top">
      <button id="vBack" class="ghost" aria-label="Retour">←</button>
      <div class="ptitle"><h1>🎤 Studio voix</h1><span class="pbest">Justesse en direct, jeux vocaux, parole et chant à deux voix</span></div>
    </header>
    <nav class="seg ch-tabs">${tabs.map(([t, l]) => `<button data-vtab="${t}" aria-pressed="${t === tab}">${l}</button>`).join('')}</nav>
    <div id="vTrace" class="v-trace"></div>
    <main class="home v-main" id="vMain"></main>
    </div>`;
  const $ = <T extends HTMLElement>(id: string) => app.querySelector<T>(`#${id}`)!;
  const trace = new PitchTrace($('vTrace'), 'ta voix');
  // Échelle verticale fixe : ta tessiture (mesurée dans le miroir), avec de la marge.
  {
    const [rl, rh] = savedRange();
    trace.setRange(rl - 4, rh + 4);
  }
  const synth = new VoiceSynth();
  let mic: MicPitchDetector | null = null;
  let onPitch: (m: number | null, t: number) => void = () => {};
  const timers: number[] = [];
  const stops: (() => void)[] = [];
  const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

  async function ensureMic(): Promise<boolean> {
    if (mic) return true;
    const m = new MicPitchDetector({ deviceId: prefs.micId, minClarity: 0.65 });
    try {
      await m.start((r) => {
        const midi = r.freq ? freqToMidiFloat(r.freq, prefs.a4) : null;
        trace.feed(midi, r.time);
        onPitch(midi, r.time);
      });
      mic = m;
      setPracticeActive(true);
      return true;
    } catch {
      $('vMain').insertAdjacentHTML('afterbegin', '<p class="mic-help">🎤 Micro refusé : clique sur 🔒 à gauche de l’adresse › Micro › Autoriser.</p>');
      return false;
    }
  }
  const stopSounds = () => {
    timers.splice(0).forEach(clearTimeout);
    stops.splice(0).forEach((s) => s());
  };
  const award = (xp: number) => {
    progress.xp += xp;
    persist();
  };

  app.querySelectorAll<HTMLButtonElement>('[data-vtab]').forEach((b) =>
    b.addEventListener('click', () => {
      stopSounds();
      renderVoiceStudio(app, back, b.dataset.vtab as Tab);
    }),
  );
  $('vBack').addEventListener('click', () => {
    closeVoiceStudio();
    back();
  });
  cleanup = () => {
    stopSounds();
    void mic?.stop();
    trace.destroy();
    void synth.ctx.close();
    setPracticeActive(false);
  };
  const main = $('vMain');
  const headphones = '<p class="hint">🎧 Avec un casque, le micro n’entend que ta voix. Avec des haut-parleurs, baisse le son de l’app.</p>';

  // ---------------- Miroir ----------------
  if (tab === 'mirror') {
    let [lo, hi] = [99, 0];
    let held: { m: number; since: number } | null = null;
    main.innerHTML = `
      <div class="v-big"><strong id="mNote">—</strong><span id="mCents" class="muted"></span></div>
      <p class="hint">Chante, parle, fais des sirènes : la courbe montre ta hauteur en temps réel. Tiens tes notes les plus graves et les plus aiguës (sans forcer) pour mesurer ta tessiture.</p>
      <div class="v-range"><span>Grave : <strong id="mLo">—</strong></span><span>Aigu : <strong id="mHi">—</strong></span><span>Voix : <strong id="mType">—</strong></span><button id="mReset">↺</button><button id="mSave" class="primary">Enregistrer ma tessiture</button></div>`;
    onPitch = (m, t) => {
      if (m === null) {
        held = null;
        return;
      }
      const near = Math.round(m);
      $('mNote').textContent = noteLabel(m);
      const c = Math.round((m - near) * 100);
      $('mCents').textContent = `${c >= 0 ? '+' : ''}${c} cents`;
      if (!held || Math.abs(held.m - near) > 0) held = { m: near, since: t };
      else if (t - held.since > 400) {
        lo = Math.min(lo, near);
        hi = Math.max(hi, near);
        $('mLo').textContent = noteLabel(lo);
        $('mHi').textContent = noteLabel(hi);
        if (hi - lo >= 5) $('mType').textContent = voiceType(lo, hi);
      }
    };
    $('mReset').addEventListener('click', () => {
      [lo, hi] = [99, 0];
      ['mLo', 'mHi', 'mType'].forEach((id) => ($(id).textContent = '—'));
    });
    $('mSave').addEventListener('click', () => {
      if (hi - lo < 5) return;
      // Zone confortable : on retire un ton à chaque extrémité.
      localStorage.setItem(RANGE_KEY, JSON.stringify([lo + 2, hi - 2]));
      $('mSave').textContent = '✔ Enregistrée';
    });
    void ensureMic();
  }

  // ---------------- Écho ----------------
  if (tab === 'echo') {
    const [rlo, rhi] = savedRange();
    let level: 1 | 2 | 3 = 1;
    let round = 0;
    let score = 0;
    let streak = 0;
    main.innerHTML = `
      <div class="toolbar"><label>Niveau <select id="eLvl"><option value="1">Une note</option><option value="2">Deux notes (intervalle)</option><option value="3">Mini-mélodie (4 notes)</option></select></label>
      <button id="eGo" class="primary">▶ Jouer (10 manches)</button></div>
      <div class="v-big"><strong id="eMsg">Écoute, puis chante la même chose</strong></div>
      <div class="v-range"><span>Manche <strong id="eRound">0</strong>/10</span><span>Score <strong id="eScore">0</strong></span><span>Série <strong id="eStreak">0</strong></span></div>
      ${headphones}<p class="hint">Tessiture utilisée : ${noteLabel(rlo)} – ${noteLabel(rhi)} (mesure-la dans 🪞 Miroir).</p>`;
    const pick = () => rlo + Math.floor(Math.random() * (rhi - rlo + 1));
    const phrase = (): number[] => {
      const a = pick();
      if (level === 1) return [a];
      if (level === 2) {
        const iv = [2, 3, 4, 5, 7, -2, -3, -5][Math.floor(Math.random() * 8)];
        return [a, Math.max(rlo, Math.min(rhi, a + iv))];
      }
      const out = [a];
      for (let i = 0; i < 3; i++) out.push(Math.max(rlo, Math.min(rhi, out[i] + [-2, -1, 1, 2, 3, -3][Math.floor(Math.random() * 6)])));
      return out;
    };
    async function playRound() {
      if (round >= 10) {
        $('eMsg').textContent = `Terminé ! ${score} points`;
        award(Math.round(score / 50));
        trace.show([]);
        return;
      }
      round++;
      $('eRound').textContent = String(round);
      const notes = phrase();
      $('eMsg').textContent = '👂 Écoute…';
      const t0 = synth.ctx.currentTime + 0.2;
      notes.forEach((m, i) => stops.push(synth.note(m, t0 + i * 0.8, 0.7)));
      let idx = 0;
      let holdSince = 0;
      let start = 0;
      later(() => {
        $('eMsg').textContent = `🎤 À toi : ${notes.length > 1 ? `${notes.length} notes` : 'chante la note'}`;
        trace.show([{ midi: notes[0] }], notes[1] ? [{ midi: notes[1] }] : []);
        start = performance.now();
        onPitch = (m, t) => {
          if (idx >= notes.length) return;
          if (t - start > 6000 * notes.length) {
            streak = 0;
            $('eStreak').textContent = '0';
            $('eMsg').textContent = `⏱ C'était ${notes.map(noteLabel).join(' – ')}`;
            onPitch = () => {};
            later(playRound, 1500);
            return;
          }
          if (m === null) return void (holdSince = 0);
          let d = m - notes[idx];
          while (d > 6) d -= 12;
          while (d < -6) d += 12;
          if (Math.abs(d) <= 0.4) {
            if (!holdSince) holdSince = t;
            if (t - holdSince > 350) {
              score += Math.round(100 - Math.abs(d) * 100) + Math.max(0, 50 - Math.round((t - start) / 100));
              idx++;
              holdSince = 0;
              if (idx < notes.length) trace.show([{ midi: notes[idx] }], notes[idx + 1] ? [{ midi: notes[idx + 1] }] : []);
              else {
                streak++;
                score += streak * 10;
                $('eMsg').textContent = streak >= 3 ? `🔥 Juste ! Série de ${streak}` : '✅ Juste !';
                onPitch = () => {};
                later(playRound, 900);
              }
              $('eScore').textContent = String(score);
              $('eStreak').textContent = String(streak);
            }
          } else holdSince = 0;
        };
      }, notes.length * 800 + 300);
    }
    $('eGo').addEventListener('click', async () => {
      if (!(await ensureMic())) return;
      void synth.ctx.resume();
      stopSounds();
      level = Number($<HTMLSelectElement>('eLvl').value) as 1 | 2 | 3;
      round = 0;
      score = 0;
      streak = 0;
      $('eScore').textContent = '0';
      void playRound();
    });
  }

  // ---------------- Sirène ----------------
  if (tab === 'siren') {
    const [rlo, rhi] = savedRange();
    let inside = 0;
    let total = 0;
    let raf = 0;
    main.innerHTML = `
      <div class="toolbar"><label>Parcours <select id="sPath"><option value="wave">Vague douce</option><option value="steps">Escalier</option><option value="slide">Grands glissés</option></select></label>
      <button id="sGo" class="primary">▶ Suivre la ligne (20 s)</button></div>
      <div class="v-big"><strong id="sPct">—</strong><span class="muted">du temps dans la bande</span></div>
      <p class="hint">La bande orange bouge : suis-la avec ta voix sur « ou » ou « i ». C'est l'échauffement des chanteurs (sirènes).</p>`;
    $('sGo').addEventListener('click', async () => {
      if (!(await ensureMic())) return;
      cancelAnimationFrame(raf);
      const kind = $<HTMLSelectElement>('sPath').value;
      const mid = (rlo + rhi) / 2;
      const amp = (rhi - rlo) / 2;
      const path = (s: number) =>
        kind === 'wave' ? mid + amp * 0.7 * Math.sin((s / 5) * Math.PI * 2) : kind === 'steps' ? rlo + Math.floor(s / 1.5) % (rhi - rlo + 1) : mid + amp * Math.sin((s / 8) * Math.PI * 2);
      inside = 0;
      total = 0;
      const t0 = performance.now();
      let cur = path(0);
      onPitch = (m) => {
        total++;
        if (m !== null) {
          let d = m - cur;
          while (d > 6) d -= 12;
          while (d < -6) d += 12;
          if (Math.abs(d) <= 0.5) inside++;
        }
        $('sPct').textContent = `${Math.round((inside / Math.max(1, total)) * 100)} %`;
      };
      const step = () => {
        const s = (performance.now() - t0) / 1000;
        cur = path(s);
        trace.show([{ midi: cur }]);
        if (s < 20) raf = requestAnimationFrame(step);
        else {
          onPitch = () => {};
          trace.show([]);
          award(Math.round((inside / Math.max(1, total)) * 20));
        }
      };
      raf = requestAnimationFrame(step);
      stops.push(() => cancelAnimationFrame(raf));
    });
  }

  // ---------------- Parole ----------------
  if (tab === 'speech') {
    const CHALLENGES = [
      { id: 'question', title: 'La question', say: '« Tu viens ce soir ? »', check: (pts: { t: number; m: number }[]) => contourSlope(pts) > 3, ok: 'Ta voix monte à la fin : on entend une question.', ko: 'Fais monter la voix sur la dernière syllabe.' },
      { id: 'affirm', title: 'L’affirmation', say: '« Je viens ce soir. »', check: (pts: { t: number; m: number }[]) => contourSlope(pts) < -2, ok: 'La voix descend : c’est affirmatif et posé.', ko: 'Laisse retomber la voix à la fin, comme un point.' },
      { id: 'robot', title: 'Voix de robot', say: '« Je suis un robot. »', check: (pts: { t: number; m: number }[]) => contourRange(pts) < 2.5, ok: 'Parfaitement monotone, bip bip !', ko: 'Garde exactement la même hauteur sur chaque syllabe.' },
      { id: 'conteur', title: 'Le conteur', say: '« Il était une fois… un ogre GIGANTESQUE ! »', check: (pts: { t: number; m: number }[]) => contourRange(pts) > 7, ok: 'Très expressif : ta voix voyage sur plus d’une quinte.', ko: 'Exagère : monte très haut puis descends très bas.' },
      { id: 'surprise', title: 'La surprise', say: '« Oh ! C’est toi ? »', check: (pts: { t: number; m: number }[]) => contourRange(pts) > 5 && contourSlope(pts) > 2, ok: 'Surprise réussie !', ko: 'Pars plus haut sur « Oh ! » et remonte sur « toi ? ».' },
    ];
    main.innerHTML = `<p class="hint">La mélodie de la parole (l'intonation) se travaille comme le chant. Clique sur un défi, dis la phrase, puis arrête-toi : l'app analyse la courbe.</p>
      <div class="v-challenges">${CHALLENGES.map((c) => `<button class="ch-song" data-ch="${c.id}"><strong>${esc(c.title)}</strong><span>${esc(c.say)}</span><span class="muted" data-res="${c.id}"></span></button>`).join('')}</div>
      <div class="v-big"><strong id="pMsg">Choisis un défi</strong></div>`;
    app.querySelectorAll<HTMLButtonElement>('[data-ch]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!(await ensureMic())) return;
        const c = CHALLENGES.find((x) => x.id === b.dataset.ch)!;
        const pts: { t: number; m: number }[] = [];
        let lastVoice = 0;
        const t0 = performance.now();
        $('pMsg').textContent = `🎙 Dis : ${c.say}`;
        trace.show([]);
        onPitch = (m, t) => {
          if (m !== null) {
            pts.push({ t, m });
            lastVoice = t;
          }
          const ended = (pts.length > 8 && t - lastVoice > 900) || t - t0 > 7000;
          if (!ended) return;
          onPitch = () => {};
          const ok = pts.length > 8 && c.check(pts);
          $('pMsg').textContent = ok ? `✅ ${c.ok}` : `↻ ${pts.length > 8 ? c.ko : 'Je n’ai presque rien entendu : rapproche-toi du micro.'}`;
          app.querySelector(`[data-res="${c.id}"]`)!.textContent = ok ? '✅ réussi' : '↻ à retenter';
          if (ok) award(10);
        };
      }),
    );
  }

  // ---------------- Deux voix ----------------
  if (tab === 'duet') {
    const SONGS = ['frere-jacques', 'au-clair-de-la-lune', 'ode-joie', 'ah-vous-dirai-je', 'amazing-grace', 'douce-nuit', 'jingle-bells', 'mary-had-a-little-lamb'];
    const songs = SONGS.map((id) => LIBRARY.find((s) => s.id === id)).filter((s): s is (typeof LIBRARY)[number] => !!s);
    const INTERVALS: [string, number][] = [
      ['Unisson', 0],
      ['Tierce majeure ↑', 4],
      ['Tierce mineure ↑', 3],
      ['Quinte ↑', 7],
      ['Octave ↑', 12],
      ['Sixte majeure ↑', 9],
      ['Quarte ↑', 5],
      ['Tierce ↓', -4],
      ['Quinte ↓', -7],
    ];
    main.innerHTML = `
      <h2>1. Tenir sa note contre une autre</h2>
      <p class="hint">L'app tient une note (bande violette) ; chante l'intervalle demandé (bande orange). C'est la base de toute harmonie.</p>
      <div class="toolbar"><label>Intervalle <select id="dIv">${INTERVALS.map(([n, v]) => `<option value="${v}">${n}</option>`).join('')}</select></label><button id="dHold" class="primary">▶ Tenir</button><span id="dIvMsg" class="muted"></span></div>
      <h2>2. Chanter à deux voix</h2>
      <p class="hint">L'app chante une voix, tu chantes l'autre. La tierce est calculée dans la gamme du morceau (tierces parallèles, comme dans les chorales).</p>
      <div class="toolbar">
        <label>Morceau <select id="dSong">${songs.map((s) => `<option value="${s.id}">${esc(s.title)}</option>`).join('')}</select></label>
        <label>Tu chantes <select id="dPart"><option value="third-below">la tierce au-dessous</option><option value="third-above">la tierce au-dessus</option><option value="melody">la mélodie (l'app fait la tierce)</option><option value="canon">un canon (entrée après 2 mesures)</option></select></label>
        <label>♩ <input id="dBpm" type="number" min="40" max="160" value="80" /></label>
        <button id="dGo" class="primary">▶ Chanter</button>
      </div>
      <div class="v-big"><strong id="dPct">—</strong><span class="muted" id="dInfo"></span></div>
      ${headphones}
      <h2>3. Deux chanteurs</h2>
      <p class="hint">Un seul micro ne sait pas séparer deux voix en même temps. Deux solutions : <strong>deux micros</strong> (deux casques-micros USB, par exemple) branchés sur cet appareil, ou <strong>chacun son tour</strong> avec un seul micro, puis on compare les scores.</p>
      <div class="toolbar">
        <label>Mode <select id="mMode"><option value="duo">2 micros, en même temps</option><option value="turns">Chacun son tour (1 micro)</option></select></label>
        <label>Micro 1 <select id="mA"></select></label>
        <label class="duo-only">Micro 2 <select id="mB"></select></label>
      </div>
      <div class="toolbar">
        <label>Morceau <select id="mSong">${songs.map((s) => `<option value="${s.id}">${esc(s.title)}</option>`).join('')}</select></label>
        <label class="duo-only">Chanteur 2 <select id="mPart"><option value="third-below">tierce au-dessous</option><option value="melody">même mélodie</option><option value="canon">canon (2 mesures après)</option></select></label>
        <label>♩ <input id="mBpm" type="number" min="40" max="160" value="80" /></label>
        <button id="mGo" class="primary">▶ C'est parti</button>
      </div>
      <div class="v-range"><span>Chanteur 1 : <strong id="mS1">—</strong></span><span>Chanteur 2 : <strong id="mS2">—</strong></span><span id="mMsg" class="muted"></span></div>`;
    // ---- Deux chanteurs ----
    void (async () => {
      const devs = (await navigator.mediaDevices?.enumerateDevices().catch(() => [])) ?? [];
      const ins = devs.filter((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');
      const opts = (sel: number) =>
        `<option value="">Micro par défaut</option>` + ins.map((d, i) => `<option value="${esc(d.deviceId)}" ${i === sel ? 'selected' : ''}>${esc(d.label || `Micro ${i + 1}`)}</option>`).join('');
      $('mA').innerHTML = opts(-1);
      $('mB').innerHTML = opts(ins.length > 1 ? 1 : -1);
    })();
    const syncMode = () => app.querySelectorAll<HTMLElement>('.duo-only').forEach((el) => (el.hidden = $<HTMLSelectElement>('mMode').value !== 'duo'));
    $('mMode').addEventListener('change', syncMode);
    syncMode();
    const extraMics: MicPitchDetector[] = [];
    stops.push(() => extraMics.splice(0).forEach((m) => void m.stop()));
    /** Joue un morceau pour 1 ou 2 chanteurs ; renvoie le % de justesse de chacun. */
    const runSong = (lines: TimedNote[][], bpm: number, feeds: ((cb: (m: number | null, t: number) => void) => void)[], done: (pcts: number[]) => void) => {
      const spb = 60 / bpm;
      const count = 4;
      const t0 = synth.ctx.currentTime + 0.2;
      for (let i = 0; i < count; i++) stops.push(synth.note(84, t0 + i * spb, 0.05));
      const startPerf = performance.now() + 200 + count * spb * 1000;
      const end = Math.max(...lines.flat().map((n) => n.start + n.dur));
      const ok = lines.map(() => 0);
      const tot = lines.map(() => 0);
      const all = lines.flat().map((n) => n.midi);
      trace.setRange(Math.min(...all), Math.max(...all));
      let finished = false;
      feeds.forEach((feed, k) =>
        feed((m, t) => {
          if (finished) return;
          const beat = (t - startPerf) / 1000 / spb;
          if (beat < 0) return;
          if ($('mMsg').textContent === 'décompte…') $('mMsg').textContent = '🎤 Chantez !';
          if (beat > end + 0.5) {
            finished = true;
            trace.show([], [], [], 0);
            trace.show([], [], [], 1);
            done(ok.map((o, i) => Math.round((o / Math.max(1, tot[i])) * 100)));
            return;
          }
          const target = noteAt(lines[k], beat);
          trace.show(target ? [{ midi: target.midi }] : [], [], [], k);
          if (!target) return;
          tot[k]++;
          if (m !== null) {
            let d = m - target.midi;
            while (d > 6) d -= 12;
            while (d < -6) d += 12;
            if (Math.abs(d) * 100 <= trace.toleranceCents) ok[k]++;
          }
          $(k === 0 ? 'mS1' : 'mS2').textContent = `${Math.round((ok[k] / Math.max(1, tot[k])) * 100)} %`;
        }),
      );
    };
    $('mGo').addEventListener('click', async () => {
      stopSounds();
      void synth.ctx.resume();
      void mic?.stop();
      mic = null;
      const song = songs.find((s) => s.id === $<HTMLSelectElement>('mSong').value)!;
      const bpm = Number($<HTMLInputElement>('mBpm').value) || 80;
      const mel = melodyTimeline(song);
      const barBeats = (song.timeSignature[0] * 4) / song.timeSignature[1];
      const start = async (deviceId: string, singer: number, cb: (m: number | null, t: number) => void) => {
        const d = new MicPitchDetector({ deviceId, minClarity: 0.65 });
        await d.start((r) => {
          const midi = r.freq ? freqToMidiFloat(r.freq, prefs.a4) : null;
          trace.feed(midi, r.time, singer);
          cb(midi, r.time);
        });
        extraMics.push(d);
      };
      try {
        if ($<HTMLSelectElement>('mMode').value === 'duo') {
          const part = $<HTMLSelectElement>('mPart').value;
          const second = part === 'melody' ? mel : part === 'canon' ? mel.map((n) => ({ ...n, start: n.start + barBeats * 2 })) : harmonyLine(mel, 'third-below');
          trace.names = ['Chanteur 1', 'Chanteur 2'];
          $('mMsg').textContent = 'décompte…';
          const cbs: ((m: number | null, t: number) => void)[] = [() => {}, () => {}];
          await start($<HTMLSelectElement>('mA').value, 0, (m, t) => cbs[0](m, t));
          await start($<HTMLSelectElement>('mB').value, 1, (m, t) => cbs[1](m, t));
          runSong([mel, second], bpm, [(cb) => (cbs[0] = cb), (cb) => (cbs[1] = cb)], (p) => {
            extraMics.splice(0).forEach((m) => void m.stop());
            $('mMsg').textContent = p[0] === p[1] ? 'Égalité !' : `🏆 Chanteur ${p[0] > p[1] ? 1 : 2} gagne`;
            award(Math.round((p[0] + p[1]) / 10));
          });
        } else {
          // Chacun son tour : même mélodie, même micro.
          trace.names = ['Chanteur 1', 'Chanteur 2'];
          let cb: (m: number | null, t: number) => void = () => {};
          await start($<HTMLSelectElement>('mA').value, 0, (m, t) => cb(m, t));
          $('mMsg').textContent = '🎤 Chanteur 1 : à toi après le décompte';
          runSong([mel], bpm, [(c) => (cb = c)], (p1) => {
            $('mS1').textContent = `${p1[0]} %`;
            $('mMsg').textContent = '🎤 Chanteur 2 : prépare-toi…';
            extraMics.splice(0).forEach((m) => void m.stop());
            later(async () => {
              let cb2: (m: number | null, t: number) => void = () => {};
              await start($<HTMLSelectElement>('mA').value, 1, (m, t) => cb2(m, t));
              runSong([[], mel], bpm, [() => {}, (c) => (cb2 = c)], (p2) => {
                extraMics.splice(0).forEach((m) => void m.stop());
                $('mMsg').textContent = p1[0] === p2[1] ? 'Égalité !' : `🏆 Chanteur ${p1[0] > p2[1] ? 1 : 2} gagne (${p1[0]} % contre ${p2[1]} %)`;
                award(Math.round((p1[0] + p2[1]) / 10));
              });
            }, 2500);
          });
        }
      } catch {
        $('mMsg').textContent = 'Micro refusé ou indisponible (vérifie le choix des micros).';
      }
    });

    $('dHold').addEventListener('click', async () => {
      if (!(await ensureMic())) return;
      void synth.ctx.resume();
      stopSounds();
      const [rlo, rhi] = savedRange();
      const iv = Number($<HTMLSelectElement>('dIv').value);
      const root = Math.round((rlo + rhi) / 2 - iv / 2);
      const target = root + iv;
      stops.push(synth.note(root, synth.ctx.currentTime + 0.05, 12));
      trace.partner = root;
      trace.show([{ midi: target }]);
      $('dIvMsg').textContent = `L'app : ${noteLabel(root)} · toi : ${noteLabel(target)}`;
      let since = 0;
      onPitch = (m, t) => {
        if (m === null) return void (since = 0);
        let d = m - target;
        while (d > 6) d -= 12;
        while (d < -6) d += 12;
        if (Math.abs(d) <= 0.35) {
          if (!since) since = t;
          if (t - since > 1500) {
            $('dIvMsg').textContent = `✅ Accord tenu ! ${noteLabel(root)} + ${noteLabel(target)}`;
            award(5);
            onPitch = () => {};
          }
        } else since = 0;
      };
      later(() => {
        trace.partner = null;
      }, 12000);
    });
    $('dGo').addEventListener('click', async () => {
      if (!(await ensureMic())) return;
      void synth.ctx.resume();
      stopSounds();
      const song = songs.find((s) => s.id === $<HTMLSelectElement>('dSong').value)!;
      const part = $<HTMLSelectElement>('dPart').value;
      const bpm = Number($<HTMLInputElement>('dBpm').value) || 80;
      const mel = melodyTimeline(song);
      const barBeats = (song.timeSignature[0] * 4) / song.timeSignature[1];
      let user: TimedNote[];
      let app2: TimedNote[];
      if (part === 'melody') {
        user = mel;
        app2 = harmonyLine(mel, 'third-below');
      } else if (part === 'canon') {
        app2 = mel;
        user = mel.map((n) => ({ ...n, start: n.start + barBeats * 2 }));
      } else {
        app2 = mel;
        user = harmonyLine(mel, part as 'third-below' | 'third-above');
      }
      const all2 = [...user, ...app2].map((n) => n.midi);
      trace.setRange(Math.min(...all2), Math.max(...all2));
      const spb = 60 / bpm;
      const count = barBeats; // une mesure de décompte
      const t0 = synth.ctx.currentTime + 0.2;
      for (let i = 0; i < count; i++) stops.push(synth.note(84, t0 + i * spb, 0.05));
      for (const n of app2) stops.push(synth.note(n.midi, t0 + (count + n.start) * spb, Math.max(0.1, n.dur * spb - 0.04)));
      const startPerf = performance.now() + (t0 - synth.ctx.currentTime) * 1000 + count * spb * 1000;
      const end = Math.max(...user.map((n) => n.start + n.dur), ...app2.map((n) => n.start + n.dur));
      let ok = 0;
      let tot = 0;
      $('dInfo').textContent = 'décompte…';
      onPitch = (m, t) => {
        const beat = (t - startPerf) / 1000 / spb;
        if (beat < 0) return;
        if (beat > end + 0.5) {
          onPitch = () => {};
          trace.partner = null;
          trace.show([]);
          const pct = Math.round((ok / Math.max(1, tot)) * 100);
          $('dInfo').textContent = 'terminé';
          award(Math.round(pct / 5));
          return;
        }
        const target = noteAt(user, beat);
        const other = noteAt(app2, beat);
        trace.partner = other?.midi ?? null;
        trace.show(target ? [{ midi: target.midi }] : []);
        const wait = user[0] ? Math.ceil(user[0].start - beat) : 0;
        $('dInfo').textContent = target
          ? `toi : ${noteLabel(target.midi)}${other ? ` · l'app : ${noteLabel(other.midi)}` : ''}`
          : wait > 0
            ? `l'app commence… tu entres dans ${wait} temps`
            : '';
        if (target) {
          tot++;
          if (m !== null) {
            let d = m - target.midi;
            while (d > 6) d -= 12;
            while (d < -6) d += 12;
            if (Math.abs(d) <= 0.4) ok++;
          }
          $('dPct').textContent = `${Math.round((ok / Math.max(1, tot)) * 100)} % juste`;
        }
      };
    });
  }
}
