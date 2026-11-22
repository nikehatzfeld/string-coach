import { MicPitchDetector } from '../practice/pitch-detector';
import { INSTRUMENTS, type InstrumentId } from '../songs/instruments';
import { freqToMidiFloat } from '../songs/notation';
import { solfege } from '../songs/positions';
import { prefs, savePrefs } from '../state/prefs';

/** Accordeur flottant, disponible sur toutes les pages (au-dessus du métronome). */

let root: HTMLElement | null = null;

export function mountTuner(): void {
  if (root) return;
  root = document.createElement('div');
  root.className = 'tuner-float';
  root.innerHTML = `
    <button class="tuner-fab" aria-expanded="false" title="Accordeur"><span>🎚</span><small>Accordeur</small></button>
    <div class="tuner-panel" hidden role="dialog" aria-label="Accordeur">
      <div class="seg tn-inst">${(['violin', 'guitar'] as InstrumentId[]).map((id) => `<button data-tinst="${id}">${id === 'violin' ? '🎻' : '🎸'} ${INSTRUMENTS[id].label}</button>`).join('')}</div>
      <div class="tn-note"><strong class="tn-name">—</strong><span class="tn-cents"></span></div>
      <div class="tn-scale"><div class="tn-zone"></div><div class="tn-needle" hidden></div></div>
      <p class="tn-hint muted">Joue une corde à vide</p>
      <div class="tn-strings"></div>
      <div class="tn-row">
        <label>La = <select class="tn-a4"></select></label>
        <button class="tn-toggle primary">▶ Accorder</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  const $ = <T extends HTMLElement>(sel: string) => root!.querySelector<T>(sel)!;
  let inst: InstrumentId = prefs.instrument;
  let mic: MicPitchDetector | null = null;
  const recent: number[] = [];

  const strings = () => INSTRUMENTS[inst].tuning.map((m) => m).sort((a, b) => a - b);
  function renderStatic() {
    root!.querySelectorAll<HTMLButtonElement>('[data-tinst]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tinst === inst)));
    $('.tn-strings').innerHTML = strings()
      .map((m) => `<span data-m="${m}">${solfege(m, false)}<small>${Math.floor(m / 12) - 1}</small></span>`)
      .join('');
    const opts = [...new Set([440, 442, 432, prefs.a4])].sort((a, b) => a - b);
    $<HTMLSelectElement>('.tn-a4').innerHTML = opts.map((f) => `<option value="${f}" ${f === prefs.a4 ? 'selected' : ''}>${f} Hz${f === 440 ? ' (standard)' : ''}</option>`).join('');
  }

  function onFreq(freq: number | null) {
    const needle = $('.tn-needle');
    if (!freq) return;
    const m = freqToMidiFloat(freq, prefs.a4);
    recent.push(m);
    if (recent.length > 5) recent.shift();
    const med = [...recent].sort((a, b) => a - b)[Math.floor(recent.length / 2)];
    // Corde la plus proche (octave tolérée : le micro entend parfois l'harmonique).
    const ss = strings();
    let best = ss[0];
    let bestD = 99;
    for (const s of ss) {
      for (const oct of [0, 12, -12]) {
        const d = med - (s + oct);
        if (Math.abs(d) < Math.abs(bestD)) {
          bestD = d;
          best = s;
        }
      }
    }
    const near = Math.round(med);
    const c = Math.round((med - near) * 100);
    $('.tn-name').textContent = `${solfege(near, false)}${Math.floor(near / 12) - 1}`;
    $('.tn-cents').textContent = `${c >= 0 ? '+' : ''}${c}`;
    needle.hidden = false;
    needle.style.left = `${50 + Math.max(-50, Math.min(50, c))}%`;
    const ok = Math.abs(c) <= 5;
    needle.classList.toggle('ok', ok);
    root!.querySelectorAll<HTMLElement>('[data-m]').forEach((el) => el.classList.toggle('on', Number(el.dataset.m) === best));
    const dc = Math.round(bestD * 100);
    $('.tn-hint').textContent =
      Math.abs(dc) > 150 ? 'Joue une corde à vide' : Math.abs(dc) <= 5 ? `✔ Corde de ${solfege(best, false)} juste` : `Corde de ${solfege(best, false)} : ${dc < 0 ? 'trop bas → monte' : 'trop haut → descends'} (${dc > 0 ? '+' : ''}${dc})`;
  }

  async function start() {
    mic = new MicPitchDetector({ deviceId: prefs.micId });
    try {
      await mic.start((r) => onFreq(r.freq));
      $('.tn-toggle').textContent = '⏹ Arrêter';
    } catch {
      mic = null;
      $('.tn-hint').textContent = 'Micro refusé : clique sur 🔒 à gauche de l’adresse › Micro › Autoriser.';
    }
  }
  function stop() {
    void mic?.stop();
    mic = null;
    recent.length = 0;
    $('.tn-toggle').textContent = '▶ Accorder';
    $('.tn-needle').hidden = true;
  }

  $('.tuner-fab').addEventListener('click', () => {
    const panel = $('.tuner-panel');
    panel.hidden = !panel.hidden;
    $('.tuner-fab').setAttribute('aria-expanded', String(!panel.hidden));
    if (panel.hidden) stop();
    else {
      inst = prefs.instrument;
      renderStatic();
    }
  });
  $('.tn-toggle').addEventListener('click', () => (mic ? stop() : void start()));
  root.querySelectorAll<HTMLButtonElement>('[data-tinst]').forEach((b) =>
    b.addEventListener('click', () => {
      inst = b.dataset.tinst as InstrumentId;
      renderStatic();
    }),
  );
  $<HTMLSelectElement>('.tn-a4').addEventListener('change', (e) => {
    prefs.a4 = Number((e.target as HTMLSelectElement).value) || 440;
    savePrefs();
  });
  renderStatic();
}
