import type { Stream, StreamId } from './types';

/** Disposal routes in Málaga, in the order the legend shows them. */
export const STREAMS: Stream[] = [
  {
    id: 'yellow',
    name: { es: 'Contenedor amarillo — envases', en: 'Yellow bin — packaging' },
    short: { es: 'Amarillo', en: 'Yellow' },
    color: '#F6C600',
    ink: '#1B1B1B',
    accepts: {
      es: 'Envases de plástico, latas y briks. Solo envases: un objeto de plástico que no es envase no va aquí.',
      en: 'Plastic packaging, cans and drink cartons. Packaging only: a plastic object that is not packaging does not go here.',
    },
    lookFor: { es: 'Contenedor amarillo o con tapa amarilla.', en: 'Yellow container, or one with a yellow lid.' },
    sources: ['ecoembes', 'limasam'],
  },
  {
    id: 'blue',
    name: { es: 'Contenedor azul — papel y cartón', en: 'Blue bin — paper and cardboard' },
    short: { es: 'Azul', en: 'Blue' },
    color: '#1F6FD6',
    ink: '#FFFFFF',
    accepts: {
      es: 'Papel y cartón limpios: cajas plegadas, periódicos, folios, hueveras de cartón.',
      en: 'Clean paper and cardboard: flattened boxes, newspapers, office paper, cardboard egg boxes.',
    },
    lookFor: { es: 'Contenedor azul o con tapa azul.', en: 'Blue container, or one with a blue lid.' },
    sources: ['ecoembes', 'limasam'],
  },
  {
    id: 'green',
    name: { es: 'Iglú verde — vidrio', en: 'Green igloo — glass' },
    short: { es: 'Vidrio', en: 'Glass' },
    color: '#2E9B47',
    ink: '#FFFFFF',
    accepts: {
      es: 'Botellas, tarros y frascos de vidrio, sin tapas. Vasos, espejos y cerámica no.',
      en: 'Glass bottles, jars and flasks, without lids. Not drinking glasses, mirrors or ceramics.',
    },
    lookFor: { es: 'Iglú o contenedor verde con agujeros redondos.', en: 'Green igloo or container with round openings.' },
    sources: ['ecovidrio', 'limasam'],
  },
  {
    id: 'brown',
    name: { es: 'Contenedor marrón — orgánica', en: 'Brown bin — food and organic waste' },
    short: { es: 'Marrón', en: 'Brown' },
    color: '#8A5A2B',
    ink: '#FFFFFF',
    accepts: {
      es: 'Restos de comida, cáscaras, posos de café, servilletas usadas y pequeños restos de plantas.',
      en: 'Food leftovers, peels, coffee grounds, used napkins and small plant trimmings.',
    },
    lookFor: { es: 'Contenedor con tapa marrón, junto al gris.', en: 'Container with a brown lid, usually next to the grey one.' },
    sources: ['limasam-organica', 'ley-7-2022'],
  },
  {
    id: 'grey',
    name: { es: 'Contenedor gris — resto', en: 'Grey bin — general waste' },
    short: { es: 'Gris', en: 'Grey' },
    color: '#5F6670',
    ink: '#FFFFFF',
    accepts: {
      es: 'Lo que no se recicla en ningún otro: pañales, colillas, toallitas, cerámica rota pequeña.',
      en: 'What no other stream takes: diapers, cigarette butts, wet wipes, small broken ceramics.',
    },
    lookFor: { es: 'Contenedor gris (o verde oscuro) sin tapa de color.', en: 'Grey (or dark green) container without a coloured lid.' },
    sources: ['limasam'],
  },
  {
    id: 'textile',
    name: { es: 'Contenedor de ropa y calzado', en: 'Clothes and shoes container' },
    short: { es: 'Ropa', en: 'Clothes' },
    color: '#6D4BC2',
    ink: '#FFFFFF',
    accepts: {
      es: 'Ropa, calzado y textil del hogar, limpios y en bolsa cerrada.',
      en: 'Clothes, shoes and household textiles, clean and in a closed bag.',
    },
    lookFor: { es: 'Contenedor cerrado con buzón, a menudo de una ONG.', en: 'Closed container with a chute, often run by a charity.' },
    sources: ['limasam', 'ley-7-2022'],
  },
  {
    id: 'oil',
    name: { es: 'Contenedor de aceite usado', en: 'Used cooking oil container' },
    short: { es: 'Aceite', en: 'Oil' },
    color: '#E07B00',
    ink: '#1B1B1B',
    accepts: {
      es: 'Aceite de cocina usado, frío y en una botella de plástico cerrada.',
      en: 'Used cooking oil, cooled and in a closed plastic bottle.',
    },
    lookFor: { es: 'Contenedor pequeño con boca para botellas.', en: 'Small container with an opening for bottles.' },
    sources: ['limasam'],
  },
  {
    id: 'battery',
    name: { es: 'Contenedor de pilas', en: 'Battery drop-off' },
    short: { es: 'Pilas', en: 'Batteries' },
    color: '#C62E2E',
    ink: '#FFFFFF',
    accepts: {
      es: 'Pilas y baterías pequeñas. También se recogen en tiendas que las venden.',
      en: 'Batteries and small rechargeable cells. Shops that sell them also take them back.',
    },
    lookFor: { es: 'Columna o caja de pilas en la calle o en tiendas.', en: 'Battery column on the street or a box in shops.' },
    sources: ['limasam', 'ley-7-2022'],
  },
  {
    id: 'clean_point',
    name: { es: 'Punto limpio', en: 'Clean point (recycling centre)' },
    short: { es: 'Punto limpio', en: 'Clean point' },
    color: '#0F766E',
    ink: '#FFFFFF',
    accepts: {
      es: 'Aparatos eléctricos, bombillas, pintura, espejos, muebles y residuos peligrosos.',
      en: 'Electrical devices, light bulbs, paint, mirrors, furniture and hazardous waste.',
    },
    lookFor: { es: 'Puntos limpios de Limasam y puntos de proximidad.', en: 'Limasam recycling centres and neighbourhood drop-off points.' },
    sources: ['limasam', 'ley-7-2022'],
  },
  {
    id: 'pharmacy',
    name: { es: 'Punto SIGRE en farmacias', en: 'SIGRE point at pharmacies' },
    short: { es: 'Farmacia', en: 'Pharmacy' },
    color: '#0E7A3E',
    ink: '#FFFFFF',
    accepts: {
      es: 'Medicamentos caducados o sobrantes, con su caja y blíster.',
      en: 'Expired or leftover medicines, with their box and blister pack.',
    },
    lookFor: { es: 'Contenedor blanco SIGRE dentro de la farmacia.', en: 'White SIGRE container inside the pharmacy.' },
    sources: ['sigre'],
  },
];

const BY_ID = new Map<StreamId, Stream>(STREAMS.map((s) => [s.id, s]));

export function streamById(id: StreamId): Stream {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`Unknown stream ${id}`);
  return s;
}

/** The five street bins, for the "Spain's bins at a glance" legend. */
export const STREET_BINS: StreamId[] = ['yellow', 'blue', 'green', 'brown', 'grey'];
