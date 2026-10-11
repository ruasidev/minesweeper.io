import { randomSeed } from "../../shared/engine/seed"
import { flag, ownGame, reveal, startGame, type Game } from "../../shared/game/game"
import type { SoloModeId } from "../../shared/game/modes"
import type { BoardSettings, CellPosition } from "../../shared/protocol"
import type { LiveGame } from "./connection"

// A game played here in the browser, for someone without an account (or whose connection to the server is down).
// It is run by the very code the server runs its games with, and reported in the very shape the server reports
// them in, so nothing that draws a game can tell the difference. Nothing about it is kept, and nothing about it can
// be trusted: the mines are right here in the page

const PLAYER = "local"

export type LocalGame = {
  game: Game
  // the game as its player sees it right now. A new one after every move that did something
  live: LiveGame
}

function snapshot(game: Game, now: number): LiveGame {
  const own = ownGame(game, PLAYER, now)!
  return { ...own, startedAt: game.startedAt, cooldownUntil: now + own.cooldownMs }
}

// Starts a game with its first click
export function startLocalGame(mode: SoloModeId, settings: BoardSettings, opening: CellPosition, now: number): LocalGame {
  const game = startGame(mode, settings, [PLAYER], now, { seed: randomSeed(), opening })
  return { game, live: snapshot(game, now) }
}

// A click on a cell. Gives back the very same game if it did nothing
export function clickLocalGame(local: LocalGame, row: number, col: number, now: number): LocalGame {
  return reveal(local.game, PLAYER, row, col, now) === null ? local : { game: local.game, live: snapshot(local.game, now) }
}

export function flagLocalGame(local: LocalGame, row: number, col: number, now: number): LocalGame {
  return flag(local.game, PLAYER, row, col, now) ? { game: local.game, live: snapshot(local.game, now) } : local
}
