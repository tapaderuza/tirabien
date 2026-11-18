import { describe, expect, it } from 'vitest';
import {
  bytesToBase64,
  decide,
  decodeBank,
  l2normalize,
  rank,
  softmax,
  type EmbeddingBankJson,
  type Ranked,
} from '../src/classify';
import type { StreamId } from '../src/types';

function bankJson(vectors: number[][], labels: EmbeddingBankJson['labels'], scale = 10, bias = -5): EmbeddingBankJson {
  const flat = new Float32Array(vectors.flatMap((v) => Array.from(l2normalize(v))));
  return {
    model: 'test',
    dim: vectors[0]!.length,
    scale,
    bias,
    labels,
    vectors: bytesToBase64(new Uint8Array(flat.buffer)),
  };
}

describe('math helpers', () => {
  it('softmax sums to one and survives large logits', () => {
    const p = softmax([1000, 1001, 999]);
    expect(p.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 6);
    expect(p[1]).toBeGreaterThan(p[0]!);
    expect(Number.isFinite(p[0]!)).toBe(true);
  });
  it('l2normalize gives unit length and leaves zeros alone', () => {
    const v = l2normalize([3, 4]);
    expect(v[0]).toBeCloseTo(0.6);
    expect(v[1]).toBeCloseTo(0.8);
    expect(Array.from(l2normalize([0, 0]))).toEqual([0, 0]);
  });
});

describe('embedding bank', () => {
  const labels: EmbeddingBankJson['labels'] = [
    { id: 'a', kind: 'item' },
    { id: 'b', kind: 'item' },
    { id: 'c', kind: 'not_waste' },
  ];
  const json = bankJson(
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    labels,
  );

  it('round-trips through base64', () => {
    const bank = decodeBank(json);
    expect(bank.vectors).toHaveLength(9);
    expect(bank.vectors[4]).toBeCloseTo(1);
  });

  it('rejects a bank whose size does not match its labels', () => {
    expect(() => decodeBank({ ...json, dim: 4 })).toThrow(/mismatch/);
  });

  it('ranks the label closest to the image first', () => {
    const r = rank(decodeBank(json), [0.1, 0.9, 0.05]);
    expect(r[0]!.id).toBe('b');
    expect(r.reduce((s, x) => s + x.prob, 0)).toBeCloseTo(1, 5);
  });

  it('rejects an image embedding of the wrong size', () => {
    expect(() => rank(decodeBank(json), [1, 0])).toThrow(/dims/);
  });
});

describe('decide', () => {
  const streams: Record<string, StreamId> = {
    pet: 'yellow',
    can: 'yellow',
    jar: 'green',
    box: 'blue',
  };
  const streamOf = (id: string) => streams[id];
  const r = (id: string, prob: number, kind: Ranked['kind'] = 'item'): Ranked => ({ id, kind, prob, match: 0.5 });

  it('is confident when one item dominates', () => {
    const d = decide([r('pet', 0.9), r('jar', 0.05), r('box', 0.05)], streamOf);
    expect(d).toMatchObject({ verdict: 'confident', stream: 'yellow', itemId: 'pet' });
  });

  it('answers by bin when the items disagree but agree on the bin', () => {
    // 0.4 + 0.4 in yellow: the bin is clear, the exact item is not.
    const d = decide([r('pet', 0.42), r('can', 0.4), r('jar', 0.18)], streamOf);
    expect(d.stream).toBe('yellow');
    expect(d.streamProb).toBeCloseTo(0.82);
    expect(d.verdict).toBe('likely');
    expect(d.itemId).toBe('pet');
  });

  it('asks instead of guessing when bins compete', () => {
    const d = decide([r('pet', 0.4), r('jar', 0.35), r('box', 0.25)], streamOf);
    expect(d.verdict).toBe('unsure');
    expect(d.candidates.map((c) => c.id)).toEqual(['pet', 'jar', 'box']);
  });

  it('says when the photo is not waste', () => {
    const d = decide([r('person', 0.7, 'not_waste'), r('pet', 0.2), r('jar', 0.1)], streamOf);
    expect(d.verdict).toBe('not_waste');
    expect(d.stream).toBeUndefined();
  });

  it('renormalises item probabilities without the not-waste labels', () => {
    const d = decide([r('pet', 0.45), r('person', 0.3, 'not_waste'), r('jar', 0.25)], streamOf);
    expect(d.candidates[0]!.prob).toBeCloseTo(0.45 / 0.7);
    expect(d.candidates.reduce((s, c) => s + c.prob, 0)).toBeCloseTo(1);
  });

  it('ignores labels that are not in the catalog', () => {
    const d = decide([r('ghost', 0.9), r('pet', 0.1)], streamOf);
    expect(d.itemId).toBe('pet');
  });
});
