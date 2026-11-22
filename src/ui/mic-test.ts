import { MicPitchDetector, type PitchReading } from '../practice/pitch-detector';
import { freqToMidiFloat } from '../songs/notation';
import { solfege } from '../songs/positions';
import { prefs, savePrefs } from '../state/prefs';
import { esc } from './dom';

/** Écran de diagnostic du micro : ce que l'app reçoit vraiment, et test des 4 cordes à vide. */
export function openMicTest(): void {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <div class="modal mic-test" role="dialog" aria-label="Test du micro">
      <h2>🎤 Test micro</h2>
      <label>Micro <select id="mtSel"><option value="">Micro par défaut</option></select></label>
      <div class="mic-meter big"><span class="lvl" id="mtLvl"></span></div>
      <p class="mt-note"><strong id="mtNote">—</strong> <span id="mtVerdict" class="muted">Joue une corde à vide</span></p>
      <div class="mt-strings">${['Sol', 'Ré', 'La', 'Mi'].map((n) => `<span data-s="${n}">${n}</span>`).join('')}</div>
      <pre id="mtInfo" class="mt-info"></pre>
      <div class="modal-actions"><button id="mtCopy">📋 Copier le rapport</button><button id="mtClose" class="primary">Fermer</button></div>
    </div>`;
  document.body.appendChild(back);
  const q = <T extends HTMLElement>(id: string) => back.querySelector<T>(`#${id}`)!;
  let mic: MicPitchDetector | null = null;
  const stats = { frames: 0, loud: 0, pitched: 0, maxRms: 0, maxClarity: 0, lastRaw: 0 };
  const open = new Map<number, number>([[55, 0], [62, 0], [69, 0], [76, 0]]);
  const names: Record<number, string> = { 55: 'Sol', 62: 'Ré', 69: 'La', 76: 'Mi' };

  async function fill() {
    const devs = (await navigator.mediaDevices?.enumerateDevices().catch(() => [])) ?? [];
    const ins = devs.filter((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default');
    q<HTMLSelectElement>('mtSel').innerHTML =
      '<option value="">Micro par défaut</option>' + ins.map((d, i) => `<option value="${esc(d.deviceId)}" ${d.deviceId === prefs.micId ? 'selected' : ''}>${esc(d.label || `Micro ${i + 1}`)}</option>`).join('');
  }

  function report(): string {
    const d = mic?.details;
    const info = mic?.info;
    return [
      `Micro : ${info?.label || '?'}`,
      `Filtres actifs : ${info?.filtered.join(', ') || 'aucun'}`,
      `Audio : ${d?.sampleRate} Hz, ${d?.state}`,
      `Réglages : ${JSON.stringify(d?.settings ?? {})}`,
      `Mesures : ${stats.frames}, avec son ${stats.loud}, avec note ${stats.pitched}`,
      `Niveau max ${stats.maxRms.toFixed(4)}, clarté max ${stats.maxClarity.toFixed(2)}`,
      `Cordes reconnues : ${[...open].filter(([, n]) => n > 8).map(([m]) => names[m]).join(', ') || 'aucune'}`,
      `Navigateur : ${navigator.userAgent}`,
    ].join('\n');
  }

  function onReading(r: PitchReading) {
    stats.frames++;
    if (r.level > 0.2) stats.loud++;
    if (r.freq) stats.pitched++;
    stats.maxRms = Math.max(stats.maxRms, r.rms);
    if (r.level > 0.2) stats.maxClarity = Math.max(stats.maxClarity, r.clarity);
    q('mtLvl').style.width = `${Math.round(r.level * 100)}%`;
    const f = r.freq || r.rawFreq;
    if (f) {
      const m = freqToMidiFloat(f);
      const near = Math.round(m);
      const c = Math.round((m - near) * 100);
      q('mtNote').textContent = `${solfege(near, false)}${Math.floor(near / 12) - 1} ${c >= 0 ? '+' : ''}${c}`;
      q('mtVerdict').textContent = r.freq ? '✅ note reconnue' : `⚠ son pas assez net (clarté ${r.clarity.toFixed(2)}, il faut 0,70)`;
      if (r.freq) {
        // Corde à vide jouée (à ±40 cents, toutes octaves).
        for (const [om] of open) {
          const d = ((((m - om) % 12) + 18) % 12) - 6;
          if (Math.abs(d) < 0.4) open.set(om, (open.get(om) ?? 0) + 1);
        }
        back.querySelectorAll<HTMLElement>('[data-s]').forEach((el) => {
          const om = Number(Object.keys(names).find((k) => names[Number(k)] === el.dataset.s));
          el.classList.toggle('ok', (open.get(om) ?? 0) > 8);
        });
      }
    } else {
      q('mtNote').textContent = '—';
      q('mtVerdict').textContent = r.level > 0.2 ? '⚠ du son, mais aucune hauteur' : r.rms < 0.0006 ? '🔈 rien n’arrive (micro coupé ou trop faible ?)' : 'silence';
    }
  }

  async function start() {
    await mic?.stop();
    mic = new MicPitchDetector({ deviceId: prefs.micId });
    try {
      await mic.start(onReading);
      void fill();
    } catch (e) {
      q('mtVerdict').textContent = `Micro refusé ou indisponible : ${(e as Error).name || e}`;
    }
  }
  const timer = window.setInterval(() => (q('mtInfo').textContent = report()), 500);
  q<HTMLSelectElement>('mtSel').addEventListener('change', (e) => {
    prefs.micId = (e.target as HTMLSelectElement).value;
    savePrefs();
    void start();
  });
  q('mtCopy').addEventListener('click', async () => {
    await navigator.clipboard?.writeText(report()).catch(() => {});
    q('mtCopy').textContent = '✔ Copié';
  });
  const close = () => {
    clearInterval(timer);
    void mic?.stop();
    back.remove();
  };
  q('mtClose').addEventListener('click', close);
  back.addEventListener('click', (e) => e.target === back && close());
  void fill();
  void start();
}
