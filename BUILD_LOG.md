# CoinGlance build log

## Sat 21 Nov 2026 — scaffold milestone (DONE, verified)

- Work dir `~/workspace/heads-up-coinglance/`; template cloned via
  `npx degit even-realities/evenhub-templates/minimal`.
- Installed SDK `@evenrealities/even_hub_sdk@0.0.16` and simulator
  `@evenrealities/evenhub-simulator@0.9.5` (template pinned 0.0.10 / 0.7.2).
- `app.json`: package `com.oyentv.coinglance`, name CoinGlance, network
  permission whitelisting `https://api.coingecko.com`, min_sdk 0.0.16.
- `src/main.ts`: single 576x288 text container; CoinGecko `coins/markets`
  fetch (price + 24h % + high/low); 60 s refresh; offline fallback keeps
  last quote with "(offline - last price)" flag; gestures: tap = next coin,
  long-press = price/high-low toggle, double-tap = exit (platform rule).
  COINS list currently has BTC only; ETH/SOL/USDT/BNB land Mon 24 Nov.
- `npm run build` passes (tsc --noEmit + vite build, 85.43 kB JS).
- CoinGecko verified live from this VM: BTC $57,852 / ETH $1,634.41 /
  SOL $68.01 / USDT $0.9987 / BNB $523.27 with 24h change + high/low.
  Binance public ticker returns empty from this VM — CoinGecko only.
- Simulator: native binary needs `libwebkit2gtk-4.1.so.0`; installed via
  `apt-get install libwebkit2gtk-4.1-0` (Ubuntu 24.04, v2.52.6). Runs under
  Xvfb :99 (1280x800). Note: `npm run simulate` failed because npm did not
  create the `evenhub-simulator` .bin link — script now calls the binary
  via node directly.
- Verification (all via simulator automation API on :9898 + X11 captures):
  - Price view renders live BTC: $57,777, 24h ▼ -7.11%
    (`screenshots/sim-btc.png`)
  - Long-press toggles to high/low view: 24h high $62,087 / low $55,298
    (`screenshots/sim-after-longpress.png`)
  - Tap (click) received, no errors; console shows "Page created: success",
    bridge initialized, no failed fetches.
  - Quirk: `/api/screenshot/glasses` returns blank green; X11 captures are
    the verification evidence instead.

## Still running (for the next milestone)

- Xvfb :99, Vite dev server http://localhost:5173 (pid 2242),
  simulator pid ~65xx with automation on http://127.0.0.1:9898
  (restarted several times during the features milestone; current
  instance launched without proxy env, plain http://localhost:5173).
  Restart if gone: `Xvfb :99 -screen 0 1280x800x24 &`, `npm run dev`,
  `DISPLAY=:99 node node_modules/@evenrealities/evenhub-simulator/bin/index.js http://localhost:5173 --automation-port 9898`.
  NOTE: do NOT use `pkill -f evenhub-simulator` — the pattern matches
  the calling shell itself and kills it. Kill by explicit PID instead.

## Mon 24 Nov 2026 — features milestone (DONE, verified)

- All 5 coins in `COINS` (`src/main.ts`): BTC, ETH, SOL, USDT, BNB.
  Tap cycles 1/5 → 5/5; each renders live CoinGecko price + 24h % +
  alert line. Screenshots: `screenshots/feat-{btc,eth,sol,usdt,bnb}.png`.
- Price alerts (`src/main.ts` + pure logic in `src/alerts.ts`):
  thresholds in localStorage (defaults BTC $60,000 / ETH $1,700 /
  SOL $70 / USDT $1.00 / BNB $550); prev price persisted per coin;
  crossing latches ▲/▼ and persists in localStorage until the price
  moves back across. Unit tests 15/15 (`npm test`,
  `tests/alerts.test.mjs` — one test expectation was wrong at first:
  a move back across the threshold IS the opposite crossing, so the
  latch flips rather than clearing; cleared only with no prev price).
  Live demo in simulator: seeded BTC threshold $57,750 + prev $57,000
  via the dev-only `?alert=&prev=` hook → real live price $57,832
  crossed up → "▲ ALERT! crossed $57,750" (`feat-btc-alert.png`);
  still latched after a plain restart (`feat-btc-alert-persist.png`).
  The simulator webview's localStorage still holds that demo seed
  (BTC $57,750, latched up) — the demo script re-seeds explicitly at
  recording time, so the recording is deterministic.
- Long-press high/low view re-verified on BNB: high $573.34 / low
  $504.34 (`feat-bnb-range.png`).
- Offline fallback verified with a REAL network block: /etc/hosts is
  read-only and iptables/nft are permission-denied in this container,
  so a CONNECT proxy was built (`tests/coinproxy.py`, kept in repo):
  simulator run with https_proxy → proxy (chains through the sandbox
  egress proxy for the upstream leg — direct TCP fails the TLS
  handshake here). `touch /tmp/coinproxy.block` cut api.coingecko.com
  mid-session → next 60 s refresh failed, console shows
  "CoinGecko fetch failed, showing last price", screen kept $57,812
  flagged "(offline - last price)" (`feat-offline.png`); block lifted
  → fresh price $57,791, flag gone (`feat-recovered.png`). Proxy
  killed afterwards; simulator restarted without proxy env (clean).
- `src/vite-env.d.ts` added (the template lacked the vite/client
  reference, so `import.meta.env` failed tsc).
- `npm run build` passes; `npm test` added to package.json.
- Demo script written: `DEMO_SCRIPT.md` (≤3 min, shot list + setup +
  cut list). Evidence screenshots all under `screenshots/feat-*.png`
  (cropped 705x288 glasses region; `/api/screenshot/glasses` returns
  blank green — X11 capture via ffmpeg is the ground truth).

## Tue 25 Nov 2026 — demo video (DONE, verified)

- Recorded in the simulator per `DEMO_SCRIPT.md`: driver script
  (`/tmp/demo-driver.sh`) started ffmpeg x11grab on :99 and drove the
  automation API on the shot schedule (4 taps through all 5 coins,
  2 long-presses for high/low, back to BTC for the alert), staged the
  offline block at t=93 via the test proxy, stopped when the app
  logged the failed fetch. Raw 156.6 s, cropped to the 705×288
  glasses region (ffmpeg x264 evened it to 704×288).
- English narration added (Google Translate TTS, free public endpoint;
  6 segments mixed with ffmpeg at the shot boundaries; vo1 sped up
  1.08× to fit its 15 s window). Final `demo.mp4`: 155.4 s, 704×288,
  H.264 + AAC, narration mean −22.7 dB, verified present at every
  segment (t=3/18/55/72/136/146).
- Frame-by-frame verification of `demo.mp4`: BTC $57,898 + alert
  (t=5), ETH $1,640.76 (t=20), SOL $68.17 (t=29), USDT $0.9987
  (t=38), BNB $525.71 (t=47), BNB 24h high $573.34 / low $504.34
  (t=57), BTC $57,905 + alert latched (t=75), "(offline - last
  price)" + alert (t=150). Cut per the script's cut list: the
  offline-recovery half was dropped, so the narration does not claim
  a recovery the video does not show.

## Next milestones

- Mon 24 Nov: add ETH, SOL, USDT, BNB + cycle navigation + price alerts
  (localStorage thresholds, ▲/▼ on cross) + offline fallback test +
  simulator test pass + demo script.
- Tue 25 Nov: record ≤3-min demo video in the simulator, create public
  GitHub repo (gh CLI authenticated as emagaul135), write description,
  submit to DoraHacks by evening. HARD STOP before Toggle Wars (26 Nov).
- Cut order if anything slips: alerts first, then cut to 3 coins.
- Human gate watch: DoraHacks team registration flow unverified — if it
  needs a login tap on the user's phone, STOP that step and report it.
