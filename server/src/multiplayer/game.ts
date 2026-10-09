import { chordCell, createEmptyBoard, flagCell, populateBoard, revealCell, type Board } from "../../../shared/board.js"
import {
  CELL_FLAGGED, CELL_HIDDEN, CELL_MINE, MINE_COOLDOWN_MS, SECTION_LEVELS, START_COUNTDOWN_MS, mineBlastRadius,
  type BoardSettings, type GameSummary, type Player, type PlayerOutcome, type PlayerProgress,
} from "../../../shared/protocol.js"

// A board is cut into at most this many sections along its longer side for showing progress to other players.
// A section is never smaller than 2x2 cells: everyone plays the same board, so showing an opponent's
// progress cell by cell would show exactly which cells are safe
const SECTIONS_ALONG_LONG_SIDE = 12
const SECTION_SIZE_MIN = 2

type PlayerGame = {
  board: Board
  // the moment (server clock) this player can play again after uncovering a mine
  blockedUntil: number
  mineHits: number
  finishedMs: number | null
  outcome: PlayerOutcome
  // how long they had been playing when they stopped without clearing the board
  stoppedMs: number | null
}

let nextGameId = 1

// One game in one room. The board, mines included, only ever exists here on the server:
// players are sent what they have uncovered themselves and nothing else
export type Game = {
  id: number
  settings: BoardSettings
  sectionSize: number
  // the cell the opening click was made on
  start: { row: number, col: number }
  // The moment (server clock) play begins: a short countdown after the game is created,
  // during which players can look at the board but not touch it. Times are measured from here
  startedAt: number
  // By player id: everyone who started the game. A player who stops (or leaves the room) stays in here as they
  // stood, so the game can be scored, and their board looked at, afterwards
  players: Map<string, PlayerGame>
  // how many cells the opening click uncovered: nobody earned those
  openedAtStart: number
  // The moment (server clock) the players still going are stopped. Null until that clock starts (see timeLimitDue)
  deadline: number | null
  // nobody is playing any more
  over: boolean
  // how far the game moved each player's rating, by player id, once it is over and that has been worked out
  ratingChanges: Map<string, number> | null
}

// How one player came out of a game
export type Standing = {
  playerId: string
  finishedMs: number | null
  // how much of what was left to uncover after the opening they uncovered, 0 to 1
  share: number
  mineHits: number
  // how long they were playing
  elapsedMs: number
}

type StartOptions = {
  // where the randomness comes from: Math.random, unless the same board is wanted again (the daily challenge)
  random?: () => number
  // when play begins: after the usual countdown, unless the clock was already started some other time
  startedAt?: number
}

export function startGame(settings: BoardSettings, playerIds: string[], now: number, { random = Math.random, startedAt = now + START_COUNTDOWN_MS }: StartOptions = {}): Game {
  // The first click is made for everyone, on a cell picked at random, and the mines are laid around it
  // exactly as in singleplayer. So every player starts from the same board with the same patch already open
  const row = Math.floor(random() * settings.rows)
  const col = Math.floor(random() * settings.cols)
  const laid = populateBoard(createEmptyBoard(settings.rows, settings.cols), settings.mines, row, col, { excludeAdj: true, random })
  const opened = revealCell(laid, row, col)
  // on a tiny board that one click can already uncover everything
  const finishedMs = opened.status === "won" ? 0 : null
  const outcome: PlayerOutcome = finishedMs === null ? "playing" : "cleared"

  return {
    id: nextGameId++,
    settings,
    sectionSize: Math.max(SECTION_SIZE_MIN, Math.ceil(Math.max(settings.rows, settings.cols) / SECTIONS_ALONG_LONG_SIDE)),
    start: { row, col },
    startedAt,
    // boards are never changed in place, so everyone can start from the same one
    players: new Map(playerIds.map(id => [id, { board: opened, blockedUntil: 0, mineHits: 0, finishedMs, outcome, stoppedMs: null }])),
    openedAtStart: opened.revealedCount,
    deadline: null,
    over: false,
    ratingChanges: null,
  }
}

function standingOf(game: Game, playerId: string, player: PlayerGame, now: number): Standing {
  const { rows, cols, mines } = game.settings
  const leftToUncover = rows * cols - mines - game.openedAtStart
  return {
    playerId,
    finishedMs: player.finishedMs,
    // a mine going off can cover up more than they have uncovered since the opening: that is nothing, not less than nothing
    share: leftToUncover === 0 ? 1 : Math.max(0, player.board.revealedCount - game.openedAtStart) / leftToUncover,
    mineHits: player.mineHits,
    elapsedMs: player.finishedMs ?? player.stoppedMs ?? Math.max(0, now - game.startedAt),
  }
}

// Stops a player who is still going, for the reason given. Returns whether they were
function stop(game: Game, playerId: string, outcome: Exclude<PlayerOutcome, "playing" | "cleared">, now: number): boolean {
  const player = game.players.get(playerId)
  if (!player || player.outcome !== "playing") return false
  player.outcome = outcome
  player.stoppedMs = Math.max(0, now - game.startedAt)
  return true
}

export const giveUp = (game: Game, playerId: string, now: number): boolean => stop(game, playerId, "gaveUp", now)

// A player leaving the room in the middle of the game. Someone who had already finished keeps their result
export const leaveGame = (game: Game, playerId: string, now: number): boolean => stop(game, playerId, "left", now)

// Stops everyone who is still going: their time is up
export function stopEveryone(game: Game, now: number) {
  for (const playerId of game.players.keys()) stop(game, playerId, "timedOut", now)
}

export const isPlaying = (game: Game, playerId: string): boolean => game.players.get(playerId)?.outcome === "playing"

const countWith = (game: Game, outcome: PlayerOutcome): number =>
  [...game.players.values()].filter(player => player.outcome === outcome).length

export const stillPlaying = (game: Game): number => countWith(game, "playing")

// Whether it is time to start the clock on the players still going: once at least half of the players
// who haven't given up or left have cleared the board. (Those who gave up aren't waiting on anybody.)
export function timeLimitDue(game: Game): boolean {
  const cleared = countWith(game, "cleared")
  const playing = countWith(game, "playing")
  return game.deadline === null && playing > 0 && cleared >= (cleared + playing) / 2
}

// Everyone who took part, best first, each with their place (1 is best; equal results share a place).
// Clearing the board beats not clearing it; among those who cleared it the faster is better,
// and among those who didn't, whoever uncovered more
export function standings(game: Game, now: number): (Standing & { place: number })[] {
  const all = [...game.players].map(([id, player]) => standingOf(game, id, player, now))
  const better = (a: Standing, b: Standing) =>
    a.finishedMs !== null && b.finishedMs !== null ? a.finishedMs - b.finishedMs
      : a.finishedMs !== null ? -1
      : b.finishedMs !== null ? 1
      : b.share - a.share
  all.sort(better)
  return all.map(standing => ({ ...standing, place: 1 + all.findIndex(other => better(other, standing) === 0) }))
}

// The player, if they are in the game and allowed to act on this cell right now
function actingPlayer(game: Game, playerId: string, row: number, col: number, now: number): PlayerGame | null {
  const player = game.players.get(playerId)
  const onBoard = Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < game.settings.rows && col >= 0 && col < game.settings.cols
  if (!player || !onBoard || now < game.startedAt || player.outcome !== "playing" || now < player.blockedUntil) return null
  return player
}

// A mine going off: everything uncovered within its blast is covered up again.
// The mine itself stays uncovered, and flags stay where they are
function coverAround(board: Board, row: number, col: number, radius: number): Board {
  let revealedCount = board.revealedCount
  // boards are never changed in place: only the cells that change are made anew
  const grid = board.grid.map(cells => cells.map((cell) => {
    const inBlast = (cell.row - row) ** 2 + (cell.col - col) ** 2 <= radius ** 2
    if (!inBlast || !cell.revealed || cell.hasMine) return cell
    revealedCount--
    return { ...cell, revealed: false }
  }))
  return { ...board, grid, revealedCount }
}

// Uncovers a cell, or chords it if it is already uncovered. Returns whether anything changed
export function reveal(game: Game, playerId: string, row: number, col: number, now: number): boolean {
  const player = actingPlayer(game, playerId, row, col, now)
  if (!player) return false

  const before = player.board
  let after = before.grid[row][col].revealed ? chordCell(before, row, col) : revealCell(before, row, col)
  if (after === before) return false

  if (after.status === "lost") {
    // Uncovering a mine doesn't end the game here: it goes off, and the player sits out for a moment.
    // The mine is the cell they clicked, or one beside it if this was a chord over a misplaced flag
    const mine = after.grid.flat().find(cell => cell.hasMine && cell.revealed && !before.grid[cell.row][cell.col].revealed)!
    after = coverAround({ ...after, status: "playing" }, mine.row, mine.col, mineBlastRadius(game.settings))
    player.mineHits++
    player.blockedUntil = now + MINE_COOLDOWN_MS
  }
  player.board = after
  if (after.status === "won") {
    player.finishedMs = now - game.startedAt
    player.outcome = "cleared"
  }
  return true
}

// Flags or unflags a cell. Returns whether anything changed
export function flag(game: Game, playerId: string, row: number, col: number, now: number): boolean {
  const player = actingPlayer(game, playerId, row, col, now)
  if (!player) return false

  const after = flagCell(player.board, row, col)
  if (after === player.board) return false
  player.board = after
  return true
}

// A player's board as it is sent to them (and to whoever is watching them): one character per cell, row after row
export function boardView(game: Game, playerId: string, now: number): { cells: string, cooldownMs: number } | null {
  const player = game.players.get(playerId)
  if (!player) return null

  const cells = player.board.grid
    .map(row => row.map(cell =>
      cell.flagged ? CELL_FLAGGED
        : !cell.revealed ? CELL_HIDDEN
        : cell.hasMine ? CELL_MINE
        : String(cell.neighborCount)).join(""))
    .join("")
  return { cells, cooldownMs: Math.max(0, player.blockedUntil - now) }
}

// everything about a player's progress that can be told from their own board
type OwnProgress = Omit<PlayerProgress, "place" | "ratingChange">

function progressOf(game: Game, player: PlayerGame): OwnProgress {
  const { rows, cols, mines } = game.settings
  const sectionCols = Math.ceil(cols / game.sectionSize)
  const sectionCount = Math.ceil(rows / game.sectionSize) * sectionCols
  const share = player.board.revealedCount / (rows * cols - mines)

  // per section: how many safe cells it has, and how many of those are uncovered
  const safe = new Array<number>(sectionCount).fill(0)
  const uncovered = new Array<number>(sectionCount).fill(0)
  for (const row of player.board.grid) {
    for (const cell of row) {
      if (cell.hasMine) continue
      const section = Math.floor(cell.row / game.sectionSize) * sectionCols + Math.floor(cell.col / game.sectionSize)
      safe[section]++
      if (cell.revealed) uncovered[section]++
    }
  }

  return {
    // A section that is nothing but mines has nothing to uncover. Showing it as done (or never done)
    // would give away where it is, so it just follows the board as a whole
    sections: safe.map((total, section) => Math.floor(SECTION_LEVELS * (total === 0 ? share : uncovered[section] / total))),
    percent: Math.floor(100 * share),
    mineHits: player.mineHits,
    finishedMs: player.finishedMs,
    outcome: player.outcome,
  }
}

// How one player is doing, for whoever needs just theirs
export function progressFor(game: Game, playerId: string): OwnProgress | null {
  const player = game.players.get(playerId)
  return player ? progressOf(game, player) : null
}

// `players` is who the ids in the game belong to: the game itself only knows the ids
export function summarize(game: Game, players: Player[], now: number): GameSummary {
  const places = new Map(standings(game, now).map(standing => [standing.playerId, standing.place]))
  return {
    id: game.id,
    settings: game.settings,
    players,
    over: game.over,
    timeLeftMs: game.deadline === null || game.over ? null : Math.max(0, game.deadline - now),
    sectionRows: Math.ceil(game.settings.rows / game.sectionSize),
    sectionCols: Math.ceil(game.settings.cols / game.sectionSize),
    start: game.start,
    elapsedMs: now - game.startedAt,
    progress: Object.fromEntries([...game.players].map(([id, player]) => [id, {
      ...progressOf(game, player),
      place: places.get(id)!,
      ratingChange: game.ratingChanges?.get(id) ?? null,
    }])),
  }
}
