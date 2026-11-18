// Precomputes SigLIP text embeddings for every catalog label so the browser
// only downloads the vision tower. Also fits the model's logit scale and bias
// (SigLIP logit = scale * cosine + bias) from its own outputs.
// Run: npm run data:embeddings   (downloads ~330 MB of ONNX weights once into .cache/)
import fs from 'node:fs/promises';
import { AutoTokenizer, AutoProcessor, SiglipModel, SiglipTextModel, RawImage, env } from '@huggingface/transformers';
import { ITEMS, NOT_WASTE } from '../src/catalog.ts';

const MODEL = 'Xenova/siglip-base-patch16-224';
env.cacheDir = '.cache/hf';

const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
const textModel = await SiglipTextModel.from_pretrained(MODEL, { dtype: 'q8' });

function norm(v) {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

async function embedTexts(texts) {
  const inputs = tokenizer(texts, { padding: 'max_length', truncation: true, max_length: 64 });
  const { pooler_output } = await textModel(inputs);
  const dim = pooler_output.dims[1];
  return texts.map((_, i) => norm(Array.from(pooler_output.data.slice(i * dim, (i + 1) * dim))));
}

const labels = [];
const vectors = [];
const groups = [
  ...ITEMS.filter((i) => i.prompts.length).map((i) => ({ id: i.id, kind: 'item', prompts: i.prompts })),
  ...NOT_WASTE.map((i) => ({ id: i.id, kind: 'not_waste', prompts: i.prompts })),
];
// TEMPLATE=photo wraps each description as "a photo of <description>".
const wrap = (p) => (process.env.TEMPLATE === 'photo' ? `a photo of ${p.replace(/^an? /, '')}` : p);
for (const g of groups) {
  const embs = await embedTexts(g.prompts.map(wrap));
  const mean = embs[0].map((_, d) => embs.reduce((s, e) => s + e[d], 0) / embs.length);
  labels.push({ id: g.id, kind: g.kind });
  vectors.push(norm(mean));
}
const dim = vectors[0].length;
console.log(`${labels.length} labels, dim ${dim}`);

// Fit scale/bias with the full model on a few synthetic pairs: logits = s*cos + b.
const full = await SiglipModel.from_pretrained(MODEL, { dtype: 'q8' });
const processor = await AutoProcessor.from_pretrained(MODEL);
const probeTexts = ['a photo of a cat', 'a photo of a plastic bottle', 'a photo of a banana peel', 'a photo of a car', 'a photo of a glass jar'];
const probeImages = await Promise.all(
  [
    'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/football-match.jpg',
    'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/tiger.jpg',
    'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cats.jpg',
  ].map((u) => RawImage.read(u)),
);
const xs = [];
const ys = [];
for (const img of probeImages) {
  const out = await full({ ...tokenizer(probeTexts, { padding: 'max_length', truncation: true, max_length: 64 }), ...(await processor(img)) });
  const ie = norm(Array.from(out.image_embeds.data));
  const te = out.text_embeds;
  const d = te.dims[1];
  probeTexts.forEach((_, i) => {
    const t = norm(Array.from(te.data.slice(i * d, (i + 1) * d)));
    xs.push(ie.reduce((s, v, k) => s + v * t[k], 0));
    ys.push(out.logits_per_image.data[i]);
  });
}
const n = xs.length;
const mx = xs.reduce((a, b) => a + b, 0) / n;
const my = ys.reduce((a, b) => a + b, 0) / n;
const scale = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
const bias = my - scale * mx;
const resid = Math.max(...xs.map((x, i) => Math.abs(scale * x + bias - ys[i])));
console.log(`fit: scale=${scale.toFixed(3)} bias=${bias.toFixed(3)} maxResidual=${resid.toExponential(2)}`);
if (resid > 0.05) throw new Error('scale/bias fit is not linear enough; check pooler/embeds');

const flat = new Float32Array(vectors.flat());
const out = {
  model: MODEL,
  dim,
  scale,
  bias,
  labels,
  vectors: Buffer.from(flat.buffer).toString('base64'),
};
await fs.mkdir('public/data', { recursive: true });
await fs.writeFile('public/data/embeddings.json', JSON.stringify(out));
console.log(`wrote public/data/embeddings.json (${(JSON.stringify(out).length / 1e6).toFixed(2)} MB)`);
