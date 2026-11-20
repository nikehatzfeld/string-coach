import type { Song } from './alphatex';

/** Morceaux du domaine public transcrits de mémoire : à vérifier à l'oreille. */

export const KIDS: Song[] = [
  {
    id: 'mary-had-a-little-lamb',
    title: 'Mary Had a Little Lamb',
    composer: 'Traditionnel américain',
    style: 'Comptines',
    level: 1,
    tempo: 100,
    timeSignature: [4, 4],
    key: 'D',
    notation:
      'F#4@D E4 D4 E4 | F#4 F#4 F#4:2 | E4:4@A E4 E4:2 | F#4:4@D A4 A4:2 | ' +
      'F#4:4@D E4 D4 E4 | F#4 F#4 F#4 F#4 | E4@A E4 F#4 E4 | D4:1@D',
  },
  {
    id: 'old-macdonald',
    title: 'Old MacDonald Had a Farm',
    composer: 'Traditionnel',
    style: 'Comptines',
    level: 1,
    tempo: 110,
    timeSignature: [4, 4],
    key: 'G',
    notation:
      'G4@G G4 G4 D4 | E4@C E4 D4:2@G | B4:4 B4 A4@D A4 | G4:2.@G D4:4 | ' +
      'G4 G4 G4 D4 | E4@C E4 D4:2@G | B4:4 B4 A4@D A4 | G4:1@G',
  },
  {
    id: 'london-bridge',
    title: 'London Bridge Is Falling Down',
    composer: 'Traditionnel anglais',
    style: 'Comptines',
    level: 1,
    tempo: 100,
    timeSignature: [4, 4],
    key: 'D',
    notation:
      'A4:4.@D B4:8 A4:4 G4 | F#4 G4 A4:2 | E4:4@A F#4 G4:2 | F#4:4@D G4 A4:2 | ' +
      'A4:4.@D B4:8 A4:4 G4 | F#4 G4 A4:2 | E4:2@A A4:2 | F#4:4@D D4 r:2',
  },
  {
    id: 'row-row-row',
    title: 'Row, Row, Row Your Boat',
    composer: 'Traditionnel',
    style: 'Comptines',
    level: 1,
    tempo: 90,
    timeSignature: [6, 8],
    key: 'D',
    notation:
      'D4:4.@D D4:4. | D4:4 E4:8 F#4:4. | F#4:4 E4:8@A F#4:4 G4:8 | A4:2.@D | ' +
      'D5:8 D5 D5 A4 A4 A4 | F#4 F#4 F#4 D4 D4 D4 | A4:4@A G4:8 F#4:4 E4:8 | D4:2.@D',
  },
  {
    id: 'hot-cross-buns',
    title: 'Hot Cross Buns',
    composer: 'Traditionnel anglais',
    style: 'Comptines',
    level: 1,
    tempo: 90,
    timeSignature: [4, 4],
    key: 'D',
    notation: 'F#4@D E4 D4:2 | F#4:4 E4 D4:2 | D4:8 D4 D4 D4 E4@A E4 E4 E4 | F#4:4@D E4 D4:2',
  },
  {
    id: 'yankee-doodle',
    title: 'Yankee Doodle',
    composer: 'Traditionnel américain',
    style: 'Comptines',
    level: 1,
    tempo: 120,
    timeSignature: [4, 4],
    key: 'D',
    notation:
      'D4@D D4 E4 F#4 | D4 F#4 E4@A A3 | D4@D D4 E4 F#4 | D4:2 C#4:2@A | ' +
      'D4:4@D D4 E4 F#4 | G4@G F#4 E4 D4 | C#4@A A3 B3 C#4 | D4:2@D D4:2',
  },
  {
    id: 'alouette',
    title: 'Alouette',
    composer: 'Traditionnel',
    style: 'Comptines',
    level: 1,
    tempo: 100,
    timeSignature: [4, 4],
    key: 'G',
    notation:
      'G4:4.@G A4:8 B4:4 B4 | A4:8@D G4 A4 B4 G4:4@G D4 | G4:4. A4:8 B4:4 B4 | A4:8@D G4 A4 B4 G4:2@G | ' +
      'G4:4. A4:8 B4:4 B4 | A4:8@D G4 A4 B4 G4:4@G D4 | G4:4. A4:8 B4:4 B4 | A4:8@D G4 A4 B4 G4:2@G',
  },
];

export const CLASSICAL_MORE: Song[] = [
  {
    id: 'french-cancan',
    title: 'French cancan (Galop infernal)',
    composer: 'J. Offenbach',
    style: 'Classique',
    level: 2,
    tempo: 120,
    timeSignature: [2, 4],
    notation:
      'C4:4@C D4:8 F4 | E4 D4 G4:4@G | G4:4 G4:8 A4 | E4 F4 D4:4 | ' +
      'D4:4@G D4:8 F4 | E4 D4 C4 C5 | B4@G A4 G4 F4 | E4@C D4 C4:4',
  },
  {
    id: 'symphonie-40',
    title: 'Symphonie n° 40 (thème)',
    composer: 'W. A. Mozart',
    style: 'Classique',
    level: 2,
    tempo: 110,
    timeSignature: [4, 4],
    key: 'gminor',
    notation:
      'r:2 r:4 Eb5:8 D5 | D5:4@Gm Eb5:8 D5 D5:4 Eb5:8 D5 | D5:4 Bb5 r:4 Bb5:8 A5 | G5:4@Cm G5:8 F5 Eb5:4 Eb5:8 D5 | C5:4 C5 r:4 D5:8 C5 | ' +
      'C5:4@D D5:8 C5 C5:4 D5:8 C5 | C5:4 A5 r:4 A5:8 G5 | F#5:4@D F#5:8 Eb5 D5:4 D5:8 C5 | Bb4:4@Gm Bb4 r:2',
  },
  {
    id: 'symphonie-surprise',
    title: 'Symphonie « La Surprise » (thème)',
    composer: 'J. Haydn',
    style: 'Classique',
    level: 1,
    tempo: 100,
    timeSignature: [4, 4],
    notation:
      'C4:8@C C4 E4 E4 G4 G4 E4:4 | F4:8@G F4 D4 D4 B3 B3 G3:4 | C4:8@C C4 E4 E4 G4 G4 C5:4 | A4:8@D A4 F#4 F#4 G4:2@G',
  },
  {
    id: 'sonate-facile',
    title: 'Sonate « facile » K. 545 (thème)',
    composer: 'W. A. Mozart',
    style: 'Classique',
    level: 2,
    tempo: 100,
    timeSignature: [4, 4],
    notation: 'C5:2@C E5:4 G5 | B4:4.@G C5:16 D5 C5:2@C | A5:2@F G5:4@C C6 | G5:4@G F5:8 G5 E5:2@C | C5:1',
  },
  {
    id: 'jesus-que-ma-joie',
    title: 'Jésus que ma joie demeure',
    composer: 'J. S. Bach',
    style: 'Classique',
    level: 2,
    tempo: 66,
    timeSignature: [9, 8],
    key: 'G',
    notation:
      'G4:8@G A4 B4 D5 C5 C5 E5 D5 D5 | G5@G F#5 G5 D5 B4 G4 A4 B4 C5 | D5@D E5 D5 C5 B4 A4 B4 G4 F#4 | G4@G A4 D4 F#4 A4 C5 B4 A4 B4 | G4:2.@G r:4.',
  },
  {
    id: 'bourree-mi-mineur',
    title: 'Bourrée en Mi mineur (début)',
    composer: 'J. S. Bach',
    style: 'Classique',
    level: 2,
    tempo: 90,
    timeSignature: [4, 4],
    key: 'eminor',
    notation:
      'r:2. E4:8@Em F#4 | G4:4 F#4:8 E4 D#4:4@B E4:8@Em F#4 | B3:4@B C#4:8 D#4 E4:4@Em D4:8@G C4 | B3:4@B A3:8 G3 F#3:4 G3:8@Em A3 | B3:8@B A3 G3 F#3 E3:2@Em',
  },
  {
    id: 'beau-danube-bleu',
    title: 'Le Beau Danube bleu (thème)',
    composer: 'J. Strauss fils',
    style: 'Classique',
    level: 2,
    tempo: 150,
    timeSignature: [3, 4],
    key: 'D',
    notation:
      'r:2 D4:4@D | D4 F#4 A4 | A4:2. | r:4 A5 A5 | r:4 F#5 F#5 | D4:4 D4 F#4 | A4 A4:2 | r:4 A5@A7 A5 | r:4 G5 G5 | ' +
      'C#4:4 C#4 E4 | B4 B4:2 | r:4 B5 B5 | r:4 G5 G5 | C#4:4 C#4 E4 | B4 B4:2 | r:4 B5@D B5 | r:4 F#5 F#5 | D4:4 D4 F#4 | A4 D5:2 | D5:2.@D',
  },
  {
    id: 'au-matin-peer-gynt',
    title: 'Au matin (Peer Gynt)',
    composer: 'E. Grieg',
    style: 'Classique',
    level: 2,
    tempo: 60,
    timeSignature: [6, 8],
    key: 'E',
    notation:
      'G#4:8@E E4 D#4 C#4 D#4 E4 | G#4 E4 D#4 C#4 D#4:16 E4 D#4 E4 | G#4:8 E4 G#4 B4 G#4 B4 | C#5@A G#4 C#5 B4@E G#4 E4 | E4:2.',
  },
  {
    id: 'printemps-vivaldi',
    title: 'Le Printemps (motif)',
    composer: 'A. Vivaldi',
    style: 'Classique',
    level: 2,
    tempo: 100,
    timeSignature: [4, 4],
    key: 'E',
    notation: 'E4:4@E G#4 G#4 G#4 | F#4:8 E4 B4:2. | B4:8@E A4 G#4:4 G#4 G#4 | F#4:8 E4 B4:2. | E4:1@E',
  },
  {
    id: 'marche-nuptiale-wagner',
    title: 'Marche nuptiale (Lohengrin)',
    composer: 'R. Wagner',
    style: 'Classique',
    level: 1,
    tempo: 72,
    timeSignature: [4, 4],
    key: 'G',
    notation:
      'r:2. D4:4@G | G4:2 G4:4. G4:8 | G4:2. D4:4 | A4:2@D F#4:4. G4:8 | A4:2. D4:4 | ' +
      'G4:2@G C5:4.@C C5:8 | B4:2@G A4:4.@D G4:8 | F#4:2 G4:4.@G A4:8 | G4:2. r:4',
  },
  {
    id: 'la-marseillaise',
    title: 'La Marseillaise (début)',
    composer: 'C. J. Rouget de Lisle',
    style: 'Chanson française',
    level: 2,
    tempo: 100,
    timeSignature: [4, 4],
    key: 'G',
    notation:
      'r:2. D4:8. D4:16 | G4:4@G G4 A4@D A4 | D5:4.@G B4:8 G4:8. G4:16 B4:8. G4:16 | E4:4@C C5:2 A4:8.@D F#4:16 | G4:2@G r:4 G4:8. A4:16 | ' +
      'B4:4@G B4 B4 C5:8. B4:16 | B4:4 A4:2@D A4:8. B4:16 | C5:4@C C5 C5 D5:8. C5:16 | B4:2@G r:4 D5:8. D5:16 | ' +
      'D5:4@G B4:8. G4:16 D5:4 B4:8. G4:16 | D4:2@D r:4 D4:8. D4:16 | G4:1@G',
  },
];

export const CHRISTMAS: Song[] = [
  {
    id: 'douce-nuit',
    title: 'Douce nuit',
    composer: 'F. X. Gruber',
    style: 'Noël',
    level: 1,
    tempo: 70,
    timeSignature: [6, 8],
    key: 'C',
    notation:
      'G4:4.@C A4:8 G4:4 | E4:2. | G4:4. A4:8 G4:4 | E4:2. | D5:2@G D5:4 | B4:2. | C5:2@C C5:4 | G4:2. | ' +
      'A4:2@F A4:4 | C5:4. B4:8 A4:4 | G4:4.@C A4:8 G4:4 | E4:2. | A4:2@F A4:4 | C5:4. B4:8 A4:4 | G4:4.@C A4:8 G4:4 | E4:2. | ' +
      'D5:2@G D5:4 | F5:4. D5:8 B4:4 | C5:2.@C | E5:2. | C5:4 G4 E4 | G4:4.@G F4:8 D4:4 | C4:2.@C | C4:2.',
  },
  {
    id: 'we-wish-you',
    title: 'We Wish You a Merry Christmas',
    composer: 'Traditionnel anglais',
    style: 'Noël',
    level: 1,
    tempo: 120,
    timeSignature: [3, 4],
    key: 'G',
    notation:
      'r:2 D4:4 | G4:4@G G4:8 A4 G4 F#4 | E4:4@C E4 E4 | A4:4@A A4:8 B4 A4 G4 | F#4:4@D D4 D4 | ' +
      'B4:4@B B4:8 C5 B4 A4 | G4:4@Em E4 D4:8 D4 | E4:4@C A4@D F#4 | G4:2.@G',
  },
  {
    id: 'deck-the-halls',
    title: 'Deck the Halls',
    composer: 'Traditionnel gallois',
    style: 'Noël',
    level: 2,
    tempo: 110,
    timeSignature: [4, 4],
    key: 'G',
    notation:
      'D5:4.@G C5:8 B4:4 A4@D | G4@G A4 B4 G4 | A4:8@D B4 C5 A4 B4:4.@G A4:8 | G4:4@G F#4@D G4:2@G | ' +
      'D5:4.@G C5:8 B4:4 A4@D | G4@G A4 B4 G4 | A4:8@D B4 C5 A4 B4:4.@G A4:8 | G4:4@G F#4@D G4:2@G | ' +
      'A4:4.@D B4:8 C5:4 A4 | B4:4.@G C5:8 D5:4 A4@D | B4:8@G C#5 D5:4 E5:8@A F#5 G5:4@G | F#5:4@D E5@A D5:2@D | ' +
      'D5:4.@G C5:8 B4:4 A4@D | G4@G A4 B4 G4 | E5:8@C E5 E5 E5 D5:4.@G C5:8 | B4:4@G A4@D G4:2@G',
  },
  {
    id: 'adeste-fideles',
    title: 'Adeste fideles (Peuple fidèle)',
    composer: 'Attribué à J. F. Wade',
    style: 'Noël',
    level: 1,
    tempo: 90,
    timeSignature: [4, 4],
    key: 'G',
    notation:
      'G4:2@G G4:4 D4@D | G4:4@G A4@D D4:2 | B4:4@G A4 B4@C C5 | B4:2@G A4:4@D G4@G | ' +
      'G4:2 F#4:4@D E4@C | F#4:4@D G4@G A4@D B4@G | F#4:2@D E4:4. D4:8 | D4:1@D',
  },
  {
    id: 'good-king-wenceslas',
    title: 'Good King Wenceslas',
    composer: 'Traditionnel',
    style: 'Noël',
    level: 1,
    tempo: 110,
    timeSignature: [4, 4],
    key: 'G',
    notation:
      'G4@G G4 G4 A4@D | G4@G G4 D4:2@D | E4:4@C D4 E4 F#4@D | G4:2@G G4:2 | ' +
      'G4:4 G4 G4 A4@D | G4@G G4 D4:2@D | E4:4@C D4 E4 F#4@D | G4:2@G G4:2 | ' +
      'D5:4@G C5 B4 A4@D | B4@G A4 G4:2 | E4:4@C D4 E4 F#4@D | G4:2@G G4:2 | ' +
      'D4:4@D D4 E4 F#4 | G4@G G4 A4:2@D | D5:4@G C5 B4 A4@D | G4:2@G C5:2@C | G4:1@G',
  },
  {
    id: 'hark-the-herald',
    title: 'Hark! The Herald Angels Sing',
    composer: 'F. Mendelssohn',
    style: 'Noël',
    level: 2,
    tempo: 100,
    timeSignature: [4, 4],
    key: 'G',
    notation:
      'D4:4@G G4 G4:4. F#4:8@D | G4:4@G B4 B4 A4@D | D5@G D5 D5:4. C5:8@C | B4:4@G A4@D B4:2@G | ' +
      'D4:4@G G4 G4:4. F#4:8@D | G4:4@G B4 B4 A4@D | D5:4@D A4 A4:4. F#4:8 | F#4:4@A E4 D4:2@D | ' +
      'D5:4@G D5 D5 G4 | C5:4@C B4 B4 A4@D | D5:4@G D5 D5 G4 | C5:4@C B4 B4 A4@D | ' +
      'E5:4@C E5 E5 D5 | C5@C B4 C5:2 | A4:4@D B4:8 C5 D5:4.@G G4:8 | G4:4 A4@D B4:2@G | ' +
      'E5:4.@C E5:8 E5:4 D5 | C5@C B4 C5:2 | A4:4@D B4:8 C5 D5:4.@G G4:8 | G4:4 A4@D G4:2@G',
  },
  {
    id: 'les-anges-dans-nos-campagnes',
    title: 'Les anges dans nos campagnes',
    composer: 'Traditionnel français',
    style: 'Noël',
    level: 2,
    tempo: 100,
    timeSignature: [4, 4],
    key: 'G',
    notation:
      'B4@G B4 B4 D5 | D5:4.@D C5:8 B4:2@G | B4:4@G A4@D B4@G D5 | B4:4.@G A4:8@D G4:2@G | ' +
      'B4:4@G B4 B4 D5 | D5:4.@D C5:8 B4:2@G | B4:4@G A4@D B4@G D5 | B4:4.@G A4:8@D G4:2@G | ' +
      'D5:2@G E5:8@C D5 C5 B4 | C5:2@C D5:8@D C5 B4 A4 | B4:2@G C5:8@C B4 A4 G4 | A4:4.@D D4:8 D4:2 | ' +
      'G4:4@G A4@D B4@G C5@C | B4:2@G A4:2@D | G4:1@G',
  },
  {
    id: 'mon-beau-sapin',
    title: 'Mon beau sapin',
    composer: 'Traditionnel allemand',
    style: 'Noël',
    level: 1,
    tempo: 90,
    timeSignature: [3, 4],
    key: 'G',
    notation:
      'r:2 D4:4 | G4:4.@G G4:8 G4:4 | A4:4.@D B4:8 B4:4 | B4:4@G A4 B4 | C5:4@C F#4@D A4 | G4:2@G r:4',
  },
  {
    id: 'god-rest-ye',
    title: 'God Rest Ye Merry, Gentlemen',
    composer: 'Traditionnel anglais',
    style: 'Noël',
    level: 2,
    tempo: 110,
    timeSignature: [4, 4],
    key: 'eminor',
    notation:
      'r:2. E4:4 | E4@Em B4 B4 A4@Am | G4@Em F#4@B E4@Em D4@D | E4@Em F#4 G4@G A4@D | B4:2.@Em E4:4 | ' +
      'E4@Em B4 B4 A4@Am | G4@Em F#4@B E4@Em D4@D | E4@Em F#4 G4@G A4@D | B4:2.@Em B4:4 | ' +
      'C5@Am A4 B4@G C5@C | D5@G E5@C B4@G A4@D | G4@Em E4 F#4@B G4@Em | A4:2@D G4:4@G A4 | ' +
      'B4:2@Em C5:4@C B4 | B4@Em A4@Am G4@Em F#4@B | E4:2@Em G4:8@G F#4 E4:4@Em | A4:2@Am G4:4@G A4 | ' +
      'B4@Em C5@C D5@G E5@C | B4@Em A4@Am G4@Em F#4@B | E4:1@Em',
  },
];

export const FOLK_WORLD: Song[] = [
  {
    id: 'amazing-grace',
    title: 'Amazing Grace',
    composer: 'Traditionnel (gospel)',
    style: 'Gospel & jazz',
    level: 1,
    tempo: 80,
    timeSignature: [3, 4],
    key: 'G',
    notation:
      'r:2 D4:4 | G4:2@G B4:8 G4 | B4:2 A4:4@D | G4:2@C E4:4 | D4:2@G D4:4 | G4:2@G B4:8 G4 | B4:2 A4:4@D | D5:2.@D | D5:2 B4:4 | ' +
      'D5:2@G B4:8 G4 | B4:2 A4:4@D | G4:2@C E4:4 | D4:2@G D4:4 | G4:2@G B4:8 G4 | B4:2@D A4:4 | G4:2.@G',
  },
  {
    id: 'auld-lang-syne',
    title: 'Auld Lang Syne (Ce n’est qu’un au revoir)',
    composer: 'Traditionnel écossais',
    style: 'Folk & monde',
    level: 1,
    tempo: 90,
    timeSignature: [4, 4],
    key: 'G',
    notation:
      'r:2. D4:4 | G4:4.@G G4:8 G4:4 B4 | A4:4.@D G4:8 A4:4 B4:8 A4 | G4:4.@G G4:8 B4:4 D5 | E5:2.@C E5:4 | ' +
      'D5:4.@G B4:8 B4:4 G4 | A4:4.@D G4:8 A4:4 B4:8 A4 | G4:4.@Em E4:8 E4:4@C D4@D | G4:2.@G E5:4 | ' +
      'D5:4.@G B4:8 B4:4 G4 | A4:4.@D G4:8 A4:4 E5 | D5:4.@G B4:8 B4:4 D5 | E5:2.@C E5:4 | ' +
      'D5:4.@G B4:8 B4:4 G4 | A4:4.@D G4:8 A4:4 B4:8 A4 | G4:4.@Em E4:8 E4:4@C D4@D | G4:2.@G r:4',
  },
  {
    id: 'scarborough-fair',
    title: 'Scarborough Fair',
    composer: 'Traditionnel anglais',
    style: 'Folk & monde',
    level: 2,
    tempo: 100,
    timeSignature: [3, 4],
    key: 'D',
    notation:
      'E4:2@Em E4:4 | B4:2 B4:4 | F#4:4.@D G4:8 F#4:4 | E4:2.@Em | r:4 B4@G D5 | E5:2@A D5:4 | B4:4@Em C#5@A A4 | B4:2.@Em | ' +
      'r:2 E5:4 | E5:2@G E5:4 | D5:2@D B4:4 | B4:4@Em A4 G4 | F#4:4@D D4:2 | E4:2@Em B4:4 | A4:2@D G4:4 | F#4:4 E4@Em D4@D | E4:2.@Em',
  },
  {
    id: 'oh-susanna',
    title: 'Oh! Susanna',
    composer: 'S. Foster',
    style: 'Folk & monde',
    level: 1,
    tempo: 110,
    timeSignature: [4, 4],
    key: 'G',
    notation:
      'r:2. G4:8 A4 | B4:4@G D5 D5:4. E5:8 | D5:4 B4 G4:4. A4:8@D | B4:4@G B4 A4 G4 | A4:2.@D G4:8 A4 | ' +
      'B4:4@G D5 D5:4. E5:8 | D5:4 B4 G4:4. A4:8@D | B4:4@G B4 A4@D A4 | G4:2.@G r:4 | ' +
      'C5:2@C C5:2 | E5:4 E5:2 E5:4 | D5:4@G D5 B4 G4 | A4:2.@D G4:8 A4 | ' +
      'B4:4@G D5 D5:4. E5:8 | D5:4 B4 G4:4. A4:8@D | B4:4@G B4 A4@D A4 | G4:2.@G r:4',
  },
  {
    id: 'sakura',
    title: 'Sakura Sakura',
    composer: 'Traditionnel japonais',
    style: 'Folk & monde',
    level: 1,
    tempo: 70,
    timeSignature: [4, 4],
    notation:
      'A4 A4 B4:2 | A4:4 A4 B4:2 | A4:4 B4 C5 B4 | A4 B4:8 A4 F4:2 | E4:4 C4 E4 F4 | E4 E4:8 C4 B3:2 | ' +
      'A4:4 B4 C5 B4 | A4 B4:8 A4 F4:2 | E4:4 C4 E4 F4 | E4 E4:8 C4 B3:2 | A4:4 A4 B4:2 | A4:4 A4 B4:2 | E4:4 F4 B4:8 A4 F4:4 | E4:1',
  },
  {
    id: 'korobeiniki',
    title: 'Korobeiniki (air de Tetris)',
    composer: 'Traditionnel russe',
    style: 'Folk & monde',
    level: 2,
    tempo: 140,
    timeSignature: [4, 4],
    key: 'aminor',
    notation:
      'E5:4@Am B4:8 C5 D5:4 C5:8 B4 | A4:4@Am A4:8 C5 E5:4 D5:8 C5 | B4:4.@E C5:8 D5:4 E5 | C5:4@Am A4 A4:2 | ' +
      'r:8 D5:4@Dm F5:8 A5:4 G5:8 F5 | E5:4.@C C5:8 E5:4 D5:8 C5 | B4:4@E B4:8 C5 D5:4 E5 | C5:4@Am A4 A4:2',
  },
  {
    id: 'bella-ciao',
    title: 'Bella ciao',
    composer: 'Traditionnel italien',
    style: 'Folk & monde',
    level: 2,
    tempo: 120,
    timeSignature: [4, 4],
    key: 'aminor',
    notation:
      'r:2 r:8 E4 A4 B4 | C5:8@Am A4:4. r:8 E4 A4 B4 | C5:8@Am A4:4. r:8 E4 A4 B4 | C5:4@Am B4:8 A4 C5:4 B4:8 A4 | ' +
      'E5:4@E E5 E5 D5:8 E5 | F5:4@Dm F5:2 r:8 F5:8 | E5:8 D5 F5 E5:2@Am r:8 | E5:8 D5 C5:4 B4@E E5 | C5:4@Am B4@E A4:2@Am',
  },
  {
    id: 'la-cucaracha',
    title: 'La cucaracha',
    composer: 'Traditionnel mexicain',
    style: 'Folk & monde',
    level: 2,
    tempo: 140,
    timeSignature: [4, 4],
    key: 'C',
    notation:
      'r:2 r:8 G4 G4 G4 | C5:4.@C E5:8 r:8 G4 G4 G4 | C5:4.@C E5:8 r:2 | C5:4@G C5:8 B4 B4 A4 A4 G4 | ' +
      'r:8 G4@G G4 G4 B4:4. D5:8 | r:8 G4 G4 G4 B4:4. D5:8 | D5:4@G E5:8 D5 C5 B4 A4 B4 | C5:2@C r:2',
  },
];
