// Crunches parsed messages into raw numbers. No captions or wording here —
// cards.js turns these into slides.

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const CONVO_GAP = 6 * HOUR;   // silence that counts as "the chat died"
const REPLY_WINDOW = 2 * HOUR; // longer than this isn't a reply, it's a new topic

const BRO = /\b(bro+|bruh+|bhai+|bhaiya|dude)\b/gi;
const LAUGH = /(😂|🤣|💀|😭)|\b(lo+l|lmf?ao+|(?:ha){2,}h?|(?:he){2,}|xd+)\b/giu;
const PICTO = /\p{Extended_Pictographic}/u;
const WORD = /[\p{L}][\p{L}']*/gu;
const LINK = /https?:\/\/\S+/g;

// English + Hinglish filler that would otherwise top every chat.
const STOP = new Set(`the and you that this for are was with have not but what all its it's i'm
just like your can they when about from will get there their them then than one out how why who
yes yeah yea okay ok haan han hai hain ka ki ke ko to toh na nahi nhi kya ho hoga bhi me mein main
mai se ye yeh wo woh tha thi the aur kar karo kr raha rahi rhe rha bol bolo hu hun hum tum tu tera
teri mera meri apna kuch koi abhi ab bas par pe sab ek do kyu kyun kaise kab jab tab fir phir wala
wali vo jo bhai bro lol haha omitted media message deleted edited null www com https http`.split(/\s+/));

export function computeStats(messages) {
  const people = new Map();
  const person = name => {
    if (!people.has(name)) people.set(name, {
      name, msgs: 0, texts: 0, words: 0, media: 0, deleted: 0, night: 0,
      bro: 0, laughs: 0, started: 0, killed: 0, replies: [], emojis: new Map(),
    });
    return people.get(name);
  };

  const emojiTotals = new Map();
  const wordTotals = new Map();
  const byDay = new Map();
  const byHour = new Array(24).fill(0);
  const byWeekday = new Array(7).fill(0);
  let words = 0, media = 0, deleted = 0, longestSilence = null;
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;

  messages.forEach((m, i) => {
    const p = person(m.author);
    const prev = messages[i - 1];
    const next = messages[i + 1];
    p.msgs++;

    const h = m.date.getHours();
    byHour[h]++;
    byWeekday[m.date.getDay()]++;
    if (h < 5) p.night++;
    const key = dayKey(m.date);
    byDay.set(key, (byDay.get(key) || 0) + 1);

    if (prev) {
      const gap = m.date - prev.date;
      if (gap >= CONVO_GAP) p.started++;
      else if (prev.author !== m.author && gap <= REPLY_WINDOW) p.replies.push(gap);
      if (!longestSilence || gap > longestSilence.ms) longestSilence = { ms: gap, from: prev.date, to: m.date };
    }
    if (next && next.date - m.date >= CONVO_GAP) p.killed++;

    if (m.kind === 'media') { p.media++; media++; return; }
    if (m.kind === 'deleted') { p.deleted++; deleted++; return; }

    p.texts++;
    const text = m.text.replace(LINK, ' ');
    const ws = text.match(WORD) || [];
    p.words += ws.length;
    words += ws.length;
    for (const w of ws) {
      const lw = w.toLowerCase();
      if (lw.length < 3 || STOP.has(lw)) continue;
      wordTotals.set(lw, (wordTotals.get(lw) || 0) + 1);
    }
    p.bro += (text.match(BRO) || []).length;
    p.laughs += (text.match(LAUGH) || []).length;

    if (PICTO.test(text)) {
      const graphemes = segmenter ? [...segmenter.segment(text)].map(s => s.segment) : [...text];
      for (const g of graphemes) {
        if (!PICTO.test(g)) continue;
        const e = g.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, ''); // fold skin tones together
        p.emojis.set(e, (p.emojis.get(e) || 0) + 1);
        emojiTotals.set(e, (emojiTotals.get(e) || 0) + 1);
      }
    }
  });

  const list = [...people.values()].sort((a, b) => b.msgs - a.msgs);
  for (const p of list) {
    p.medianReply = median(p.replies);
    p.avgWords = p.texts ? p.words / p.texts : 0;
    p.topEmoji = top(p.emojis, 1)[0]?.key || null;
    delete p.emojis;
  }

  const first = messages[0].date, last = messages[messages.length - 1].date;
  const spanDays = Math.max(1, Math.round((startOfDay(last) - startOfDay(first)) / DAY) + 1);
  const [busiest] = top(byDay, 1);

  return {
    total: messages.length, words, media, deleted,
    first, last, spanDays, activeDays: byDay.size,
    people: list,
    emojis: top(emojiTotals, 5),
    topWords: top(wordTotals, 8),
    busiestDay: busiest ? { date: fromKey(busiest.key), count: busiest.value } : null,
    byHour, byWeekday,
    peakHour: byHour.indexOf(Math.max(...byHour)),
    streak: longestStreak([...byDay.keys()]),
    longestSilence,
  };
}

// ---------- helpers ----------

export function top(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([key, value]) => ({ key, value }));
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function dayKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function fromKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }

function longestStreak(keys) {
  const days = keys.map(fromKey).sort((a, b) => a - b);
  let best = { days: 0 }, runStart = days[0], run = 0;
  days.forEach((d, i) => {
    if (i && Math.round((d - days[i - 1]) / DAY) === 1) run++;
    else { run = 1; runStart = d; }
    if (run > best.days) best = { days: run, from: runStart, to: d };
  });
  return best;
}
