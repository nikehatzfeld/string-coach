import { importLibrary, type ImportReport } from '../songs/library-import';

/**
 * Génération de bibliothèque avec l'API de Grok (xAI), avec la clé de l'utilisateur.
 * La clé reste dans ce navigateur (localStorage) et n'est envoyée qu'à api.x.ai.
 */
const KEY = 'string-coach:xai-key';
const MODEL = 'string-coach:xai-model';
const API = 'https://api.x.ai/v1';

export const grokKey = (): string => {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};
export const setGrokKey = (k: string): void => localStorage.setItem(KEY, k.trim());
export const grokModel = (): string => localStorage.getItem(MODEL) ?? '';
export const setGrokModel = (m: string): void => localStorage.setItem(MODEL, m);

/** Consignes données à Grok : format exact attendu par l'import de l'app. */
export const SYSTEM_PROMPT = `Tu génères des fichiers JSON pour une application d'apprentissage musical (violon, guitare, flûte à bec soprano, voix). Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour.

FORMAT : {"format":"string-coach-library","version":1,"songs":[{"title":"…","artist":"…","year":1994,"instruments":["violin"|"guitar"|"recorder"|"voice"],"style":"Classique"|"Cinéma & TV"|"Années 80"|"Années 90"|"Pop & rock"|"Variété française"|"Rap US"|"Rap français"|"R&B & soul"|"Reggae"|"Électro & dance"|"Comédies musicales"|"Folk & monde"|"Chanson française"|"Comptines"|"Noël"|"Blues"|"Gospel & jazz","level":1-5,"tempo":BPM,"timeSignature":[4,4],"key":"G","notation":"…","lyrics":"…","chords":"G | D | Em C | C","source":{"url":"…","license":"Domaine public|CC BY|CC BY-SA|Protégé"}}]}

MÉLODIE ("notation") : note = nom anglais + octave + ":" + durée (C4:4 = do du milieu en noire, F#4:8, Bb3:2). Durées 1 2 4 8 16, point après la durée pour pointer (C4:4.). Silence r:4. Note liée (prolongée) -:4. Accord collé à une note : G4:4@Em. Mesures séparées par " | " ; chaque mesure fait exactement la durée de la mesure (4 noires en 4/4, 3 en 3/4, 6 croches en 6/8), sauf la levée et la dernière. Tessitures : violon G3–E6, flûte à bec C4–D6, voix A3–E5, guitare E2–B5.
PAROLES ("lyrics") : une syllabe par note jouée, tiret collé quand le mot continue : "Frè- re Ja- cques".
ACCORDS ("chords") : une mesure entre deux |, noms anglais (C, Am, F#m7, Bb, Gsus4, D/F#).
DROITS : domaine public ou licence libre → mélodie, paroles et accords complets. Œuvre protégée → PAS de "notation" ni de "lyrics" : titre, artiste, année, style, niveau, tempo, mesure, tonalité, grille d'accords complète par mesure dans "chords", "license":"Protégé".
N'invente rien : si tu n'es pas sûr d'un morceau, ne le mets pas.`;

async function call(messages: { role: string; content: string }[]): Promise<string> {
  const key = grokKey();
  if (!key) throw new Error('clé API Grok manquante');
  const res = await fetch(`${API}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: grokModel() || 'grok-4', messages, temperature: 0.3 }),
  });
  if (!res.ok) throw new Error(`Grok a répondu ${res.status} : ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

/** Modèles disponibles pour cette clé. */
export async function listGrokModels(): Promise<string[]> {
  const res = await fetch(`${API}/models`, { headers: { Authorization: `Bearer ${grokKey()}` } });
  if (!res.ok) throw new Error(`Grok a répondu ${res.status}`);
  const data = (await res.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((m) => m.id).sort();
}

const parse = (text: string): unknown => JSON.parse((/```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1] ?? text).trim());

/**
 * Demande à Grok, vérifie avec l'import de l'app, et redemande une fois la correction des morceaux refusés.
 */
export async function generateWithGrok(request: string, onStep: (msg: string) => void): Promise<ImportReport> {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: request },
  ];
  onStep('Grok compose la liste…');
  const first = await call(messages);
  let report = importLibrary(parse(first));
  if (report.errors.length) {
    onStep(`${report.errors.length} morceau(x) à corriger, Grok les reprend…`);
    messages.push({ role: 'assistant', content: first });
    messages.push({ role: 'user', content: `L'application a refusé ces morceaux. Corrige-les et renvoie UNIQUEMENT le JSON des morceaux corrigés (même format) :\n${report.errors.join('\n')}` });
    try {
      const fixed = importLibrary(parse(await call(messages)));
      const known = new Set(report.songs.map((s) => s.id));
      report = {
        songs: [...report.songs, ...fixed.songs.filter((s) => !known.has(s.id))],
        errors: fixed.errors,
        warnings: [...report.warnings, ...fixed.warnings],
      };
    } catch {
      /* on garde le premier résultat */
    }
  }
  return report;
}
