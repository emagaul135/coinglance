// Unit test for the pure alert-crossing logic (src/alerts.ts).
// Run: npx tsc src/alerts.ts --outDir /tmp/alert-test --module nodenext --target es2022 && node /tmp/alert-test/alerts.test.mjs
import { detectCross } from '/tmp/alert-test/alerts.js'

let failures = 0
function check(name, actual, expected) {
  const ok = actual === expected
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: got ${actual}, want ${expected}`)
}

// Cross up: prev below, price at/above threshold.
check('cross up', detectCross(57800, 57000, 57852, null), 'up')
check('cross up, exact threshold', detectCross(57800, 57000, 57800, null), 'up')
// Cross down: prev above, price at/below threshold.
check('cross down', detectCross(57800, 58000, 57700, null), 'down')
check('cross down, exact threshold', detectCross(57800, 58000, 57800, null), 'down')
// No crossing: both sides the same.
check('no cross, both below', detectCross(57800, 57000, 57500, null), null)
check('no cross, both above', detectCross(57800, 58000, 58500, null), null)
// No previous price: cannot detect a crossing, latch unchanged.
check('no prev, no latch', detectCross(57800, null, 58000, null), null)
check('no prev, keeps latch', detectCross(57800, null, 58000, 'up'), 'up')
// Latch flips when the price moves back across the threshold (that move
// IS the opposite crossing).
check('up latch flips to down', detectCross(57800, 58000, 57700, 'up'), 'down')
check('down latch flips to up', detectCross(57800, 57700, 58000, 'down'), 'up')
// With no previous price to compare, a stale latch clears once the price
// is back on the other side.
check('stale up latch clears, no prev', detectCross(57800, null, 57700, 'up'), null)
check('stale down latch clears, no prev', detectCross(57800, null, 58000, 'down'), null)
// Latch holds while the price stays on the crossed side.
check('up latch holds above', detectCross(57800, 58000, 58100, 'up'), 'up')
check('down latch holds below', detectCross(57800, 57700, 57600, 'down'), 'down')
// No threshold configured: latch untouched.
check('no threshold', detectCross(0, 57000, 58000, null), null)

if (failures > 0) {
  console.error(`${failures} FAILURES`)
  process.exit(1)
}
console.log('All detectCross tests passed.')
