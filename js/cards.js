// Turns stats into the slides: what each one says, and the caption that roasts you.
// Every card is plain data, so the same card draws on screen and onto a share image.

export const THEMES = [
  { a: '#ff2e93', b: '#7b2ff7', ink: '#fff' },
  { a: '#00f5a0', b: '#00b4d8', ink: '#08130f' },
  { a: '#ff6b00', b: '#ff0055', ink: '#fff' },
  { a: '#14142b', b: '#3a0ca3', ink: '#fff' },
  { a: '#c6ff00', b: '#2bd96b', ink: '#0b1400' },
  { a: '#00c6ff', b: '#0049ff', ink: '#fff' },
  { a: '#ffd200', b: '#ff8a00', ink: '#1a1000' },
  { a: '#8e2de2', b: '#ff2e93', ink: '#fff' },
];

const num = n => Math.round(n).toLocaleString('en-IN');
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const date = d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const hourLabel = h => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
const plural = (n, word) => `${num(n)} ${word}${n === 1 ? '' : 's'}`;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function duration(ms) {
  const s = ms / 1000;
  if (s < 60) return `${Math.max(1, Math.round(s))} sec`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86400 * 2) return `${Math.round(s / 3600)} hours`;
  return `${Math.round(s / 86400)} days`;
}

/**
 * @param stats from computeStats
 * @param {string} chatName
 * @param {(name: string) => string} nm how to display a person (masking / nicknames)
 */
export function buildCards(stats, chatName, nm) {
  const s = stats;
  const P = s.people;
  const cards = [];
  const add = card => cards.push({ ...card, theme: THEMES[cards.length % THEMES.length] });
  const group = chatName || 'your chat';
  const perDay = s.total / s.spanDays;
  const rank = (list, val, fmt = num) =>
    list.slice(0, 5).map(p => ({ label: nm(p.name), value: fmt(val(p)), pct: val(p) / (val(list[0]) || 1) }));

  // 1. Intro
  add({
    id: 'intro', kicker: 'yap report', emoji: '📱',
    title: group,
    sub: `${date(s.first)} → ${date(s.last)} · ${P.length} people · ${plural(s.spanDays, 'day')}`
      + (s.leftCount ? ` · ${s.leftCount} ex-${s.leftCount === 1 ? 'member' : 'members'} not counted` : ''),
    caption: "aight gang, let's see how cooked this chat is 👀",
  });

  // 2. Total messages
  add({
    id: 'total', kicker: 'total yap', emoji: '💬',
    title: 'messages sent', big: num(s.total),
    sub: `${num(perDay)} a day · ${num(s.words)} words`,
    caption: perDay > 150 ? "this ain't a gc no more, it's a full-time job cuh 💀"
      : perDay > 40 ? "y'all touched some grass lately? asking for a friend 🌱"
      : perDay > 8 ? 'lowkey healthy amount of yap. kinda sus ngl 🤨'
      : 'this chat dry af fr 🏜️',
  });

  // 3. Top yapper
  const yap = P[0];
  const yapShare = pct(yap.msgs, s.total);
  add({
    id: 'yapper', kicker: 'top yapper', emoji: '🗣️',
    title: nm(yap.name), big: plural(yap.msgs, 'msg'),
    sub: `${yapShare}% of the entire chat`,
    rows: rank(P, p => p.msgs),
    caption: yapShare > 45 ? 'bestie treats the gc like their personal diary 📔'
      : yapShare > 25 ? 'certified yapper. no thoughts, just sending 🗣️'
      : 'top yapper, but it was a close race ngl',
  });

  // 4. Ghost
  if (P.length > 2) {
    const ghost = P[P.length - 1];
    add({
      id: 'ghost', kicker: 'the ghost', emoji: '👻',
      title: nm(ghost.name), big: plural(ghost.msgs, 'msg'),
      sub: `in ${plural(s.spanDays, 'day')}`,
      caption: ghost.msgs < 10 ? 'twin is this person even real?? blink twice if you need help 👻'
        : 'reads everything, replies to nothing. lurker gang 🫥',
    });
  }

  // 5. 3am menace
  const owls = [...P].sort((a, b) => b.night - a.night);
  if (owls[0].night > 0) {
    add({
      id: 'night', kicker: '3am menace', emoji: '🌙',
      title: nm(owls[0].name), big: `${num(owls[0].night)}`,
      sub: 'messages between midnight and 5am',
      rows: rank(owls.filter(p => p.night), p => p.night),
      caption: 'big dawg does NOT sleep. the grind (of doing nothing) never stops 🌙',
    });
  }

  // 6. Emojis
  if (s.emojis.length) {
    const e = s.emojis[0].key;
    add({
      id: 'emoji', kicker: 'top emoji', emoji: e,
      title: "the gc's entire personality", big: `${num(s.emojis[0].value)}×`,
      rows: s.emojis.map((x, i) => ({ label: x.key, value: num(x.value), pct: x.value / s.emojis[0].value })),
      caption: e === '💀' ? 'everyone in this gc is dead inside fr 💀'
        : e === '😂' ? 'boomer laugh detected 😂 ur uncle would be proud cuh'
        : e === '😭' ? 'crying but make it funny 😭'
        : /❤|🥰|😍|🫶/u.test(e) ? 'a wholesome gc?? in this economy??'
        : /🔥/u.test(e) ? "everything's fire, nothing's mid. delulu is the solulu 🔥"
        : 'interesting choice gang. we respect it.',
    });
  }

  // 7. Busiest day
  if (s.busiestDay) {
    add({
      id: 'busiest', kicker: 'busiest day ever', emoji: '📈',
      title: date(s.busiestDay.date), big: plural(s.busiestDay.count, 'msg'),
      sub: `that was a ${DAYS[s.busiestDay.date.getDay()]}`,
      caption: "something went DOWN that day. nobody's allowed to forget 📈",
    });
  }

  // 8. Peak hour
  add({
    id: 'hours', kicker: 'peak hour', emoji: '⏰',
    title: 'when the yap hits hardest', big: hourLabel(s.peakHour),
    bars: s.byHour,
    caption: s.peakHour < 5 ? "peak yap at night. y'all are straight up nocturnal 🦉"
      : s.peakHour < 12 ? "morning yappers?? that's lowkey concerning"
      : s.peakHour < 18 ? 'peak yap during work hours. productivity: zero, no cap'
      : 'evening yap sesh. a certified classic.',
  });

  // 9. Fastest replier
  const repliers = P.filter(p => p.replies.length >= 10 && p.medianReply != null)
    .sort((a, b) => a.medianReply - b.medianReply);
  if (repliers.length > 1) {
    add({
      id: 'fast', kicker: 'fastest replier', emoji: '⚡',
      title: nm(repliers[0].name), big: duration(repliers[0].medianReply),
      sub: 'typical reply time',
      rows: rank(repliers, p => p.medianReply, duration).map((r, i, all) => ({ ...r, pct: 1 - i / (all.length + 1) })),
      caption: "my guy's phone is glued to their hand. do they even blink?? ⚡",
    });
  }

  // 10. Conversation starter & killer
  const starters = [...P].sort((a, b) => b.started - a.started);
  const killers = [...P].sort((a, b) => b.killed - a.killed);
  if (starters[0].started > 0) {
    add({
      id: 'starter', kicker: 'chat defibrillator', emoji: '⚡',
      title: nm(starters[0].name), big: `${num(starters[0].started)}×`,
      sub: 'times they revived a dead chat',
      caption: 'real one fr. without them this gc would be a graveyard 🪦',
    });
  }
  if (killers[0].killed > 0) {
    add({
      id: 'killer', kicker: 'conversation killer', emoji: '🔪',
      title: nm(killers[0].name), big: `${num(killers[0].killed)}×`,
      sub: 'times they sent the last message before the chat went silent',
      caption: 'one text from them and suddenly everyone\'s "busy" 💀',
    });
  }

  // 11. Essays vs dry texts
  const talkers = P.filter(p => p.texts >= 20).sort((a, b) => b.avgWords - a.avgWords);
  if (talkers.length > 1) {
    const essay = talkers[0], dry = talkers[talkers.length - 1];
    add({
      id: 'essay', kicker: 'essay writer vs dry texter', emoji: '📝',
      title: `${nm(essay.name)} vs ${nm(dry.name)}`,
      big: `${essay.avgWords.toFixed(1)} vs ${dry.avgWords.toFixed(1)}`,
      sub: 'words per message',
      rows: [
        { label: `📝 ${nm(essay.name)}`, value: `${essay.avgWords.toFixed(1)} words`, pct: 1 },
        { label: `🏜️ ${nm(dry.name)}`, value: `${dry.avgWords.toFixed(1)} words`, pct: dry.avgWords / essay.avgWords },
      ],
      caption: 'one writes essays, the other replies "k". balanced ecosystem fr.',
    });
  }

  // 12. Bro counter
  const bros = [...P].sort((a, b) => b.bro - a.bro);
  if (bros[0].bro >= 5) {
    add({
      id: 'bro', kicker: 'bro counter', emoji: '🤝',
      title: nm(bros[0].name), big: `${num(bros[0].bro)}`,
      sub: 'times they said bro, bhai or bruh',
      rows: rank(bros.filter(p => p.bro), p => p.bro),
      caption: "bro isn't a word, it's a whole lifestyle broskie 🤝",
    });
  }

  // 13. Laughs
  const laughers = [...P].sort((a, b) => b.laughs - a.laughs);
  if (laughers[0].laughs >= 5) {
    add({
      id: 'laugh', kicker: 'most entertained', emoji: '😹',
      title: nm(laughers[0].name), big: `${num(laughers[0].laughs)}`,
      sub: 'laughs sent (lol, lmao, 💀, 😭…)',
      caption: 'either this gc is peak comedy or those laughs are fake af. no in-between 😹',
    });
  }

  // 14. Media and deleted
  const dumpers = [...P].sort((a, b) => b.media - a.media);
  if (dumpers[0].media >= 5) {
    add({
      id: 'media', kicker: 'media dumper', emoji: '🖼️',
      title: nm(dumpers[0].name), big: `${num(dumpers[0].media)}`,
      sub: 'photos, videos, stickers and voice notes',
      caption: 'sticker spammer arc. homie only speaks in memes 🖼️',
    });
  }
  const deleters = [...P].sort((a, b) => b.deleted - a.deleted);
  if (deleters[0].deleted >= 2) {
    add({
      id: 'deleted', kicker: 'deleted evidence', emoji: '🤨',
      title: nm(deleters[0].name), big: `${num(deleters[0].deleted)}`,
      sub: 'messages deleted',
      caption: 'what you hiding cuh? we saw nothing. (we saw everything) 🤨',
    });
  }

  // 15. Streak & silence
  if (s.streak.days > 1) {
    const silence = s.longestSilence;
    add({
      id: 'streak', kicker: 'longest streak', emoji: '🔥',
      title: `${num(s.streak.days)} days in a row`, big: `${num(s.streak.days)}🔥`,
      sub: `${date(s.streak.from)} → ${date(s.streak.to)}`,
      rows: silence && silence.ms > 86400e3 ? [{ label: 'longest silence', value: duration(silence.ms), pct: 1 }] : undefined,
      caption: silence && silence.ms > 7 * 86400e3 ? `then ${duration(silence.ms)} of silence. who started the beef? 👀`
        : "not one day without yapping. y'all need help fr",
    });
  }

  // 16. Top words
  if (s.topWords.length >= 3) {
    add({
      id: 'words', kicker: 'most said words', emoji: '🔤',
      title: `"${s.topWords[0].key}"`, big: `${num(s.topWords[0].value)}×`,
      rows: s.topWords.slice(0, 6).map(w => ({ label: w.key, value: num(w.value), pct: w.value / s.topWords[0].value })),
      caption: "the gc's whole vocabulary, unfortunately.",
    });
  }

  // 17. Summary
  const summaryRows = [
    { label: '💬 messages', value: num(s.total) },
    { label: '🗣️ top yapper', value: nm(yap.name) },
  ];
  if (P.length > 2) summaryRows.push({ label: '👻 ghost', value: nm(P[P.length - 1].name) });
  if (owls[0].night) summaryRows.push({ label: '🌙 3am menace', value: nm(owls[0].name) });
  if (s.emojis.length) summaryRows.push({ label: '😶 top emoji', value: s.emojis[0].key });
  if (s.busiestDay) summaryRows.push({ label: '📈 busiest day', value: date(s.busiestDay.date) });
  add({
    id: 'summary', kicker: 'the receipts', emoji: '🧾',
    title: group, rows: summaryRows, summary: true,
    caption: 'screenshot this and drop it in the gc, gang 📲',
  });

  return cards;
}
