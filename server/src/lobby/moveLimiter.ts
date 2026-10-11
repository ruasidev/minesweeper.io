// How fast a player may make moves. Moves are let through at this rate at the very most: well beyond what the
// fastest players manage, and well short of what a program can send. A short burst above it is allowed for
const MOVES_PER_SECOND = 15
const MOVES_BURST = 30

// What a player has left to spend on moves: it fills back up as time passes, as far as the burst
export type MoveLimiter = {
  // how many moves they may make right now
  tokens: number
  // when that was last worked out
  stamp: number
}

export const newMoveLimiter = (now: number): MoveLimiter => ({ tokens: MOVES_BURST, stamp: now })

// Whether a player may make a move right now, which uses one up. One that comes too soon is simply thrown away
export function allowMove(limiter: MoveLimiter, now: number): boolean {
  const earned = Math.max(0, now - limiter.stamp) / 1000 * MOVES_PER_SECOND
  limiter.tokens = Math.min(MOVES_BURST, limiter.tokens + earned)
  limiter.stamp = now
  if (limiter.tokens < 1) return false
  limiter.tokens--
  return true
}
