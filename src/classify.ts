import type { StreamId } from './types';

/**
 * Label embeddings precomputed at build time by scripts/build-embeddings.mjs.
 * The browser only runs the vision half of SigLIP; the text half never ships.
 */
export interface EmbeddingBankJson {
  model: string;
  dim: number;
  /** SigLIP logit = scale * cosine + bias. */
  scale: number;
  bias: number;
  labels: { id: string; kind: 'item' | 'not_waste' }[];
  /** Base64 of a little-endian Float32Array, labels.length × dim, L2-normalised. */
  vectors: string;
}

export interface EmbeddingBank {
  model: string;
  dim: number;
  scale: number;
  bias: number;
  labels: { id: string; kind: 'item' | 'not_waste' }[];
  vectors: Float32Array;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function decodeBank(json: EmbeddingBankJson): EmbeddingBank {
  const bytes = base64ToBytes(json.vectors);
  const vectors = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  if (vectors.length !== json.labels.length * json.dim) {
    throw new Error(`Embedding bank size mismatch: ${vectors.length} values for ${json.labels.length}×${json.dim}`);
  }
  return { model: json.model, dim: json.dim, scale: json.scale, bias: json.bias, labels: json.labels, vectors };
}

export function l2normalize(v: ArrayLike<number>): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i]! * v[i]!;
  const inv = n > 0 ? 1 / Math.sqrt(n) : 0;
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i]! * inv;
  return out;
}

/** SigLIP logits of one image embedding against every label. */
export function logits(bank: EmbeddingBank, image: ArrayLike<number>): Float32Array {
  if (image.length !== bank.dim) throw new Error(`Image embedding has ${image.length} dims, expected ${bank.dim}`);
  const img = l2normalize(image);
  const out = new Float32Array(bank.labels.length);
  for (let l = 0; l < bank.labels.length; l++) {
    let dot = 0;
    const off = l * bank.dim;
    for (let i = 0; i < bank.dim; i++) dot += bank.vectors[off + i]! * img[i]!;
    out[l] = bank.scale * dot + bank.bias;
  }
  return out;
}

export function softmax(x: ArrayLike<number>): Float32Array {
  let max = -Infinity;
  for (let i = 0; i < x.length; i++) max = Math.max(max, x[i]!);
  const out = new Float32Array(x.length);
  let sum = 0;
  for (let i = 0; i < x.length; i++) {
    out[i] = Math.exp(x[i]! - max);
    sum += out[i]!;
  }
  for (let i = 0; i < x.length; i++) out[i] = out[i]! / sum;
  return out;
}

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export interface Ranked {
  id: string;
  kind: 'item' | 'not_waste';
  /** Share of probability among all labels (softmax). */
  prob: number;
  /** SigLIP's own yes/no score for this label (sigmoid of the logit). */
  match: number;
}

export function rank(bank: EmbeddingBank, image: ArrayLike<number>): Ranked[] {
  const z = logits(bank, image);
  const p = softmax(z);
  return bank.labels
    .map((l, i) => ({ id: l.id, kind: l.kind, prob: p[i]!, match: sigmoid(z[i]!) }))
    .sort((a, b) => b.prob - a.prob);
}

export type Verdict = 'confident' | 'likely' | 'unsure' | 'not_waste';

export interface Thresholds {
  /** Probability mass on "not waste" labels above which we say so. */
  notWaste: number;
  /** Stream probability and top-item probability needed for "confident". */
  confidentStream: number;
  confidentItem: number;
  /** Stream probability needed for "likely" (we answer but ask to confirm). */
  likelyStream: number;
}

/**
 * Chosen from the threshold sweep in eval/RESULTS.md: at 0.9 a "confident"
 * answer had the right bin about 97% of the time. Tuned on the same set it is
 * reported on, so treat that figure as optimistic.
 */
export const DEFAULT_THRESHOLDS: Thresholds = {
  notWaste: 0.5,
  confidentStream: 0.9,
  confidentItem: 0.45,
  likelyStream: 0.5,
};

export interface Decision {
  verdict: Verdict;
  /** The stream we would answer with (absent for not_waste). */
  stream?: StreamId;
  streamProb: number;
  /** Most likely item inside the chosen stream. */
  itemId?: string;
  /** Top three items overall, renormalised without the not-waste labels: the "is it one of these?" chips. */
  candidates: { id: string; prob: number }[];
}

/**
 * Turn label probabilities into an answer. The vision model only says which
 * catalog entries the photo looks like; the bin comes from the catalog, and
 * when probability is spread across bins we ask instead of guessing.
 */
export function decide(
  ranked: Ranked[],
  streamOf: (itemId: string) => StreamId | undefined,
  th: Thresholds = DEFAULT_THRESHOLDS,
): Decision {
  const notWaste = ranked.filter((r) => r.kind === 'not_waste').reduce((s, r) => s + r.prob, 0);
  const items = ranked.filter((r) => r.kind === 'item' && streamOf(r.id));
  const itemMass = items.reduce((s, r) => s + r.prob, 0);
  const norm = itemMass > 0 ? items.map((r) => ({ id: r.id, prob: r.prob / itemMass })) : [];
  const candidates = norm.slice(0, 3);

  if (notWaste > th.notWaste || norm.length === 0) {
    return { verdict: 'not_waste', streamProb: 0, candidates };
  }

  const byStream = new Map<StreamId, number>();
  for (const r of norm) {
    const s = streamOf(r.id)!;
    byStream.set(s, (byStream.get(s) ?? 0) + r.prob);
  }
  let stream: StreamId = streamOf(norm[0]!.id)!;
  let streamProb = -1;
  for (const [s, p] of byStream) {
    if (p > streamProb) {
      stream = s;
      streamProb = p;
    }
  }
  const best = norm.find((r) => streamOf(r.id) === stream)!;

  let verdict: Verdict = 'unsure';
  if (streamProb >= th.confidentStream && best.prob >= th.confidentItem) verdict = 'confident';
  else if (streamProb >= th.likelyStream) verdict = 'likely';

  return { verdict, stream, streamProb, itemId: best.id, candidates };
}
