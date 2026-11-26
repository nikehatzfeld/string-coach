import { importLibrary, type ImportReport } from '../songs/library-import';
import { generateWithGrok, grokKey, grokModel, listGrokModels, setGrokKey, setGrokModel } from '../practice/grok';
import { saveUserSongs } from '../state/user-songs';
import { midiToSong } from '../songs/midi-import';
import { esc } from './dom';

/** Fenêtre d'import d'une bibliothèque (fichier JSON « string-coach-library », par exemple produit par Grok). */
export function openLibraryImport(onDone: () => void): void {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <div class="modal tr-modal" role="dialog" aria-label="Importer une bibliothèque">
      <h2>📥 Importer une bibliothèque</h2>
      <p class="hint">Un fichier <strong>MIDI</strong> (.mid) que tu as téléchargé, un fichier <code>.json</code> au format String Coach, ou colle le texte ci-dessous. Les morceaux sont vérifiés, puis gardés sur cet appareil (style choisi, ou « Mes morceaux »).</p>
      <label class="tr-row">Fichier JSON ou MIDI (.mid) <input id="libFile" type="file" accept=".json,.mid,.midi,application/json,audio/midi,audio/x-midi,text/plain" /></label>
      <textarea id="libText" rows="8" placeholder='{ "format": "string-coach-library", "version": 1, "songs": [ … ] }'></textarea>
      <div class="modal-actions"><button id="libGo" class="primary">Vérifier et importer</button><button id="libClose" class="ghost">Fermer</button></div>
      <details class="tr-adv" id="grokBox" ${grokKey() ? 'open' : ''}><summary>✨ Générer avec Grok (ta clé API xAI)</summary>
        <p class="hint">Écris ce que tu veux ; l'app interroge Grok, vérifie chaque morceau, fait corriger les erreurs et importe le résultat. Ta clé reste dans ce navigateur et n'est envoyée qu'à api.x.ai.</p>
        <label class="tr-row">Clé API <input id="gKey" type="password" autocomplete="off" placeholder="xai-…" value="${grokKey() ? '••••••••' : ''}" /></label>
        <label class="tr-row">Modèle <select id="gModel"><option value="${grokModel()}">${grokModel() || 'par défaut'}</option></select> <button id="gModels" class="ghost">↻ Lister</button></label>
        <textarea id="gReq" rows="3" placeholder="ex. 30 morceaux de violon niveau 2 · grilles d'accords des tubes rap français 2015-2025 · 20 comptines à chanter avec paroles"></textarea>
        <div class="modal-actions"><button id="gGo" class="primary">✨ Générer et importer</button></div>
        <p id="gMsg" class="muted"></p>
      </details>
      <div id="libReport"></div>
    </div>`;
  document.body.appendChild(back);
  const q = <T extends HTMLElement>(id: string) => back.querySelector<T>(`#${id}`)!;
  const showReport = (r: ImportReport) => {
    try {
      if (r.songs.length) saveUserSongs(r.songs);
    } catch {
      return void (q('libReport').innerHTML = '<p class="bad">Stockage plein : importe en plusieurs fois ou supprime des morceaux.</p>');
    }
    q('libReport').innerHTML = `
      <p><strong>✅ ${r.songs.length} morceau${r.songs.length > 1 ? 'x' : ''} importé${r.songs.length > 1 ? 's' : ''}</strong>${r.errors.length ? ` · ❌ ${r.errors.length} refusé${r.errors.length > 1 ? 's' : ''}` : ''}</p>
      ${r.errors.length ? `<details open><summary>Refusés</summary><ul>${r.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></details>` : ''}
      ${r.warnings.length ? `<details><summary>Avertissements (${r.warnings.length})</summary><ul>${r.warnings.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></details>` : ''}`;
    if (r.songs.length) onDone();
  };
  q('gKey').addEventListener('change', () => {
    const v = q<HTMLInputElement>('gKey').value;
    if (v && !v.startsWith('•')) setGrokKey(v);
    q<HTMLInputElement>('gKey').value = grokKey() ? '••••••••' : '';
  });
  q('gModel').addEventListener('change', () => setGrokModel(q<HTMLSelectElement>('gModel').value));
  q('gModels').addEventListener('click', async () => {
    try {
      const ms = await listGrokModels();
      q('gModel').innerHTML = ms.map((m) => `<option ${m === grokModel() ? 'selected' : ''}>${esc(m)}</option>`).join('');
      if (!grokModel() && ms.length) setGrokModel(q<HTMLSelectElement>('gModel').value);
      q('gMsg').textContent = `${ms.length} modèles disponibles.`;
    } catch (e) {
      q('gMsg').textContent = `Impossible de joindre Grok : ${(e as Error).message}. Vérifie la clé.`;
    }
  });
  q('gGo').addEventListener('click', async () => {
    const req = q<HTMLTextAreaElement>('gReq').value.trim();
    if (!req) return void (q('gMsg').textContent = 'Écris d’abord ta demande.');
    q<HTMLButtonElement>('gGo').disabled = true;
    try {
      showReport(await generateWithGrok(req, (m) => (q('gMsg').textContent = m)));
      q('gMsg').textContent = 'Terminé.';
    } catch (e) {
      const msg = (e as Error).message;
      q('gMsg').textContent = /Failed to fetch|NetworkError|Load failed/i.test(msg)
        ? 'Le navigateur n’a pas pu joindre api.x.ai (réseau ou blocage du navigateur). Réessaie, ou utilise le copier-coller ci-dessus.'
        : `Erreur : ${msg}`;
    } finally {
      q<HTMLButtonElement>('gGo').disabled = false;
    }
  });
  q('libFile').addEventListener('change', async () => {
    const f = q<HTMLInputElement>('libFile').files?.[0];
    if (!f) return;
    // MIDI : converti directement en morceau (mélodie + accords), gardé sur l'appareil.
    if (/\.midi?$/i.test(f.name)) {
      try {
        const song = midiToSong(await f.arrayBuffer(), f.name.replace(/\.midi?$/i, ''));
        showReport({ songs: [song], errors: [], warnings: [] });
      } catch (e) {
        q('libReport').innerHTML = `<p class="bad">MIDI illisible : ${esc((e as Error).message)}</p>`;
      }
      return;
    }
    q<HTMLTextAreaElement>('libText').value = await f.text();
  });
  q('libGo').addEventListener('click', () => {
    const text = q<HTMLTextAreaElement>('libText').value.trim();
    // Grok entoure parfois le JSON de ```json … ``` : on l'extrait.
    const raw = (/```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1] ?? text).trim();
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return void (q('libReport').innerHTML = `<p class="bad">JSON illisible : ${esc((e as Error).message)}</p>`);
    }
    showReport(importLibrary(data));
  });
  back.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === back || t.id === 'libClose') back.remove();
  });
}
