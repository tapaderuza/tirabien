import { describe, expect, it } from 'vitest';
import { buildAnswer, makeFinder, placesFor } from '../src/answer';
import type { ContainerData } from '../src/geo';

const data: ContainerData = {
  generated: '2026-11-18',
  source: 'test',
  license: 'test',
  bbox: [36.66, -4.56, 36.79, -4.33],
  streams: {
    yellow: [
      [36.7211, -4.4217],
      [36.7301, -4.4101],
      [36.7001, -4.4501],
    ],
    clean_point: [[36.7424, -4.4302]],
  },
  places: {},
};
const finder = makeFinder(data);

describe('placesFor', () => {
  it('orders containers by distance and adds a walking time', () => {
    const r = placesFor(finder, 'yellow', [36.7212, -4.4218], 3);
    expect(r.nearest).toHaveLength(3);
    expect(r.nearest[0]!.meters).toBeLessThan(r.nearest[1]!.meters);
    expect(r.nearest[0]!.walkMin).toBe(1);
    expect(r.total).toBe(3);
    expect(r.outside).toBe(false);
  });

  it('says so when the user is outside the covered area', () => {
    expect(placesFor(finder, 'yellow', [40.4, -3.7]).outside).toBe(true);
  });

  it('returns no places, not a crash, for a stream without data', () => {
    const r = placesFor(finder, 'brown', [36.72, -4.42]);
    expect(r.nearest).toEqual([]);
    expect(r.total).toBe(0);
  });
});

describe('buildAnswer', () => {
  it('attaches the conditional second destination', () => {
    const a = buildAnswer('aerosol_can', finder)!;
    expect(a.main.stream.id).toBe('yellow');
    expect(a.alt?.stream.id).toBe('clean_point');
    expect(a.alt?.nearest).toHaveLength(1);
  });

  it('has no alternative when the rule has none', () => {
    expect(buildAnswer('plastic_bottle', finder)!.alt).toBeUndefined();
  });

  it('returns undefined for an unknown item', () => {
    expect(buildAnswer('nope', finder)).toBeUndefined();
  });
});
