// A made-up group chat, so people can try the site without exporting anything.
// Everyone in it is fictional. Seeded, so the demo is the same every time.

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PEOPLE = [
  { name: 'Riya', weight: 32, night: 0.1, lines: ['guys guys guys', 'WAIT what 😭😭', 'okay so listen', 'bro i literally cannot 💀', 'who is coming tomorrow??', 'this is so real', 'no because why is this me 😭', 'GOSSIP TIME', 'i have a story', 'send pics pls'] },
  { name: 'Kabir', weight: 22, night: 0.55, lines: ['bhai', 'lmao', 'anyone awake?', 'bro ranked is cooked today', 'one more game then sleep', 'gg', 'who wants to play valo', 'bro 💀💀', 'cant sleep lol', 'bhai ye dekh'] },
  { name: 'Aarav', weight: 18, night: 0.15, lines: ['ok', 'k', 'hmm', 'sure', 'lol', 'ya', 'nice', 'same', 'ok bro', '👍'] },
  { name: 'Zoya', weight: 15, night: 0.05, lines: ['okay so here is the thing, i think we should actually plan this properly because last time nobody booked anything and we ended up at the same cafe again', 'reminder: we said we would study today. we did not study today.', 'can someone please explain what happened yesterday because i was gone for one hour and there are 300 messages', 'i made a list of places we could go this weekend, vote please'] },
  { name: 'Vihaan', weight: 10, night: 0.2, lines: ['💀', '😭', '🔥🔥', 'real', 'fr fr', 'no cap', 'aura -1000', 'he is so cooked', 'W', 'L'] },
  { name: '+91 98765 43210', weight: 3, night: 0, lines: ['hi', 'who added me', 'ok'] },
  // Yaps a lot early on, then leaves, so the demo shows ex-members being dropped.
  { name: 'Arjun', weight: 30, night: 0, until: 25, lines: ['bro', 'lmao', 'ok im out of this group soon', 'yo'] },
];
const LEAVER = PEOPLE[PEOPLE.length - 1];

export function demoChat() {
  const r = rng(2026);
  const pick = arr => arr[Math.floor(r() * arr.length)];
  const total = PEOPLE.reduce((s, p) => s + p.weight, 0);
  const pickPerson = () => {
    let x = r() * total;
    for (const p of PEOPLE) if ((x -= p.weight) < 0) return p;
    return PEOPLE[0];
  };

  const lines = [];
  const start = new Date(2026, 6, 1);
  const pad = n => String(n).padStart(2, '0');
  const stamp = d => {
    const h = d.getHours();
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}, ${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'am' : 'pm'}`;
  };
  lines.push(`${stamp(start)} - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them. Tap to learn more.`);

  for (let day = 0; day < 140; day++) {
    if (day >= 61 && day <= 69) continue; // the great silence of september
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + day);
    const hype = day === 45 ? 9 : 1; // one chaotic day
    const sessions = Math.max(1, Math.round((1 + r() * 4) * hype));

    for (let s = 0; s < sessions; s++) {
      let t = new Date(date);
      const late = r() < 0.1;
      t.setHours(late ? Math.floor(r() * 4) : 10 + Math.floor(r() * 13), Math.floor(r() * 60));
      const burst = 4 + Math.floor(r() * 26);

      for (let m = 0; m < burst; m++) {
        let p = pickPerson();
        if (p.until != null && day > p.until) p = PEOPLE[0];
        if (late && r() < 0.4) p = PEOPLE[1]; // Kabir runs the night shift
        t = new Date(t.getTime() + (5 + r() * 240) * 1000);
        if (t.getDate() !== date.getDate()) break;

        let text;
        const roll = r();
        if (roll < 0.07) text = '<Media omitted>';
        else if (roll < 0.08 && p.name === 'Riya') text = 'This message was deleted';
        else text = pick(p.lines);
        lines.push(`${stamp(t)} - ${p.name}: ${text}`);
      }
    }
    if (day === LEAVER.until) lines.push(`${stamp(new Date(date.getTime() + 23.9 * 3600e3))} - ${LEAVER.name} left`);
  }
  return lines.join('\n');
}
