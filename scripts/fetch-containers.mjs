// Builds public/data/containers.json: real container locations for Málaga.
//   - glass, clothes, cooking oil, batteries: Ayuntamiento de Málaga open data (CC BY 4.0)
//   - yellow, blue, grey, brown, clean points, pharmacies: OpenStreetMap (ODbL), via Overpass
// Run: npm run data:containers
import fs from 'node:fs/promises';

const BBOX = [36.66, -4.56, 36.79, -4.33]; // south, west, north, east
const UA = 'TiraBien/0.1 (student hackathon project; github.com/tapaderuza)';
const OPEN = 'https://datosabiertos.malaga.eu/recursos/ambiente/';
const OPEN_FILES = {
  green: 'contenedores/da_amb_contenedoresvidrio-4326.geojson',
  textile: 'contenedores/da_medioAmbiente_contenedoresRopa-4326.geojson',
  oil: 'contenedores/da_medioAmbiente_contenedoresAceite-4326.geojson',
  battery: 'contenedores/da_medioAmbiente_contenedoresPilas-4326.geojson',
};
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

const round = (n) => Math.round(n * 1e5) / 1e5;
const inBox = (lat, lon) => lat >= BBOX[0] && lat <= BBOX[2] && lon >= BBOX[1] && lon <= BBOX[3];

function dedupe(points) {
  const seen = new Set();
  return points.filter(([a, b]) => {
    const k = `${round(a)},${round(b)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function openData(file) {
  const res = await fetch(OPEN + file, { headers: { 'User-Agent': UA } });
  const text = await res.text();
  if (!text.startsWith('{')) throw new Error(`${file}: not GeoJSON (${text.slice(0, 80)})`);
  const out = [];
  for (const f of JSON.parse(text).features) {
    if (f.geometry?.type !== 'Point') continue;
    const [lon, lat] = f.geometry.coordinates;
    if (inBox(lat, lon)) out.push([round(lat), round(lon)]);
  }
  return dedupe(out);
}

async function overpass(query) {
  let wait = 4000;
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = OVERPASS[attempt % OVERPASS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      });
      const text = await res.text();
      if (res.ok && text.startsWith('{')) return JSON.parse(text).elements;
      console.warn(`Overpass ${res.status}, retrying in ${wait / 1000}s`);
    } catch (e) {
      console.warn(`Overpass error ${e.message}, retrying in ${wait / 1000}s`);
    }
    await new Promise((r) => setTimeout(r, wait));
    wait *= 2;
  }
  throw new Error('Overpass unavailable');
}

const has = (t, ...keys) => keys.some((k) => t[k] === 'yes');
const centre = (e) => [e.lat ?? e.center?.lat, e.lon ?? e.center?.lon];

async function main() {
  const streams = {};
  const places = {};

  for (const [stream, file] of Object.entries(OPEN_FILES)) {
    streams[stream] = await openData(file);
    console.log(stream, streams[stream].length, '(Málaga open data)');
  }

  const bb = `[bbox:${BBOX.join(',')}]`;
  const els = await overpass(
    `[out:json][timeout:90]${bb};(
      node["amenity"="recycling"];
      nwr["amenity"="recycling"]["recycling_type"="centre"];
      node["amenity"="waste_disposal"];
      node["amenity"="pharmacy"];
    );out center tags;`,
  );

  const buckets = { yellow: [], blue: [], grey: [], brown: [], clean_point: [], pharmacy: [] };
  const named = [];
  for (const e of els) {
    const t = e.tags ?? {};
    const [lat, lon] = centre(e);
    if (lat == null || !inBox(lat, lon)) continue;
    const p = [round(lat), round(lon)];
    if (t.amenity === 'pharmacy') buckets.pharmacy.push(p);
    else if (t.amenity === 'waste_disposal') buckets.grey.push(p);
    else if (t.amenity === 'recycling') {
      if (t.recycling_type === 'centre') {
        buckets.clean_point.push(p);
        named.push({ name: t.name ?? 'Punto limpio', lat: p[0], lon: p[1] });
        continue;
      }
      if (has(t, 'recycling:plastic_packaging', 'recycling:cans', 'recycling:plastic_bottles', 'recycling:plastic')) buckets.yellow.push(p);
      if (has(t, 'recycling:paper', 'recycling:cardboard', 'recycling:paper_packaging', 'recycling:newspaper')) buckets.blue.push(p);
      if (has(t, 'recycling:organic', 'recycling:food_waste')) buckets.brown.push(p);
    }
  }
  for (const [s, pts] of Object.entries(buckets)) {
    streams[s] = dedupe(pts);
    console.log(s, streams[s].length, '(OpenStreetMap)');
  }
  places.clean_point = named;

  const out = {
    generated: new Date().toISOString().slice(0, 10),
    source:
      'Ayuntamiento de Málaga open data (glass, clothes, oil, batteries) and OpenStreetMap contributors (everything else)',
    license: 'CC BY 4.0 (Ayuntamiento de Málaga) and ODbL 1.0 (OpenStreetMap)',
    bbox: BBOX,
    streams,
    places,
  };
  await fs.mkdir('public/data', { recursive: true });
  await fs.writeFile('public/data/containers.json', JSON.stringify(out));
  const total = Object.values(streams).reduce((s, a) => s + a.length, 0);
  console.log(`wrote public/data/containers.json: ${total} points`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
