# yap report 🗣️

**Wrapped, but for your WhatsApp group chat.** Who's the top yapper? Who's the ghost?
Who's texting at 3am? Drop your chat export and find out who's *actually* cooked.

**Your chat never leaves your device.**

## What you get

Story-style slides, each one saveable as a 1080×1920 image to drop back in the group:

| | |
|---|---|
| 🗣️ **Top yapper** with a leaderboard | 👻 **The ghost** |
| 🌙 **3am menace** | 😶 **Top emojis** |
| 📈 **Busiest day ever** | ⏰ **Peak hour** chart |
| ⚡ **Fastest replier** | 🔪 **Conversation killer** and defibrillator |
| 📝 **Essay writer vs dry texter** | 🤝 **Bro counter** (bro / bhai / bruh) |
| 😹 **Most entertained** | 🤨 **Deleted evidence** |
| 🔥 **Longest streak** and longest silence | 🔤 **Most said words** (English + Hinglish filler filtered) |
| 🧾 **The receipts**: a summary card | |

## Privacy, for real

- **No server.** It's a static site. The chat is read and crunched in your browser.
- **Locked by the browser.** A Content Security Policy (`connect-src 'none'`) blocks the
  page from making any network request at all: fetch, beacons, WebSockets, tracking
  pixels. Even buggy or tampered code couldn't upload a chat.
- **No trackers, no outside scripts.** Zero dependencies. Every line is in this repo.
- **Works offline.** Load the page, switch off Wi-Fi, then drop your chat.
- **Nothing stored.** No cookies, no localStorage. Close the tab and it's gone.
- **Numbers masked.** Unsaved contacts show as `+91 98••• ••210`, and **hide names**
  swaps everyone for "Person A, B, C…" before you share a card.
- **Chat text is never treated as HTML**, so a sneaky name can't inject anything.

## Export your chat

**Android:** open the group → ⋮ → More → Export chat → Without media.
**iPhone:** open the group → tap its name → Export Chat → Without Media → Save to Files.

Both the `.txt` and the iPhone `.zip` work.

## Run it locally

No build step and no dependencies:

```bash
npm start        # serves on http://localhost:5173 (needs Python)
npm test         # parser, stats and zip tests (Node 20+)
```

## How it's built

```
js/parser.js   WhatsApp export → messages (Android + iPhone, 12h/24h, any date order)
js/unzip.js    pulls _chat.txt out of the iPhone .zip using DecompressionStream
js/stats.js    the numbers
js/cards.js    the slides and the roasts
js/render.js   draws a card on screen and as a PNG
js/demo.js     a fake group chat for the demo button
```

## License

[MIT](LICENSE)
