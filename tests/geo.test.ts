import { describe, expect, it } from 'vitest';
import { GridIndex, formatDistance, haversineMeters, insideBbox, walkingMinutes, type LatLon } from '../src/geo';

/** Small deterministic PRNG so the test is reproducible. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('haversineMeters', () => {
  it('measures one degree of latitude as about 111.2 km', () => {
    expect(haversineMeters([0, 0], [1, 0])).toBeCloseTo(111195, -1);
  });
  it('is symmetric and zero for the same point', () => {
    const a: LatLon = [36.72, -4.42];
    const b: LatLon = [36.6749, -4.4991];
    expect(haversineMeters(a, a)).toBe(0);
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6);
    // Málaga centre to the airport is roughly 8–9 km in a straight line.
    expect(haversineMeters(a, b)).toBeGreaterThan(8000);
    expect(haversineMeters(a, b)).toBeLessThan(9500);
  });
});

describe('GridIndex.nearest', () => {
  const rnd = mulberry32(42);
  const points: LatLon[] = Array.from({ length: 3000 }, () => [36.66 + rnd() * 0.13, -4.56 + rnd() * 0.23]);
  const grid = new GridIndex(points);

  const brute = (p: LatLon) =>
    points.map((q, index) => ({ index, meters: haversineMeters(p, q) })).sort((a, b) => a.meters - b.meters);

  it('agrees with brute force inside and outside the data area', { timeout: 30_000 }, () => {
    const queries: LatLon[] = [
      ...Array.from({ length: 120 }, (): LatLon => [36.66 + rnd() * 0.13, -4.56 + rnd() * 0.23]),
      [36.5, -4.9], // well outside the bounding box
      [36.9, -4.1],
    ];
    for (const q of queries) {
      const expected = brute(q).map((n) => n.index); // sorted once per query
      for (const k of [1, 3, 5]) {
        expect(grid.nearest(q, k).map((n) => n.index)).toEqual(expected.slice(0, k));
      }
    }
  });

  it('answers fast for a query thousands of kilometres away (user abroad)', () => {
    const t0 = performance.now();
    for (const far of [[40.4, -3.7], [51.5, -0.1], [40.7, -74.0], [-33.9, 151.2]] as LatLon[]) {
      expect(grid.nearest(far, 3)).toHaveLength(3);
    }
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it('returns everything when k exceeds the size', () => {
    const small = new GridIndex([
      [36.7, -4.4],
      [36.71, -4.41],
    ]);
    expect(small.nearest([36.7, -4.4], 10)).toHaveLength(2);
  });

  it('handles an empty index', () => {
    expect(new GridIndex([]).nearest([36.7, -4.4], 3)).toEqual([]);
  });
});

describe('formatting helpers', () => {
  it('rounds walking time and distance sensibly', () => {
    expect(walkingMinutes(10)).toBe(1);
    expect(walkingMinutes(800)).toBe(10);
    expect(formatDistance(123)).toBe('120 m');
    expect(formatDistance(1530)).toBe('1.5 km');
    expect(formatDistance(23500)).toBe('24 km');
  });
  it('checks bounding boxes as [south, west, north, east]', () => {
    expect(insideBbox([36.72, -4.42], [36.66, -4.56, 36.79, -4.33])).toBe(true);
    expect(insideBbox([40.4, -3.7], [36.66, -4.56, 36.79, -4.33])).toBe(false);
  });
});
