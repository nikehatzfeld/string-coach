import { STYLE_ORDER, type Song } from './alphatex';
import { EXERCISES } from './exercises';
import { CHRISTMAS, CLASSICAL_MORE, FOLK_WORLD, KIDS } from './library-more';
import PD_LIBRARY from './pd-library.json';
import PD_GUITAR from './pd-guitar.json';
import { easyVersion } from './simplify';
import { lyricsOf } from './lyrics';
import type { InstrumentId } from './instruments';

/**
 * Morceaux du domaine public et exercices, transcrits de mémoire en notation compacte
 * (voir notation.ts). Chaque mélodie est jouable au violon et à la guitare : la
 * conversion choisit corde, case et octave automatiquement.
 */
const CORE: Song[] = [
  {
    id: 'penta-la-mineur',
    title: 'Pentatonique de La mineur',
    composer: 'Exercice',
    style: 'Gammes & arpèges',
    level: 2,
    tempo: 80,
    timeSignature: [4, 4],
    notation: 'A3 C4 D4 E4 | G4 A4 C5 D5 | E5 D5 C5 A4 | G4 E4 D4 C4 | A3:1',
  },
  {
    id: 'ode-joie',
    title: 'Ode à la joie',
    composer: 'L. van Beethoven',
    style: 'Classique',
    level: 1,
    tempo: 100,
    timeSignature: [4, 4],
    notation:
      'F#4@D F#4 G4 A4 | A4@A G4 F#4 E4 | D4@D D4 E4 F#4 | F#4:4.@A E4:8 E4:2 | ' +
      'F#4:4@D F#4 G4 A4 | A4@A G4 F#4 E4 | D4@D D4 E4 F#4 | E4:4.@A D4:8 D4:2@D | ' +
      'E4:4@A E4 F#4 D4@D | E4@A F#4:8 G4:8 F#4:4 D4@D | E4@A F#4:8 G4:8 F#4:4 E4 | D4@D E4 A3:2@A | ' +
      'F#4:4@D F#4 G4 A4 | A4@A G4 F#4 E4 | D4@D D4 E4 F#4 | E4:4.@A D4:8 D4:2@D',
  },
  {
    id: 'ah-vous-dirai-je',
    title: 'Ah ! vous dirai-je, maman',
    composer: 'Traditionnel (thème de Mozart)',
    style: 'Classique',
    level: 1,
    tempo: 90,
    timeSignature: [4, 4],
    notation:
      'D4@D D4 A4 A4 | B4@G B4 A4:2@D | G4:4@G G4 F#4@D F#4 | E4@A E4 D4:2@D | ' +
      'A4:4@D A4 G4@G G4 | F#4@D F#4 E4:2@A | A4:4@D A4 G4@G G4 | F#4@D F#4 E4:2@A | ' +
      'D4:4@D D4 A4 A4 | B4@G B4 A4:2@D | G4:4@G G4 F#4@D F#4 | E4@A E4 D4:2@D',
  },
  {
    id: 'canon-pachelbel',
    title: 'Canon (thème)',
    composer: 'J. Pachelbel',
    style: 'Classique',
    level: 2,
    tempo: 66,
    timeSignature: [4, 4],
    notation:
      'F#5:2@D E5:2@A | D5:2@Bm C#5:2@F#m | B4:2@G A4:2@D | B4:2@G C#5:2@A | ' +
      'D5:2@D C#5:2@A | B4:2@Bm A4:2@F#m | G4:2@G F#4:2@D | G4:2@G E4:2@A | ' +
      'D4:4@D F#4 A4@A G4 | F#4@Bm D4 F#4@F#m E4 | D4@G B3 D4@D A4 | G4@G B4 A4@A G4 | F#4:1@D',
  },
  {
    id: 'menuet-sol-bach',
    title: 'Menuet en Sol',
    composer: 'Petit livre d’Anna Magdalena Bach',
    style: 'Classique',
    level: 2,
    tempo: 110,
    timeSignature: [3, 4],
    notation:
      'D5:4@G G4:8 A4 B4 C5 | D5:4 G4 G4 | E5:4@C C5:8 D5 E5 F#5 | G5:4@G G4 G4 | ' +
      'C5:4@C D5:8 C5 B4 A4 | B4:4@G C5:8 B4 A4 G4 | F#4:4@D G4:8 A4 B4 G4 | A4:2.@D | ' +
      'D5:4@G G4:8 A4 B4 C5 | D5:4 G4 G4 | E5:4@C C5:8 D5 E5 F#5 | G5:4@G G4 G4 | ' +
      'C5:4@C D5:8 C5 B4 A4 | B4:4@G C5:8 B4 A4 G4 | A4:4@D B4:8 A4 G4 F#4 | G4:2.@G',
  },
  {
    id: 'petite-musique-de-nuit',
    title: 'Une petite musique de nuit (thème)',
    composer: 'W. A. Mozart',
    style: 'Classique',
    level: 2,
    tempo: 120,
    timeSignature: [4, 4],
    notation:
      'G4:4@G r:8 D4 G4:4 r:8 D4 | G4:8 D4 G4 B4 D5:4 r:4 | C5:4@D7 r:8 A4 C5:4 r:8 A4 | C5:8 A4 F#4 A4 D4:4 r:4 | ' +
      'G4:2@G r:4 B4:8 A4 | G4:4 G4 G4:8 F#4 E4 F#4 | G4:4 r:4 r:2',
  },
  {
    id: 'berceuse-brahms',
    title: 'Berceuse',
    composer: 'J. Brahms',
    style: 'Classique',
    level: 1,
    tempo: 80,
    timeSignature: [3, 4],
    notation:
      'r:2 E4:8@C E4 | G4:2 E4:8 E4 | G4:2 E4:8 G4 | C5:4 B4:4.@G A4:8 | A4:4@F G4 D4:8@G E4 | ' +
      'F4:4 D4 D4:8 E4 | F4:2 D4:8 F4 | B4:8 A4 G4:4 B4 | C5:2.@C',
  },
  {
    id: 'lettre-a-elise',
    title: 'Lettre à Élise (partie A complète)',
    composer: 'L. van Beethoven',
    style: 'Classique',
    level: 3,
    tempo: 60,
    timeSignature: [3, 8],
    sections: [
      ['Thème', 1, 9],
      ['Thème (reprise)', 10, 17],
      ['Passage', 18, 24],
      ['Retour du thème', 25, 32],
    ],
    notation:
      // Thème
      'r:4 E5:16 D#5 | E5@Am D#5 E5 B4 D5 C5 | A4:8 r:16 C4 E4 A4 | B4:8@E r:16 E4 G#4 B4 | C5:8@Am r:16 E4 E5 D#5 | ' +
      'E5 D#5 E5 B4 D5 C5 | A4:8 r:16 C4 E4 A4 | B4:8@E r:16 E4 C5 B4 | A4:8@Am r:8 E5:16 D#5 | ' +
      // Reprise du thème, 2e fin
      'E5 D#5 E5 B4 D5 C5 | A4:8 r:16 C4 E4 A4 | B4:8@E r:16 E4 G#4 B4 | C5:8@Am r:16 E4 E5 D#5 | ' +
      'E5 D#5 E5 B4 D5 C5 | A4:8 r:16 C4 E4 A4 | B4:8@E r:16 E4 C5 B4 | A4:8@Am r:16 B4 C5 D5 | ' +
      // Passage (pont simplifié : les sauts d'octave sont ramenés dans la même octave)
      'E5:8.@C G4:16 F5 E5 | D5:8.@G F4:16 E5 D5 | C5:8.@Am E4:16 D5 C5 | B4:8@E r:16 E4 E5 r:16 | r:16 E5 E5 r:16 r:16 D#5 | E5 r:16 r:16 D#5 E5 D#5 | ' +
      'E5 D#5 E5 B4 D5 C5 | ' +
      // Retour du thème
      'A4:8@Am r:16 C4 E4 A4 | B4:8@E r:16 E4 G#4 B4 | C5:8@Am r:16 E4 E5 D#5 | E5 D#5 E5 B4 D5 C5 | A4:8 r:16 C4 E4 A4 | B4:8@E r:16 E4 C5 B4 | A4:4.@Am | r:4.',
  },
  {
    id: 'largo-nouveau-monde',
    title: 'Symphonie du Nouveau Monde (Largo)',
    composer: 'A. Dvořák',
    style: 'Classique',
    level: 1,
    tempo: 50,
    timeSignature: [4, 4],
    notation:
      'E4:4.@C G4:8 G4:2 | E4:4.@G D4:8 C4:2@C | D4:4.@G E4:8 G4:4. E4:8 | D4:1@G | ' +
      'E4:4.@C G4:8 G4:2 | E4:4.@G D4:8 C4:2@C | D4:4.@G E4:8 D4:4. C4:8 | C4:1@C',
  },
  {
    id: 'roi-de-la-montagne',
    title: 'Dans l’antre du roi de la montagne',
    composer: 'E. Grieg',
    style: 'Classique',
    level: 2,
    tempo: 100,
    timeSignature: [4, 4],
    notation:
      'B3:8@Bm C#4 D4 E4 F#4 D4 F#4:4 | F4:8@C# C#4 F4:4 E4:8@C C4 E4:4 | B3:8@Bm C#4 D4 E4 F#4 D4 F#4 B4 | A4:8@F# F#4 D4 F#4 A4:2 | ' +
      'B3:8@Bm C#4 D4 E4 F#4 D4 F#4:4 | F4:8@C# C#4 F4:4 E4:8@C C4 E4:4 | B3:8@Bm C#4 D4 E4 F#4 D4 F#4 B4 | A4:8@F# F#4 D4 F#4 B4:2@Bm',
  },
  {
    id: 'marche-turque',
    title: 'Marche turque (début)',
    composer: 'W. A. Mozart',
    style: 'Classique',
    level: 3,
    tempo: 110,
    timeSignature: [2, 4],
    notation:
      'B4:16@Am A4 G#4 A4 C5:4 | D5:16@E C5 B4 C5 E5:4@Am | F5:16@Dm E5 D#5 E5 B5 A5 G#5 A5 | B5:16@E A5 G#5 A5 C6:4@Am | A5:2',
  },
  {
    id: 'cinquieme-beethoven',
    title: 'Symphonie n° 5 (motif)',
    composer: 'L. van Beethoven',
    style: 'Classique',
    level: 1,
    tempo: 108,
    timeSignature: [2, 4],
    notation: 'r:8 G4 G4 G4 | Eb4:2@Cm | r:8 F4 F4 F4 | D4:2@G | r:8 G4 G4 G4 | Eb4:2@Cm | r:8 Ab4 Ab4 Ab4 | G4:2',
  },
  {
    id: 'greensleeves',
    title: 'Greensleeves',
    composer: 'Traditionnel anglais (Renaissance)',
    style: 'Classique',
    level: 2,
    tempo: 90,
    timeSignature: [3, 4],
    notation:
      'r:2 A4:4 | C5:2@Am D5:4 | E5:4.@C F5:8 E5:4 | D5:2@G B4:4 | G4:4.@Em A4:8 B4:4 | C5:2@Am A4:4 | ' +
      'A4:4.@Dm G#4:8 A4:4 | B4:2@E G#4:4 | E4:2 A4:4 | C5:2@Am D5:4 | E5:4.@C F5:8 E5:4 | D5:2@G B4:4 | ' +
      'G4:4.@Em A4:8 B4:4 | C5:4.@Am B4:8 A4:4 | G#4:4.@E F#4:8 G#4:4 | A4:2.@Am',
  },
  {
    id: 'frere-jacques',
    title: 'Frère Jacques',
    composer: 'Traditionnel',
    style: 'Comptines',
    level: 1,
    tempo: 100,
    timeSignature: [4, 4],
    notation:
      'D4@D E4 F#4 D4 | D4 E4 F#4 D4 | F#4 G4 A4:2 | F#4:4 G4 A4:2 | ' +
      'A4:8 B4 A4 G4 F#4:4 D4 | A4:8 B4 A4 G4 F#4:4 D4 | D4 A3@A D4:2@D | D4:4 A3@A D4:2@D',
  },
  {
    id: 'au-clair-de-la-lune',
    title: 'Au clair de la lune',
    composer: 'Traditionnel',
    style: 'Comptines',
    level: 1,
    tempo: 90,
    timeSignature: [4, 4],
    notation:
      'D4@D D4 D4 E4@A | F#4:2@D E4:2@A | D4:4@D F#4 E4@A E4 | D4:1@D | ' +
      'D4:4@D D4 D4 E4@A | F#4:2@D E4:2@A | D4:4@D F#4 E4@A E4 | D4:1@D | ' +
      'E4:4@A E4 E4 E4 | B3:2@E B3:2 | E4:4@A D4 C#4 B3@E | A3:1@A | ' +
      'D4:4@D D4 D4 E4@A | F#4:2@D E4:2@A | D4:4@D F#4 E4@A E4 | D4:1@D',
  },
  {
    id: 'drunken-sailor',
    title: 'Drunken Sailor',
    composer: 'Traditionnel (chant de marins)',
    style: 'Folk & monde',
    level: 2,
    tempo: 110,
    timeSignature: [4, 4],
    notation:
      'A4:4@Dm A4:8 A4 A4:4 A4:8 A4 | A4:4 D4 F4 A4 | G4:4@C G4:8 G4 G4:4 G4:8 G4 | G4:4 C4 E4 G4 | ' +
      'A4:4@Dm A4:8 A4 A4:4 A4:8 A4 | A4:4 B4 C5 D5 | C5@C A4 G4 E4 | D4:2@Dm D4:2 | ' +
      'A4:2@Dm A4:2 | A4:4 D4 F4 A4 | G4:2@C G4:2 | G4:4 C4 E4 G4 | ' +
      'A4:2@Dm A4:2 | A4:4 B4 C5 D5 | C5@C A4 G4 E4 | D4:2@Dm D4:2',
  },
  {
    id: 'saints',
    title: 'When the Saints Go Marching In',
    composer: 'Traditionnel (spiritual)',
    style: 'Gospel & jazz',
    level: 2,
    tempo: 120,
    timeSignature: [4, 4],
    notation:
      'r:4 G4@G B4 C5 | D5:1 | r:4 G4 B4 C5 | D5:1 | r:4 G4 B4 C5 | D5:2 B4:2 | G4:2 B4:2 | A4:1@D | ' +
      'r:4 B4@G B4 A4 | G4:2. G4:4 | B4:2@C D5:4 D5:4 | C5:1 | r:4 B4@G C5 D5 | B4:2 G4:2@D | A4:1 | G4:1@G',
  },
  {
    id: 'walking-blues-la',
    title: 'Walking blues en La',
    composer: 'Exercice (12 mesures)',
    style: 'Blues',
    level: 2,
    tempo: 96,
    timeSignature: [4, 4],
    notation:
      'A2:8@A7 C#3 E3 F#3 G3 F#3 E3 C#3 | A2 C#3 E3 F#3 G3 F#3 E3 C#3 | A2 C#3 E3 F#3 G3 F#3 E3 C#3 | A2 C#3 E3 F#3 G3 F#3 E3 C#3 | ' +
      'D3@D7 F#3 A3 B3 C4 B3 A3 F#3 | D3 F#3 A3 B3 C4 B3 A3 F#3 | A2@A7 C#3 E3 F#3 G3 F#3 E3 C#3 | A2 C#3 E3 F#3 G3 F#3 E3 C#3 | ' +
      'E3@E7 G#3 B3 C#4 D4 C#4 B3 G#3 | D3@D7 F#3 A3 B3 C4 B3 A3 F#3 | A2@A7 C#3 E3 F#3 G3 F#3 E3 C#3 | E3@E7 G#3 B3 C#4 D4 C#4 B3 G#3 | A2:1@A7',
  },
  {
    id: 'jingle-bells',
    title: 'Jingle Bells (Vive le vent)',
    composer: 'J. L. Pierpont',
    style: 'Noël',
    level: 1,
    tempo: 120,
    timeSignature: [4, 4],
    notation:
      'B4:4@G B4 B4:2 | B4:4 B4 B4:2 | B4:4 D5 G4:4. A4:8 | B4:1 | ' +
      'C5:4@C C5 C5:4. C5:8 | C5:4@G B4 B4 B4:8 B4 | B4:4@A A4 A4 B4 | A4:2@D D5:2 | ' +
      'B4:4@G B4 B4:2 | B4:4 B4 B4:2 | B4:4 D5 G4:4. A4:8 | B4:1 | ' +
      'C5:4@C C5 C5:4. C5:8 | C5:4@G B4 B4 B4:8 B4 | D5:4@D D5 C5 A4 | G4:1@G',
  },
  {
    id: 'joyeux-anniversaire',
    title: 'Joyeux anniversaire',
    composer: 'M. et P. Hill',
    style: 'Fêtes',
    level: 1,
    tempo: 100,
    timeSignature: [3, 4],
    notation:
      'r:2 D4:8 D4 | E4:4@G D4 G4 | F#4:2@D D4:8 D4 | E4:4@D D4 A4 | G4:2@G D4:8 D4 | ' +
      'D5:4@G B4 G4 | F#4@C E4 C5:8 C5 | B4:4@G G4@D A4 | G4:2.@G',
  },
];

/** Morceaux complets (Mutopia Project, domaine public / Creative Commons), voir docs/credits-mutopia.md. */
const FULL: Song[] = (PD_LIBRARY as unknown as Song[]).map((s) => ({ ...s, style: (STYLE_ORDER as readonly string[]).includes(s.style) ? s.style : 'Classique' }));

/** Versions courtes écrites de mémoire, remplacées par une version complète. */
const REPLACED_BY_FULL: Record<string, RegExp> = {
  'marche-turque': /marche turque/i,
  'lettre-a-elise': /lettre à élise/i,
  'canon-pachelbel': /canon in d/i,
  'menuet-sol-bach': /menuet bwv anh 114/i,
  'petite-musique-de-nuit': /kleine nachtmusik/i,
  'berceuse-brahms': /berceuse|wiegenlied|cancion de cuna/i,
};
const keepShort = (s: Song) => !REPLACED_BY_FULL[s.id] || !FULL.some((f) => REPLACED_BY_FULL[s.id].test(f.title));

/** Les plus connus. Ceux marqués « facile » ont aussi une version simplifiée (1 note par temps, 1re position, plus lent). */
const FAMOUS: [string, boolean][] = [
  ['pd-canon-in-d-j-pachelbel', true],
  ['pd-canon-per-3-violini-e-basso-j-pachelbel', true],
  ['pd-marche-turque-rondo-alla-turca-w-a-mozart', true],
  ['pd-lettre-a-elise-fur-elise-l-van-beethoven', true],
  ['pd-eine-kleine-nachtmusik-1st-movement-w-a-mozart', true],
  ['pd-the-entertainer-s-joplin', true],
  ['vivaldi-spring-i', true],
  ['vivaldi-summer-iii', true],
  ['vivaldi-autumn-i', true],
  ['vivaldi-winter-i', true],
  ['vivaldi-winter-ii', true],
  ['pd-ave-maria-meditation-on-the-first-prelude-in-c-by-j-s-bach-c', true],
  ['pd-danse-napolitaine-p-i-tchaikovsky', true],
  ['pd-valse-op-39-n-15-j-brahms', true],
  ['pd-gavotte-g-b-martini', true],
  ['pd-menuet-bwv-anh-114-115-116-pour-violons-ou-altos-j-s-bach', false],
  ['pd-musette-en-re-j-s-bach', false],
  ['pd-greensleeves-traditionnel', false],
  ['film-gymnopedie-1', true],
  ['film-clair-de-lune', true],
  ['film-moonlight', true],
  ['film-nocturne-9-2', true],
  ['film-beau-danube', true],
  ['film-brindisi', true],
  ['film-carmen-prelude', true],
  ['film-roi-montagne', true],
  ['film-maple-leaf', true],
  ['ode-joie', false],
  ['largo-nouveau-monde', false],
  ['jesus-que-ma-joie', false],
  ['amazing-grace', false],
  ['la-marseillaise', false],
];

const GUITAR_CLASSICAL: Song[] = PD_GUITAR as unknown as Song[];
const BASE: Song[] = [...[...CORE, ...KIDS, ...CLASSICAL_MORE, ...CHRISTMAS, ...FOLK_WORLD].filter(keepShort), ...FULL, ...GUITAR_CLASSICAL];
const famousIds = new Map(FAMOUS);
const EASY: Song[] = [];
for (const s of BASE) {
  if (!famousIds.has(s.id)) continue;
  s.famous = true;
  if (famousIds.get(s.id)) EASY.push({ ...easyVersion(s), famous: true });
}

export const LIBRARY: Song[] = [...BASE, ...EASY, ...EXERCISES];

export const STYLES = STYLE_ORDER.filter((st) => LIBRARY.some((s) => s.style === st));

/** Genres de chansons (filtres mis en avant pour la voix). */
export const VOCAL_GENRES = ['Rap US', 'Rap français', 'R&B & soul', 'Pop & rock', 'Années 80', 'Années 90', 'Variété française', 'Chanson française', 'Reggae', 'Électro & dance', 'Comédies musicales', 'Gospel & jazz', 'Comptines', 'Noël', 'Folk & monde'] as const;
const FOR_ALL = new Set(['Mes morceaux', 'Années 80', 'Années 90', 'Pop & rock', 'Variété française', 'Rap US', 'Rap français', 'R&B & soul', 'Reggae', 'Électro & dance', 'Comédies musicales', 'Comptines', 'Chanson française', 'Noël', 'Folk & monde', 'Chants & cantiques', 'Gospel & jazz', 'Blues', 'Fêtes', 'Gammes & arpèges', 'Exercices']);

/**
 * Répertoire par instrument : chansons, folk, Noël, blues… pour tous ; le répertoire classique
 * suit l'instrument d'origine de la partition (violon, flûte, voix) ; la guitare garde les chansons,
 * les morceaux à accords et les mélodies faciles des méthodes.
 */
export function songFor(song: Song, inst: InstrumentId): boolean {
  if (song.instruments) return song.instruments.includes(inst);
  const ex = song as Song & { only?: InstrumentId };
  if (ex.only) return ex.only === inst;
  if (song.id.endsWith('~facile')) {
    const orig = BY_ID.get(song.id.replace('~facile', ''));
    // Les versions faciles servent aussi à la guitare (mélodie simplifiée).
    return inst === 'guitar' || (orig ? songFor(orig, inst) : true);
  }
  // Voix : les chansons qui ont des paroles ; pour les genres chantés (rap…), aussi les instrus seules (grille d'accords).
  if (inst === 'voice') return !!lyricsOf(song) || (!!song.chords && (VOCAL_GENRES as readonly string[]).includes(song.style));
  if (FOR_ALL.has(song.style)) return true;
  const o = song.origin;
  switch (inst) {
    case 'violin':
      return true;
    case 'recorder':
      return !o || ['Flute', 'Recorder', 'Oboe', 'Clarinet', 'Voice', 'Piano'].includes(o);
    case 'guitar':
      // Classique : seulement les mélodies faciles écrites pour les méthodes (pas les pièces de concert).
      return !o && song.level <= 2;
  }
}
const BY_ID = new Map(LIBRARY.map((s) => [s.id, s]));
