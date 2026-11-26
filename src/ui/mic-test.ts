import { MicPitchDetector, type PitchReading } from '../practice/pitch-detector';
import { INSTRUMENTS, type InstrumentId } from '../songs/instruments';
import { freqToMidiFloat } from '../songs/notation';
import { solfege } from '../songs/positions';
import { prefs, savePrefs } from '../state/prefs';
import { esc } from './dom';

/**
 * Test guidé du micro : l'utilisateur choisit l'instrument et le micro, démarre,
 * puis joue chaque corde à vide demandée. Rapport copiable pour le diagnostic.
 */

type StringResult = 'todo' | 'ok' | 'skip';

export function openMicTest(): void {
  let inst: InstrumentId = prefs.instrument;
  let mic: MicPitchDetector | null = null;
  let current = 0;
  let holdSince = 0;
  let results: StringResult[] = [];
  const stats = { frames: 0, loud: 0, pitched: 0, maxRms: 0, maxClarity: 0, heard: [] as string[] };
  /** Écart de chaque corde reconnue par rapport au La 440, en cents. */
  let offsets: number[] = [];

  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  document.body.appendChild(back);

  const strings = () => {
    const i = INSTRUMENTS[inst];
    // Du grave à l'aigu, comme on accorde.
    return i.tuning.map((midi, k) => ({ midi, name: solfege(midi, false), octave: Math.floor(midi / 12) - 1, num: k + 1 })).reverse();
  };

  function render() {
    const ss = strings();
    back.innerHTML = `
      <div class="modal mic-test" role="dialog" aria-label="Test du micro">
        <h2>🎤 Test micro</h2>
        <div class="seg mt-inst" role="group" aria-label="Instrument">
          ${(['violin', 'guitar'] as InstrumentId[]).map((id) => `<button data-inst="${id}" aria-pressed="${id === inst}" ${mic ? 'disabled' : ''}>${id === 'violin' ? '🎻' : '🎸'} ${INSTRUMENTS[id].label}</button>`).join('')}
        </div>
        <label class="mt-row">Micro <select id="mtSel" ${mic ? 'disabled' : ''}><option value="">Micro par défaut</option></select></label>
        ${
          mic
            ? `<p class="mt-ask" id="mtAsk"></p>
               <div class="mic-meter big"><span class="lvl" id="mtLvl"></span></div>
               <p class="mt-note"><strong id="mtNote">—</strong> <span id="mtVerdict" class="muted">…</span></p>`
            : `<p class="hint">Accorde ton instrument, place-le à environ 50 cm du micro, puis clique sur <strong>Démarrer</strong>. L'app te demandera de jouer chaque corde à vide, une par une.</p>`
        }
        <div class="mt-strings">${ss
          .map((s, k) => `<button data-k="${k}" class="${results[k] === 'ok' ? 'ok' : results[k] === 'skip' ? 'skip' : ''} ${mic && k === current ? 'cur' : ''}" ${mic ? '' : 'disabled'}>${s.name}<small>${s.octave}</small></button>`)
          .join('')}</div>
        ${mic ? '' : calibrationHtml()}
        ${mic ? '' : results.length ? `<pre class="mt-info">${esc(report())}</pre>` : ''}
        <div class="modal-actions">
          ${mic ? '<button id="mtSkip">Passer cette corde</button><button id="mtStop">⏹ Arrêter</button>' : `<button id="mtStart" class="primary">▶ Démarrer</button>${results.length ? '<button id="mtCopy">📋 Copier le rapport</button>' : ''}`}
          <button id="mtClose" class="ghost">Fermer</button>
        </div>
      </div>`;
    wire();
    void fillMics();
    if (mic) ask();
  }

  const q = <T extends HTMLElement>(id: string) => back.querySelector<T>(`#${id}`);

  async function fillMics() {
    const sel = q<HTMLSelectElement>('mtSel');
    if (!sel) return;
    const devs = (await navigator.mediaDevices?.enumerateDevices().catch(() => [])) ?? [];
    const ins = devs.filter((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications');
    sel.innerHTML =
      '<option value="">Micro par défaut</option>' + ins.map((d, i) => `<option value="${esc(d.deviceId)}" ${d.deviceId === prefs.micId ? 'selected' : ''}>${esc(d.label || `Micro ${i + 1}`)}</option>`).join('');
  }

  function ask() {
    const s = strings()[current];
    const el = q('mtAsk');
    if (el) el.innerHTML = s ? `Joue la corde de <strong>${s.name}</strong> à vide (${s.name}${s.octave})` : 'Terminé ✔';
    back.querySelectorAll<HTMLElement>('[data-k]').forEach((b) => b.classList.toggle('cur', Number(b.dataset.k) === current));
  }

  function next() {
    const ss = strings();
    const k = ss.findIndex((_, i) => results[i] === 'todo');
    if (k < 0) return void stop();
    current = k;
    holdSince = 0;
    ask();
  }

  function onReading(r: PitchReading) {
    stats.frames++;
    if (r.level > 0.2) stats.loud++;
    if (r.freq) stats.pitched++;
    stats.maxRms = Math.max(stats.maxRms, r.rms);
    if (r.level > 0.2) stats.maxClarity = Math.max(stats.maxClarity, r.clarity);
    const lvl = q('mtLvl');
    if (lvl) lvl.style.width = `${Math.round(r.level * 100)}%`;
    const noteEl = q('mtNote');
    const verdict = q('mtVerdict');
    if (!noteEl || !verdict) return;
    const f = r.freq || r.rawFreq;
    if (!f) {
      holdSince = 0;
      noteEl.textContent = '—';
      verdict.textContent = r.level > 0.2 ? '⚠ du son, mais aucune note' : r.rms < 0.0006 ? '🔈 rien n’arrive du micro' : 'j’écoute…';
      return;
    }
    const m = freqToMidiFloat(f, prefs.a4);
    const near = Math.round(m);
    const c = Math.round((m - near) * 100);
    noteEl.textContent = `${solfege(near, false)}${Math.floor(near / 12) - 1} ${c >= 0 ? '+' : ''}${c}`;
    if (!r.freq) {
      holdSince = 0;
      verdict.textContent = `⚠ son pas assez net (netteté ${r.clarity.toFixed(2)} / 0,70)`;
      return;
    }
    const target = strings()[current];
    if (!target) return;
    // Bonne corde à ±50 cents, octave indifférente (le détecteur se trompe parfois d'octave).
    const d = ((((m - target.midi) % 12) + 18) % 12) - 6;
    if (Math.abs(d) <= 0.5) {
      verdict.textContent = '✅ reconnu, tiens la note…';
      if (!holdSince) holdSince = r.time;
      if (r.time - holdSince > 300) {
        results[current] = 'ok';
        offsets.push(Math.round((((((freqToMidiFloat(f) - target.midi) % 12) + 18) % 12) - 6) * 100));
        stats.heard.push(`${target.name}: ${noteEl.textContent}`);
        back.querySelector(`[data-k="${current}"]`)?.classList.add('ok');
        next();
      }
    } else {
      holdSince = 0;
      verdict.textContent = `j'entends une autre note que ${target.name}`;
    }
  }

  async function start() {
    results = strings().map(() => 'todo');
    current = 0;
    Object.assign(stats, { frames: 0, loud: 0, pitched: 0, maxRms: 0, maxClarity: 0, heard: [] });
    offsets = [];
    const m = new MicPitchDetector({ deviceId: prefs.micId });
    try {
      await m.start(onReading);
      mic = m;
      render();
    } catch (e) {
      const name = (e as DOMException)?.name ?? String(e);
      results = [];
      render();
      const hint = back.querySelector('.hint');
      if (hint) hint.innerHTML = `❌ Micro refusé ou indisponible (${esc(name)}). Clique sur 🔒 à gauche de l'adresse › Micro › Autoriser, puis réessaie.`;
    }
  }

  let lastInfo = { label: '', filtered: [] as string[] };
  let lastDetails: MicPitchDetector['details'] | null = null;
  async function stop() {
    if (mic) {
      lastInfo = mic.info;
      lastDetails = mic.details;
      await mic.stop();
    }
    mic = null;
    results = results.map((r) => (r === 'todo' ? 'skip' : r));
    render();
  }

  /** Accordage moyen mesuré (Hz du La) et proposition de l'utiliser. */
  function measuredA4(): number | null {
    if (offsets.length < 2) return null;
    const sorted = [...offsets].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    return Math.round(440 * Math.pow(2, med / 1200) * 2) / 2;
  }
  function calibrationHtml(): string {
    const a = measuredA4();
    if (a === null) return '';
    const cents = Math.round(1200 * Math.log2(a / 440));
    const diff = Math.abs(1200 * Math.log2(a / prefs.a4));
    const state = `Réglage actuel de l'app : La = ${prefs.a4} Hz.`;
    if (Math.abs(cents) < 8 && Math.abs(prefs.a4 - 440) < 1) return `<p class="mt-cal ok">🎯 Ton instrument est bien accordé (La ≈ 440 Hz).</p>`;
    if (diff < 8) return `<p class="mt-cal ok">🎯 L'app est calée sur ton accordage. ${state}</p>`;
    return `<div class="mt-cal">
      <p>🎻 Ton instrument est accordé <strong>${Math.abs(cents)} cents ${cents < 0 ? 'trop bas' : 'trop haut'}</strong> (La ≈ ${a} Hz). Le pas à pas risque de refuser des notes justes.</p>
      <p>Soit tu l'accordes (tourne les chevilles/tendeurs jusqu'à lire +0), soit l'app s'aligne sur lui :</p>
      <div class="modal-actions"><button id="mtUseA4" class="primary">Utiliser mon accordage (La = ${a} Hz)</button>${prefs.a4 !== 440 ? '<button id="mtReset440">Revenir à 440 Hz</button>' : ''}</div>
      <p class="muted">${state}</p></div>`;
  }

  function report(): string {
    const ss = strings();
    return [
      `Instrument : ${INSTRUMENTS[inst].label}`,
      `Cordes reconnues : ${ss.filter((_, k) => results[k] === 'ok').map((s) => s.name).join(', ') || 'aucune'} / ${ss.length}`,
      `Notes entendues : ${stats.heard.join(' · ') || '—'}`,
      `Écarts / La 440 : ${offsets.join(', ') || '—'} cents · La de l'app : ${prefs.a4} Hz`,
      `Micro : ${lastInfo.label || '?'} · filtres : ${lastInfo.filtered.join(', ') || 'aucun'}`,
      `Audio : ${lastDetails?.sampleRate ?? '?'} Hz · ${JSON.stringify(lastDetails?.settings ?? {})}`,
      `Mesures : ${stats.frames} · avec son ${stats.loud} · avec note ${stats.pitched} · niveau max ${stats.maxRms.toFixed(4)} · netteté max ${stats.maxClarity.toFixed(2)}`,
      `Navigateur : ${navigator.userAgent}`,
    ].join('\n');
  }

  function close() {
    void mic?.stop();
    back.remove();
  }

  function wire() {
    back.querySelectorAll<HTMLButtonElement>('[data-inst]').forEach((b) =>
      b.addEventListener('click', () => {
        inst = b.dataset.inst as InstrumentId;
        results = [];
        render();
      }),
    );
    q<HTMLSelectElement>('mtSel')?.addEventListener('change', (e) => {
      prefs.micId = (e.target as HTMLSelectElement).value;
      savePrefs();
    });
    // Choisir une corde : on la (re)teste.
    back.querySelectorAll<HTMLButtonElement>('[data-k]').forEach((b) =>
      b.addEventListener('click', () => {
        current = Number(b.dataset.k);
        results[current] = 'todo';
        b.classList.remove('ok', 'skip');
        holdSince = 0;
        ask();
      }),
    );
    q('mtStart')?.addEventListener('click', () => void start());
    q('mtStop')?.addEventListener('click', () => void stop());
    q('mtSkip')?.addEventListener('click', () => {
      results[current] = 'skip';
      back.querySelector(`[data-k="${current}"]`)?.classList.add('skip');
      next();
    });
    q('mtCopy')?.addEventListener('click', async (e) => {
      await navigator.clipboard?.writeText(report()).catch(() => {});
      (e.target as HTMLElement).textContent = '✔ Copié';
    });
    q('mtClose')?.addEventListener('click', close);
    q('mtUseA4')?.addEventListener('click', () => {
      prefs.a4 = measuredA4() ?? 440;
      savePrefs();
      render();
    });
    q('mtReset440')?.addEventListener('click', () => {
      prefs.a4 = 440;
      savePrefs();
      render();
    });
  }

  back.addEventListener('click', (e) => e.target === back && !mic && close());
  render();
}
