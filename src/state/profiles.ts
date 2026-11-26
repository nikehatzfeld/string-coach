/**
 * Profils sur un même appareil (toi, ta femme, ton fils…) : chacun a sa progression,
 * son parcours violon et son tableau de bord. Les réglages (micro, son) restent communs.
 */
export interface Profile {
  id: string;
  name: string;
  emoji: string;
}

const LIST = 'string-coach:profiles';
const ACTIVE = 'string-coach:profile';
const DEFAULT: Profile = { id: 'main', name: 'Moi', emoji: '🎻' };

const read = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

export function profiles(): Profile[] {
  const l = read<Profile[]>(LIST, []);
  return l.some((p) => p.id === 'main') ? l : [DEFAULT, ...l];
}

/** Profil de cette page, figé jusqu'au rechargement (sinon la sauvegarde de sortie irait dans le nouveau profil). */
let current: string | null = null;
export function activeProfileId(): string {
  if (current === null) {
    const id = read<string>(ACTIVE, 'main');
    current = profiles().some((p) => p.id === id) ? id : 'main';
  }
  return current;
}

export function activeProfile(): Profile {
  return profiles().find((p) => p.id === activeProfileId()) ?? DEFAULT;
}

/** Clé de stockage propre au profil (le profil principal garde les clés d'origine). */
export function profileKey(base: string, id = activeProfileId()): string {
  return id === 'main' ? base : `${base}@${id}`;
}

export function saveProfiles(list: Profile[]): void {
  write(LIST, list);
}

export function addProfile(name: string, emoji: string): Profile {
  const p: Profile = { id: `p${Date.now().toString(36)}`, name: name.trim().slice(0, 24) || 'Élève', emoji: emoji || '🎵' };
  saveProfiles([...profiles(), p]);
  return p;
}

export function updateProfile(id: string, patch: Partial<Omit<Profile, 'id'>>): void {
  saveProfiles(profiles().map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

export function removeProfile(id: string): void {
  if (id === 'main') return;
  saveProfiles(profiles().filter((p) => p.id !== id));
  try {
    localStorage.removeItem(profileKey('string-coach:progress', id));
  } catch {
    /* ignore */
  }
  if (activeProfileId() === id) switchProfile('main');
}

/** Change de profil : la page se recharge pour repartir proprement sur sa progression. */
export function switchProfile(id: string): void {
  write(ACTIVE, id);
  location.reload();
}
