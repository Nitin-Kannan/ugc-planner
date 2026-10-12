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
export const todayStr = () => toStr(new Date());
export const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
};
export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / 86400000);

export function fmtDate(s) {
  if (!s) return '—';
  return parse(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function relDay(s) {
  if (!s) return 'No date';
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
  return !!k && !isDone(it) && k.date < todayStr();
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
