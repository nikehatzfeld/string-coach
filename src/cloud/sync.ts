import type { SupabaseClient, User } from '@supabase/supabase-js';
import { progress } from '../game/store';
import { saveProgress } from '../game/progress';
import { prefs, savePrefs } from '../state/prefs';
import { cloudEnabled, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { mergeProgress, type CloudData } from './merge';

/**
 * Comptes et synchronisation (Supabase) : connexion par lien email, une ligne « profiles » par compte
 * contenant la progression et les tempos. Fusion à la connexion, envoi automatique ensuite.
 */

let client: SupabaseClient | null = null;
let user: User | null = null;
let pushTimer = 0;
let listeners: ((s: CloudStatus) => void)[] = [];

export interface CloudStatus {
  enabled: boolean;
  email: string | null;
  state: 'off' | 'signed-out' | 'syncing' | 'synced' | 'error';
  message?: string;
}

let status: CloudStatus = { enabled: cloudEnabled(), email: null, state: cloudEnabled() ? 'signed-out' : 'off' };

function set(s: Partial<CloudStatus>) {
  status = { ...status, ...s };
  listeners.forEach((l) => l(status));
}

export function onCloudStatus(cb: (s: CloudStatus) => void): () => void {
  listeners.push(cb);
  cb(status);
  return () => (listeners = listeners.filter((l) => l !== cb));
}

export function cloudStatus(): CloudStatus {
  return status;
}

async function getClient(): Promise<SupabaseClient | null> {
  if (!cloudEnabled()) return null;
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, detectSessionInUrl: true } });
  }
  return client;
}

/** À appeler au démarrage : reprend la session et synchronise. */
export async function initCloud(): Promise<void> {
  const c = await getClient();
  if (!c) return;
  const { data } = await c.auth.getSession();
  c.auth.onAuthStateChange((_e, session) => {
    const u = session?.user ?? null;
    if (u && u.id !== user?.id) {
      user = u;
      set({ email: u.email ?? null });
      pull();
    } else if (!u) {
      user = null;
      set({ email: null, state: 'signed-out' });
    }
  });
  if (data.session?.user) {
    user = data.session.user;
    set({ email: user.email ?? null });
    await pull();
  }
}

export async function signIn(email: string): Promise<void> {
  const c = await getClient();
  if (!c) throw new Error('Comptes non configurés');
  const { error } = await c.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${location.origin}${import.meta.env.BASE_URL}` },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const c = await getClient();
  await c?.auth.signOut();
  user = null;
  set({ email: null, state: 'signed-out' });
}

/** Récupère le compte, fusionne avec l'appareil, puis renvoie le résultat. */
async function pull(): Promise<void> {
  const c = await getClient();
  if (!c || !user) return;
  set({ state: 'syncing' });
  const { data, error } = await c.from('profiles').select('data').eq('user_id', user.id).maybeSingle();
  if (error) return set({ state: 'error', message: error.message });
  const remote = data?.data as CloudData | undefined;
  if (remote?.progress) {
    Object.assign(progress, mergeProgress(progress, remote.progress));
    prefs.bpmBySong = { ...remote.bpmBySong, ...prefs.bpmBySong };
    saveProgress(progress);
    savePrefs();
  }
  await push();
  dispatchEvent(new Event('cloud-merged'));
}

async function push(): Promise<void> {
  const c = await getClient();
  if (!c || !user) return;
  set({ state: 'syncing' });
  const payload: CloudData = { progress, bpmBySong: prefs.bpmBySong, updatedAt: Date.now() };
  const { error } = await c.from('profiles').upsert({ user_id: user.id, data: payload, updated_at: new Date().toISOString() });
  set(error ? { state: 'error', message: error.message } : { state: 'synced', message: undefined });
}

/** Envoi différé après chaque sauvegarde locale. */
export function schedulePush(): void {
  if (!user) return;
  clearTimeout(pushTimer);
  pushTimer = window.setTimeout(push, 4000);
}
