// Turns a WhatsApp "Export chat" .txt into a list of messages.
// Handles Android ("31/12/23, 11:59 pm - Name: hi") and iPhone
// ("[31/12/23, 11:59:59 PM] Name: hi") exports, 12h and 24h clocks,
// day-first and month-first dates, and multi-line messages.

const ANDROID = /^(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([ap]\.?\s?m\.?)?\s+-\s+([\s\S]*)$/i;
const IPHONE = /^\[(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*([ap]\.?\s?m\.?)?\]\s+([\s\S]*)$/i;

// Invisible direction marks WhatsApp sprinkles through exports.
const BIDI = /[‎‏‪-‮⁦-⁩﻿]/g;
// Odd spaces (narrow no-break before AM/PM, no-break space).
const ODD_SPACE = /[   ]/g;

const MEDIA = /^(<media omitted>|(image|video|audio|sticker|gif|document|contact card) omitted|<attached: .*>|.+\.(jpg|jpeg|png|webp|mp4|opus|pdf|vcf) \(file attached\))$/i;
const DELETED = /^(this message was deleted\.?|you deleted this message\.?)$/i;
const EDITED = /\s*<this message was edited>$/i;
const VIEW_ONCE = /^(view once|null)$/i;

/** @typedef {{ date: Date, author: string, text: string, kind: 'text'|'media'|'deleted' }} Message */

/**
 * @param {string} raw contents of the exported .txt
 * @returns {{ messages: Message[], dateOrder: 'DMY'|'MDY'|'YMD', departed: Set<string> }}
 */
export function parseChat(raw) {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');

  // Pass 1: split into entries (header line + continuation lines).
  const entries = [];
  for (const original of lines) {
    const hadMark = /^\s*\[?[^\]]*\]?\s*[^:]*:\s*‎/.test(original);
    const line = original.replace(ODD_SPACE, ' ').replace(BIDI, '');
    const m = ANDROID.exec(line) || IPHONE.exec(line);
    if (m) {
      entries.push({ parts: m.slice(1, 8), body: m[8], marked: hadMark });
    } else if (entries.length) {
      entries[entries.length - 1].body += '\n' + line;
    }
  }

  const dateOrder = guessDateOrder(entries.map(e => e.parts));
  const messages = [];
  const events = []; // who joined / left, in order

  for (const { parts, body, marked } of entries) {
    const date = toDate(parts, dateOrder);
    if (!date) continue;

    const sep = body.indexOf(': ');
    // Android system notices have no "Name: " — "Riya left", "Kabir added Zoya" …
    // `You changed the subject from "a: b"` has a colon but no author.
    if (sep <= 0 || sep > 60 || (sep > 25 && looksLikeSystem(body.slice(0, sep)))) {
      addEvent(events, date, body);
      continue;
    }

    const author = cleanName(body.slice(0, sep));
    let text = body.slice(sep + 2).replace(EDITED, '').trim();

    let kind = 'text';
    if (MEDIA.test(text) || VIEW_ONCE.test(text)) kind = 'media';
    else if (DELETED.test(text)) kind = 'deleted';
    else if (marked && looksLikeSystem(text)) { addEvent(events, date, text); continue; } // iPhone notices
    if (!author) continue;

    messages.push({ date, author, text: kind === 'text' ? text : '', kind });
  }

  messages.sort((a, b) => a.date - b.date);
  return { messages, dateOrder, departed: departedMembers(events) };
}

// ---------- group membership ----------

const LEFT = /^(.+?) left$/i;
const REMOVED = /^(.+?) removed (.+)$/i;
const ADDED = /^(.+?) added (.+)$/i;
const JOINED = /^(.+?) joined( using (this|a) group'?s invite link| from the community)?$/i;

function addEvent(events, date, text) {
  const t = text.trim().replace(/\.$/, '');
  let m;
  if ((m = LEFT.exec(t))) events.push({ date, type: 'leave', names: [m[1]] });
  else if ((m = REMOVED.exec(t))) events.push({ date, type: 'leave', names: splitNames(m[2]) });
  else if ((m = ADDED.exec(t))) events.push({ date, type: 'join', names: splitNames(m[2]) });
  else if ((m = JOINED.exec(t))) events.push({ date, type: 'join', names: [m[1]] });
}

function splitNames(list) {
  return list.split(/,\s*|\s+and\s+/).map(cleanName).filter(Boolean);
}

/** People whose most recent membership event is leaving or being removed. */
function departedMembers(events) {
  const gone = new Set();
  events.sort((a, b) => a.date - b.date);
  for (const e of events) {
    for (const raw of e.names) {
      const name = cleanName(raw);
      if (/^you$/i.test(name)) continue; // the person who exported is always in the chat
      if (e.type === 'leave') gone.add(name); else gone.delete(name);
    }
  }
  return gone;
}

const SYSTEM_HINTS = /(end-to-end encrypted|created (this )?group|added|removed|left\.?$|joined( using| from|\.?$)|changed (the|this group|their)|security code|now an admin|pinned a message|disappearing messages|message timer|missed (voice|video) call)/i;
function looksLikeSystem(text) {
  return SYSTEM_HINTS.test(text);
}

function cleanName(name) {
  return name.replace(/^~\s*/, '').replace(/\s+/g, ' ').trim();
}

/** Decide whether dates are day/month/year or month/day/year. */
function guessDateOrder(partsList) {
  let firstOver12 = false, secondOver12 = false, yearFirst = false;
  for (const [a, b] of partsList) {
    if (a.length === 4) { yearFirst = true; break; }
    if (+a > 12) firstOver12 = true;
    if (+b > 12) secondOver12 = true;
  }
  if (yearFirst) return 'YMD';
  if (secondOver12 && !firstOver12) return 'MDY';
  return 'DMY'; // the default in India and most of the world
}

function toDate([a, b, c, h, min, s, ampm], order) {
  let day, month, year;
  if (order === 'YMD') [year, month, day] = [+a, +b, +c];
  else if (order === 'MDY') [month, day, year] = [+a, +b, +c];
  else [day, month, year] = [+a, +b, +c];
  if (year < 100) year += 2000;

  let hour = +h;
  if (ampm) {
    const pm = /p/i.test(ampm);
    if (hour === 12) hour = pm ? 12 : 0;
    else if (pm) hour += 12;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23) return null;
  const d = new Date(year, month - 1, day, hour, +min, +(s || 0));
  return d.getMonth() === month - 1 ? d : null;
}

/** "WhatsApp Chat with Squad 🔥.txt" / "WhatsApp Chat - Squad.zip" → "Squad 🔥" */
export function chatNameFromFile(filename) {
  const base = filename.replace(/\.(txt|zip)$/i, '').replace(/\s*\(\d+\)$/, '');
  const m = /^WhatsApp Chat (?:with|-)\s*(.+)$/i.exec(base);
  if (m) return m[1].trim();
  return base === '_chat' ? '' : base;
}

/** Hide the middle of phone numbers that show up as names. */
export function maskIfNumber(name) {
  const digits = name.replace(/\D/g, '');
  if (!/^\+?[\d\s\-()]{7,}$/.test(name) || digits.length < 7) return name;
  const plus = name.trim().startsWith('+');
  const cc = plus && digits.length > 10 ? digits.slice(0, digits.length - 10) : '';
  const local = digits.slice(cc.length);
  return `${plus ? '+' : ''}${cc}${cc ? ' ' : ''}${local.slice(0, 2)}••• ••${local.slice(-3)}`;
}
