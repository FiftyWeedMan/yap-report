import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readChatFromZip } from '../js/unzip.js';
import { parseChat, chatNameFromFile } from '../js/parser.js';

const ZIP = new URL('./fixtures/WhatsApp Chat - Night Crew.zip', import.meta.url);

test('reads the chat out of an iPhone-style export zip', async () => {
  const buf = await readFile(ZIP);
  const { name, text } = await readChatFromZip(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  assert.equal(name, '_chat.txt');

  const { messages } = parseChat(text);
  assert.equal(messages.length, 41); // 40 texts + 1 sticker, system notice skipped
  assert.deepEqual([...new Set(messages.map(m => m.author))].sort(), ['Aisha', 'Dev', 'Meera']);
  assert.equal(messages.at(-1).kind, 'media');
  assert.equal(chatNameFromFile('WhatsApp Chat - Night Crew.zip'), 'Night Crew');
});

test('rejects something that is not a zip', async () => {
  await assert.rejects(readChatFromZip(new TextEncoder().encode('not a zip at all, just text').buffer), /broken/);
});
