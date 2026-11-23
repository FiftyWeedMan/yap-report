// Draws a card two ways: as a slide on the page, and as a 1080×1920 story image.
// Everything from the chat goes in through textContent / fillText — never as HTML —
// so a name like "<img onerror=…>" is just text.

const FONT = '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif';
const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** @returns {HTMLElement} */
export function renderSlide(card) {
  const root = el('section', `card card-${card.id}${card.summary ? ' card-summary' : ''}`);
  root.style.setProperty('--a', card.theme.a);
  root.style.setProperty('--b', card.theme.b);
  root.style.setProperty('--ink', card.theme.ink);

  root.append(el('div', 'blob blob-1'), el('div', 'blob blob-2'));
  const body = el('div', 'card-body');
  body.append(el('p', 'kicker', card.kicker));
  if (card.emoji) body.append(el('div', 'emoji', card.emoji));
  if (card.title) body.append(el('h2', 'title', card.title));
  if (card.big) body.append(el('p', 'big', card.big));
  if (card.sub) body.append(el('p', 'sub', card.sub));

  if (card.rows) {
    const list = el('ol', 'rows');
    card.rows.forEach((r, i) => {
      const li = el('li', 'row');
      li.style.setProperty('--i', i);
      li.append(el('span', 'row-label', r.label), el('span', 'row-value', r.value));
      if (r.pct != null) {
        const bar = el('span', 'row-bar');
        const fill = el('i');
        fill.style.setProperty('--w', Math.max(0.04, r.pct).toFixed(3));
        bar.append(fill);
        li.append(bar);
      }
      list.append(li);
    });
    body.append(list);
  }

  if (card.bars) {
    const chart = el('div', 'hours');
    const max = Math.max(...card.bars, 1);
    card.bars.forEach((v, h) => {
      const b = el('span', 'hour');
      b.style.setProperty('--h', (v / max).toFixed(3));
      b.style.setProperty('--i', h);
      b.title = `${h}:00 · ${v} messages`;
      chart.append(b);
    });
    const axis = el('div', 'hours-axis');
    ['12am', '6am', '12pm', '6pm', '11pm'].forEach(t => axis.append(el('span', null, t)));
    body.append(chart, axis);
  }

  body.append(el('p', 'caption', card.caption));
  root.append(body, el('p', 'brand', 'yap report · made on your device'));
  return root;
}

// ---------- share image ----------

const W = 1080, H = 1920, PAD = 96;

/** @returns {Promise<Blob>} */
export async function renderImage(card) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const { a, b, ink } = card.theme;

  // Background: gradient + two soft blobs.
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, a); bg.addColorStop(1, b);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  blob(g, W * 0.85, H * 0.12, 520, 'rgba(255,255,255,0.22)');
  blob(g, W * 0.1, H * 0.85, 620, 'rgba(0,0,0,0.18)');

  g.fillStyle = ink;
  g.textBaseline = 'alphabetic';
  let y = PAD + 40;

  g.globalAlpha = 0.75;
  g.font = `700 34px ${FONT}`;
  g.fillText('YAP REPORT', PAD, y);
  g.globalAlpha = 1;
  y += 110;

  g.font = `800 52px ${FONT}`;
  y = wrap(g, card.kicker.toUpperCase(), PAD, y, W - PAD * 2, 62, 2) + 40;

  if (card.emoji) {
    g.font = `${card.summary ? 150 : 210}px ${EMOJI_FONT}`;
    g.fillText(card.emoji, PAD - 8, y + (card.summary ? 140 : 190));
    y += card.summary ? 210 : 290;
  }

  if (card.title) {
    g.font = `800 ${fitSize(g, card.title, 92, 54, 800)}px ${FONT}`;
    y = wrap(g, card.title, PAD, y, W - PAD * 2, 104, 2) + 30;
  }
  if (card.big) {
    g.font = `900 ${fitSize(g, card.big, 170, 70, 900)}px ${FONT}`;
    g.fillText(card.big, PAD, y + 130);
    y += 180;
  }
  if (card.sub) {
    g.globalAlpha = 0.85;
    g.font = `600 44px ${FONT}`;
    y = wrap(g, card.sub, PAD, y + 10, W - PAD * 2, 56, 2) + 30;
    g.globalAlpha = 1;
  }

  if (card.rows) {
    y += 20;
    const rowH = card.summary ? 112 : 96;
    for (const r of card.rows) {
      g.fillStyle = 'rgba(255,255,255,0.16)';
      roundRect(g, PAD, y, W - PAD * 2, rowH - 18, 26); g.fill();
      if (r.pct != null) {
        g.fillStyle = 'rgba(255,255,255,0.28)';
        roundRect(g, PAD, y, Math.max(52, (W - PAD * 2) * r.pct), rowH - 18, 26); g.fill();
      }
      g.fillStyle = ink;
      const mid = y + (rowH - 18) / 2 + 15;
      const onlyEmoji = /^\p{Extended_Pictographic}[\u{FE0F}\u{200D}\p{Extended_Pictographic}]*$/u.test(r.value);
      g.font = onlyEmoji ? `56px ${EMOJI_FONT}` : `700 40px ${FONT}, ${EMOJI_FONT}`;
      g.textAlign = 'right';
      const valueW = g.measureText(r.value).width;
      g.fillText(r.value, W - PAD - 32, mid);
      g.textAlign = 'left';
      g.font = `600 40px ${FONT}, ${EMOJI_FONT}`;
      g.fillText(ellipsize(g, r.label, W - PAD * 2 - valueW - 110), PAD + 32, mid);
      y += rowH;
    }
  }

  if (card.bars) {
    const top = y + 40, h = 360, gap = 8;
    const bw = (W - PAD * 2 - gap * 23) / 24;
    const max = Math.max(...card.bars, 1);
    card.bars.forEach((v, i) => {
      const bh = Math.max(10, (v / max) * h);
      g.fillStyle = v === max ? ink : 'rgba(255,255,255,0.45)';
      roundRect(g, PAD + i * (bw + gap), top + h - bh, bw, bh, 10); g.fill();
    });
    g.fillStyle = ink; g.globalAlpha = 0.7; g.font = `600 30px ${FONT}`;
    g.fillText('12am', PAD, top + h + 50);
    g.textAlign = 'center'; g.fillText('12pm', W / 2, top + h + 50);
    g.textAlign = 'right'; g.fillText('11pm', W - PAD, top + h + 50);
    g.textAlign = 'left'; g.globalAlpha = 1;
  }

  // Caption sits at the bottom, footer under it.
  g.fillStyle = ink;
  g.font = `italic 700 46px ${FONT}, ${EMOJI_FONT}`;
  const lines = lineBreak(g, card.caption, W - PAD * 2).slice(0, 3);
  let cy = H - PAD - 120 - (lines.length - 1) * 60;
  for (const line of lines) { g.fillText(line, PAD, cy); cy += 60; }

  g.globalAlpha = 0.7;
  g.font = `600 30px ${FONT}`;
  g.fillText('made on-device · nothing uploaded', PAD, H - PAD);
  g.globalAlpha = 1;

  return new Promise(res => c.toBlob(res, 'image/png'));
}

function blob(g, x, y, r, color) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(x - r, y - r, r * 2, r * 2);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function fitSize(g, text, max, min, weight) {
  for (let size = max; size > min; size -= 4) {
    g.font = `${weight} ${size}px ${FONT}`;
    if (g.measureText(text).width <= W - PAD * 2) return size;
  }
  return min;
}

function lineBreak(g, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function wrap(g, text, x, y, maxW, lh, maxLines) {
  const lines = lineBreak(g, text, maxW);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) shown[maxLines - 1] = ellipsize(g, shown[maxLines - 1] + '…', maxW);
  shown.forEach((l, i) => g.fillText(l, x, y + lh * (i + 1) - lh * 0.2));
  return y + lh * shown.length;
}

function ellipsize(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return text;
  let t = [...text];
  while (t.length > 1 && g.measureText(t.join('') + '…').width > maxW) t.pop();
  return t.join('') + '…';
}
