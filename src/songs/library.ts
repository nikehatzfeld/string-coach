import type { Song } from './alphatex';

/**
 * Morceaux du domaine public et exercices, transcrits de mémoire en notation compacte
 * (voir notation.ts). Chaque mélodie est jouable au violon et à la guitare : la
 * conversion choisit corde, case et octave automatiquement.
 */
export const LIBRARY: Song[] = [
  {
    id: 'gamme-re-majeur',
    title: 'Gamme de Ré majeur',
    composer: 'Exercice',
    style: 'Exercices',
    level: 1,
    tempo: 70,
    timeSignature: [4, 4],
    notation: 'D4 E4 F#4 G4 | A4 B4 C#5 D5 | D5 C#5 B4 A4 | G4 F#4 E4 D4 | D4:1',
  },
  {
    id: 'gamme-sol-majeur',
    title: 'Gamme de Sol majeur',
    composer: 'Exercice',
    style: 'Exercices',
    level: 1,
    tempo: 70,
    timeSignature: [4, 4],
    notation: 'G3 A3 B3 C4 | D4 E4 F#4 G4 | G4 F#4 E4 D4 | C4 B3 A3 G3 | G3:1',
  },
  {
    id: 'penta-la-mineur',
    title: 'Pentatonique de La mineur',
    composer: 'Exercice',
    style: 'Exercices',
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
    id: 'frere-jacques',
    title: 'Frère Jacques',
    composer: 'Traditionnel',
    style: 'Folk français',
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
    style: 'Folk français',
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
    style: 'Folk anglo-saxon',
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
    title: 'Jingle Bells',
    composer: 'J. L. Pierpont',
    style: 'Fêtes',
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

export const STYLES = [...new Set(LIBRARY.map((s) => s.style))];
