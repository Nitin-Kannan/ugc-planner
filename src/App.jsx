import { useEffect, useMemo, useState } from 'react';
import * as api from './api';
import {
  TYPES, STATUSES, PAYMENTS, todayStr, addDays, parse, toStr, fmtDate, relDay,
  keyDate, isDone, isOverdue, money, newId, emptyItem,
} from './utils';

const TABS = [
  { id: 'week', label: 'This week', icon: '⚡' },
  { id: 'calendar', label: 'Calendar', icon: '🗓️' },
  { id: 'all', label: 'All', icon: '📋' },
  { id: 'money', label: 'Payments', icon: '💸' },
];

const typeClass = (t) => 'type-' + String(t || 'Reel').toLowerCase();
const statusClass = (s) => 'st-' + String(s || '').toLowerCase().replace(/\s+/g, '-');

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('week');
  const [editing, setEditing] = useState(null); // item being edited, or null
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState('');
  const [demo, setDemo] = useState(api.isDemo());

  async function load() {
    setLoading(true);
    setError('');
    try {
      setItems(await api.listItems());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // Optimistic save: update the screen first, then the sheet.
  async function save(item, msg = 'Saved') {
    const prev = items;
    const it = { ...item, id: item.id || newId() };
    setItems((list) => {
      const i = list.findIndex((x) => x.id === it.id);
      if (i < 0) return [...list, it];
      const copy = [...list];
      copy[i] = it;
      return copy;
    });
    try {
      await api.saveItem(it);
      setToast(msg);
    } catch (e) {
      setItems(prev);
      setToast('Could not save: ' + e.message);
    }
    return it;
  }

  async function remove(id) {
    const prev = items;
    setItems((list) => list.filter((x) => x.id !== id));
    try {
      await api.deleteItem(id);
      setToast('Deleted');
    } catch (e) {
      setItems(prev);
      setToast('Could not delete: ' + e.message);
    }
  }

  const overdueCount = items.filter(isOverdue).length;

  return (
    <div className="app">
      <header className="top">
        <div className="brandmark">
          <img src="./icon.svg" alt="" width="34" height="34" />
          <div>
            <h1>UGC Planner</h1>
            <p className="sub">
              {demo ? 'Demo mode · sample data' : 'Synced with Google Sheets'}
            </p>
          </div>
        </div>
        <div className="top-actions">
          <button className="icon-btn" onClick={load} title="Refresh" aria-label="Refresh">↻</button>
          <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings" aria-label="Settings">⚙︎</button>
        </div>
      </header>

      {demo && (
        <button className="demo-banner" onClick={() => setShowSettings(true)}>
          You're viewing sample data. <b>Connect your Google Sheet →</b>
        </button>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'tab' + (tab === t.id ? ' active' : '')}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
            {t.id === 'week' && overdueCount > 0 && <span className="badge">{overdueCount}</span>}
          </button>
        ))}
      </nav>

      <main className="content">
        {loading && <div className="state">Loading your deliverables…</div>}
        {!loading && error && (
          <div className="state error">
            <p>{error}</p>
            <button className="btn" onClick={load}>Try again</button>
          </div>
        )}
        {!loading && !error && (
          <>
            {tab === 'week' && <WeekView items={items} onOpen={setEditing} onSave={save} />}
            {tab === 'calendar' && <CalendarView items={items} onOpen={setEditing} />}
            {tab === 'all' && <AllView items={items} onOpen={setEditing} />}
            {tab === 'money' && <MoneyView items={items} onOpen={setEditing} onSave={save} />}
          </>
        )}
      </main>

      <button className="fab" onClick={() => setEditing(emptyItem())} aria-label="Add deliverable">
        <span>＋</span> Add
      </button>

      {editing && (
        <ItemForm
          item={editing}
          onClose={() => setEditing(null)}
          onSave={async (it, again) => {
            await save(it, it.id ? 'Updated' : 'Added');
            if (again) {
              // Same brand, next deliverable (e.g. 1 Reel + 3 Stories)
              setEditing({ ...emptyItem(), brand: it.brand, contact: it.contact, goLive: it.goLive });
            } else setEditing(null);
          }}
          onDelete={async (id) => {
            await remove(id);
            setEditing(null);
          }}
        />
      )}

      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onChanged={() => {
            setDemo(api.isDemo());
            setShowSettings(false);
            load();
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card used in lists                                                  */
/* ------------------------------------------------------------------ */

function ItemCard({ it, onOpen, onSave, showMarkLive = true }) {
  const k = keyDate(it);
  const late = isOverdue(it);
  const nextStatus = STATUSES[STATUSES.indexOf(it.status) + 1];
  return (
    <article className={'card' + (late ? ' late' : '') + (isDone(it) ? ' done' : '')}>
      <button className="card-main" onClick={() => onOpen(it)}>
        <div className="card-row">
          <span className={'chip ' + typeClass(it.type)}>{it.type}</span>
          {it.collab && <span className="chip collab">Collab</span>}
          <span className={'status ' + statusClass(it.status)}>{it.status}</span>
        </div>
        <h3>{it.brand}</h3>
        {k && (
          <p className={'when' + (late ? ' late-text' : '')}>
            {k.label}: <b>{relDay(k.date)}</b>
            <span className="muted"> · {fmtDate(k.date)}</span>
          </p>
        )}
        {it.notes && <p className="notes">{it.notes}</p>}
      </button>
      {onSave && showMarkLive && nextStatus && (
        <div className="card-actions">
          <button
            className="btn small ghost"
            onClick={() => onSave({ ...it, status: nextStatus }, `Moved to ${nextStatus}`)}
          >
            Move to {nextStatus} →
          </button>
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* This week                                                           */
/* ------------------------------------------------------------------ */

function WeekView({ items, onOpen, onSave }) {
  const t = todayStr();
  const week = addDays(t, 7);
  const open = items.filter((x) => !isDone(x));
  const byDate = (a, b) => (keyDate(a)?.date || '9999').localeCompare(keyDate(b)?.date || '9999');

  const overdue = open.filter(isOverdue).sort(byDate);
  const today = open.filter((x) => keyDate(x)?.date === t).sort(byDate);
  const soon = open
    .filter((x) => {
      const d = keyDate(x)?.date;
      return d && d > t && d <= week;
    })
    .sort(byDate);
  const later = open.filter((x) => {
    const d = keyDate(x)?.date;
    return !d || d > week;
  });

  const liveThisWeek = items.filter((x) => x.goLive >= t && x.goLive <= week).length;

  return (
    <div className="stack">
      <div className="stats">
        <Stat label="Overdue" value={overdue.length} tone="red" />
        <Stat label="Due today" value={today.length} tone="orange" />
        <Stat label="Going live in 7 days" value={liveThisWeek} tone="purple" />
      </div>

      <Section title="🔴 Overdue" items={overdue} empty="Nothing overdue. Nice!" onOpen={onOpen} onSave={onSave} />
      <Section title="📍 Today" items={today} empty="Nothing due today." onOpen={onOpen} onSave={onSave} />
      <Section title="📅 Next 7 days" items={soon} empty="A clear week ahead." onOpen={onOpen} onSave={onSave} />
      {later.length > 0 && (
        <p className="muted center">
          + {later.length} more deliverable{later.length > 1 ? 's' : ''} later. See the Calendar or All tab.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={'stat ' + tone}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function Section({ title, items, empty, onOpen, onSave }) {
  return (
    <section>
      <h2 className="section-title">
        {title} <span className="count">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="empty">{empty}</p>
      ) : (
        <div className="grid">
          {items.map((it) => (
            <ItemCard key={it.id} it={it} onOpen={onOpen} onSave={onSave} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

function CalendarView({ items, onOpen }) {
  const t = todayStr();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(t);

  const cells = useMemo(() => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7; // Monday first
    const start = new Date(first);
    start.setDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return toStr(d);
    });
  }, [month]);

  const eventsOn = (d) => {
    const live = items.filter((x) => x.goLive === d).map((x) => ({ it: x, kind: 'live' }));
    const draft = items
      .filter((x) => x.draftDue === d && (x.status === 'Briefed' || x.status === 'Shooting'))
      .map((x) => ({ it: x, kind: 'draft' }));
    return [...live, ...draft];
  };

  const monthIdx = month.getMonth();
  const selectedEvents = eventsOn(selected);
  const shift = (n) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <div className="stack">
      <div className="cal-head">
        <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
        <h2>{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2>
        <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month">›</button>
      </div>

      <div className="legend">
        <span><i className="dot type-reel" />Reel</span>
        <span><i className="dot type-story" />Story</span>
        <span><i className="dot type-post" />Post</span>
        <span><i className="dot type-carousel" />Carousel</span>
        <span><i className="dot outline" />Draft due</span>
      </div>

      <div className="cal">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="cal-dow">{d}</div>
        ))}
        {cells.map((d) => {
          const ev = eventsOn(d);
          const inMonth = parse(d).getMonth() === monthIdx;
          return (
            <button
              key={d}
              className={
                'cal-cell' +
                (inMonth ? '' : ' other') +
                (d === t ? ' today' : '') +
                (d === selected ? ' selected' : '') +
                (ev.length >= 3 ? ' busy' : '')
              }
              onClick={() => setSelected(d)}
            >
              <span className="cal-num">{parse(d).getDate()}</span>
              <span className="cal-events">
                {ev.slice(0, 3).map(({ it, kind }) => (
                  <span
                    key={it.id + kind}
                    className={'cal-pill ' + typeClass(it.type) + (kind === 'draft' ? ' outline' : '')}
                  >
                    {it.brand}
                  </span>
                ))}
                {ev.length > 3 && <span className="cal-more">+{ev.length - 3}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <section>
        <h2 className="section-title">
          {parse(selected).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          <span className="count">{selectedEvents.length}</span>
        </h2>
        {selectedEvents.length === 0 ? (
          <p className="empty">Nothing scheduled. A good day for a new brand!</p>
        ) : (
          <div className="grid">
            {selectedEvents.map(({ it, kind }) => (
              <div key={it.id + kind}>
                <p className="mini-label">{kind === 'live' ? 'Goes live' : 'Draft due'}</p>
                <ItemCard it={it} onOpen={onOpen} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* All deliverables                                                    */
/* ------------------------------------------------------------------ */

function AllView({ items, onOpen }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Active');

  const filtered = items
    .filter((x) => {
      if (status === 'Active') return !isDone(x);
      if (status === 'All') return true;
      return x.status === status;
    })
    .filter((x) => {
      const s = q.trim().toLowerCase();
      if (!s) return true;
      return [x.brand, x.contact, x.notes, x.type].join(' ').toLowerCase().includes(s);
    })
    .sort((a, b) => (a.goLive || '9999').localeCompare(b.goLive || '9999'));

  return (
    <div className="stack">
      <div className="filters">
        <input
          className="input"
          placeholder="Search brand, contact, notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="pills">
          {['Active', ...STATUSES, 'All'].map((s) => (
            <button key={s} className={'pill' + (status === s ? ' on' : '')} onClick={() => setStatus(s)}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="empty">No deliverables match.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Brand</th>
                <th>Type</th>
                <th>Draft due</th>
                <th>Go live</th>
                <th>Status</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => (
                <tr key={it.id} onClick={() => onOpen(it)} className={isOverdue(it) ? 'late' : ''}>
                  <td>
                    <b>{it.brand}</b>
                    {it.contact && <div className="muted small">{it.contact}</div>}
                  </td>
                  <td><span className={'chip ' + typeClass(it.type)}>{it.type}</span></td>
                  <td>{fmtDate(it.draftDue)}</td>
                  <td>{fmtDate(it.goLive)}</td>
                  <td><span className={'status ' + statusClass(it.status)}>{it.status}</span></td>
                  <td className="num">{it.amount ? money(it.amount) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

function MoneyView({ items, onOpen, onSave }) {
  const withAmount = items.filter((x) => Number(x.amount) > 0);
  const sum = (arr) => arr.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const paid = withAmount.filter((x) => x.payment === 'Paid');
  const invoiced = withAmount.filter((x) => x.payment === 'Invoiced');
  const unpaid = withAmount.filter((x) => x.payment === 'Unpaid');
  const chase = [...invoiced, ...unpaid.filter(isDone)]; // posted but not paid

  const next = { Unpaid: 'Invoiced', Invoiced: 'Paid' };

  return (
    <div className="stack">
      <div className="stats">
        <Stat label="Received" value={money(sum(paid))} tone="green" />
        <Stat label="Invoiced, waiting" value={money(sum(invoiced))} tone="orange" />
        <Stat label="Not invoiced yet" value={money(sum(unpaid))} tone="purple" />
      </div>

      <section>
        <h2 className="section-title">
          🔔 Posted but not paid <span className="count">{chase.length}</span>
        </h2>
        {chase.length === 0 ? (
          <p className="empty">No one owes you for live posts right now.</p>
        ) : (
          <div className="pay-list">
            {chase.map((it) => (
              <PayRow key={it.id} it={it} onOpen={onOpen} next={next[it.payment]} onSave={onSave} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="section-title">All deals with an amount <span className="count">{withAmount.length}</span></h2>
        <div className="pay-list">
          {withAmount
            .slice()
            .sort((a, b) => (b.goLive || '').localeCompare(a.goLive || ''))
            .map((it) => (
              <PayRow key={it.id} it={it} onOpen={onOpen} next={next[it.payment]} onSave={onSave} />
            ))}
        </div>
      </section>
    </div>
  );
}

function PayRow({ it, onOpen, next, onSave }) {
  return (
    <div className="pay-row">
      <button className="pay-info" onClick={() => onOpen(it)}>
        <b>{it.brand}</b>
        <span className="muted small">
          {it.type} · {it.status} · {fmtDate(it.goLive)}
        </span>
      </button>
      <span className="pay-amt">{money(it.amount)}</span>
      {next ? (
        <button
          className={'pay-state ' + it.payment.toLowerCase()}
          onClick={() => onSave({ ...it, payment: next }, `Marked ${next}`)}
          title={`Mark as ${next}`}
        >
          {it.payment} → {next}
        </button>
      ) : (
        <span className="pay-state paid">Paid ✓</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add / edit form                                                     */
/* ------------------------------------------------------------------ */

function ItemForm({ item, onClose, onSave, onDelete }) {
  const [f, setF] = useState(item);
  const [saving, setSaving] = useState(false);
  const isNew = !item.id;
  const set = (k) => (e) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(again) {
    if (!f.brand.trim()) return;
    setSaving(true);
    await onSave({ ...f, brand: f.brand.trim() }, again);
    setSaving(false);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-head">
          <h2>{isNew ? 'New deliverable' : 'Edit deliverable'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
        >
          <label className="field full">
            <span>Brand *</span>
            <input className="input" value={f.brand} onChange={set('brand')} placeholder="e.g. Glow Theory" required autoFocus={isNew} />
          </label>

          <div className="field full">
            <span>Content type</span>
            <div className="seg">
              {TYPES.map((t) => (
                <button
                  type="button"
                  key={t}
                  className={'seg-btn ' + typeClass(t) + (f.type === t ? ' on' : '')}
                  onClick={() => setF({ ...f, type: t })}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span>Draft due to brand</span>
            <input className="input" type="date" value={f.draftDue} onChange={set('draftDue')} />
          </label>
          <label className="field">
            <span>Go-live date</span>
            <input className="input" type="date" value={f.goLive} onChange={set('goLive')} />
          </label>

          <label className="field">
            <span>Status</span>
            <select className="input" value={f.status} onChange={set('status')}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="field check">
            <input type="checkbox" checked={!!f.collab} onChange={set('collab')} />
            <span>Instagram Collab post</span>
          </label>

          <label className="field">
            <span>Amount (₹)</span>
            <input className="input" type="number" inputMode="numeric" min="0" value={f.amount} onChange={set('amount')} placeholder="0" />
          </label>
          <label className="field">
            <span>Payment</span>
            <select className="input" value={f.payment} onChange={set('payment')}>
              {PAYMENTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>

          <label className="field full">
            <span>Brand contact</span>
            <input className="input" value={f.contact} onChange={set('contact')} placeholder="Name, email or @handle" />
          </label>

          <label className="field full">
            <span>Post link (once live)</span>
            <input className="input" type="url" value={f.link} onChange={set('link')} placeholder="https://instagram.com/…" />
          </label>

          <label className="field full">
            <span>Notes</span>
            <textarea className="input" rows="3" value={f.notes} onChange={set('notes')} placeholder="Hashtags, tags, brief, how long it must stay up…" />
          </label>

          {f.link && (
            <a className="link-out full" href={f.link} target="_blank" rel="noreferrer">
              Open post ↗
            </a>
          )}

          <div className="form-actions full">
            {!isNew && (
              <button
                type="button"
                className="btn danger ghost"
                onClick={() => {
                  if (confirm(`Delete this ${f.type} for ${f.brand}?`)) onDelete(f.id);
                }}
              >
                Delete
              </button>
            )}
            <span className="spacer" />
            {isNew && (
              <button type="button" className="btn ghost" disabled={saving || !f.brand.trim()} onClick={() => submit(true)}>
                Save + add another
              </button>
            )}
            <button type="submit" className="btn primary" disabled={saving || !f.brand.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

function Settings({ onClose, onChanged }) {
  const current = api.getSettings();
  const [url, setUrl] = useState(current.url || '');
  const [passcode, setPasscode] = useState(current.passcode || '');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    setStatus('Connecting…');
    try {
      const n = await api.testConnection(url.trim(), passcode);
      api.saveSettings({ url: url.trim(), passcode });
      setStatus(`Connected ✓ Found ${n} deliverable${n === 1 ? '' : 's'}.`);
      setTimeout(onChanged, 700);
    } catch (e) {
      setStatus('✗ ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-head">
          <h2>Connect Google Sheet</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="form">
          <p className="muted full">
            Paste the Web app URL from Apps Script (it ends in <code>/exec</code>) and the passcode you set.
            These are saved on this device only.
          </p>
          <label className="field full">
            <span>Apps Script Web app URL</span>
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
          </label>
          <label className="field full">
            <span>Passcode</span>
            <input className="input" type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
          </label>
          {status && <p className="full status-line">{status}</p>}
          <div className="form-actions full">
            {current.url ? (
              <button
                className="btn ghost"
                onClick={() => {
                  api.saveSettings({});
                  onChanged();
                }}
              >
                Disconnect
              </button>
            ) : (
              <button
                className="btn ghost"
                onClick={() => {
                  api.resetDemo();
                  onChanged();
                }}
              >
                Reset demo data
              </button>
            )}
            <span className="spacer" />
            <button className="btn primary" disabled={busy || !url.trim()} onClick={connect}>
              {busy ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
