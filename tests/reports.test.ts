import { describe, expect, it } from 'vitest';
import { addReport, listReports, reportsText, type ReportStore } from '../src/reports';

const memory = (initial: string | null = null): ReportStore & { value: string | null } => {
  const s = { value: initial, get: () => s.value, set: (v: string) => void (s.value = v) };
  return s;
};

describe('wrong-answer reports', () => {
  it('starts empty and survives broken storage', () => {
    expect(listReports(memory())).toEqual([]);
    expect(listReports(memory('not json'))).toEqual([]);
    expect(listReports(memory('{"a":1}'))).toEqual([]);
  });

  it('adds reports with a timestamp and keeps them in order', () => {
    const s = memory();
    addReport(s, { shown: 'sponge', actual: 'shoes', photo: true }, new Date('2026-11-24T10:00:00Z'));
    const all = addReport(s, { shown: '', actual: 'napkin', photo: true }, new Date('2026-11-25T10:00:00Z'));
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({ shown: 'sponge', actual: 'shoes', at: '2026-11-24T10:00:00.000Z' });
    expect(listReports(s)).toEqual(all);
  });

  it('keeps only the most recent 200', () => {
    const s = memory();
    for (let i = 0; i < 205; i++) addReport(s, { shown: `a${i}`, actual: '', photo: false });
    const all = listReports(s);
    expect(all).toHaveLength(200);
    expect(all[0]!.shown).toBe('a5');
  });

  it('formats a plain-text summary without the photo itself', () => {
    const s = memory();
    addReport(s, { shown: 'sponge', actual: '', photo: true }, new Date('2026-11-24T10:00:00Z'));
    const text = reportsText(listReports(s), (id) => id.toUpperCase());
    expect(text).toBe('2026-11-24 · photo · shown: SPONGE · actual: (not in the list)');
  });
});
