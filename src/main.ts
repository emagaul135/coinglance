import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import { detectCross } from './alerts'

// ---------------------------------------------------------------------------
// CoinGlance — glanceable crypto ticker for Even G2 glasses (576x288 canvas)
// Features milestone (Mon 24 Nov 2026): all 5 coins, tap cycling, long-press
// price/high-low toggle, double-tap exit (platform rule), CoinGecko 60 s
// refresh, offline fallback, and price alerts (threshold per coin stored
// locally; ▲/▼ indicator when the live price crosses it).
// ---------------------------------------------------------------------------

interface Coin {
  id: string // CoinGecko id
  symbol: string
  name: string
}

const COINS: Coin[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'tether', symbol: 'USDT', name: 'Tether' },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
]

interface Quote {
  price: number
  change24h: number // percent
  high24h: number
  low24h: number
  fetchedAt: number
}

const REFRESH_MS = 60_000
const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/coins/markets' +
  '?vs_currency=usd&price_change_percentage=24h'

// Default alert thresholds (USD). Round levels, stored per coin in
// localStorage under `coinglance:alert:<id>`; a user-set value survives
// restarts. USDT's threshold sits at the $1 peg.
const ALERT_DEFAULTS: Record<string, number> = {
  bitcoin: 60000,
  ethereum: 1700,
  solana: 70,
  tether: 1.0,
  binancecoin: 550,
}

const LS_ALERT = (id: string) => `coinglance:alert:${id}`
const LS_PREV = (id: string) => `coinglance:prev:${id}`
const LS_LATCH = (id: string) => `coinglance:alertstate:${id}`

function loadThreshold(id: string): number {
  try {
    const raw = localStorage.getItem(LS_ALERT(id))
    const v = raw === null ? NaN : parseFloat(raw)
    if (Number.isFinite(v) && v > 0) return v
  } catch {
    // localStorage unavailable — fall back to the default.
  }
  return ALERT_DEFAULTS[id] ?? 0
}

function loadPrevPrice(id: string): number | null {
  try {
    const raw = localStorage.getItem(LS_PREV(id))
    const v = raw === null ? NaN : parseFloat(raw)
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

function loadLatch(id: string): 'up' | 'down' | null {
  try {
    const raw = localStorage.getItem(LS_LATCH(id))
    return raw === 'up' || raw === 'down' ? raw : null
  } catch {
    return null
  }
}

function saveLatch(id: string, value: 'up' | 'down' | null): void {
  try {
    if (value === null) localStorage.removeItem(LS_LATCH(id))
    else localStorage.setItem(LS_LATCH(id), value)
  } catch {
    // Non-fatal: the in-memory latch still drives this session.
  }
}

// Dev-only test hook (inert in production builds): seed local state from
// URL params, e.g. `?alert=bitcoin:57800&prev=bitcoin:57000` sets BTC's
// alert threshold and the "previous price" used for crossing detection.
// Used to exercise the alert path against real live prices in the
// simulator; the shipped .ehpk build ignores these params entirely.
function seedDevStateFromUrl(): void {
  if (!import.meta.env.DEV) return
  const params = new URLSearchParams(window.location.search)
  const alert = params.get('alert')
  const prev = params.get('prev')
  try {
    if (alert) {
      const [id, value] = alert.split(':')
      if (id && Number.isFinite(parseFloat(value))) {
        localStorage.setItem(LS_ALERT(id), String(parseFloat(value)))
        console.log(`[dev-seed] alert threshold ${id} = ${value}`)
      }
    }
    if (prev) {
      const [id, value] = prev.split(':')
      if (id && Number.isFinite(parseFloat(value))) {
        localStorage.setItem(LS_PREV(id), String(parseFloat(value)))
        console.log(`[dev-seed] previous price ${id} = ${value}`)
      }
    }
  } catch (err) {
    console.warn('[dev-seed] failed:', err)
  }
}

const state = {
  coinIndex: 0,
  view: 'price' as 'price' | 'range', // price view | 24h high/low view
  quotes: new Map<string, Quote>(),
  // Last fetched price per coin, used for crossing detection. Initialised
  // from localStorage so a crossing can be detected across restarts.
  prevPrices: new Map<string, number>(),
  thresholds: new Map<string, number>(),
  // Latched crossing per coin: 'up' = price crossed above the threshold,
  // 'down' = crossed below. Stays latched until the price moves back
  // across the threshold; persisted in localStorage.
  alerts: new Map<string, 'up' | 'down'>(),
  online: true,
  lastError: '',
}

function coin(): Coin {
  return COINS[state.coinIndex % COINS.length]
}

function fmtPrice(n: number): string {
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return '$' + n.toFixed(2)
  return '$' + n.toFixed(4)
}

function fmtChange(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(2)}%`
}

function alertLine(c: Coin, q: Quote | undefined): string {
  const threshold = state.thresholds.get(c.id) ?? 0
  if (!threshold) return ''
  const latched = state.alerts.get(c.id)
  if (latched === 'up') return `▲ ALERT! crossed ${fmtPrice(threshold)}`
  if (latched === 'down') return `▼ ALERT! crossed ${fmtPrice(threshold)}`
  if (!q) return `Alert ${fmtPrice(threshold)}`
  return q.price >= threshold
    ? `Alert ${fmtPrice(threshold)} · above`
    : `Alert ${fmtPrice(threshold)} · below`
}

function renderContent(): string {
  const c = coin()
  const q = state.quotes.get(c.id)
  const idx = `${state.coinIndex + 1}/${COINS.length}`

  if (!q) {
    return (
      `CoinGlance  ${idx}\n\n` +
      `${c.name} (${c.symbol})\n` +
      `Loading prices...\n\n` +
      `${alertLine(c, undefined)}\n` +
      `Tap: next coin\n` +
      `Long-press: high / low\n` +
      `Double-tap: exit`
    )
  }

  const arrow = q.change24h >= 0 ? '▲' : '▼'
  const status = state.online ? '' : ' (offline - last price)'

  if (state.view === 'range') {
    return (
      `CoinGlance  ${idx}${status}\n\n` +
      `${c.name} (${c.symbol})\n` +
      `24h high  ${fmtPrice(q.high24h)}\n` +
      `24h low   ${fmtPrice(q.low24h)}\n\n` +
      `Now ${fmtPrice(q.price)}  ${arrow} ${fmtChange(q.change24h)}\n` +
      `${alertLine(c, q)}\n` +
      `Tap: next coin · Long-press: price`
    )
  }

  return (
    `CoinGlance  ${idx}${status}\n\n` +
    `${c.name} (${c.symbol})\n` +
    `${fmtPrice(q.price)}\n` +
    `24h  ${arrow} ${fmtChange(q.change24h)}\n` +
    `${alertLine(c, q)}\n\n` +
    `Tap: next coin · Long-press: high/low`
  )
}

// Crossing detection for one coin after a successful fetch. `prev` is the
// price before this fetch (from the previous fetch or localStorage).
// Pure logic lives in ./alerts.ts (unit-tested); this wrapper supplies the
// coin's threshold and the currently latched state.
function detectCrossForCoin(
  id: string,
  prev: number | null,
  price: number,
  latched: 'up' | 'down' | null,
): 'up' | 'down' | null {
  return detectCross(state.thresholds.get(id) ?? 0, prev, price, latched)
}

async function refresh(bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>>) {
  const ids = COINS.map(c => c.id).join(',')
  try {
    const res = await fetch(`${COINGECKO_URL}&ids=${encodeURIComponent(ids)}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows = (await res.json()) as Array<{
      id: string
      current_price: number
      price_change_percentage_24h: number
      high_24h: number
      low_24h: number
    }>
    for (const row of rows) {
      const prev = state.prevPrices.get(row.id) ?? loadPrevPrice(row.id)
      const latched = detectCrossForCoin(row.id, prev, row.current_price, state.alerts.get(row.id) ?? null)
      if (latched === null) {
        state.alerts.delete(row.id)
        saveLatch(row.id, null)
      } else {
        state.alerts.set(row.id, latched)
        saveLatch(row.id, latched)
      }
      state.prevPrices.set(row.id, row.current_price)
      try {
        localStorage.setItem(LS_PREV(row.id), String(row.current_price))
      } catch {
        // Non-fatal.
      }
      state.quotes.set(row.id, {
        price: row.current_price,
        change24h: row.price_change_percentage_24h,
        high24h: row.high_24h,
        low24h: row.low_24h,
        fetchedAt: Date.now(),
      })
    }
    state.online = true
    state.lastError = ''
  } catch (err) {
    // Offline fallback: keep the last known quote, flag it on screen.
    state.online = false
    state.lastError = String(err)
    console.warn('CoinGecko fetch failed, showing last price:', err)
  }
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: 1,
      containerName: 'main',
      content: renderContent(),
    }),
  )
}

seedDevStateFromUrl()
for (const c of COINS) {
  state.thresholds.set(c.id, loadThreshold(c.id))
  const prev = loadPrevPrice(c.id)
  if (prev !== null) state.prevPrices.set(c.id, prev)
  const latched = loadLatch(c.id)
  if (latched) state.alerts.set(c.id, latched)
}

const bridge = await waitForEvenAppBridge()

const mainText = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 1,
  containerName: 'main',
  content: renderContent(),
  isEventCapture: 1,
})

const result = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 1,
    textObject: [mainText],
  }),
)
console.log('Page created:', result === 0 ? 'success' : `failed (${result})`)

// First fetch immediately, then every 60 s.
await refresh(bridge)
setInterval(() => void refresh(bridge), REFRESH_MS)

// Reads the event type out of one envelope. CLICK_EVENT is 0 and protobuf
// omits zero-value fields, so a single tap arrives with `eventType`
// undefined — resolve the default INSIDE the envelope check.
function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

// Gesture map:
//   tap         → next coin
//   long-press  → toggle price view / 24h high-low view
//   double-tap  → exit (platform convention: shutDownPageContainer(1)
//                   shows the system exit-confirmation dialog; required
//                   on the root page, so it cannot also toggle the view)
const unsubscribe = bridge.onEvenHubEvent(event => {
  const sysType = eventTypeOf(event.sysEvent)
  const textType = eventTypeOf(event.textEvent)
  const type = sysType ?? textType
  if (type === null) return

  if (
    sysType === OsEventTypeList.DOUBLE_CLICK_EVENT ||
    textType === OsEventTypeList.DOUBLE_CLICK_EVENT
  ) {
    bridge.shutDownPageContainer(1)
    return
  }

  if (type === OsEventTypeList.LONG_PRESS_EVENT) {
    state.view = state.view === 'price' ? 'range' : 'price'
    void bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 1,
        containerName: 'main',
        content: renderContent(),
      }),
    )
    return
  }

  if (type === OsEventTypeList.CLICK_EVENT) {
    state.coinIndex = (state.coinIndex + 1) % COINS.length
    void bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: 1,
        containerName: 'main',
        content: renderContent(),
      }),
    )
    return
  }

  if (
    sysType === OsEventTypeList.SYSTEM_EXIT_EVENT ||
    sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT
  ) {
    unsubscribe()
  }
})
