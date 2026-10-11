import { sectionProgress, sectionSizeOf } from "../../shared/engine/analysis"
import { NO_CELL, coveredBoard, press, toggleFlag, uncover, type Board, type MineRule } from "../../shared/engine/board"
import { cellAt, fieldFromLayout } from "../../shared/engine/field"
import { mineRuleFor, rulesOf } from "../../shared/game/modes"
import { MOVE_FLAG, SECTION_LEVELS, type Move, type PlayerOutcome, type PlayerProgress } from "../../shared/protocol"
import type { OtherPlayersGame, RecordedGame } from "./api"

// Playing a recorded game back. A record is the board and the moves made on it, so playing it back is making
// those moves again, by the engine and the rules the game was played with in the first place

// About how many cells' worth of boards a replay keeps in memory. A long game on a huge board keeps only every
// few boards and works out the ones between as they are asked for
const CELLS_KEPT = 2_000_000

// A game that starts long after its clock did (the daily challenge, picked back up later) is played back from just
// before its first move rather than from the start of the clock
const LATE_START_MS = 5000
const LEAD_IN_MS = 1000

// A recorded game, ready to be played back: any moment of it can be asked for
export type Replay = {
  // how far into the game's own clock the replay starts: nought, unless the game started long after its clock did
  startMs: number
  // when each move was made, in milliseconds from where the replay starts
  times: number[]
  // how long the replay runs for
  lengthMs: number
  moves: Move[]
  // the board as it stood after that many moves (none: just opened)
  boardAfter: (moveCount: number) => Board
  // how many mines had been hit after that many moves
  mineHitsAfter: (moveCount: number) => number
}

// What one move did to a board, and the mine it uncovered if it uncovered one
function play(board: Board, [, kind, row, col]: Move, onMine: MineRule): { board: Board, mine: number } {
  const at = cellAt(board.field.cols, row, col)
  return kind === MOVE_FLAG ? { board: toggleFlag(board, at), mine: NO_CELL } : press(board, at, onMine)
}

// What makeReplay needs of a game: the board it was played on, the rules it was played by, and one player's moves
type Recording = Pick<RecordedGame, "mode" | "rows" | "cols" | "mines" | "layout" | "openRow" | "openCol" | "durationMs" | "moves">

export function makeReplay(game: Recording): Replay {
  const { rows, cols, moves } = game
  const onMine = mineRuleFor(rulesOf(game.mode), game)
  const opened = uncover(coveredBoard(fieldFromLayout(rows, cols, game.layout)), cellAt(cols, game.openRow, game.openCol)).board
  const clamp = (moveCount: number) => Math.max(0, Math.min(moves.length, Math.floor(moveCount)))

  // one run through the whole game, keeping every `every`th board and a running count of the mines hit
  const every = Math.max(1, Math.ceil(rows * cols * moves.length / CELLS_KEPT))
  const kept: Board[] = [opened]
  const mineHits = new Uint32Array(moves.length + 1)
  let board = opened
  moves.forEach((move, at) => {
    const played = play(board, move, onMine)
    board = played.board
    mineHits[at + 1] = mineHits[at] + (played.mine === NO_CELL ? 0 : 1)
    if ((at + 1) % every === 0) kept.push(board)
  })

  // the board asked for last: playing forwards asks for the one after it, which is a single move further on
  let last = { moveCount: 0, board: opened }
  const boardAfter = (moveCount: number): Board => {
    const wanted = clamp(moveCount)
    const nearest = Math.floor(wanted / every)
    let from = last.moveCount <= wanted && last.moveCount >= nearest * every ? last : { moveCount: nearest * every, board: kept[nearest] }
    for (let at = from.moveCount; at < wanted; at++) from = { moveCount: at + 1, board: play(from.board, moves[at], onMine).board }
    last = from
    return from.board
  }

  const firstMs = moves[0]?.[0] ?? 0
  const startMs = firstMs > LATE_START_MS ? firstMs - LEAD_IN_MS : 0
  const times = moves.map(([ms]) => ms - startMs)
  return {
    startMs,
    times,
    lengthMs: Math.max(1, game.durationMs - startMs, times[times.length - 1] ?? 0),
    moves,
    boardAfter,
    mineHitsAfter: moveCount => mineHits[clamp(moveCount)],
  }
}

// How many of a replay's moves have been made by a moment in it
export function movesMadeBy(replay: Replay, positionMs: number): number {
  let low = 0
  let high = replay.times.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (replay.times[middle] <= positionMs) low = middle + 1
    else high = middle
  }
  return low
}

// Another player's side of a game played in a room, ready to be asked how far along they were at any moment of it.
// It was played on the same board from the same opening, so it is played back by the same rules
export function makeOtherReplay(game: RecordedGame, other: OtherPlayersGame): Replay {
  return makeReplay({ ...game, durationMs: other.durationMs, moves: other.moves })
}

// what of a player's record says how their game ended, and on what size of board
type PlayedBy = { rows: number, cols: number, outcome: string, durationMs: number }

// How far along a player was `gameMs` into the game's clock, in the shape the small pixelated boards are drawn
// from while a game is being played: so a replay shows the other players exactly as the game did
export function progressAt(replay: Replay, record: PlayedBy, gameMs: number): PlayerProgress {
  // their game goes on until the moment it was recorded as ending, however long before that their last move was
  return progressAfter(replay, record, movesMadeBy(replay, gameMs - replay.startMs), gameMs >= record.durationMs)
}

// The same, for a player who had made `moveCount` of their moves and whose game was or wasn't `over`: all that how
// far along they were depends on, so it only needs working out again when one of those changes
export function progressAfter(replay: Replay, record: PlayedBy, moveCount: number, over: boolean): PlayerProgress {
  const { sections, share } = sectionProgress(replay.boardAfter(moveCount), sectionSizeOf(record.rows, record.cols), SECTION_LEVELS)
  return {
    sections,
    percent: Math.floor(100 * share),
    mineHits: replay.mineHitsAfter(moveCount),
    finishedMs: over && record.outcome === "cleared" ? record.durationMs : null,
    outcome: over ? record.outcome as PlayerOutcome : "playing",
    // where they came and what it did to their rating aren't part of how far along they were
    place: 0,
    ratingChange: null,
  }
}
