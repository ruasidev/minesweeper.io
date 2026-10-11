// A game being played: one board, everyone playing it, and the clock.
//
// It is the same thing whoever runs it. The server runs every game that counts, and keeps the board to itself:
// a player is only ever told what they have uncovered (`ownGame`). The site runs one of its own, by these same
// rules, for someone playing without an account. Nothing here keeps a result or talks to anyone: it only plays.
//
// A game is changed in place as it goes (the boards inside it are not: see engine/board.ts).

import { clicksNeeded, sectionProgress, sectionSizeOf } from "../engine/analysis.js"
import { coveredBoard, press, toggleFlag, uncover, type Board, type MineRule } from "../engine/board.js"
import { cellAt, colOf, isOnBoard, layoutText, rowOf, safeCells, type BoardSettings, type Field } from "../engine/field.js"
import { generateField } from "../engine/generate.js"
import { viewOf } from "../engine/view.js"
import {
  MOVE_CLICK, MOVE_FLAG, SECTION_LEVELS,
  type CellPosition, type GameSummary, type Move, type OwnGame, type Player, type PlayerOutcome, type PlayerProgress, type WatchedBoard,
} from "../protocol.js"
import { MINE_COOLDOWN_MS, START_COUNTDOWN_MS, mineRuleFor, rulesOf, type GameModeId, type Rules } from "./modes.js"

type PlayerGame = {
  board: Board
  // the moment (the game's clock) this player can play again after a mine went off
  blockedUntil: number
  mineHits: number
  outcome: PlayerOutcome
  // how long they took to clear the board, if they did
  finishedMs: number | null
  // how long they had been playing when they stopped without clearing it
  stoppedMs: number | null
  // everything they did, in order: the record of their game
  moves: Move[]
  // how many of their moves were thrown away for coming faster than a person can click
  dropped: number
}

// a game's record stops growing here: far more moves than any real game has
const MOVES_KEPT_MAX = 20_000

let nextGameId = 1

export type Game<Mode extends GameModeId = GameModeId> = {
  id: number
  // a name for the game that stays unique after a restart, for the records kept of it
  key: string
  mode: Mode
  rules: Rules
  settings: BoardSettings
  // whether the game counts towards ratings
  rated: boolean
  // where the mines are: one field, shared by everyone playing
  field: Field
  // what a mine does here, as the engine is told it
  onMine: MineRule
  // the cell the board was opened on
  opening: number
  // Whether the board is known to need no guess: so for every game whose rules ask for such a board, save one so
  // crowded with mines that none could be found (see GeneratedBoard)
  guessFree: boolean
  // how many cells the opening uncovered: nobody earned those
  openedAtStart: number
  // The fewest clicks the board could be cleared in from its opening (its "3BV"). How fast a player got through
  // those is how their speed is judged
  bv: number
  sectionSize: number
  // The moment play begins, by the clock of whoever runs the game: a short countdown after a dealt board is made,
  // during which players can look at it but not touch it. Times are measured from here
  startedAt: number
  // By player id: everyone who started the game. A player who stops (or leaves) stays in here as they stood,
  // so the game can be scored, and their board looked at, afterwards
  players: Map<string, PlayerGame>
  // the moment the players still going are stopped. Null until that clock starts (see timeLimitDue)
  deadline: number | null
  // nobody is playing any more
  over: boolean
  // how far the game moved each player's rating, by player id, once it is over and that has been worked out
  ratingChanges: Map<string, number> | null
}

export type StartOptions = {
  // What the board is made from. Whoever starts a game must give it a seed nobody else could know (randomSeed),
  // unless the same board is wanted again on purpose
  seed: Uint8Array
  // the game's name in the records kept of it
  key?: string
  // The player's first click, for a game whose board opens on it. Left out, and ignored, for one that is dealt:
  // where a dealt board opens is never the player's to choose
  opening?: CellPosition
  // when play begins: now, or after the countdown for a dealt board, unless the clock was started some other time
  startedAt?: number
  rated?: boolean
}

export function startGame<Mode extends GameModeId>(mode: Mode, settings: BoardSettings, playerIds: string[], now: number, options: StartOptions): Game<Mode> {
  const rules = rulesOf(mode)
  const dealt = rules.opening === "dealt"
  if (!dealt && !(options.opening && isOnBoard(settings, options.opening.row, options.opening.col))) {
    throw new RangeError(`A ${mode} game starts with the player's first click, on the board`)
  }

  // The mines are laid around the opening, which is then made for everyone:
  // every player starts from the same board with the same patch already open
  const clicked = dealt ? undefined : cellAt(settings.cols, options.opening!.row, options.opening!.col)
  const { field, opening, guessFree } = generateField(settings, options.seed, { opening: clicked, guessFree: rules.guessFree })
  const opened = uncover(coveredBoard(field), opening).board
  // on a tiny board that one click can already uncover everything
  const cleared = opened.status === "won"

  return {
    id: nextGameId++,
    key: options.key ?? "",
    mode,
    rules,
    settings,
    rated: options.rated ?? false,
    field,
    onMine: mineRuleFor(rules, settings),
    opening,
    guessFree,
    openedAtStart: opened.uncovered,
    bv: clicksNeeded(opened),
    sectionSize: sectionSizeOf(settings.rows, settings.cols),
    startedAt: options.startedAt ?? (dealt ? now + START_COUNTDOWN_MS : now),
    // boards are never changed in place, so everyone can start from the same one
    players: new Map(playerIds.map(id => [id, {
      board: opened,
      blockedUntil: 0,
      mineHits: 0,
      outcome: cleared ? "cleared" : "playing",
      finishedMs: cleared ? 0 : null,
      stoppedMs: null,
      moves: [],
      dropped: 0,
    }])),
    deadline: null,
    over: false,
    ratingChanges: null,
  }
}

const elapsed = (game: Game, now: number): number => Math.max(0, now - game.startedAt)

// --- Stopping ------------------------------------------------------------------------------------------------

// Stops a player who is still going, for the reason given. Returns whether they were
function stop(game: Game, playerId: string, outcome: "gaveUp" | "timedOut" | "left", now: number): boolean {
  const player = game.players.get(playerId)
  if (!player || player.outcome !== "playing") return false
  player.outcome = outcome
  player.stoppedMs = elapsed(game, now)
  return true
}

export const giveUp = (game: Game, playerId: string, now: number): boolean => stop(game, playerId, "gaveUp", now)

// A player leaving in the middle of the game. Someone who had already finished keeps their result
export const leaveGame = (game: Game, playerId: string, now: number): boolean => stop(game, playerId, "left", now)

// Stops everyone who is still going: their time is up
export function stopEveryone(game: Game, now: number): void {
  for (const playerId of game.players.keys()) stop(game, playerId, "timedOut", now)
}

export const outcomeOf = (game: Game, playerId: string): PlayerOutcome | null => game.players.get(playerId)?.outcome ?? null

export const isPlaying = (game: Game, playerId: string): boolean => outcomeOf(game, playerId) === "playing"

function countWith(game: Game, outcome: PlayerOutcome): number {
  let count = 0
  for (const player of game.players.values()) {
    if (player.outcome === outcome) count++
  }
  return count
}

export const stillPlaying = (game: Game): number => countWith(game, "playing")

// Whether it is time to start the clock on the players still going, in a game whose rules have one: once at least
// half of the players who haven't given up or left have cleared the board. (Those who gave up aren't waiting on anybody.)
export function timeLimitDue(game: Game): boolean {
  if (!game.rules.finishLimit || game.deadline !== null) return false
  const cleared = countWith(game, "cleared")
  const playing = countWith(game, "playing")
  return playing > 0 && cleared >= (cleared + playing) / 2
}

// --- Playing -------------------------------------------------------------------------------------------------

// The player, if they are in the game and allowed to act on this cell right now
function actingPlayer(game: Game, playerId: string, row: number, col: number, now: number): PlayerGame | null {
  const player = game.players.get(playerId)
  if (!player || player.outcome !== "playing" || !isOnBoard(game.settings, row, col)) return null
  // not during the countdown, and not while sitting out after a mine
  if (now < game.startedAt || now < player.blockedUntil) return null
  return player
}

// Adds a move to the record of a player's game
function remember(game: Game, player: PlayerGame, kind: Move[1], row: number, col: number, now: number): void {
  if (player.moves.length < MOVES_KEPT_MAX) player.moves.push([elapsed(game, now), kind, row, col])
}

// A click on a cell: it is uncovered, or chorded if it is uncovered already. Returns how the player stands
// afterwards ("playing", or how their game has just ended), or null if the click did nothing
export function reveal(game: Game, playerId: string, row: number, col: number, now: number): PlayerOutcome | null {
  const player = actingPlayer(game, playerId, row, col, now)
  if (!player) return null

  const played = press(player.board, cellAt(game.settings.cols, row, col), game.onMine)
  if (played.board === player.board) return null
  remember(game, player, MOVE_CLICK, row, col, now)
  player.board = played.board

  if (played.board.status === "lost") {
    player.mineHits++
    player.outcome = "lost"
    player.stoppedMs = elapsed(game, now)
  } else if (played.board.status === "won") {
    player.outcome = "cleared"
    player.finishedMs = elapsed(game, now)
  } else if (played.mine >= 0) {
    // it went off, and the game goes on once the player has sat out
    player.mineHits++
    player.blockedUntil = now + MINE_COOLDOWN_MS
  }
  return player.outcome
}

// Flags or unflags a cell. Returns whether anything changed
export function flag(game: Game, playerId: string, row: number, col: number, now: number): boolean {
  const player = actingPlayer(game, playerId, row, col, now)
  if (!player) return false

  const flagged = toggleFlag(player.board, cellAt(game.settings.cols, row, col))
  if (flagged === player.board) return false
  remember(game, player, MOVE_FLAG, row, col, now)
  player.board = flagged
  return true
}

// A move of this player's was thrown away for coming too fast: it counts against how their game is judged
export function noteDropped(game: Game, playerId: string): void {
  const player = game.players.get(playerId)
  if (player) player.dropped++
}

// --- What a game has to say ------------------------------------------------------------------------------------

const positionOf = (game: Game, at: number): CellPosition => ({ row: rowOf(game.settings.cols, at), col: colOf(game.settings.cols, at) })

// Where every mine is, as the text a record keeps it in. Never to be sent to anyone still playing the board
export const layoutOf = (game: Game): string => layoutText(game.field.mines)

const durationOf = (game: Game, player: PlayerGame, now: number): number => player.finishedMs ?? player.stoppedMs ?? elapsed(game, now)

const percentOf = (board: Board): number => {
  const safe = safeCells(board.field)
  return safe === 0 ? 100 : Math.floor(100 * board.uncovered / safe)
}

// A player's own game as it is sent to them. Everything they are allowed to know, and nothing else:
// the mines are told only once their game is over, and only where the rules say they may be
export function ownGame(game: Game, playerId: string, now: number): OwnGame | null {
  const player = game.players.get(playerId)
  if (!player) return null
  const over = player.outcome !== "playing"
  return {
    id: game.id,
    mode: game.mode,
    settings: game.settings,
    opening: positionOf(game, game.opening),
    elapsedMs: now - game.startedAt,
    cells: viewOf(player.board),
    cooldownMs: Math.max(0, player.blockedUntil - now),
    outcome: player.outcome,
    durationMs: over ? durationOf(game, player, now) : null,
    mineHits: player.mineHits,
    percent: percentOf(player.board),
    layout: over && game.rules.showsMines ? layoutOf(game) : null,
  }
}

// A player's board as someone watching it is sent it
export function watchedBoard(game: Game, playerId: string, now: number): WatchedBoard | null {
  const player = game.players.get(playerId)
  return player ? { cells: viewOf(player.board), cooldownMs: Math.max(0, player.blockedUntil - now) } : null
}

// Everything worth keeping about one player's game once it is over
export type PlayerRecord = {
  outcome: PlayerOutcome
  durationMs: number
  mineHits: number
  moves: Move[]
  dropped: number
}

export function recordOf(game: Game, playerId: string, now: number): PlayerRecord | null {
  const player = game.players.get(playerId)
  if (!player) return null
  return {
    outcome: player.outcome,
    durationMs: durationOf(game, player, now),
    mineHits: player.mineHits,
    moves: player.moves,
    dropped: player.dropped,
  }
}

// --- Who is winning --------------------------------------------------------------------------------------------

// How one player came out of a game
export type Standing = {
  playerId: string
  // 1 is best; equal results share a place
  place: number
  finishedMs: number | null
  // how much of what was left to uncover after the opening they uncovered, 0 to 1
  share: number
  mineHits: number
  // how long they were playing
  elapsedMs: number
}

// Clearing the board beats not clearing it; among those who cleared it the faster is better,
// and among those who didn't, whoever uncovered more. Negative when `a` is the better
function compare(a: Standing, b: Standing): number {
  if (a.finishedMs !== null && b.finishedMs !== null) return a.finishedMs - b.finishedMs
  if (a.finishedMs !== null) return -1
  if (b.finishedMs !== null) return 1
  return b.share - a.share
}

// Everyone who took part, best first
export function standings(game: Game, now: number): Standing[] {
  const leftToUncover = safeCells(game.field) - game.openedAtStart
  const all: Standing[] = []
  for (const [playerId, player] of game.players) {
    all.push({
      playerId,
      place: 0,
      finishedMs: player.finishedMs,
      // a mine going off can cover up more than they have uncovered since the opening: that is nothing, not less than nothing
      share: leftToUncover === 0 ? 1 : Math.max(0, player.board.uncovered - game.openedAtStart) / leftToUncover,
      mineHits: player.mineHits,
      elapsedMs: durationOf(game, player, now),
    })
  }
  all.sort(compare)
  // a player's place is one more than the number of players who did better: those level with the one before share theirs
  all.forEach((standing, index) => {
    standing.place = index > 0 && compare(all[index - 1], standing) === 0 ? all[index - 1].place : index + 1
  })
  return all
}

// How far along a board is, section by section. Boards are never changed in place, so what was worked out for one
// holds for as long as it is around: with several players in a game, a move means working out one board, not all
const progressKept = new WeakMap<Board, { sections: number[], percent: number }>()

function boardProgress(game: Game, board: Board): { sections: number[], percent: number } {
  let progress = progressKept.get(board)
  if (!progress) {
    // (worked out by what the site also uses to play a game back, so a replay draws these as they were)
    const { sections, share } = sectionProgress(board, game.sectionSize, SECTION_LEVELS)
    progress = { sections, percent: Math.floor(100 * share) }
    progressKept.set(board, progress)
  }
  return progress
}

// The game as everyone in its room sees it. `players` is who the ids in the game belong to: the game itself only
// knows the ids
export function summarize(game: Game, players: Player[], now: number): GameSummary {
  const places = new Map(standings(game, now).map(standing => [standing.playerId, standing.place]))
  const progress: Record<string, PlayerProgress> = {}
  for (const [id, player] of game.players) {
    progress[id] = {
      ...boardProgress(game, player.board),
      mineHits: player.mineHits,
      finishedMs: player.finishedMs,
      outcome: player.outcome,
      place: places.get(id)!,
      ratingChange: game.ratingChanges?.get(id) ?? null,
    }
  }
  return {
    id: game.id,
    mode: game.mode,
    settings: game.settings,
    rated: game.rated,
    players,
    over: game.over,
    timeLeftMs: game.deadline === null || game.over ? null : Math.max(0, game.deadline - now),
    sectionRows: Math.ceil(game.settings.rows / game.sectionSize),
    sectionCols: Math.ceil(game.settings.cols / game.sectionSize),
    opening: positionOf(game, game.opening),
    elapsedMs: now - game.startedAt,
    progress,
  }
}
