import { describe, expect, it } from 'vitest';
import { ITEMS, NOT_WASTE, VISUAL_ITEMS, itemById } from '../src/catalog';
import { STREAMS } from '../src/streams';
import { SOURCES } from '../src/sources';
import { normalize } from '../src/search';

const streamIds = new Set(STREAMS.map((s) => s.id));

describe('catalog integrity', () => {
  it('has unique item ids', () => {
    const ids = ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points every item and alternative at a known stream', () => {
    for (const item of ITEMS) {
      expect(streamIds.has(item.stream), item.id).toBe(true);
      if (item.alt) {
        expect(streamIds.has(item.alt.stream), item.id).toBe(true);
        expect(item.alt.stream, item.id).not.toBe(item.stream);
      }
    }
  });

  it('has both languages for every user-facing text', () => {
    for (const item of ITEMS) {
      for (const text of [item.name, item.tip, item.mistake, item.changing, item.alt?.when]) {
        if (!text) continue;
        expect(text.es.trim().length, item.id).toBeGreaterThan(0);
        expect(text.en.trim().length, item.id).toBeGreaterThan(0);
      }
    }
  });

  it('cites only sources that exist', () => {
    const ids = new Set(SOURCES.map((s) => s.id));
    for (const s of STREAMS) for (const src of s.sources) expect(ids.has(src), `${s.id}:${src}`).toBe(true);
  });

  it('never gives two items the same visual prompt', () => {
    const prompts = [...ITEMS, ...NOT_WASTE].flatMap((i) => i.prompts);
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it('never maps one typed term to two different bins', () => {
    const seen = new Map<string, string>();
    for (const item of ITEMS) {
      for (const term of new Set([item.name.es, item.name.en, ...item.synonyms].map(normalize))) {
        const prev = seen.get(term);
        if (prev) {
          const other = itemById(prev)!;
          expect(other.stream, `"${term}" is in ${prev} and ${item.id}`).toBe(item.stream);
        } else {
          seen.set(term, item.id);
        }
      }
    }
  });

  it('gives the vision model a broad label set', () => {
    expect(VISUAL_ITEMS.length).toBeGreaterThanOrEqual(70);
  });
});

describe('the rules people most often get wrong', () => {
  const cases: [string, string][] = [
    ['drink_carton', 'yellow'], // looks like cardboard, but it is a composite carton
    ['bottle_cap', 'yellow'], // lids come off glass jars before the igloo
    ['plastic_bag', 'yellow'],
    ['napkin', 'brown'], // dirty paper is not paper recycling
    ['receipt', 'grey'], // thermal paper
    ['drinking_glass', 'grey'], // glassware is not container glass
    ['ceramic', 'grey'],
    ['mirror', 'clean_point'],
    ['light_bulb', 'clean_point'],
    ['toothbrush', 'grey'], // plastic but not packaging
    ['plastic_toy', 'clean_point'],
    ['battery', 'battery'],
    ['cooking_oil', 'oil'],
    ['medicine', 'pharmacy'],
    ['clothes', 'textile'],
  ];
  it.each(cases)('%s goes to %s', (id, stream) => {
    expect(itemById(id)?.stream).toBe(stream);
  });

  it('flags coffee capsules as a rule that is changing', () => {
    expect(itemById('coffee_capsule')?.changing?.en).toMatch(/2026/);
  });

  it('explains the mistake for every item that is commonly put in the wrong bin', () => {
    for (const id of ['drink_carton', 'napkin', 'receipt', 'drinking_glass', 'toothbrush', 'plastic_toy', 'battery']) {
      expect(itemById(id)?.mistake, id).toBeDefined();
    }
  });
});
