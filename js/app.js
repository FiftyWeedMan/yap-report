import { parseChat, chatNameFromFile, maskIfNumber } from './parser.js';
import { readChatFromZip } from './unzip.js';
import { computeStats } from './stats.js';
import { buildCards } from './cards.js';
import { renderSlide, renderImage } from './render.js';
import { demoChat } from './demo.js';

const $ = sel => document.querySelector(sel);
const home = $('#home');
const player = $('#player');
const stage = $('#stage');
const progress = $('#progress');
const errorBox = $('#error');
const fileInput = $('#file');
const drop = $('#drop');
const hideToggle = $('#hide-names');

let session = null; // { stats, chatName, cards, index } — lives only in memory

// ---------- loading a chat ----------

async function openFile(file) {
  showError('');
  if (!file) return;
  if (file.size > 200 * 1024 * 1024) return showError("that file is way too big gng. export the chat again with \"Without media\".");
  drop.classList.add('busy');
  try {
    let text, name = file.name;
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const isZip = head[0] === 0x50 && head[1] === 0x4b;
    if (isZip) text = (await readChatFromZip(await file.arrayBuffer())).text;
    else text = await file.text();
    start(text, chatNameFromFile(name));
  } catch (err) {
    console.error(err);
    showError(err.message || "Couldn't read that file.");
  } finally {
    drop.classList.remove('busy');
    fileInput.value = '';
  }
}

function start(text, chatName) {
  const parsed = parseChat(text);
  // People who left or were removed don't count: drop everything they sent.
  const messages = parsed.messages.filter(m => !parsed.departed.has(m.author));
  const people = new Set(messages.map(m => m.author));
  const leftCount = new Set(parsed.messages.map(m => m.author).filter(a => parsed.departed.has(a))).size;
  if (messages.length < 20 || people.size < 2) {
    return showError(messages.length
      ? `Only found ${messages.length} messages from ${people.size} ${people.size === 1 ? 'person' : 'people'}. need a chat with more yap than that, gang.`
      : "that ain't a WhatsApp chat export cuh. check the steps below and try again.");
  }
  const stats = computeStats(messages);
  stats.leftCount = leftCount;
  session = { stats, chatName, index: 0, cards: [] };
  rebuild();
  home.hidden = true;
  player.hidden = false;
  document.body.classList.add('playing');
  show(0);
}

function rebuild() {
  const { stats, chatName } = session;
  const hide = hideToggle.checked;
  const aliases = new Map(stats.people.map((p, i) => [p.name, `Person ${alias(i)}`]));
  const nm = name => (hide ? aliases.get(name) : maskIfNumber(name));
  session.cards = buildCards(stats, hide ? 'the group chat' : chatName, nm);

  progress.replaceChildren(...session.cards.map(() => {
    const seg = document.createElement('span');
    seg.append(document.createElement('i'));
    return seg;
  }));
}

function alias(i) {
  let s = '';
  do { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } while (i >= 0);
  return s;
}

// ---------- the slideshow ----------

function show(i) {
  const cards = session.cards;
  session.index = Math.max(0, Math.min(cards.length - 1, i));
  const slide = renderSlide(cards[session.index]);
  stage.replaceChildren(slide);
  [...progress.children].forEach((seg, n) => seg.classList.toggle('done', n <= session.index));
  $('#prev').disabled = session.index === 0;
  $('#next').disabled = session.index === cards.length - 1;
}

function close() {
  session = null; // drop everything; nothing was ever stored anywhere else
  stage.replaceChildren();
  player.hidden = true;
  home.hidden = false;
  document.body.classList.remove('playing');
}

async function save() {
  const card = session.cards[session.index];
  const btn = $('#save');
  btn.disabled = true;
  try {
    const blob = await renderImage(card);
    const file = new File([blob], `yap-report-${card.id}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ files: [file] }).catch(() => {});
    } else {
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  } finally {
    btn.disabled = false;
  }
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = !msg;
}

// ---------- wiring ----------

fileInput.addEventListener('change', () => openFile(fileInput.files[0]));
$('#demo').addEventListener('click', () => start(demoChat(), 'the squad 🔥'));
$('#prev').addEventListener('click', () => show(session.index - 1));
$('#next').addEventListener('click', () => show(session.index + 1));
$('#close').addEventListener('click', close);
$('#save').addEventListener('click', save);
hideToggle.addEventListener('change', () => { if (session) { rebuild(); show(session.index); } });

// Tap the left third to go back, anywhere else to go forward (like stories).
stage.addEventListener('click', e => {
  const { left, width } = stage.getBoundingClientRect();
  show(session.index + ((e.clientX - left) < width / 3 ? -1 : 1));
});

let touchX = null;
stage.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
stage.addEventListener('touchend', e => {
  if (touchX == null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 50) { e.preventDefault(); show(session.index + (dx < 0 ? 1 : -1)); }
});

document.addEventListener('keydown', e => {
  if (!session) return;
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); show(session.index + 1); }
  if (e.key === 'ArrowLeft') show(session.index - 1);
  if (e.key === 'Escape') close();
});

// Drag a file anywhere on the page.
['dragenter', 'dragover'].forEach(t => document.addEventListener(t, e => {
  e.preventDefault(); drop.classList.add('over');
}));
['dragleave', 'drop'].forEach(t => document.addEventListener(t, e => {
  e.preventDefault(); if (t === 'drop' || e.target === document.documentElement) drop.classList.remove('over');
}));
document.addEventListener('drop', e => {
  if (!session) openFile(e.dataTransfer.files[0]);
});

// How-to tabs
document.querySelectorAll('[data-os]').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('[data-os]').forEach(b => b.setAttribute('aria-selected', b === btn));
  document.querySelectorAll('[data-steps]').forEach(s => { s.hidden = s.dataset.steps !== btn.dataset.os; });
}));
