import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChat, chatNameFromFile, maskIfNumber } from '../js/parser.js';
import { computeStats } from '../js/stats.js';

const LRM = '‎', NNBSP = ' ';

test('android, 12h clock with lowercase am/pm, day-first', () => {
  const { messages, dateOrder } = parseChat([
    '31/12/23, 11:58 pm - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them. Tap to learn more.',
    '31/12/23, 11:59 pm - Riya created group "Squad 🔥"',
    '31/12/23, 11:59 pm - Riya: happy new year in 1 min 🎉',
    '01/01/24, 12:00 am - Kabir: HAPPY NEW YEAR',
    'second line of the same message',
    '01/01/24, 12:01 am - +91 98765 43210: <Media omitted>',
    '01/01/24, 12:02 am - Riya: This message was deleted',
    '01/01/24, 12:03 am - Kabir changed the subject from "old: name" to "Squad 🔥"',
    '01/01/24, 1:15 pm - Kabir: ok <This message was edited>',
  ].join('\n'));

  assert.equal(dateOrder, 'DMY');
  assert.deepEqual(messages.map(m => [m.author, m.kind]), [
    ['Riya', 'text'], ['Kabir', 'text'], ['+91 98765 43210', 'media'], ['Riya', 'deleted'], ['Kabir', 'text'],
  ]);
  assert.equal(messages[1].text, 'HAPPY NEW YEAR\nsecond line of the same message');
  assert.equal(messages[1].date.getHours(), 0);
  assert.equal(messages[1].date.getDate(), 1);
  assert.equal(messages[4].text, 'ok');
  assert.equal(messages[4].date.getHours(), 13);
});

test('iPhone export with brackets, seconds, invisible marks and system notices', () => {
  const { messages } = parseChat([
    `[12/03/2024, 9:05:12${NNBSP}PM] Squad: ${LRM}Messages and calls are end-to-end encrypted.`,
    `[12/03/2024, 9:05:20${NNBSP}PM] Zoya: yo`,
    `${LRM}[12/03/2024, 9:06:01${NNBSP}PM] Vihaan: ${LRM}image omitted`,
    `[12/03/2024, 9:07:00${NNBSP}PM] Zoya: ${LRM}Vihaan added Ishaan`,
  ].join('\r\n'));

  assert.deepEqual(messages.map(m => [m.author, m.kind]), [['Zoya', 'text'], ['Vihaan', 'media']]);
  assert.equal(messages[0].date.getMonth(), 2); // March: day-first
  assert.equal(messages[0].date.getHours(), 21);
});

test('people who left or were removed are flagged; rejoining clears it', () => {
  const { departed } = parseChat([
    '01/02/24, 10:00 am - Riya created group "Squad"',
    '01/02/24, 10:01 am - Riya added Kabir, Zoya, +91 98765 43210 and Aarav',
    '01/02/24, 10:02 am - Kabir: yo',
    '01/02/24, 10:03 am - Aarav: hey',
    '01/02/24, 10:04 am - Zoya: hi',
    '01/02/24, 10:05 am - +91 98765 43210: hello',
    '02/02/24, 9:00 pm - Kabir left',
    '03/02/24, 9:00 pm - Riya removed Aarav',
    '04/02/24, 9:00 pm - Riya removed +91 98765 43210',
    '05/02/24, 9:00 pm - Riya added Aarav',
    '06/02/24, 9:00 pm - Zoya joined using this group\'s invite link',
    '07/02/24, 9:00 pm - You removed Zoya',
    '08/02/24, 9:00 pm - You left',
  ].join('\n'));
  assert.deepEqual([...departed].sort(), ['+91 98765 43210', 'Kabir', 'Zoya']);
});

test('iPhone leave notices are read too', () => {
  const { departed, messages } = parseChat([
    `[12/03/2024, 9:05:20${NNBSP}PM] Zoya: yo`,
    `[12/03/2024, 9:06:20${NNBSP}PM] Vihaan: sup`,
    `[13/03/2024, 9:05:20${NNBSP}PM] Squad: ${LRM}Vihaan left`,
  ].join('\n'));
  assert.deepEqual([...departed], ['Vihaan']);
  assert.equal(messages.length, 2);
});

test('a normal message that mentions leaving is not a leave', () => {
  const { departed } = parseChat('01/02/24, 10:00 am - Riya: Kabir left\n01/02/24, 10:01 am - Kabir: lol no');
  assert.equal(departed.size, 0);
});

test('month-first dates are detected', () => {
  const { messages, dateOrder } = parseChat('3/25/24, 14:00 - A: hi\n3/26/24, 14:01 - B: hey');
  assert.equal(dateOrder, 'MDY');
  assert.equal(messages[0].date.getDate(), 25);
});

test('chat names and phone masking', () => {
  assert.equal(chatNameFromFile('WhatsApp Chat with Squad 🔥.txt'), 'Squad 🔥');
  assert.equal(chatNameFromFile('WhatsApp Chat - Squad (2).zip'), 'Squad');
  assert.equal(maskIfNumber('+91 98765 43210'), '+91 98••• ••210');
  assert.equal(maskIfNumber('Riya'), 'Riya');
});

test('stats pick the right people', () => {
  const lines = [];
  const add = (d, h, who, text) => lines.push(`${d}/01/24, ${h}:00 - ${who}: ${text}`);
  for (let i = 0; i < 10; i++) add('05', 10, 'Yapper', 'bro bro this is crazy 💀💀');
  add('05', 11, 'Ghost', 'k');
  add('06', 3, 'Owl', 'who is awake lmao 😭');
  add('06', 4, 'Owl', 'hello??');
  const s = computeStats(parseChat(lines.join('\n')).messages);

  assert.equal(s.total, 13);
  assert.equal(s.people[0].name, 'Yapper');
  assert.equal(s.people.at(-1).name, 'Ghost');
  assert.equal(s.people.find(p => p.name === 'Owl').night, 2);
  assert.equal(s.people[0].bro, 20);
  assert.equal(s.emojis[0].key, '💀');
  assert.equal(s.emojis[0].value, 20);
  assert.equal(s.streak.days, 2);
  assert.equal(s.busiestDay.count, 11);
});
