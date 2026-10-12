/**
 * UGC Planner — Google Sheets backend
 *
 * Paste this into Extensions → Apps Script of the Google Sheet,
 * run `setup` once, set your passcode, then Deploy → New deployment → Web app.
 * Full steps are in the README.
 */

const SHEET_NAME = 'Deliverables';
const HEADERS = [
  'id', 'brand', 'contact', 'type', 'draftDue', 'goLive',
  'status', 'amount', 'payment', 'collab', 'link', 'notes', 'updatedAt',
];
const DATE_COLS = ['draftDue', 'goLive'];
// Every column except amount and updatedAt is stored as plain text, so Sheets
// never turns phone numbers, notes or brand names into numbers, dates or formulas.
const TEXT_COLS = HEADERS.filter((h) => h !== 'amount' && h !== 'updatedAt');

/** Run this once from the Apps Script editor. */
function setup() {
  const sh = getSheet_();
  sh.getRange(1, 1, 1, HEADERS.length)
    .setValues([HEADERS])
    .setFontWeight('bold')
    .setBackground('#fce4ec');
  sh.setFrozenRows(1);
  // Keep text columns (including dates) as plain text.
  TEXT_COLS.forEach((c) => {
    const col = HEADERS.indexOf(c) + 1;
    sh.getRange(1, col, sh.getMaxRows(), 1).setNumberFormat('@');
  });
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PASSCODE')) props.setProperty('PASSCODE', 'change-me');
}

/** Optional: run this to change the passcode (edit the value first). */
function setPasscode() {
  PropertiesService.getScriptProperties().setProperty('PASSCODE', 'change-me');
}

function doGet() {
  return json_({ ok: true, message: 'UGC Planner backend is running.' });
}

function doPost(e) {
  let req = {};
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Bad request' });
  }

  const pass = PropertiesService.getScriptProperties().getProperty('PASSCODE');
  if (!pass || req.passcode !== pass) return json_({ ok: false, error: 'Wrong passcode' });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return json_({ ok: false, busy: true, error: 'The sheet is busy. Please try again in a moment.' });
  }
  try {
    const sh = getSheet_();
    switch (req.action) {
      case 'list':
        return json_({ ok: true, items: readAll_(sh) });
      case 'save':
        return json_({ ok: true, item: save_(sh, req.item || {}) });
      case 'delete':
        remove_(sh, req.id);
        return json_({ ok: true });
      default:
        return json_({ ok: false, error: 'Unknown action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ---------- helpers ----------

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function readAll_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  const items = [];
  values.forEach((row, i) => {
    if (!row[HEADERS.indexOf('brand')]) return; // skip blank rows
    const item = rowToItem_(row);
    // Rows typed directly into the sheet won't have an id yet — give them one.
    if (!item.id) {
      item.id = Utilities.getUuid().slice(0, 12);
      sh.getRange(i + 2, 1).setValue(item.id);
    }
    items.push(item);
  });
  return items;
}

function isDate_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

function rowToItem_(row) {
  // Use the sheet's own time zone (File → Settings), not the script's,
  // so dates never shift by a day.
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const item = {};
  HEADERS.forEach((h, i) => {
    let v = row[i];
    if (isDate_(v)) v = Utilities.formatDate(v, tz, h === 'updatedAt' ? "yyyy-MM-dd'T'HH:mm:ss" : 'yyyy-MM-dd');
    if (v === null || v === undefined) v = '';
    if (h === 'collab') v = v === true || String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'yes';
    else if (h === 'amount') v = v === '' ? '' : Number(v) || 0;
    else v = String(v); // always send text, even if an older row holds a number
    item[h] = v;
  });
  item.id = String(item.id);
  return item;
}

function itemToRow_(item) {
  return HEADERS.map((h) => {
    if (h === 'updatedAt') return new Date();
    if (h === 'collab') return item.collab ? 'Yes' : 'No';
    if (h === 'amount') return item.amount === '' || item.amount == null ? '' : Number(item.amount) || 0;
    const v = item[h];
    const s = v === undefined || v === null ? '' : String(v);
    // A leading apostrophe makes Sheets store "=…" as text, not a formula.
    // Sheets hides the apostrophe and never returns it.
    return s.charAt(0) === '=' ? "'" + s : s;
  });
}

function findRow_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2 || !id) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function save_(sh, item) {
  if (!item.id) item.id = Utilities.getUuid().slice(0, 12);
  const row = itemToRow_(item);
  let r = findRow_(sh, item.id);
  if (r < 0) r = sh.getLastRow() + 1;
  const range = sh.getRange(r, 1, 1, HEADERS.length);
  // Keep text cells as plain text so Sheets never converts them.
  TEXT_COLS.forEach((c) => range.getCell(1, HEADERS.indexOf(c) + 1).setNumberFormat('@'));
  range.setValues([row]);
  return item;
}

function remove_(sh, id) {
  const r = findRow_(sh, id);
  if (r > 0) sh.deleteRow(r);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
