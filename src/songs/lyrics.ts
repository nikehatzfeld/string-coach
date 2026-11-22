/**
 * Paroles du domaine public (chansons traditionnelles et comptines), une syllabe par note.
 * Les tirets relient les syllabes d'un même mot. Chaque texte est vérifié par un test :
 * autant de syllabes que de notes dans la mélodie du morceau.
 */
export const LYRICS: Record<string, string> = {
  'frere-jacques':
    'Frè- re Ja- cques, Frè- re Ja- cques, dor- mez- vous ? dor- mez- vous ? Son- nez les ma- ti- nes, son- nez les ma- ti- nes, ding, daing, dong ! ding, daing, dong !',
  'au-clair-de-la-lune':
    "Au clair de la lu- ne, mon a- mi Pier- rot, prê- te- moi ta plu- me pour é- crire un mot. Ma chan- delle est mor- te, je n'ai plus de feu ; ou- vre- moi ta por- te pour l'a- mour de Dieu.",
  'ah-vous-dirai-je':
    "Ah ! vous di- rai- je, ma- man, ce qui cau- se mon tour- ment ? Pa- pa veut que je rai- sonne com- m'u- ne gran- de per- sonne ; moi je dis que les bon- bons va- lent mieux que la rai- son.",
  alouette:
    'A- lou- et- te, gen- tille a- lou- et- te, a- lou- et- te, je te plu- me- rai. A- lou- et- te, gen- tille a- lou- et- te, a- lou- et- te, je te plu- me- rai.',
  'jingle-bells':
    'Jin- gle bells, jin- gle bells, jin- gle all the way. Oh what fun it is to ride in a one- horse o- pen sleigh, hey! Jin- gle bells, jin- gle bells, jin- gle all the way. Oh what fun it is to ride in a one- horse o- pen sleigh.',
  'mary-had-a-little-lamb':
    'Ma- ry had a lit- tle lamb, lit- tle lamb, lit- tle lamb, Ma- ry had a lit- tle lamb, its fleece was white as snow.',
  'row-row-row': 'Row, row, row your boat, gent- ly down the stream. Mer- ri- ly, mer- ri- ly, mer- ri- ly, mer- ri- ly, life is but a dream.',
  'london-bridge': 'Lon- don Bridge is fall- ing down, fall- ing down, fall- ing down. Lon- don Bridge is fall- ing down, my fair la- dy.',
  'hot-cross-buns': 'Hot cross buns, hot cross buns, one a pen- ny, two a pen- ny, hot cross buns.',
  'we-wish-you':
    'We wish you a mer- ry Christ- mas, we wish you a mer- ry Christ- mas, we wish you a mer- ry Christ- mas and a hap- py new year.',
  'mon-beau-sapin': "Mon beau sa- pin, roi des fo- rêts, que j'ai- me ta ver- dure !",
  'old-macdonald': 'Old Mac- Don- ald had a farm, E- I- E- I- O, and on that farm he had a cow, E- I- E- I- O.',
};

/** Syllabes (une par note) au format des paroles alphaTex. */
export function lyricSyllables(text: string): string[] {
  return text
    .split(/\s+/)
    .filter((w) => w && !/^[,.;:!?]+$/.test(w))
    .map((w) => w.replace(/-$/, '-'));
}
