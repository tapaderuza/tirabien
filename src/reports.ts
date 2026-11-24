// "Wrong answer?" reports. They stay on the phone (localStorage); nothing is ever sent.
// The user can copy them as plain text and share them by email if they want to.

export type Report = {
  /** When it was reported (ISO). */
  at: string;
  /** The item TiraBien showed. Empty when it said "not waste" or "not sure". */
  shown: string;
  /** The item the user says it really was, or "" when it is not in the catalog. */
  actual: string;
  /** Whether the answer came from a photo (true) or from typing (false). The photo itself is never stored. */
  photo: boolean;
};

export type ReportStore = { get(): string | null; set(value: string): void };

const KEY = 'tirabien.reports';
const MAX = 200;

export const localStore = (): ReportStore => ({
  get: () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set: (v) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* storage may be blocked or full: the report is simply not kept */
    }
  },
});

export function listReports(store: ReportStore): Report[] {
  const raw = store.get();
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data)
      ? data.filter((r): r is Report => !!r && typeof r === 'object' && typeof (r as Report).at === 'string')
      : [];
  } catch {
    return [];
  }
}

export function addReport(store: ReportStore, report: Omit<Report, 'at'>, now = new Date()): Report[] {
  const next = [...listReports(store), { ...report, at: now.toISOString() }].slice(-MAX);
  store.set(JSON.stringify(next));
  return next;
}

/** Plain text the user can paste into an email: one line per report. */
export function reportsText(reports: Report[], nameOf: (id: string) => string): string {
  return reports
    .map(
      (r) =>
        `${r.at.slice(0, 10)} · ${r.photo ? 'photo' : 'text'} · shown: ${r.shown ? nameOf(r.shown) : '(no item)'} · actual: ${
          r.actual ? nameOf(r.actual) : '(not in the list)'
        }`,
    )
    .join('\n');
}
