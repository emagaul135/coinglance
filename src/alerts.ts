// Pure price-alert crossing logic for CoinGlance (no SDK dependency, so it
// can be unit-tested with plain node).
//
// A threshold is "crossed" when the price moves from one side of it to the
// other between two consecutive fetches. The crossing latches ('up' /
// 'down') and stays latched until the price moves back across the
// threshold, so the glasses keep showing the indicator instead of
// flickering on a single tick.

export function detectCross(
  threshold: number,
  prev: number | null,
  price: number,
  latched: 'up' | 'down' | null,
): 'up' | 'down' | null {
  if (!threshold) return latched
  if (prev !== null) {
    if (prev < threshold && price >= threshold) return 'up'
    if (prev > threshold && price <= threshold) return 'down'
  }
  // Clear the latch once the price moves back across the threshold.
  if (latched === 'up' && price < threshold) return null
  if (latched === 'down' && price > threshold) return null
  return latched
}
