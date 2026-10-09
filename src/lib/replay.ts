import { boardFromLayout, chordCell, coverAround, flagCell, revealCell, type Board } from "../../shared/board"
import { mineBlastRadius, type Move } from "../../shared/protocol"
import type { RecordedGame } from "./api"

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

// What one move did to a board, by the same rules the server played it with. In singleplayer a mine ends the game;
// anywhere else it goes off, covers back up what was uncovered around it, and the game goes on
function play(board: Board, [, kind, row, col]: Move, mineEnds: boolean, blastRadius: number): { board: Board, hitMine: boolean } {
  if (board.status !== "playing") return { board, hitMine: false }
  if (kind === 1) return { board: flagCell(board, row, col), hitMine: false }

  const after = board.grid[row][col].revealed ? chordCell(board, row, col) : revealCell(board, row, col)
  if (after.status !== "lost") return { board: after, hitMine: false }
  if (mineEnds) return { board: after, hitMine: true }
  const mine = after.grid.flat().find(cell => cell.hasMine && cell.revealed && !board.grid[cell.row][cell.col].revealed)!
  return { board: coverAround({ ...after, status: "playing" }, mine.row, mine.col, blastRadius), hitMine: true }
}

export function makeReplay(game: RecordedGame): Replay {
  const { rows, cols, moves } = game
  const mineEnds = game.kind === "singleplayer"
  const blastRadius = mineBlastRadius(game)
  const opened = revealCell(boardFromLayout(rows, cols, game.layout), game.openRow, game.openCol)

  // one run through the whole game, keeping every `every`th board and a running count of the mines hit
  const every = Math.max(1, Math.ceil(rows * cols * moves.length / CELLS_KEPT))
  const kept: Board[] = [opened]
  const mineHits: number[] = [0]
  let board = opened
  moves.forEach((move, at) => {
    const played = play(board, move, mineEnds, blastRadius)
    board = played.board
    mineHits.push(mineHits[at] + (played.hitMine ? 1 : 0))
    if ((at + 1) % every === 0) kept.push(board)
  })

  // the board asked for last: playing forwards asks for the one after it, which is a single move further on
  let last = { moveCount: 0, board: opened }
  const boardAfter = (moveCount: number): Board => {
    const wanted = Math.max(0, Math.min(moves.length, Math.floor(moveCount)))
    const nearest = Math.floor(wanted / every)
    let from = last.moveCount <= wanted && last.moveCount >= nearest * every ? last : { moveCount: nearest * every, board: kept[nearest] }
    for (let at = from.moveCount; at < wanted; at++) from = { moveCount: at + 1, board: play(from.board, moves[at], mineEnds, blastRadius).board }
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
    mineHitsAfter: moveCount => mineHits[Math.max(0, Math.min(moves.length, Math.floor(moveCount)))],
  }
}

// How many of a replay's moves have been made by a moment in it
export function movesMadeBy(replay: Replay, positionMs: number): number {
  let low = 0, high = replay.times.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (replay.times[middle] <= positionMs) low = middle + 1
    else high = middle
  }
  return low
}
