import type { Song } from './alphatex';
import { syllabifyLyrics } from '../practice/karaoke';
import type { SpokenLine } from '../audio/rap-voice';

/**
 * Morceaux de rap ORIGINAUX écrits pour String Coach (paroles libres d'utilisation).
 * Chaque vers occupe une mesure de 4/4 : les syllabes tombent sur les doubles croches (ou les croches
 * pour un vers court), ce qui donne un flow régulier et un karaoké exact (une syllabe par note).
 * La hauteur n'est qu'indicative : pour le rap, le jeu juge le placement, pas la justesse.
 */

interface RapDef {
  id: string;
  title: string;
  tempo: number;
  level: 1 | 2 | 3;
  lang: 'fr' | 'en';
  chords: string[];
  verse: string[];
  hook: string[];
  /** Note de base du flow (MIDI). */
  base?: number;
}

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nn = (m: number) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

/** Un vers → une ou deux mesures (doubles croches, ou croches si le vers est court). */
function barsFor(line: string, base: number, chord: string): { notes: string; syl: string[] } [] {
  const syl = syllabifyLyrics(line, true).map((x) => x.s);
  const chunks = syl.length > 16 ? [syl.slice(0, Math.ceil(syl.length / 2)), syl.slice(Math.ceil(syl.length / 2))] : [syl];
  return chunks.map((ch, ci) => {
    const eighth = ch.length <= 8;
    const slot = eighth ? 2 : 1; // en doubles croches
    const toks: string[] = [];
    ch.forEach((_s, i) => {
      // Contour parlé : légère montée au milieu, accent sur la rime (dernière syllabe).
      const last = i === ch.length - 1;
      const m = last ? base + 3 : i % 4 === 2 ? base + 2 : base;
      toks.push(`${nn(m)}:${eighth ? 8 : 16}${i === 0 && ci === 0 ? `@${chord}` : ''}`);
    });
    let used = ch.length * slot;
    // Complète la mesure avec des silences (16 doubles croches par mesure).
    const rests: string[] = [];
    while (used < 16) {
      const left = 16 - used;
      const d = left >= 8 && used % 8 === 0 ? 8 : left >= 4 && used % 4 === 0 ? 4 : left >= 2 && used % 2 === 0 ? 2 : 1;
      rests.push(`r:${16 / d}`);
      used += d;
    }
    if (ci > 0) toks[0] = toks[0].replace(/@.*/, '') + `@${chord}`;
    // Virgule sur la dernière syllabe du vers : le karaoké passe à la ligne au bon endroit.
    const shown = ch.map((x, i) => (i === ch.length - 1 && ci === chunks.length - 1 && !x.endsWith('-') ? `${x},` : x));
    return { notes: [...toks, ...rests].join(' '), syl: shown };
  });
}

function build(d: RapDef): Song {
  const base = d.base ?? 57;
  const lines = [...d.verse, ...d.hook, ...d.verse.slice(0, 4), ...d.hook];
  const bars: string[] = [];
  const syl: string[] = [];
  const spoken: SpokenLine[] = [];
  lines.forEach((line, i) => {
    const bs = barsFor(line, base, d.chords[i % d.chords.length]);
    // Mesure 0 = intro ; le vers commence à la mesure suivante.
    spoken.push({ bar: bars.length + 1, bars: bs.length, text: line, syl: bs.reduce((a, b) => a + b.syl.length, 0) });
    for (const b of bs) {
      bars.push(b.notes);
      syl.push(...b.syl);
    }
  });
  // Une mesure d'intro (beat seul) pour se caler.
  return {
    id: `rap-${d.id}`,
    title: `${d.title}${d.lang === 'en' ? ' (EN)' : ''}`,
    composer: d.lang === 'fr' ? 'String Coach (création originale)' : 'String Coach (original)',
    // Catégorie à part, facile à repérer ; la langue est indiquée dans le titre.
    style: 'Raps originaux',
    level: d.level,
    tempo: d.tempo,
    timeSignature: [4, 4],
    notation: [`r:1@${d.chords[0]}`, ...bars].join(' | '),
    lyrics: syl.join(' '),
    spoken: { lang: d.lang === 'fr' ? 'fr-FR' : 'en-US', lines: spoken },
    instruments: ['voice', 'guitar'],
    source: { url: '', license: 'Création originale, libre d’utilisation' },
  };
}

const DEFS: RapDef[] = [
  {
    id: 'pas-a-pas',
    title: 'Pas à pas',
    tempo: 88,
    level: 2,
    lang: 'fr',
    chords: ['Am', 'F', 'C', 'G'],
    verse: [
      'Je pose mes doigts sur le manche, j’apprends la patience',
      'Chaque note qui sonne faux, c’est une leçon de science',
      'Le métronome me juge, il compte sans pitié',
      'Mais j’avance pas à pas, je lâche rien, c’est juré',
      'La musique c’est mon refuge, ma lumière, ma maison',
      'Je répète la même phrase jusqu’à trouver le bon son',
      'Le matin dans la cuisine, le soir dans le salon',
      'Ma famille tape du pied, c’est ça ma vraie raison',
    ],
    hook: ['Pas à pas, note après note', 'Pas à pas, je monte la côte', 'Pas à pas, jamais je saute', 'Pas à pas, la musique me porte'],
  },
  {
    id: 'la-ville-s-endort',
    title: 'La ville s’endort',
    tempo: 84,
    level: 2,
    lang: 'fr',
    chords: ['Dm', 'Bb', 'F', 'C'],
    verse: [
      'La ville s’endort, moi je garde les yeux ouverts',
      'Les lampadaires dessinent des poèmes sur le béton vert',
      'Le dernier métro passe, il emporte mes doutes',
      'J’écris dans mon carnet ce que la nuit écoute',
      'Les fenêtres s’éteignent une par une comme des bougies',
      'Et moi je cherche la rime qui réveillera ma vie',
      'Le vent me souffle un beat, je le prends sans hésiter',
      'Demain sera plus beau, je le sens, c’est décidé',
    ],
    hook: ['La ville s’endort, moi je veille', 'La ville s’endort, je cherche le soleil', 'La ville s’endort, mes mots se réveillent', 'La ville s’endort, rien n’est pareil'],
  },
  {
    id: 'de-pere-en-fils',
    title: 'De père en fils',
    tempo: 90,
    level: 2,
    lang: 'fr',
    chords: ['Em', 'C', 'G', 'D'],
    verse: [
      'Je te donne ce que j’ai, pas de l’or, pas d’argent',
      'Juste un rythme dans le cœur et des mots pour les gens',
      'Regarde-moi tomber, regarde-moi me relever',
      'C’est comme ça qu’on grandit, c’est comme ça qu’on sait rêver',
      'Un jour tu prendras le micro, tu diras tes propres phrases',
      'Tu feras trembler la scène, tu poseras tes propres bases',
      'Moi je serai dans la salle, au premier rang, fier',
      'Parce que la musique se transmet comme la lumière',
    ],
    hook: ['De père en fils, de main en main', 'Le même beat, le même chemin', 'De père en fils, ce soir, demain', 'On garde le rythme jusqu’à la fin'],
  },
  {
    id: 'old-school-95',
    title: 'Old school 95',
    tempo: 94,
    level: 3,
    lang: 'fr',
    chords: ['Gm', 'Eb', 'Bb', 'F'],
    verse: [
      'Retour en quatre-vingt-quinze, casquette à l’envers',
      'Baskets blanches, walkman, cassette et pull over',
      'Je kicke sur un beat qui sent le vinyle et la poussière',
      'Les anciens hochent la tête, ils reconnaissent la manière',
      'Pas besoin d’autotune, juste ma voix et le groove',
      'Chaque mesure est carrée, chaque phrase est une preuve',
      'Le scratch du DJ répond à mes rimes en écho',
      'On fait bouger la salle sans jamais parler trop',
    ],
    hook: ['Old school, la boucle tourne', 'Old school, la tête tourne', 'Old school, jamais je me détourne', 'Old school, le vinyle tourne'],
  },
  {
    id: 'tic-tac',
    title: 'Tic tac (le métronome)',
    tempo: 96,
    level: 1,
    lang: 'fr',
    chords: ['Am', 'Dm', 'E', 'Am'],
    verse: [
      'Tic tac, le métronome me regarde de travers',
      'Il dit que je suis en retard, moi je dis qu’il est trop fier',
      'Je ralentis le tempo, je prends mon temps, je respire',
      'Chaque mesure bien posée, c’est un pas vers le plaisir',
      'Mon violon fait la tête, ma guitare fait la fête',
      'La flûte dans le tiroir me dit : arrête, fais pas la bête',
      'Je travaille mes gammes, je grimpe les arpèges',
      'Et bientôt sur la scène, je brise tous les pièges',
    ],
    hook: ['Tic tac, garde le tempo', 'Tic tac, pas trop vite, pas trop tôt', 'Tic tac, on reste dans le flow', 'Tic tac, et le son devient beau'],
  },
  {
    id: 'petit-frere',
    title: 'Petit frère',
    tempo: 86,
    level: 2,
    lang: 'fr',
    chords: ['Cm', 'Ab', 'Eb', 'Bb'],
    verse: [
      'Petit frère, écoute bien ce que je vais te dire',
      'L’école c’est une arme, apprends à lire et à écrire',
      'Les vrais héros du quartier se lèvent tôt le matin',
      'Ils bossent en silence et ils tendent la main',
      'Ne crois pas les écrans qui te vendent du vent',
      'Le succès c’est du travail, de la sueur et du temps',
      'Si tu tombes, je suis là, je te relève en premier',
      'On est forts ensemble, c’est ça notre métier',
    ],
    hook: ['Petit frère, lève la tête', 'Petit frère, la vie c’est pas une fête', 'Petit frère, mais garde tes rêves', 'Petit frère, demain le jour se lève'],
  },
  {
    id: 'morning-grind',
    title: 'Morning Grind',
    tempo: 90,
    level: 2,
    lang: 'en',
    chords: ['Am', 'F', 'C', 'G'],
    verse: [
      'Wake up early, put the coffee on the stove',
      'Grab my notebook and my pen, that is all I need to go',
      'Every line I write is a brick upon the wall',
      'Every beat I ride is a reason not to fall',
      'They told me it was hard, I said I like it that way',
      'Practice every single night, get better every day',
      'From the corner to the stage I am climbing every stair',
      'With my family behind me I can feel them everywhere',
    ],
    hook: ['Morning grind, I am on my way', 'Morning grind, another brand new day', 'Morning grind, nothing in my way', 'Morning grind, music every day'],
  },
  {
    id: 'keep-the-beat',
    title: 'Keep the Beat',
    tempo: 96,
    level: 2,
    lang: 'en',
    chords: ['Dm', 'Bb', 'C', 'Am'],
    verse: [
      'Keep the beat, keep it steady, keep it locked in the pocket',
      'When the drums start knocking I am flying like a rocket',
      'Count it one, two, three, four, let the rhythm take control',
      'Every word is like a drum hitting deep into the soul',
      'Hands up in the air if you feel it in your chest',
      'Nodding with the bass line, putting music to the test',
      'Never rushing, never dragging, every syllable in place',
      'Keep the beat and keep a smile upon your face',
    ],
    hook: ['Keep the beat, don’t stop', 'Keep the beat, from the bottom to the top', 'Keep the beat, let it drop', 'Keep the beat, hip hop'],
  },
];

export const RAP_ORIGINALS: Song[] = DEFS.map(build);

/** Style rap : le chant est jugé sur le placement (le flow), pas sur la justesse. */
export const isRap = (style: string): boolean => style === 'Rap français' || style === 'Rap US' || style === 'Raps originaux';
