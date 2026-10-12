// Instagram deliverable types, workflow stages and payment states.
export const TYPES = ['Reel', 'Story', 'Post', 'Carousel'];
export const STATUSES = ['Briefed', 'Shooting', 'Draft sent', 'Approved', 'Live'];
export const PAYMENTS = ['Unpaid', 'Invoiced', 'Paid'];

// ---- Dates are stored as plain "YYYY-MM-DD" strings (local time) ----
const pad = (n) => String(n).padStart(2, '0');
export const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const validIso = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parse(s));

// Turns whatever is in the sheet into "YYYY-MM-DD".
// Accepts 2026-10-14, 14/10/2026, 14-10-2026, 14.10.2026 (day first, Indian style),
// 2026-10-14T00:00:00Z and text like "14 Oct 2026". Returns '' for blanks.
// Anything it still can't read is returned unchanged so no data is thrown away.
export function normDate(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (!s) return '';
  // Full timestamps (2026-10-12T18:30:00.000Z) → convert to the local day,
  // otherwise a date saved at midnight in India would show one day early.
  if (/^\d{4}-\d{1,2}-\d{1,2}T/.test(s)) {
    const t = new Date(s);
    if (!isNaN(t)) return toStr(t);
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  const d = new Date(s);
  if (!isNaN(d)) return toStr(d);
  return s;
}
export const isValidDate = (s) => !!s && validIso(s);
export const todayStr = () => toStr(new Date());
export const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
};
export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 86400000);

export function fmtDate(s) {
  if (!s) return '—';
  if (!isValidDate(s)) return `⚠ ${s}`;
  return parse(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function relDay(s) {
  if (!s) return 'No date';
  if (!isValidDate(s)) return 'Check date';
  const n = diffDays(s, todayStr());
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return `${-n} days late`;
  if (n < 7) return parse(s).toLocaleDateString('en-IN', { weekday: 'long' });
  return fmtDate(s);
}

export const isDone = (it) => it.status === 'Live';

// The date that matters right now: the draft deadline while she is still
// making the content, otherwise the go-live date.
export function keyDate(it) {
  const early = it.status === 'Briefed' || it.status === 'Shooting';
  if (early && it.draftDue) return { label: 'Draft due', date: it.draftDue };
  if (it.goLive) return { label: 'Goes live', date: it.goLive };
  return null;
}

export function isOverdue(it) {
  const k = keyDate(it);
  return !!k && isValidDate(k.date) && !isDone(it) && k.date < todayStr();
}

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
export const money = (n) => inr.format(Number(n) || 0);

export const newId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const emptyItem = () => ({
  id: '',
  brand: '',
  contact: '',
  type: 'Reel',
  draftDue: '',
  goLive: '',
  status: 'Briefed',
  amount: '',
  payment: 'Unpaid',
  collab: false,
  link: '',
  notes: '',
});
