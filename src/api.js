// Talks to the Google Apps Script web app that reads/writes the Google Sheet.
// If no Apps Script URL is set yet, the app runs in Demo mode and keeps
// sample data in this browser only.
import { addDays, todayStr, newId, normDate } from './utils';

// Clean up dates typed straight into the sheet (e.g. 14/10/2026 → 2026-10-14).
const clean = (items) =>
  items.map((it) => ({ ...it, draftDue: normDate(it.draftDue), goLive: normDate(it.goLive) }));

const SETTINGS_KEY = 'ugc-planner-settings';
const DEMO_KEY = 'ugc-planner-demo';

export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: settings last for this visit only */
  }
}

export const isDemo = () => !getSettings().url;

// Apps Script needs a "simple" request (text/plain) so the browser
// doesn't send a CORS preflight, which Apps Script can't answer.
async function call(action, payload = {}, override) {
  const { url, passcode } = override || getSettings();
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, passcode, ...payload }),
    });
  } catch {
    throw new Error('No internet connection. Check your network and try again.');
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('The Apps Script URL did not return data. Check it is the /exec web app URL.');
  }
  if (!data.ok) {
    const err = new Error(data.error || 'Request failed');
    err.busy = !!data.busy;
    throw err;
  }
  return data;
}

// Saves and deletes go out one at a time, in the order she made them,
// so a quick double tap can never land in the sheet out of order.
let queue = Promise.resolve();
let pending = 0;
export const hasPendingWrites = () => pending > 0;

function enqueue(fn) {
  pending++;
  const run = queue.then(async () => {
    try {
      return await fn();
    } catch (e) {
      // The sheet was busy: wait a moment and try once more.
      if (e.busy) {
        await new Promise((r) => setTimeout(r, 1500));
        return fn();
      }
      throw e;
    }
  });
  queue = run.catch(() => {}).finally(() => pending--);
  return run;
}

// ---------- Demo storage ----------
function demoSeed() {
  const t = todayStr();
  return [
    { id: newId(), brand: 'Glow Theory', contact: 'Priya (DM)', type: 'Reel', draftDue: addDays(t, -2), goLive: addDays(t, 1), status: 'Draft sent', amount: 8000, payment: 'Unpaid', collab: true, link: '', notes: 'Tag @glowtheory, #GlowWithMe' },
    { id: newId(), brand: 'Glow Theory', contact: 'Priya (DM)', type: 'Story', draftDue: '', goLive: addDays(t, 1), status: 'Approved', amount: 2000, payment: 'Unpaid', collab: false, link: '', notes: 'Link sticker to product page' },
    { id: newId(), brand: 'Chai Point Co.', contact: 'marketing@chaipoint.example', type: 'Carousel', draftDue: addDays(t, -1), goLive: addDays(t, 4), status: 'Shooting', amount: 6000, payment: 'Unpaid', collab: false, link: '', notes: '5 slides, morning routine theme' },
    { id: newId(), brand: 'Kiko Bags', contact: 'Rahul', type: 'Reel', draftDue: addDays(t, 3), goLive: addDays(t, 9), status: 'Briefed', amount: 12000, payment: 'Unpaid', collab: true, link: '', notes: 'Unboxing + styling, 30s max' },
    { id: newId(), brand: 'Fresh Leaf', contact: 'Ananya', type: 'Post', draftDue: '', goLive: addDays(t, -6), status: 'Live', amount: 4500, payment: 'Invoiced', collab: false, link: 'https://instagram.com/', notes: 'Keep live 30 days' },
    { id: newId(), brand: 'Sunday Skin', contact: 'Meera', type: 'Reel', draftDue: '', goLive: addDays(t, -14), status: 'Live', amount: 9000, payment: 'Paid', collab: true, link: 'https://instagram.com/', notes: '' },
  ];
}

function demoRead() {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  const seed = demoSeed();
  demoWrite(seed);
  return seed;
}

function demoWrite(items) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

// ---------- Public API ----------
export async function listItems() {
  if (isDemo()) return clean(demoRead());
  const data = await call('list');
  return clean(data.items);
}

export async function saveItem(item) {
  if (isDemo()) {
    const items = demoRead();
    const i = items.findIndex((x) => x.id === item.id);
    if (i >= 0) items[i] = item;
    else items.push(item);
    demoWrite(items);
    return item;
  }
  const data = await enqueue(() => call('save', { item }));
  return data.item;
}

export async function deleteItem(id) {
  if (isDemo()) {
    demoWrite(demoRead().filter((x) => x.id !== id));
    return;
  }
  await enqueue(() => call('delete', { id }));
}

export async function testConnection(url, passcode) {
  const data = await call('list', {}, { url, passcode });
  return data.items.length;
}

export function resetDemo() {
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch {
    /* ignore */
  }
}
