# CoinGlance — a glanceable crypto ticker for Even G2 glasses

Built for the **Heads Up: Even Realities** hackathon (DoraHacks, $10,000 USDT),
Crypto & DeFi track. Free, solo, no wallet, no paid services.

## What it does

One coin per screen on the 576×288 monochrome glasses canvas: price in USD
plus 24h % change, refreshed every 60 s from the **CoinGecko free API**
(no key needed). If a fetch fails, the last known price stays on screen,
flagged "(offline - last price)".

- **Tap** the temple touchpad → next coin (BTC → ETH → SOL → USDT → BNB)
- **Long-press** → toggle price view / 24h high-low view
- **Double-tap** → exit (platform convention: shows the system
  exit-confirmation dialog; required on the root page, so it cannot also
  toggle the view — the brief's original double-tap-to-toggle gesture was
  moved to long-press for this reason)
- **Price alerts** — threshold per coin, stored locally in localStorage
  (defaults: BTC $60,000, ETH $1,700, SOL $70, USDT $1.00, BNB $550).
  When the live price crosses the threshold, the screen shows
  "▲ ALERT! crossed $…" (or ▼ for a downward cross) and the indicator
  stays latched until the price moves back across. Thresholds, last
  prices and the latch all survive a restart.

## Status (Mon 24 Nov 2026, features milestone)

- [x] Template cloned (`even-realities/evenhub-templates/minimal`)
- [x] SDK `@evenrealities/even_hub_sdk` **0.0.16**, simulator
      `@evenrealities/evenhub-simulator` **0.9.5**
- [x] `npm run build` passes (tsc + vite)
- [x] **All 5 coins rendering in the simulator with live CoinGecko data**
      — see `screenshots/feat-btc.png`, `feat-eth.png`, `feat-sol.png`,
      `feat-usdt.png`, `feat-bnb.png` (BTC $57,823, ETH $1,637.9,
      SOL $67.97, USDT $0.9987, BNB $524.00 at verification time)
- [x] Long-press → 24h high/low view verified — see
      `screenshots/feat-bnb-range.png` (high $573.34 / low $504.34)
- [x] Tap cycling through all 5 coins verified via the simulator
      automation API, console clean
- [x] **Price alerts verified end-to-end** — crossing logic unit-tested
      (15/15, `npm test`, pure function in `src/alerts.ts`); live
      crossing demonstrated in the simulator with real CoinGecko data
      ("▲ ALERT! crossed $57,750", `screenshots/feat-btc-alert.png`)
      and confirmed persistent across a simulator restart
      (`feat-btc-alert-persist.png`)
- [x] **Offline fallback verified by actually blocking the API** —
      test proxy (`tests/coinproxy.py`) cut api.coingecko.com at the
      network level mid-session; the app kept the last price and flagged
      it "(offline - last price)" (`screenshots/feat-offline.png`,
      console shows the fetch-failed warning), then recovered with a
      fresh price once the block was lifted (`feat-recovered.png`)
- [x] Demo script written — `DEMO_SCRIPT.md` (≤3 min, shot list +
      setup commands + cut list)
- [x] Demo video recorded in the simulator — `demo.mp4` (155 s, 704×288,
      H.264 + narrated AAC; all 5 coins + high/low view + alert +
      offline fallback verified frame-by-frame; narration via Google
      Translate TTS, mixed with ffmpeg). Silent cut kept as
      `demo-silent.mp4`. The offline-recovery half was cut per the
      script's cut list (video ends on the offline flag).
- [ ] Public GitHub repo + DoraHacks submission — Tue 25 Nov evening

## Run

```bash
npm install
npm run dev          # Vite dev server on http://localhost:5173
npm test             # alert-crossing unit tests (src/alerts.ts, 15 cases)
npm run simulate     # Even Hub simulator (needs a display; use Xvfb headless)
```

Simulator automation API (for scripted tests): start the simulator with
`--automation-port 9898`, then `GET /api/ping`, `POST /api/input`
(`click` / `double_click` / `long_press` / ...), `GET /api/console`.

Dev-only test hook (inert in production builds): start the dev server
with `?alert=<coinId>:<threshold>&prev=<coinId>:<price>` to seed an
alert threshold and a "previous price" in localStorage, e.g.
`http://localhost:5173/?alert=bitcoin:57750&prev=bitcoin:57000`.
Used to demonstrate a real crossing against live prices in the
simulator. The shipped `.ehpk` build ignores these params.

## Honest notes

- Tested **only in the free simulator** — no real Even G2 glasses were used.
- Prices come from CoinGecko's free tier; rate limits apply (60 s refresh
  keeps well under them). Binance was tried and returns empty from this
  environment, so it is not used.
- A ticker is a simple app: a credible shot at a track prize, not a
  favourite for the Grand. The code is the real thing, not a mock.
- `npm run simulate` calls the simulator binary directly via node because
  npm did not link its `.bin` entry on this machine.
- The simulator needs `libwebkit2gtk-4.1-0` on Ubuntu 24.04
  (`apt-get install libwebkit2gtk-4.1-0`).
- `/api/screenshot/glasses` returns a blank green framebuffer on this setup;
  screenshots in `screenshots/` were taken from the simulator window (X11
  capture) instead — that is the ground truth used for verification.

## Pack for distribution

```bash
npm run pack
```

Produces an `.ehpk` file.
