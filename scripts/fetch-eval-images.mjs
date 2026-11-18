// Downloads a small evaluation set of real photos from Wikimedia Commons.
// Images stay local (eval/images is git-ignored); only the accuracy report is published.
// Run: node scripts/fetch-eval-images.mjs
import fs from 'node:fs/promises';

const UA = 'TiraBien-eval/0.1 (student hackathon project; evaluation only)';
const PER_ITEM = 8;
// catalog item id -> Commons search phrase
const QUERIES = {
  plastic_bottle: 'plastic water bottle',
  drink_can: 'aluminium beverage can',
  food_can: 'tin can food',
  drink_carton: 'milk carton',
  plastic_bag: 'plastic shopping bag',
  yogurt_cup: 'yogurt cup plastic',
  aluminium_foil: 'aluminium foil',
  aerosol_can: 'aerosol spray can',
  detergent_bottle: 'detergent bottle',
  cardboard_box: 'cardboard box',
  newspaper: 'newspaper pile',
  egg_carton: 'egg carton',
  pizza_box: 'pizza box',
  paper_bag: 'paper bag',
  glass_bottle: 'glass bottle empty',
  glass_jar: 'glass jar empty',
  drinking_glass: 'drinking glass tumbler',
  ceramic: 'ceramic plate',
  light_bulb: 'light bulb',
  fruit_peel: 'banana peel',
  eggshells: 'eggshells',
  coffee_grounds: 'coffee grounds',
  diaper: 'disposable diaper',
  cigarette_butt: 'cigarette butts',
  toothbrush: 'toothbrush',
  clothes: 'folded clothes',
  shoes: 'pair of shoes',
  cooking_oil: 'cooking oil bottle',
  battery: 'AA batteries',
  phone: 'smartphone',
  cables: 'electric cables',
  paint: 'paint can',
  medicine: 'blister pack pills',
  furniture: 'old sofa',
  coffee_capsule: 'coffee capsules',
  plastic_toy: 'plastic toy',
  napkin: 'paper napkin',
  plastic_container: 'tupperware plastic container',
  mirror: 'mirror',
  small_appliance: 'toaster',
};

async function commons(q) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=30&gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=448`;
  for (let i = 0; i < 4; i++) {
    const res = await fetch(u, { headers: { 'User-Agent': UA } });
    if (res.ok) return Object.values((await res.json()).query?.pages ?? {});
    await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
  }
  return [];
}

await fs.mkdir('eval/images', { recursive: true });
const manifest = {};
for (const [id, q] of Object.entries(QUERIES)) {
  const pages = (await commons(q))
    .filter((p) => /jpeg|png/.test(p.imageinfo?.[0]?.mime ?? '') && (p.imageinfo[0].width ?? 0) >= 300)
    .sort((a, b) => a.index - b.index);
  await fs.mkdir(`eval/images/${id}`, { recursive: true });
  let n = 0;
  for (const p of pages) {
    if (n >= PER_ITEM) break;
    try {
      const res = await fetch(p.imageinfo[0].thumburl, { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      await fs.writeFile(`eval/images/${id}/${n}.jpg`, Buffer.from(await res.arrayBuffer()));
      (manifest[id] ??= []).push({ file: `${n}.jpg`, title: p.title });
      n++;
      await new Promise((r) => setTimeout(r, 400));
    } catch {
      /* skip */
    }
  }
  console.log(id.padEnd(18), n);
}
await fs.writeFile('eval/images/manifest.json', JSON.stringify(manifest, null, 1));
