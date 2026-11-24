import type { Lang, Text } from './types';

const STRINGS = {
  tagline: { es: '¿A qué contenedor va? Foto o texto, y el más cercano de Málaga.', en: 'Which bin does it go in? Photo or text, plus the nearest one in Málaga.' },
  searchPlaceholder: { es: 'Escribe un objeto: brik, pila, servilleta…', en: 'Type an item: carton, battery, napkin…' },
  takePhoto: { es: 'Hacer o elegir una foto', en: 'Take or choose a photo' },
  privacy: {
    es: 'La IA se ejecuta en tu dispositivo. Tu foto no se sube a ningún servidor.',
    en: 'The AI runs on your device. Your photo is never uploaded.',
  },
  loadingModel: { es: 'Descargando el modelo de IA (una sola vez, ~100 MB)…', en: 'Downloading the AI model (one time, ~100 MB)…' },
  analysing: { es: 'Analizando la foto…', en: 'Analysing the photo…' },
  modelError: { es: 'No se pudo cargar la IA. Puedes buscar escribiendo.', en: 'The AI could not load. You can still search by typing.' },
  confident: { es: 'Lo tengo claro', en: 'Confident' },
  likely: { es: 'Probablemente. Confírmalo:', en: 'Probably. Please confirm:' },
  unsure: { es: 'No estoy seguro. ¿Es alguno de estos?', en: 'Not sure. Is it one of these?' },
  notWaste: { es: 'Eso no parece un residuo. Prueba con otra foto o escribe el objeto.', en: 'That does not look like waste. Try another photo or type the item.' },
  noMatch: { es: 'No encuentro ese objeto. Prueba con otra palabra o con una foto.', en: 'I cannot find that item. Try another word or a photo.' },
  goesIn: { es: 'Va en', en: 'Goes in' },
  mistake: { es: 'Error habitual', en: 'Common mistake' },
  changing: { es: 'Norma en cambio', en: 'Rule is changing' },
  ifThen: { es: 'Alternativa', en: 'Alternative' },
  nearest: { es: 'Más cercano', en: 'Nearest' },
  walk: { es: 'min andando', en: 'min walk' },
  useLocation: { es: 'Usar mi ubicación', en: 'Use my location' },
  locationOff: { es: 'Calculando desde la plaza de la Constitución.', en: 'Measuring from Plaza de la Constitución.' },
  locationOn: { es: 'Calculando desde tu ubicación (no se envía a ningún sitio).', en: 'Measuring from your location (never sent anywhere).' },
  locationDenied: { es: 'No hay permiso de ubicación. Seguimos desde el centro.', en: 'Location permission denied. Staying with the centre.' },
  outside: { es: 'Estás fuera de Málaga: los datos solo cubren la capital.', en: 'You are outside Málaga: the data only covers the city.' },
  noMap: {
    es: 'No hay datos abiertos de este tipo de contenedor. Consulta la web de Limasam.',
    en: 'There is no open data for this container type. Check the Limasam website.',
  },
  sources: { es: 'Fuentes de la regla', en: 'Rule sources' },
  lookFor: { es: 'Cómo reconocerlo', en: 'How to spot it' },
  tryThese: { es: 'Prueba con', en: 'Try' },
  trySample: { es: 'Probar con foto de ejemplo', en: 'Try a sample photo' },
  disclaimer: {
    es: 'Las reglas están escritas a mano a partir de guías oficiales de Limasam, Ecoembes y Ecovidrio. La IA solo reconoce el objeto; nunca decide el contenedor. Ante la duda, pregunta a Limasam.',
    en: 'Rules are hand-written from official Limasam, Ecoembes and Ecovidrio guides. The AI only recognises the object; it never decides the bin. When in doubt, ask Limasam.',
  },
  data: {
    es: 'Contenedores: Ayuntamiento de Málaga (datos abiertos, CC BY 4.0) y colaboradores de OpenStreetMap (ODbL).',
    en: 'Containers: Ayuntamiento de Málaga open data (CC BY 4.0) and OpenStreetMap contributors (ODbL).',
  },
  bins: { es: 'Los cinco contenedores de calle', en: 'The five street bins' },
  wrong: { es: '¿Respuesta incorrecta?', en: 'Wrong answer?' },
  wrongAsk: { es: '¿Qué era en realidad? Se guarda solo en este móvil; no se envía nada.', en: 'What was it really? Saved on this phone only; nothing is sent.' },
  wrongNone: { es: 'No está en la lista', en: 'Not in the list' },
  wrongSaved: { es: 'Gracias. Guardado solo en este móvil.', en: 'Thanks. Saved on this phone only.' },
  wrongCopy: { es: 'Copiar mis informes para enviarlos', en: 'Copy my reports to send them' },
  wrongCopied: { es: 'Copiado. Pégalo en un correo si quieres compartirlo.', en: 'Copied. Paste it into an email if you want to share it.' },
  offlineMap: {
    es: 'Sin conexión: el mapa necesita internet. La lista de contenedores de arriba sí está al día.',
    en: 'Offline: the map needs a connection. The container list above is up to date.',
  },
} satisfies Record<string, Text>;

export type Key = keyof typeof STRINGS;

export function tr(key: Key, lang: Lang): string {
  return STRINGS[key][lang];
}

/** Sample photos in public/samples (credits in public/samples/CREDITS.md): common Spanish sorting traps. */
export const SAMPLES: { file: string; label: Text }[] = [
  { file: 'brik', label: { es: 'Brik de leche', en: 'Milk carton' } },
  { file: 'receipt', label: { es: 'Ticket térmico', en: 'Till receipt' } },
  { file: 'glass', label: { es: 'Vaso de cristal', en: 'Drinking glass' } },
  { file: 'capsule', label: { es: 'Cápsula de café', en: 'Coffee capsule' } },
];

export const QUICK: { query: string; label: Text }[] = [
  { query: 'brik', label: { es: 'brik', en: 'carton' } },
  { query: 'servilleta', label: { es: 'servilleta', en: 'napkin' } },
  { query: 'pilas', label: { es: 'pilas', en: 'batteries' } },
  { query: 'vaso de cristal', label: { es: 'vaso de cristal', en: 'drinking glass' } },
  { query: 'cápsula de café', label: { es: 'cápsula de café', en: 'coffee capsule' } },
  { query: 'tapón', label: { es: 'tapones', en: 'caps' } },
];
