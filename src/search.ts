import type { Item } from './types';

/** Lowercase, strip accents and punctuation, collapse spaces. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const STOP = new Set([
  // es
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'con', 'sin', 'para', 'en', 'al', 'mi', 'que', 'donde', 'tiro', 'tirar', 'va', 'vacio', 'vacia', 'vacios', 'vacias', 'viejo', 'vieja', 'viejos', 'viejas',
  // en
  'a', 'an', 'the', 'of', 'with', 'for', 'and', 'or', 'my', 'where', 'do', 'i', 'put', 'throw', 'empty', 'old',
]);

/** Very light plural stripping, good enough for Spanish and English nouns. */
export function stem(word: string): string {
  if (word.length > 4 && word.endsWith('es') && !/[aeiou]es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function tokens(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((w) => w.length > 0 && !STOP.has(w))
    .map(stem);
}

/** Damerau–Levenshtein distance with an early exit above `max`. */
export function editDistance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => {
    const row = new Array<number>(cols).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j < cols; j++) d[0]![j] = j;
  for (let i = 1; i < rows; i++) {
    let rowMin = Infinity;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length]![b.length]!;
}

/** How well one query token matches one term token, 0..1. */
function tokenMatch(q: string, t: string): number {
  if (q === t) return 1;
  if (q.length >= 3 && t.startsWith(q)) return 0.85;
  if (q.length >= 4) {
    const allowed = q.length >= 7 ? 2 : 1;
    if (editDistance(q, t, allowed) <= allowed) return 0.8;
  }
  return 0;
}

interface Term {
  text: string;
  toks: string[];
}

export interface SearchIndex {
  entries: { item: Item; terms: Term[] }[];
}

export function buildIndex(items: Item[]): SearchIndex {
  return {
    entries: items.map((item) => {
      const raw = [item.name.es, item.name.en, ...item.synonyms];
      const seen = new Set<string>();
      const terms: Term[] = [];
      for (const r of raw) {
        const text = normalize(r);
        if (!text || seen.has(text)) continue;
        seen.add(text);
        terms.push({ text, toks: tokens(r) });
      }
      return { item, terms };
    }),
  };
}

export interface SearchHit {
  item: Item;
  score: number;
}

function scoreTerm(qText: string, qToks: string[], term: Term): number {
  if (qText === term.text) return 1;
  if (qToks.length === 0 || term.toks.length === 0) return 0;
  if (qText.length >= 3 && term.text.startsWith(qText)) return 0.9;
  let sum = 0;
  let matchedTermToks = 0;
  const usedTerm = new Set<number>();
  for (const q of qToks) {
    let best = 0;
    let bestIdx = -1;
    term.toks.forEach((t, idx) => {
      const m = tokenMatch(q, t);
      if (m > best) {
        best = m;
        bestIdx = idx;
      }
    });
    sum += best;
    if (bestIdx >= 0 && !usedTerm.has(bestIdx)) {
      usedTerm.add(bestIdx);
      matchedTermToks++;
    }
  }
  const queryCoverage = sum / qToks.length;
  const termCoverage = matchedTermToks / term.toks.length;
  // Matching every query word matters most; matching the whole term breaks ties.
  return queryCoverage * (0.7 + 0.25 * termCoverage);
}

/** Ranked items for a free-text query in Spanish or English. */
export function search(index: SearchIndex, query: string, limit = 5): SearchHit[] {
  const qText = normalize(query);
  const qToks = tokens(query);
  if (!qText) return [];
  const hits: SearchHit[] = [];
  for (const { item, terms } of index.entries) {
    let best = 0;
    for (const term of terms) best = Math.max(best, scoreTerm(qText, qToks, term));
    if (best >= 0.45) hits.push({ item, score: best });
  }
  hits.sort((a, b) => b.score - a.score || a.item.name.en.length - b.item.name.en.length);
  return hits.slice(0, limit);
}
