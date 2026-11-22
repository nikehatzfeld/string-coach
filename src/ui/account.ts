import { cloudStatus, onCloudStatus, signIn, signOut } from '../cloud/sync';
import { esc } from './dom';

const LABEL: Record<string, string> = { syncing: '⟳', synced: '✓', error: '⚠' };

/** Bouton du compte dans l'en-tête (masqué si les comptes ne sont pas configurés). */
export function bindAccount(btn: HTMLButtonElement): void {
  const off = onCloudStatus((s) => {
    if (!btn.isConnected) return off();
    btn.hidden = !s.enabled;
    btn.textContent = s.email ? `👤 ${s.email.split('@')[0]} ${LABEL[s.state] ?? ''}` : '👤 Se connecter';
    btn.title = s.state === 'error' ? `Synchronisation impossible : ${s.message ?? ''}` : s.email ? 'Progression synchronisée sur tes appareils' : '';
  });
  btn.addEventListener('click', () => openAccount());
}

function openAccount(): void {
  const s = cloudStatus();
  const dlg = document.createElement('div');
  dlg.className = 'modal-backdrop';
  dlg.innerHTML = s.email
    ? `<div class="modal" role="dialog" aria-modal="true">
        <h2>Mon compte</h2>
        <p>Connecté : <strong>${esc(s.email)}</strong></p>
        <p class="hint">Niveau, XP, badges, étoiles, séries, cours et tempos sont enregistrés et synchronisés sur tous tes appareils.</p>
        <div class="modal-actions"><button data-act="out">Se déconnecter</button><button data-act="close" class="primary">Fermer</button></div>
      </div>`
    : `<div class="modal" role="dialog" aria-modal="true">
        <h2>Se connecter</h2>
        <p class="hint">Reçois un lien de connexion par email (pas de mot de passe). Ta progression actuelle sera fusionnée avec ton compte.</p>
        <form id="loginForm" class="vault-unlock">
          <input id="loginEmail" type="email" placeholder="ton@email.fr" autocomplete="email" required />
          <button class="primary" type="submit">Recevoir le lien</button>
        </form>
        <p id="loginMsg" class="hint"></p>
        <div class="modal-actions"><button data-act="close">Fermer</button></div>
      </div>`;
  document.body.appendChild(dlg);
  dlg.addEventListener('click', async (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'close' || e.target === dlg) dlg.remove();
    if (act === 'out') {
      await signOut();
      dlg.remove();
    }
  });
  dlg.querySelector<HTMLFormElement>('#loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = dlg.querySelector<HTMLElement>('#loginMsg')!;
    msg.textContent = 'Envoi…';
    try {
      await signIn(dlg.querySelector<HTMLInputElement>('#loginEmail')!.value.trim());
      msg.textContent = '📬 Lien envoyé : ouvre-le sur cet appareil pour te connecter.';
    } catch (err) {
      msg.textContent = `Erreur : ${(err as Error).message}`;
    }
  });
}
