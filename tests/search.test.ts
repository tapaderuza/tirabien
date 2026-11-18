import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/catalog';
import { buildIndex, editDistance, normalize, search, stem, tokens } from '../src/search';

const index = buildIndex(ITEMS);
const top = (q: string) => search(index, q)[0]?.item.id;

describe('normalize and tokens', () => {
  it('strips accents, ñ and punctuation', () => {
    expect(normalize('  Cápsula  de CAFÉ, ¿dónde? ')).toBe('capsula de cafe donde');
    expect(normalize('Pañal')).toBe('panal');
  });
  it('drops stop words and plurals', () => {
    expect(tokens('¿Dónde tiro las botellas vacías?')).toEqual(['botella']);
    expect(stem('pilas')).toBe('pila');
    expect(stem('glass')).toBe('glass');
  });
});

describe('editDistance', () => {
  it('counts insertions, deletions, substitutions and swaps', () => {
    expect(editDistance('botella', 'botella')).toBe(0);
    expect(editDistance('botela', 'botella')).toBe(1);
    expect(editDistance('botlela', 'botella')).toBe(1);
    expect(editDistance('lata', 'pata')).toBe(1);
    expect(editDistance('abc', 'xyzxyz', 2)).toBeGreaterThan(2);
  });
});

describe('search', () => {
  it.each([
    ['brik', 'drink_carton'],
    ['tetrabrik de leche', 'drink_carton'],
    ['milk carton', 'drink_carton'],
    ['pizza box', 'pizza_box'],
    ['caja de pizza', 'pizza_box'],
    ['servilleta', 'napkin'],
    ['vaso de cristal', 'drinking_glass'],
    ['pilas', 'battery'],
    ['batteries', 'battery'],
    ['cápsula nespresso', 'coffee_capsule'],
    ['aceite usado', 'cooking_oil'],
    ['tique', 'receipt'],
    ['espejo', 'mirror'],
    ['colchón', 'furniture'],
    ['cepillo de dientes', 'toothbrush'],
    ['wine bottle', 'glass_bottle'],
    ['tarro', 'glass_jar'],
    ['posos de café', 'coffee_grounds'],
    ['pañales', 'diaper'],
  ])('"%s" finds %s first', (q, id) => {
    expect(top(q)).toBe(id);
  });

  it('tolerates typos', () => {
    expect(top('botela de plastico')).toBe('plastic_bottle');
    expect(top('servilleat')).toBe('napkin');
  });

  it('matches prefixes while typing', () => {
    expect(top('servil')).toBe('napkin');
  });

  it('returns nothing for empty or unrelated input', () => {
    expect(search(index, '')).toEqual([]);
    expect(search(index, '   ')).toEqual([]);
    expect(search(index, 'xyzzy qwerty')).toEqual([]);
  });

  it('respects the limit and sorts by score', () => {
    const hits = search(index, 'botella', 3);
    expect(hits.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < hits.length; i++) expect(hits[i - 1]!.score).toBeGreaterThanOrEqual(hits[i]!.score);
  });
});
