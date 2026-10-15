import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem'

// ─── SINGLE hash helper ────────────────────────────────────────────────────
/**
 * Keccak256 of a UTF-8 string. Used by the post-brief form AND the submit-work
 * form. This is the only place in the codebase that computes a content hash.
 */
export function hashText(text: string): `0x${string}` {
  const bytes = new TextEncoder().encode(text)
  return keccak256(bytes)
}

// ─── SINGLE conversion helpers ────────────────────────────────────────────
/** The contract's native token has 18 decimals (1 ether of native = 1 USDC). */
const NATIVE_DECIMALS = 18
const NATIVE_FACTOR = BigInt(10 ** NATIVE_DECIMALS)

/**
 * Format a raw 18-decimal native-USDC bigint to a human-readable string.
 * This is the ONLY place in the codebase that converts from 18-dec to display.
 * Pass `dp` (default 2) for how many fraction digits to show.
 *
 * Examples:  5000000000000000000n  →  "5.00"
 *            500000000000000000n   →  "0.50"
 *            1000000000000000000000n → "1,000.00"
 */
export function formatBond(raw: bigint, dp = 2): string {
  const whole = raw / NATIVE_FACTOR
  const frac = raw % NATIVE_FACTOR
  const fracStr = frac.toString().padStart(NATIVE_DECIMALS, '0').slice(0, dp)
  return `${whole.toLocaleString()}.${fracStr}`
}

/**
 * Parse a human USDC string (e.g. "5" or "1.50") to a raw 18-decimal bigint.
 * This is the ONLY place in the codebase that converts from display to 18-dec.
 *
 * Examples:  "5"    →  5000000000000000000n
 *            "1.5"  →  1500000000000000000n
 */
export function parseBond(amount: string): bigint {
  const clean = amount.trim()
  if (!clean || isNaN(Number(clean))) return 0n
  const [whole = '0', frac = ''] = clean.split('.')
  const fracPadded = frac.padEnd(NATIVE_DECIMALS, '0').slice(0, NATIVE_DECIMALS)
  return (BigInt(whole) * NATIVE_FACTOR) + BigInt(fracPadded)
}

// ─── Legacy aliases (used by existing callers) ─────────────────────────────
/** @deprecated Use formatBond */
export const formatNativeUsdc = formatBond
/** @deprecated Use parseBond */
export const parseNativeUsdc = parseBond

// ─── Countdown / time helpers ─────────────────────────────────────────────
/**
 * Live-countable deadline formatter. Call with the current unix timestamp in
 * seconds so that updates are pure (no hidden Date.now() inside).
 *
 * Returns "Xd Yh left", "Xh Ym left", "Xm left", "Xs left"  — or
 * "Xd ago", "Xh Ym ago", "Xm ago"  once the deadline has passed.
 */
export function formatCountdown(deadlineSecs: number, nowSecs: number): string {
  const diff = deadlineSecs - nowSecs
  if (diff > 0) {
    const days  = Math.floor(diff / 86400)
    const hours = Math.floor((diff % 86400) / 3600)
    const mins  = Math.floor((diff % 3600) / 60)
    const secs  = diff % 60
    if (days  > 0) return `${days}d ${hours}h left`
    if (hours > 0) return `${hours}h ${mins}m left`
    if (mins  > 0) return `${mins}m ${secs}s left`
    return `${secs}s left`
  }
  // Past deadline — show how long ago
  const ago = -diff
  const aDays  = Math.floor(ago / 86400)
  const aHours = Math.floor((ago % 86400) / 3600)
  const aMins  = Math.floor((ago % 3600) / 60)
  if (aDays  > 0) return `${aDays}d ago`
  if (aHours > 0) return `${aHours}h ${aMins}m ago`
  if (aMins  > 0) return `${aMins}m ago`
  return 'just now'
}

/** Shorten an address to 0x1234…abcd */
export function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** Convert a deadline duration in seconds to a unix timestamp bigint */
export function durationToDeadline(seconds: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + seconds)
}

/** Unused but re-exported for convenience */
export { encodeAbiParameters, parseAbiParameters }
