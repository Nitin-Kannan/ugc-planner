import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, RefreshCw, Settings2, CalendarClock, CalendarDays, ListTodo, Wallet, Search,
  ChevronLeft, ChevronRight, ChevronDown, Check, X, Users, TriangleAlert, ExternalLink,
  Trash2, CircleCheck, PencilLine, Send, CalendarCheck, Info, CircleAlert, SearchX,
} from 'lucide-react';
import * as api from './api';
import {
  TYPES, STATUSES, PAYMENTS, todayStr, addDays, parse, toStr, fmtDate, diffDays,
  keyDate, isDone, isOverdue, isValidDate, money, newId, emptyItem,
} from './utils';

const TABS = [
  { id: 'week', label: 'This week', Icon: CalendarClock },
  { id: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { id: 'all', label: 'All', Icon: ListTodo },
  { id: 'money', label: 'Payments', Icon: Wallet },
];

// On phones, don't pop the keyboard open the moment the form appears.
const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

const typeKey = (t) => 't-' + String(t || 'Reel').toLowerCase();
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const weekday = (s) => parse(s).toLocaleDateString('en-IN', { weekday: 'long' });

/* ------------------------------------------------------------------ */
/* App shell                                                           */
/* ------------------------------------------------------------------ */

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('week');
  const [editing, setEditing] = useState(null); // item being edited, or null
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState('');
  const [demo, setDemo] = useState(api.isDemo());

  const lastLoad = useRef(0);
  const editingRef = useRef(null);
  editingRef.current = editing;

  // silent = refresh in the background without the loading screen
  async function load(silent = false) {
    if (!silent) {
      setLoading(items.length === 0);
      setRefreshing(true);
      setError('');
    }
    try {
      const list = await api.listItems();
      // Don't overwrite the screen while a save is still on its way to the sheet.
      if (silent && api.hasPendingWrites()) return;
      setItems(list);
      setError('');
      lastLoad.current = Date.now();
    } catch (e) {
      if (!silent) setError(e.message);
    } finally {
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    load();
    // Fetch the latest from the sheet whenever she comes back to the app
    // (switching apps, unlocking the phone, another tab). This keeps two
    // devices in step and moves "Today" on after midnight.
    const onReturn = () => {
      if (document.visibilityState !== 'visible') return;
      if (editingRef.current) return; // never refresh under an open form
      if (Date.now() - lastLoad.current < 15000) return;
      load(true);
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, []);

  // Stop the page behind a form from scrolling while the form is open.
  useEffect(() => {
    const open = !!editing || showSettings;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [editing, showSettings]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const upsert = (list, it) => {
    const i = list.findIndex((x) => x.id === it.id);
    if (i < 0) return [...list, it];
    const copy = [...list];
    copy[i] = it;
    return copy;
  };

  // Optimistic save: update the screen first, then the sheet.
  // Returns true if the sheet saved it. On failure only this one item is
  // put back, so other changes made in the meantime are kept.
  async function save(item, msg = 'Saved') {
    const it = { ...item, id: item.id || newId() };
    const before = items.find((x) => x.id === it.id);
    setItems((list) => upsert(list, it));
    try {
      await api.saveItem(it);
      setToast(msg);
      return true;
    } catch (e) {
      setItems((list) => (before ? upsert(list, before) : list.filter((x) => x.id !== it.id)));
      setToast('Not saved. ' + e.message);
      return false;
    }
  }

  async function remove(id) {
    const before = items.find((x) => x.id === id);
    setItems((list) => list.filter((x) => x.id !== id));
    try {
      await api.deleteItem(id);
      setToast('Deleted');
      return true;
    } catch (e) {
      if (before) setItems((list) => upsert(list, before));
      setToast('Not deleted. ' + e.message);
      return false;
    }
  }

  const overdueCount = items.filter(isOverdue).length;
  const addNew = () => setEditing(emptyItem());

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-row container">
          <div className="brand">
            <Logo />
            <span className="brand-name">UGC Planner</span>
            {demo ? (
              <button className="sync demo" onClick={() => setShowSettings(true)} title="Connect your Google Sheet">
                <i className="sync-dot" />
                <span className="sync-text">Sample data</span>
              </button>
            ) : (
              <span className={'sync' + (error ? ' bad' : '')} title={error ? 'Could not reach the Google Sheet' : 'Synced with Google Sheets'}>
                <i className="sync-dot" />
                <span className="sync-text">{error ? 'Offline' : refreshing ? 'Syncing' : 'Synced'}</span>
              </span>
            )}
          </div>
          <div className="top-actions">
            <button className="icon-btn" onClick={() => load()} title="Refresh from Google Sheets" aria-label="Refresh">
              <RefreshCw size={16} strokeWidth={1.75} className={refreshing ? 'spin' : ''} />
            </button>
            <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings" aria-label="Settings">
              <Settings2 size={16} strokeWidth={1.75} />
            </button>
            <button className="btn primary" onClick={addNew}>
              <Plus size={16} strokeWidth={2} />
              <span className="label-wide">New deliverable</span>
              <span className="label-narrow">New</span>
            </button>
          </div>
        </div>

        <nav className="tabs container" aria-label="Views">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={'tab' + (tab === id ? ' active' : '')}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              <Icon size={16} strokeWidth={1.75} />
              <span>{label}</span>
              {id === 'week' && overdueCount > 0 && (
                <span className="tab-badge" title={`${overdueCount} overdue`}>{overdueCount}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="content container">
        {demo && (
          <div className="notice">
            <Info size={16} strokeWidth={1.75} />
            <p>
              You're viewing sample data.
              <span className="label-wide"> Changes stay on this device until you connect a Google Sheet.</span>
            </p>
            <button className="link-btn" onClick={() => setShowSettings(true)}>Connect sheet</button>
          </div>
        )}

        {loading && <Loading />}
        {!loading && error && items.length === 0 && (
          <div className="panel">
            <EmptyState
              icon={CircleAlert}
              tone="red"
              title="Couldn't load your deliverables"
              text={error}
              action={<button className="btn" onClick={() => load()}>Try again</button>}
            />
          </div>
        )}
        {!loading && (!error || items.length > 0) && (
          <>
            {error && (
              <div className="notice bad">
                <CircleAlert size={16} strokeWidth={1.75} />
                <p>Couldn't refresh from Google Sheets. Showing the last loaded data.</p>
                <button className="link-btn" onClick={() => load()}>Retry</button>
              </div>
            )}
            {tab === 'week' && <WeekView items={items} onOpen={setEditing} onSave={save} onAdd={addNew} goTo={setTab} />}
            {tab === 'calendar' && <CalendarView items={items} onOpen={setEditing} onSave={save} />}
            {tab === 'all' && <AllView items={items} onOpen={setEditing} onSave={save} onAdd={addNew} />}
            {tab === 'money' && <MoneyView items={items} onOpen={setEditing} onSave={save} />}
          </>
        )}
      </main>

      {editing && (
        <ItemForm
          item={editing}
          onClose={() => setEditing(null)}
          onSave={async (it, again) => {
            const ok = await save(it, it.id ? 'Changes saved' : 'Deliverable added');
            if (!ok) return false; // keep the form open with what she typed
            if (again) {
              // Same brand, next deliverable (e.g. 1 Reel + 3 Stories)
              setEditing({ ...emptyItem(), brand: it.brand, contact: it.contact, goLive: it.goLive });
            } else setEditing(null);
            return true;
          }}
          onDelete={async (id) => {
            if (await remove(id)) setEditing(null);
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

      {toast && <Toast message={toast} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                 */
/* ------------------------------------------------------------------ */

function Logo() {
  return (
    // Same mark as the home-screen icon: a queue of content frames, front one done.
    <svg className="logo" width="26" height="26" viewBox="0 0 1024 1024" aria-hidden="true">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6461e0" />
          <stop offset="1" stopColor="#3f3cb4" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="230" fill="url(#logo-bg)" />
      <rect x="456" y="250" width="260" height="440" rx="56" fill="#fff" opacity=".28" />
      <rect x="408" y="292" width="260" height="440" rx="56" fill="#fff" opacity=".5" />
      <rect x="308" y="334" width="300" height="456" rx="62" fill="#fff" />
      <path d="M388 566 l52 52 l96 -106" fill="none" stroke="#4744bf" strokeWidth="50" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Loading() {
  return (
    <div className="panel loading" aria-busy="true" aria-label="Loading deliverables">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="skeleton-row">
          <span className="sk sk-a" />
          <span className="sk sk-b" />
          <span className="sk sk-c" />
        </div>
      ))}
    </div>
  );
}

function Toast({ message }) {
  const bad = message.startsWith('Not ');
  return (
    <div className={'toast' + (bad ? ' bad' : '')} role="status">
      {bad ? <CircleAlert size={16} strokeWidth={1.75} /> : <Check size={16} strokeWidth={2} />}
      <span>{message}</span>
    </div>
  );
}

function EmptyState({ icon: Icon, title, text, action, tone }) {
  return (
    <div className="empty">
      <span className={'empty-icon' + (tone ? ' ' + tone : '')}>
        <Icon size={18} strokeWidth={1.75} />
      </span>
      <div className="empty-copy">
        <p className="empty-title">{title}</p>
        {text && <p className="empty-text">{text}</p>}
      </div>
      {action}
    </div>
  );
}

function TypeTag({ type }) {
  return (
    <span className={'type ' + typeKey(type)}>
      <i className="type-mark" />
      {type}
    </span>
  );
}

// Linear-style progress ring: empty for Briefed, filling up to a check for Live.
const STAGE_FRACTION = { Briefed: 0, Shooting: 0.25, 'Draft sent': 0.5, Approved: 0.75, Live: 1 };

function StageIcon({ status }) {
  const f = STAGE_FRACTION[status] ?? 0;
  if (f === 1) {
    return (
      <svg className="stage-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="6.25" fill="var(--green)" />
        <path d="M4.4 7.2l1.8 1.8 3.4-3.7" fill="none" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  const color = f === 0 ? 'var(--text-3)' : 'var(--accent)';
  const r = 3.4;
  const a = f * 2 * Math.PI;
  const x = 7 + r * Math.sin(a);
  const y = 7 - r * Math.cos(a);
  return (
    <svg className="stage-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="5.9" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray={f === 0 ? '2.2 1.9' : undefined} />
      {f > 0 && <path d={`M7 7 L7 ${7 - r} A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x} ${y} Z`} fill={color} />}
    </svg>
  );
}

// A dropdown that renders above everything (so tables and scroll areas never clip it).
function Menu({ label, trigger, triggerClass, items, onSelect, width = 196 }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btn = useRef(null);
  const menu = useRef(null);

  function toggle(e) {
    e.stopPropagation();
    if (open) return setOpen(false);
    const r = btn.current.getBoundingClientRect();
    const h = items.length * 34 + 40;
    const up = r.bottom + h + 8 > window.innerHeight && r.top > h + 8;
    const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
    setPos({ top: up ? r.top - h - 4 : r.bottom + 4, left });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const outside = (e) => {
      if (menu.current?.contains(e.target) || btn.current?.contains(e.target)) return;
      setOpen(false);
    };
    const key = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const close = (e) => {
      if (menu.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    menu.current?.querySelector('[aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={triggerClass}
        onClick={toggle}
        onKeyDown={(e) => e.stopPropagation()}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            className="menu"
            role="menu"
            aria-label={label}
            style={{ top: pos.top, left: pos.left, width }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="menu-label">{label}</p>
            {items.map((i) => (
              <button
                key={i.value}
                type="button"
                role="menuitemradio"
                aria-checked={!!i.selected}
                className={'menu-item' + (i.selected ? ' selected' : '')}
                onClick={() => {
                  setOpen(false);
                  if (!i.selected) onSelect(i.value);
                }}
              >
                {i.icon}
                <span>{i.label}</span>
                {i.selected && <Check size={14} strokeWidth={2} className="menu-check" />}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

function StageMenu({ it, onSave, compact }) {
  return (
    <Menu
      label="Change stage"
      triggerClass={'stage-btn' + (compact ? ' compact' : '')}
      trigger={
        <>
          <StageIcon status={it.status} />
          <span className="stage-name">{it.status}</span>
          <ChevronDown size={14} strokeWidth={1.75} className="chev" />
        </>
      }
      items={STATUSES.map((s) => ({ value: s, label: s, icon: <StageIcon status={s} />, selected: s === it.status }))}
      onSelect={(s) => onSave({ ...it, status: s }, `Moved to ${s}`)}
    />
  );
}

function PaymentMenu({ it, onSave }) {
  const p = it.payment || 'Unpaid';
  return (
    <Menu
      label="Payment status"
      width={168}
      triggerClass={'pay-badge pay-' + p.toLowerCase()}
      trigger={
        <>
          <i className="pay-dot" />
          {p}
          <ChevronDown size={14} strokeWidth={1.75} className="chev" />
        </>
      }
      items={PAYMENTS.map((s) => ({
        value: s,
        label: s,
        icon: <i className={'pay-dot pay-' + s.toLowerCase()} />,
        selected: s === p,
      }))}
      onSelect={(s) => onSave({ ...it, payment: s }, `Marked as ${s.toLowerCase()}`)}
    />
  );
}

// What the deadline line on a row says, and how urgent it looks.
function deadlineOf(it, kind) {
  const k = kind
    ? { label: kind === 'draft' ? 'Draft due' : 'Goes live', date: kind === 'draft' ? it.draftDue : it.goLive }
    : keyDate(it);
  if (!k || !k.date) return null;
  const draft = k.label === 'Draft due';
  const Icon = draft ? PencilLine : Send;
  if (!isValidDate(k.date)) return { Icon, tone: 'red', text: `Check ${draft ? 'draft' : 'go-live'} date` };
  if (kind) return { Icon, tone: 'muted', text: draft ? 'Draft due' : 'Goes live' };

  const n = diffDays(k.date, todayStr());
  const done = isDone(it);
  if (done) return { Icon, tone: 'muted', text: n < 0 ? `Went live ${fmtDate(k.date)}` : `Live ${fmtDate(k.date)}` };
  if (n < 0) return { Icon, tone: 'red', text: `${draft ? 'Draft' : 'Go-live'} ${plural(-n, 'day')} late` };
  if (n === 0) return { Icon, tone: 'amber', text: draft ? 'Draft due today' : 'Goes live today' };
  if (n === 1) return { Icon, tone: 'amber', text: draft ? 'Draft due tomorrow' : 'Goes live tomorrow' };
  if (n < 7) return { Icon, tone: 'default', text: `${draft ? 'Draft due' : 'Goes live'} ${weekday(k.date)}` };
  return { Icon, tone: 'default', text: `${draft ? 'Draft due' : 'Goes live'} ${fmtDate(k.date)}` };
}

/* ------------------------------------------------------------------ */
/* Deliverable row (used in lists)                                     */
/* ------------------------------------------------------------------ */

function ItemRow({ it, onOpen, onSave, kind }) {
  const due = deadlineOf(it, kind);
  return (
    <div
      className={'row' + (isDone(it) ? ' done' : '')}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(it)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen(it);
        }
      }}
    >
      <div className="row-type"><TypeTag type={it.type} /></div>
      <div className="row-main">
        <div className="row-title">
          <span className="row-brand">{it.brand}</span>
          {it.collab && (
            <span className="collab" title="Instagram Collab post">
              <Users size={13} strokeWidth={1.75} />
              Collab
            </span>
          )}
        </div>
        {it.notes && <p className="row-notes">{it.notes}</p>}
      </div>
      <div className={'row-due tone-' + (due?.tone || 'muted')}>
        {due ? (
          <>
            <due.Icon size={14} strokeWidth={1.75} />
            <span>{due.text}</span>
          </>
        ) : (
          <span className="muted">No date</span>
        )}
      </div>
      <div className="row-stage">
        <StageMenu it={it} onSave={onSave} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stats strip                                                         */
/* ------------------------------------------------------------------ */

function Stats({ stats }) {
  return (
    <div className="stats">
      {stats.map((s) => (
        <div key={s.label} className="stat">
          <p className="stat-label">
            <i className={'ind ind-' + s.tone} />
            {s.label}
          </p>
          <p className="stat-value">{s.value}</p>
          {s.hint && <p className="stat-hint">{s.hint}</p>}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* This week                                                           */
/* ------------------------------------------------------------------ */

function WeekView({ items, onOpen, onSave, onAdd, goTo }) {
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
  const nothing = overdue.length + today.length + soon.length === 0;

  return (
    <div className="stack">
      <Stats
        stats={[
          { label: 'Overdue', value: overdue.length, tone: 'red', hint: overdue.length ? 'Past their deadline' : 'All on track' },
          { label: 'Due today', value: today.length, tone: 'amber', hint: fmtDate(t) },
          { label: 'Going live', value: liveThisWeek, tone: 'accent', hint: `By ${fmtDate(week)}` },
        ]}
      />

      {nothing ? (
        <section className="panel">
          <EmptyState
            icon={CalendarCheck}
            title="Nothing due in the next 7 days"
            text={
              later.length
                ? `${plural(later.length, 'deliverable')} scheduled after ${fmtDate(week)}.`
                : 'Deliverables you add will appear here, sorted by deadline.'
            }
            action={
              later.length ? (
                <button className="btn" onClick={() => goTo('all')}>View all</button>
              ) : (
                <button className="btn" onClick={onAdd}><Plus size={16} strokeWidth={2} />New deliverable</button>
              )
            }
          />
        </section>
      ) : (
        <div className="sections">
          <Group title="Overdue" tone="red" items={overdue} empty="Nothing overdue" onOpen={onOpen} onSave={onSave} />
          <Group title="Today" tone="amber" items={today} empty="Nothing due today" onOpen={onOpen} onSave={onSave} />
          <Group title="Next 7 days" tone="accent" items={soon} empty="Nothing else due this week" onOpen={onOpen} onSave={onSave} />
          {later.length > 0 && (
            <button className="later-link" onClick={() => goTo('all')}>
              <span>{plural(later.length, 'more deliverable')} scheduled after {fmtDate(week)}</span>
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// One section of This week: a heading, then its own card of rows.
// An empty section collapses to a single line so it doesn't take up space.
function Group({ title, tone, items, empty, onOpen, onSave }) {
  const isEmpty = items.length === 0;
  return (
    <section className={'section' + (isEmpty ? ' is-empty' : '')} aria-label={title}>
      <div className="section-head">
        <i className={'ind ind-' + tone} />
        <h2>{title}</h2>
        <span className="count">{items.length}</span>
        {isEmpty && <span className="section-empty">{empty}</span>}
      </div>
      {!isEmpty && (
        <div className="panel">
          {items.map((it) => <ItemRow key={it.id} it={it} onOpen={onOpen} onSave={onSave} />)}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

function CalendarView({ items, onOpen, onSave }) {
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
  const goToday = () => {
    const d = new Date();
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelected(t);
  };

  return (
    <div className="cal-layout">
      <section className="panel cal-panel">
        <div className="panel-head">
          <h2>{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2>
          <div className="cal-nav">
            <button className="btn small" onClick={goToday}>Today</button>
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
              <ChevronLeft size={16} strokeWidth={1.75} />
            </button>
            <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month">
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
          </div>
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
                aria-label={`${parse(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}, ${plural(ev.length, 'item')}`}
                aria-pressed={d === selected}
              >
                <span className="cal-num">{parse(d).getDate()}</span>
                <span className="cal-events">
                  {ev.slice(0, 3).map(({ it, kind }) => (
                    <span key={it.id + kind} className={'ev ' + typeKey(it.type) + ' ev-' + kind}>
                      <i className="ev-mark" />
                      <span className="ev-text">{it.brand}</span>
                    </span>
                  ))}
                  {ev.length > 3 && <span className="cal-more">+{ev.length - 3} more</span>}
                </span>
              </button>
            );
          })}
        </div>

        <div className="legend">
          {TYPES.map((ty) => (
            <span key={ty} className={typeKey(ty)}><i className="type-mark" />{ty}</span>
          ))}
          <span className="legend-sep" />
          <span><i className="shape-live" />Goes live</span>
          <span><i className="shape-draft" />Draft due</span>
          <span><i className="shape-busy" />3+ items</span>
        </div>
      </section>

      <section className="panel day-panel">
        <div className="panel-head">
          <h2>
            {selected === t ? 'Today' : weekday(selected)}
            <span className="sub">{parse(selected).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}</span>
          </h2>
          <span className="count">{selectedEvents.length}</span>
        </div>
        {selectedEvents.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Nothing scheduled" text="This day is free for a new brand." />
        ) : (
          <div className="day-list">
            {selectedEvents.map(({ it, kind }) => (
              <ItemRow key={it.id + kind} it={it} kind={kind} onOpen={onOpen} onSave={onSave} />
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

function AllView({ items, onOpen, onSave, onAdd }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('Active');

  const countFor = (s) =>
    s === 'Active' ? items.filter((x) => !isDone(x)).length : s === 'All' ? items.length : items.filter((x) => x.status === s).length;

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

  const filtering = q.trim() || status !== 'Active';
  const lateDate = (it, field) => {
    const k = keyDate(it);
    return isOverdue(it) && k && k.date === it[field];
  };

  return (
    <div className="stack">
      <div className="toolbar">
        <label className="search">
          <Search size={16} strokeWidth={1.75} />
          <input
            id="search"
            placeholder="Search brand, contact or notes"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button className="search-clear" onClick={() => setQ('')} aria-label="Clear search">
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </label>
        <div className="filter-tabs" role="tablist" aria-label="Filter by stage">
          {['Active', ...STATUSES, 'All'].map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={status === s}
              className={'filter-tab' + (status === s ? ' on' : '')}
              onClick={() => setStatus(s)}
            >
              {s}
              <span className="filter-count">{countFor(s)}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="panel">
        {filtered.length === 0 ? (
          items.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title="No deliverables yet"
              text="Add the first brand deal to start tracking it."
              action={<button className="btn" onClick={onAdd}><Plus size={16} strokeWidth={2} />New deliverable</button>}
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title="No deliverables match"
              text="Try another search or stage."
              action={
                filtering && (
                  <button className="btn" onClick={() => { setQ(''); setStatus('Active'); }}>Clear filters</button>
                )
              }
            />
          )
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Type</th>
                  <th>Draft due</th>
                  <th>Go-live</th>
                  <th>Stage</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr
                    key={it.id}
                    tabIndex={0}
                    onClick={() => onOpen(it)}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && e.key === 'Enter') onOpen(it);
                    }}
                  >
                    <td>
                      <div className="cell-brand">
                        <span className="row-brand">{it.brand}</span>
                        {it.collab && <Users size={13} strokeWidth={1.75} className="collab-icon" aria-label="Collab" />}
                      </div>
                      {it.contact && <div className="cell-sub">{it.contact}</div>}
                    </td>
                    <td><TypeTag type={it.type} /></td>
                    <td className={'date' + (lateDate(it, 'draftDue') ? ' late' : '')}>{fmtDate(it.draftDue)}</td>
                    <td className={'date' + (lateDate(it, 'goLive') ? ' late' : '')}>{fmtDate(it.goLive)}</td>
                    <td onClick={(e) => e.stopPropagation()}><StageMenu it={it} onSave={onSave} compact /></td>
                    <td className="num">{it.amount ? money(it.amount) : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="list-mobile">
              {filtered.map((it) => (
                <ItemRow key={it.id} it={it} onOpen={onOpen} onSave={onSave} />
              ))}
            </div>
          </>
        )}
      </section>
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

  return (
    <div className="stack">
      <Stats
        stats={[
          { label: 'Received', value: money(sum(paid)), tone: 'green', hint: plural(paid.length, 'deliverable') },
          { label: 'Invoiced', value: money(sum(invoiced)), tone: 'amber', hint: 'Waiting to be paid' },
          { label: 'Not invoiced', value: money(sum(unpaid)), tone: 'accent', hint: plural(unpaid.length, 'deliverable') },
        ]}
      />

      {withAmount.length === 0 ? (
        <section className="panel">
          <EmptyState
            icon={Wallet}
            title="No payments to track yet"
            text="Add an amount to a deliverable and it will appear here."
          />
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="panel-head">
              <h2>To follow up<span className="sub">Posted or invoiced, not paid yet</span></h2>
              <span className="count">{chase.length}</span>
            </div>
            {chase.length === 0 ? (
              <EmptyState icon={CircleCheck} tone="green" title="Nothing to chase" text="Every live post has been paid for." />
            ) : (
              chase.map((it) => <PayRow key={it.id} it={it} onOpen={onOpen} onSave={onSave} />)
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>All deals</h2>
              <span className="count">{withAmount.length}</span>
            </div>
            {withAmount
              .slice()
              .sort((a, b) => (b.goLive || '').localeCompare(a.goLive || ''))
              .map((it) => (
                <PayRow key={it.id} it={it} onOpen={onOpen} onSave={onSave} />
              ))}
          </section>
        </>
      )}
    </div>
  );
}

function PayRow({ it, onOpen, onSave }) {
  return (
    <div
      className="pay-row"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(it)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && e.key === 'Enter') onOpen(it);
      }}
    >
      <div className="pay-main">
        <span className="row-brand">{it.brand}</span>
        <span className="pay-meta">
          <TypeTag type={it.type} />
          <span className="pay-sep" />
          <StageIcon status={it.status} />
          <span>{isDone(it) ? 'Live' : it.status}</span>
          {it.goLive && (
            <>
              <span className="pay-sep" />
              <span>{fmtDate(it.goLive)}</span>
            </>
          )}
        </span>
      </div>
      <span className="pay-amt">{money(it.amount)}</span>
      <span className="pay-state" onClick={(e) => e.stopPropagation()}>
        <PaymentMenu it={it} onSave={onSave} />
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add / edit form                                                     */
/* ------------------------------------------------------------------ */

function ItemForm({ item, onClose, onSave, onDelete }) {
  const [f, setF] = useState(item);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const isNew = !item.id;
  const brand = String(f.brand ?? '');
  const dirty = JSON.stringify(f) !== JSON.stringify(item);
  const datesBackwards = f.draftDue && f.goLive && f.goLive < f.draftDue;
  const set = (k) => (e) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  // "Save + add another" hands in a fresh item: reset the form to it.
  useEffect(() => {
    setF(item);
    setFailed(false);
  }, [item]);

  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape' && !dirty && !saving) onClose();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [dirty, saving]);

  async function submit(again) {
    if (!brand.trim() || saving) return;
    setSaving(true);
    setFailed(false);
    const ok = await onSave({ ...f, brand: brand.trim() }, again);
    if (ok === false) setFailed(true);
    setSaving(false);
  }

  // Tapping outside closes the form only when nothing has been typed yet.
  const onBackdrop = () => {
    if (!dirty && !saving) onClose();
  };

  const safeLink = /^https?:\/\//i.test(f.link || '');

  return (
    <div className="overlay" onClick={onBackdrop}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="form-title">
        <div className="sheet-head">
          <h2 id="form-title">{isNew ? 'New deliverable' : brand || 'Edit deliverable'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <form
          className="form"
          id="item-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
        >
          <label className="field full" htmlFor="f-brand">
            <span className="field-label">Brand</span>
            <input id="f-brand" className="input" value={brand} onChange={set('brand')} placeholder="e.g. Glow Theory" required autoFocus={isNew && !isTouch} />
          </label>

          <div className="field full">
            <span className="field-label">Content type</span>
            <div className="seg" role="radiogroup" aria-label="Content type">
              {TYPES.map((t) => (
                <button
                  type="button"
                  key={t}
                  role="radio"
                  aria-checked={f.type === t}
                  className={'seg-btn ' + typeKey(t) + (f.type === t ? ' on' : '')}
                  onClick={() => setF({ ...f, type: t })}
                >
                  <i className="type-mark" />
                  {t}
                </button>
              ))}
            </div>
          </div>

          <label className="field" htmlFor="f-draft">
            <span className="field-label">Draft due to brand</span>
            <input id="f-draft" className="input" type="date" value={f.draftDue} onChange={set('draftDue')} />
          </label>
          <label className="field" htmlFor="f-live">
            <span className="field-label">Go-live date</span>
            <input id="f-live" className="input" type="date" value={f.goLive} onChange={set('goLive')} />
          </label>
          {datesBackwards && (
            <p className="hint warn full">
              <TriangleAlert size={14} strokeWidth={1.75} />
              Go-live is before the draft due date. Check the dates are the right way round.
            </p>
          )}

          <label className="field" htmlFor="f-status">
            <span className="field-label">Stage</span>
            <span className="select">
              <select id="f-status" className="input" value={f.status} onChange={set('status')}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <ChevronDown size={16} strokeWidth={1.75} />
            </span>
          </label>
          <label className="field switch-field" htmlFor="f-collab">
            <span className="field-label">Instagram Collab</span>
            <span className="switch-row">
              <input id="f-collab" type="checkbox" className="switch" checked={!!f.collab} onChange={set('collab')} />
              <span className="switch-text">{f.collab ? 'Posted as a Collab' : 'Not a Collab post'}</span>
            </span>
          </label>

          <div className="form-divider full" />

          <label className="field" htmlFor="f-amount">
            <span className="field-label">Amount</span>
            <span className="affix">
              <span className="affix-sign">₹</span>
              <input id="f-amount" className="input" type="number" inputMode="numeric" min="0" value={f.amount} onChange={set('amount')} placeholder="0" />
            </span>
          </label>
          <label className="field" htmlFor="f-payment">
            <span className="field-label">Payment</span>
            <span className="select">
              <select id="f-payment" className="input" value={f.payment} onChange={set('payment')}>
                {PAYMENTS.map((s) => <option key={s}>{s}</option>)}
              </select>
              <ChevronDown size={16} strokeWidth={1.75} />
            </span>
          </label>

          <label className="field full" htmlFor="f-contact">
            <span className="field-label">Brand contact</span>
            <input id="f-contact" className="input" value={f.contact} onChange={set('contact')} placeholder="Name, email or @handle" />
          </label>

          <label className="field full" htmlFor="f-link">
            <span className="field-label">
              Post link
              {safeLink && (
                <a className="field-link" href={f.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                  Open post <ExternalLink size={12} strokeWidth={2} />
                </a>
              )}
            </span>
            <input id="f-link" className="input" type="url" value={f.link} onChange={set('link')} placeholder="Add once the post is live" />
          </label>

          <label className="field full" htmlFor="f-notes">
            <span className="field-label">Notes</span>
            <textarea id="f-notes" className="input" rows="3" value={f.notes} onChange={set('notes')} placeholder="Hashtags, tags, brief, how long it must stay up" />
          </label>

          {failed && (
            <p className="hint error full">
              <CircleAlert size={14} strokeWidth={1.75} />
              Not saved yet. Your details are still here. Check your connection and save again.
            </p>
          )}
        </form>

        <div className="sheet-foot">
          {!isNew && (
            <button
              type="button"
              className="btn ghost danger"
              onClick={() => {
                if (confirm(`Delete this ${f.type} for ${brand}?`)) onDelete(f.id);
              }}
            >
              <Trash2 size={16} strokeWidth={1.75} />
              <span className="label-wide">Delete</span>
            </button>
          )}
          <span className="spacer" />
          {isNew && (
            <button type="button" className="btn" disabled={saving || !brand.trim()} onClick={() => submit(true)}>
              Save and add another
            </button>
          )}
          <button type="submit" form="item-form" className="btn primary" disabled={saving || !brand.trim()}>
            {saving ? 'Saving…' : isNew ? 'Add deliverable' : 'Save changes'}
          </button>
        </div>
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
  const [status, setStatus] = useState(null); // { tone, text }
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    setStatus({ tone: 'muted', text: 'Connecting…' });
    try {
      const n = await api.testConnection(url.trim(), passcode);
      api.saveSettings({ url: url.trim(), passcode });
      setStatus({ tone: 'green', text: `Connected. Found ${plural(n, 'deliverable')}.` });
      setTimeout(onChanged, 700);
    } catch (e) {
      setStatus({ tone: 'red', text: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet narrow" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="sheet-head">
          <h2 id="settings-title">Google Sheet connection</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="form">
          <p className="form-intro full">
            Paste the Web app URL from Apps Script (it ends in <code>/exec</code>) and your passcode.
            They're saved on this device only.
          </p>
          <label className="field full" htmlFor="s-url">
            <span className="field-label">Apps Script Web app URL</span>
            <input id="s-url" className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" />
          </label>
          <label className="field full" htmlFor="s-pass">
            <span className="field-label">Passcode</span>
            <input id="s-pass" className="input" type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
          </label>
          {status && (
            <p className={'hint full ' + (status.tone === 'red' ? 'error' : status.tone === 'green' ? 'ok' : '')}>
              {status.tone === 'red' ? <CircleAlert size={14} strokeWidth={1.75} /> : status.tone === 'green' ? <CircleCheck size={14} strokeWidth={1.75} /> : null}
              {status.text}
            </p>
          )}
        </div>
        <div className="sheet-foot">
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
              Reset sample data
            </button>
          )}
          <span className="spacer" />
          <button className="btn primary" disabled={busy || !url.trim()} onClick={connect}>
            {busy ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
