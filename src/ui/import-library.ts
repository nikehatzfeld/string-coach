import { importLibrary } from '../songs/library-import';
import { saveUserSongs } from '../state/user-songs';
import { esc } from './dom';

/** Fenêtre d'import d'une bibliothèque (fichier JSON « string-coach-library », par exemple produit par Grok). */
export function openLibraryImport(onDone: () => void): void {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `
    <div class="modal tr-modal" role="dialog" aria-label="Importer une bibliothèque">
      <h2>📥 Importer une bibliothèque</h2>
      <p class="hint">Fichier <code>.json</code> au format String Coach (voir le guide <em>docs/format-bibliotheque.md</em>), ou colle directement le texte ci-dessous. Les morceaux sont vérifiés, puis gardés sur cet appareil (style choisi, ou « Mes morceaux »).</p>
      <input id="libFile" type="file" accept=".json,application/json,text/plain" />
      <textarea id="libText" rows="8" placeholder='{ "format": "string-coach-library", "version": 1, "songs": [ … ] }'></textarea>
      <div class="modal-actions"><button id="libGo" class="primary">Vérifier et importer</button><button id="libClose" class="ghost">Fermer</button></div>
      <div id="libReport"></div>
    </div>`;
  document.body.appendChild(back);
  const q = <T extends HTMLElement>(id: string) => back.querySelector<T>(`#${id}`)!;
  q('libFile').addEventListener('change', async () => {
    const f = q<HTMLInputElement>('libFile').files?.[0];
    if (f) q<HTMLTextAreaElement>('libText').value = await f.text();
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
    const r = importLibrary(data);
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
  });
  back.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === back || t.id === 'libClose') back.remove();
  });
}
