// Minimal .zip reader: pulls the chat .txt out of an iPhone WhatsApp export.
// Uses the browser's built-in DecompressionStream, so no library is needed.

/** @param {ArrayBuffer} buffer @returns {Promise<{name: string, text: string}>} */
export async function readChatFromZip(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // Find the "end of central directory" record, scanning back from the end.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("That zip looks broken. Try exporting the chat again.");

  const count = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries = [];

  for (let i = 0; i < count; i++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    entries.push({ name, method, compressedSize, localOffset });
    ptr += 46 + nameLen + extraLen + commentLen;
  }

  const txts = entries.filter(e => /\.txt$/i.test(e.name) && !e.name.startsWith('__MACOSX'));
  const entry = txts.find(e => /(^|\/)_chat\.txt$/i.test(e.name)) || txts[0];
  if (!entry) throw new Error("No chat .txt inside that zip.");

  const lh = entry.localOffset;
  const start = lh + 30 + view.getUint16(lh + 26, true) + view.getUint16(lh + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);

  let out;
  if (entry.method === 0) out = data;
  else if (entry.method === 8) {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    out = new Uint8Array(await new Response(stream).arrayBuffer());
  } else throw new Error("That zip uses a compression type this can't read.");

  return { name: entry.name, text: new TextDecoder().decode(out) };
}
