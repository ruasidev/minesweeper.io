// The chance in a round of training.
//
// Like a board, a round is made from a seed, and the same seed makes the same round every time: that is what lets
// the tests ask for a thousand rounds and say something about every one of them. Unlike a board's, the seed is no
// secret. A round is made and judged in the browser, where its mines are in plain sight for anyone who looks.
//
// The numbers come from xoshiro128**, the generator the boards are laid with (crates/boardgen/src/random.rs)

import { SEED_BYTES } from "../engine/seed.js"

export type Random = {
  // a whole number from 0 up to, and not including, `bound`
  below: (bound: number) => number
  // a whole number from `low` to `high`, both included
  between: (low: number, high: number) => number
  // true that share of the time
  chance: (share: number) => boolean
  // one of a list, each as likely as the next
  pick: <T>(from: readonly T[]) => T
}

const rotated = (word: number, by: number): number => (word << by) | (word >>> (32 - by))

export function randomFrom(seed: Uint8Array): Random {
  if (seed.length !== SEED_BYTES) throw new RangeError(`A seed is ${SEED_BYTES} bytes, not ${seed.length}`)
  const words = new DataView(seed.buffer, seed.byteOffset, SEED_BYTES)
  let a = words.getUint32(0, true)
  let b = words.getUint32(4, true)
  let c = words.getUint32(8, true)
  let d = words.getUint32(12, true)
  // nothing ever comes out of all zeroes but more zeroes
  if ((a | b | c | d) === 0) a = 1

  const next = (): number => {
    const result = Math.imul(rotated(Math.imul(b, 5), 7), 9) >>> 0
    const shifted = b << 9
    c ^= a
    d ^= b
    b ^= c
    a ^= d
    c ^= shifted
    d = rotated(d, 11)
    return result
  }

  // exact for any bound a board has use for: a 32-bit number times a small one fits a double with room to spare
  const below = (bound: number): number => Math.floor(next() / 0x1_0000_0000 * bound)
  return {
    below,
    between: (low, high) => low + below(high - low + 1),
    chance: share => next() < share * 0x1_0000_0000,
    pick: from => from[below(from.length)],
  }
}
