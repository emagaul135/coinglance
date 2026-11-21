# CoinGlance demo video script (≤ 3 min, recorded in the Even Hub simulator)

Target: ≤ 180 s, single continuous screen recording of the simulator
window (X11 display :99, 1280x800), voiceover in English. All prices are
live CoinGecko data; the alert and offline moments use the documented
demo setup below — the app code paths are the real ones, only the
network condition and the alert threshold are staged.

## Setup (before recording)

```bash
cd ~/workspace/heads-up-coinglance
# Services already running: Xvfb :99, Vite on http://localhost:5173,
# simulator with automation on http://127.0.0.1:9898.
# Restart the simulator WITH the seeded alert so the crossing is
# deterministic: BTC threshold $57,750, previous price $57,000.
# (Live BTC must be above $57,750 at recording time — check it first with
# curl https://api.coingecko.com/api/v3/simple/price?ids=bitcoin\&vs_currencies=usd
# and pick a threshold ~$50–100 below the live price if it has moved.)
pkill -f evenhub-simulator; sleep 2
DISPLAY=:99 nohup node node_modules/@evenrealities/evenhub-simulator/bin/index.js \
  "http://localhost:5173/?alert=bitcoin:57750&prev=bitcoin:57000" \
  --automation-port 9898 > /tmp/sim-demo.log 2>&1 &
# Offline demo needs the test proxy (kept in the repo at tests/coinproxy.py):
rm -f /tmp/coinproxy.block
(python3 tests/coinproxy.py > /tmp/coinproxy.out 2>&1 &)
# Record with: ffmpeg -f x11grab -video_size 1280x800 -i :99 demo.mp4
```

Note: the `?alert=` / `?prev=` seed params are a DEV-ONLY hook
(`import.meta.env.DEV`); the shipped production build ignores them.
The proxy only blocks api.coingecko.com for the simulator's webview —
it chains through the sandbox egress proxy for everything else.

## Shots (running time)

| Time | Shot | Voiceover (approx.) |
| --- | --- | --- |
| 0:00–0:15 | BTC price view, live price + 24h change | "CoinGlance is a glanceable crypto ticker for Even G2 smart glasses. One coin per screen, live prices from the CoinGecko free API — no key, no account, no hardware needed to try it." |
| 0:15–0:50 | Tap 4×: ETH → SOL → USDT → BNB (5 s each) | "Tap the temple touchpad to cycle through five coins: Bitcoin, Ethereum, Solana, Tether, and Binance Coin. Price in dollars, 24-hour change, refreshed every minute." |
| 0:50–1:15 | Long-press on BNB → 24h high/low view; long-press back to price | "Long-press switches to the 24-hour high and low. Double-tap is reserved — the platform uses it for the exit confirmation, so the view toggle lives on long-press." |
| 1:15–1:50 | Back on BTC: "▲ ALERT! crossed $57,750" | "Price alerts: set a threshold per coin — it is stored on the glasses. When the live price crosses it, you get this indicator, and it stays latched until the price moves back." |
| 1:50–2:25 | `touch /tmp/coinproxy.block`, wait for the next refresh → "(offline - last price)"; then `rm /tmp/coinproxy.block` → fresh price returns | "If the network drops, CoinGlance does not go blank — it keeps the last price and flags it offline, then recovers on its own when the connection is back." |
| 2:25–2:50 | BTC price view, closing | "Five coins, alerts, offline fallback — built with the Even Hub SDK, tested entirely in the free simulator. CoinGlance — crypto at a glance." |

## Evidence already captured (screenshots/)

- `feat-btc.png` / `feat-eth.png` / `feat-sol.png` / `feat-usdt.png` /
  `feat-bnb.png` — all 5 coins in price view, live data
- `feat-bnb-range.png` — long-press 24h high/low view
- `feat-btc-alert.png` — alert-crossed state (real live price crossing
  the seeded $57,750 threshold)
- `feat-btc-alert-persist.png` — same alert after a simulator restart
  (threshold + latch survive in localStorage)
- `feat-offline.png` — "(offline - last price)" with the API blocked
  at the network level (test proxy)
- `feat-recovered.png` — fresh price after the block is lifted

## Cut list (if the recording runs long)

1. Drop the offline recovery half (keep the offline flag shot only).
2. Drop the SOL/USDT taps (keep BTC → ETH → BNB).
3. Never cut: 5-coin cycle, long-press view, alert indicator.
