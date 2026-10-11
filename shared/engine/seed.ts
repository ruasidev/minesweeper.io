// What a board is made from.
//
// All the chance in a board comes from its seed: the same seed gives the same board every time, on the server, in
// the browser, anywhere (see generate.ts). So a board *is* its seed, and a seed that could be guessed, or tried one
// after another until the opening matches, would be a way to see every mine. A game's seed therefore comes from the
// system's cryptographic source or, for the daily challenge, from a secret only the server has; and at 128 bits
// there are far too many of them to try.

export const SEED_BYTES = 16

// A seed nobody can guess. (One of all zeroes is the only seed there is no board for, and at one chance in 2^128
// it is not going to turn up)
export function randomSeed(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SEED_BYTES))
}
