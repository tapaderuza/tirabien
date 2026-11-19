// Measures the on-device classifier against real photos (eval/images, see fetch-eval-images.mjs).
// Reports item accuracy, bin accuracy, and how often a *confident* answer is wrong.
// Run: npm run eval   -> prints a summary and writes eval/RESULTS.md
import fs from 'node:fs/promises';
import { AutoProcessor, SiglipVisionModel, RawImage, env } from '@huggingface/transformers';
import { decodeBank, rank, decide, DEFAULT_THRESHOLDS } from '../src/classify.ts';
import { itemById, itemStream } from '../src/catalog.ts';

env.cacheDir = '.cache/hf';
const MODEL = 'Xenova/siglip-base-patch16-224';
const DTYPE = process.env.DTYPE ?? 'q8';

const bank = decodeBank(JSON.parse(await fs.readFile('public/data/embeddings.json', 'utf8')));
const processor = await AutoProcessor.from_pretrained(MODEL);
const vision = await SiglipVisionModel.from_pretrained(MODEL, { dtype: DTYPE });
// EVAL_DIR=eval/phone EVAL_OUT=eval/RESULTS-phone.md npm run eval  -> your own phone photos,
// one folder per catalog item id (eval/phone/battery/1.jpg ...). Default: the Commons set.
const DIR = process.env.EVAL_DIR ?? 'eval/images';
const OUT = process.env.EVAL_OUT ?? 'eval/RESULTS.md';
const OWN = !!process.env.EVAL_DIR;
let manifest;
if (OWN) {
  manifest = {};
  for (const d of await fs.readdir(DIR, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const files = (await fs.readdir(`${DIR}/${d.name}`)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    if (!itemById(d.name)) console.warn(`skipping folder "${d.name}": not a catalog item id`);
    else if (files.length) manifest[d.name] = files.map((file) => ({ file, title: file }));
  }
} else {
  manifest = JSON.parse(await fs.readFile(`${DIR}/manifest.json`, 'utf8'));
}

const excluded = OWN ? [] : JSON.parse(await fs.readFile('eval/excluded.json', 'utf8'));
let skipped = 0;
const rows = [];
const t0 = Date.now();
for (const [id, files] of Object.entries(manifest)) {
  for (const f of files) {
    if (excluded.some((e) => f.title.includes(e.match))) {
      skipped++;
      continue;
    }
    const img = await RawImage.read(`${DIR}/${id}/${f.file}`);
    const { pooler_output } = await vision(await processor(img));
    const ranked = rank(bank, Array.from(pooler_output.data));
    rows.push({ truth: id, stream: itemStream(id), ranked, title: f.title });
  }
}
const msPerImage = (Date.now() - t0) / rows.length;

function score(th) {
  let n = 0, itemTop1 = 0, itemTop3 = 0, streamOk = 0;
  const v = { confident: [0, 0], likely: [0, 0], unsure: [0, 0], not_waste: [0, 0] }; // [total, correct bin]
  for (const r of rows) {
    const d = decide(r.ranked, itemStream, th);
    n++;
    const items = r.ranked.filter((x) => x.kind === 'item');
    if (items[0].id === r.truth) itemTop1++;
    if (items.slice(0, 3).some((x) => x.id === r.truth)) itemTop3++;
    const ok = d.stream === r.stream;
    if (ok) streamOk++;
    v[d.verdict][0]++;
    if (ok) v[d.verdict][1]++;
  }
  return { n, itemTop1, itemTop3, streamOk, v };
}

const base = score(DEFAULT_THRESHOLDS);
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '–');

// Per-item table
const per = {};
for (const r of rows) {
  const d = decide(r.ranked, itemStream, DEFAULT_THRESHOLDS);
  const p = (per[r.truth] ??= { n: 0, item: 0, stream: 0 });
  p.n++;
  if (r.ranked.find((x) => x.kind === 'item').id === r.truth) p.item++;
  if (d.stream === r.stream) p.stream++;
}

// Threshold sweep: precision of confident answers vs how many photos get one.
const sweep = [];
for (const cs of [0.6, 0.7, 0.8, 0.9]) {
  for (const ci of [0.3, 0.45, 0.6]) {
    const s = score({ ...DEFAULT_THRESHOLDS, confidentStream: cs, confidentItem: ci });
    sweep.push({ cs, ci, cov: s.v.confident[0], ok: s.v.confident[1] });
  }
}

const wrongConfident = rows
  .map((r) => ({ r, d: decide(r.ranked, itemStream, DEFAULT_THRESHOLDS) }))
  .filter(({ r, d }) => d.verdict === 'confident' && d.stream !== r.stream)
  .map(({ r, d }) => `${r.truth} (${r.stream}) → ${d.itemId} (${d.stream}) [${r.title}]`);

const md = `# Vision evaluation

Model: \`${MODEL}\` (${DTYPE}), vision tower in ONNX, labels embedded offline. ${base.n} real photos of ${Object.keys(per).length} catalog items ${OWN ? 'photographed by the author with a phone, none removed after seeing the result' : `from Wikimedia Commons search results (not hand-picked; ${skipped} photos that plainly did not show the item were removed, each listed with its reason in eval/excluded.json)`}. Speed: ${msPerImage.toFixed(0)} ms/image on a laptop CPU (Node, not WebGPU).

| Metric | Result |
| --- | --- |
| Exact item, top-1 | ${base.itemTop1}/${base.n} (${pct(base.itemTop1, base.n)}) |
| Exact item, in top-3 | ${base.itemTop3}/${base.n} (${pct(base.itemTop3, base.n)}) |
| **Correct bin**, answer returned for every photo | ${base.streamOk}/${base.n} (${pct(base.streamOk, base.n)}) |
| Photos answered *confidently* | ${base.v.confident[0]}/${base.n} (${pct(base.v.confident[0], base.n)}) |
| **Correct bin when confident** | ${base.v.confident[1]}/${base.v.confident[0]} (${pct(base.v.confident[1], base.v.confident[0])}) |
| "Likely" (asks to confirm) | ${base.v.likely[0]}, correct bin ${pct(base.v.likely[1], base.v.likely[0])} |
| "Unsure" (asks the user to pick) | ${base.v.unsure[0]}, correct bin ${pct(base.v.unsure[1], base.v.unsure[0])} |

The app never hides uncertainty: below the confident threshold it shows the top candidates and asks.

## Wrong but confident
${wrongConfident.length ? wrongConfident.map((x) => '- ' + x).join('\n') : '(none)'}

## Threshold sweep (confident answers)
| stream ≥ | item ≥ | confident | precision |
| --- | --- | --- | --- |
${sweep.map((s) => `| ${s.cs} | ${s.ci} | ${s.cov} | ${pct(s.ok, s.cov)} |`).join('\n')}

## Per item
| Item | Photos | Item top-1 | Bin correct |
| --- | --- | --- | --- |
${Object.entries(per).map(([id, p]) => `| ${itemById(id)?.name.en ?? id} | ${p.n} | ${p.item} | ${p.stream} |`).join('\n')}
`;
await fs.writeFile(OUT, md);
console.log(md.split('\n').slice(0, 16).join('\n'));
