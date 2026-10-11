import { describe, expect, it } from "vitest"
import { draw, layoutDrawn, seedFrom } from "../../shared/engine/testing"
import { viewOf } from "../../shared/engine/view"
import { BEGINNER_BOARD } from "../../shared/game/boards"
import { flag, layoutOf, ownGame, recordOf, reveal, startGame } from "../../shared/game/game"
import type { GameModeId } from "../../shared/game/modes"
import type { Move } from "../../shared/protocol"
import { makeOtherReplay, makeReplay, movesMadeBy, progressAfter, progressAt } from "./replay"

// One mine, right of the middle. Opened in the top left corner, the two left-hand columns are uncovered:
//   .1##
//   .1##
//   .1##
const BOARD = ["....", "..*.", "...."]
const OPENED = [".1##", ".1##", ".1##"]

function recording(moves: Move[], overrides: { mode?: GameModeId, durationMs?: number } = {}) {
  return {
    mode: "race" as GameModeId,
    rows: 3,
    cols: 4,
    mines: 1,
    layout: layoutDrawn(...BOARD),
    openRow: 0,
    openCol: 0,
    durationMs: 10_000,
    moves,
    ...overrides,
  }
}

const UNCOVER = 0
const FLAG = 1

describe("makeReplay", () => {
  it("starts from the board as the opening left it", () => {
    const replay = makeReplay(recording([]))
    expect(draw(replay.boardAfter(0))).toEqual(OPENED)
    expect(replay.mineHitsAfter(0)).toBe(0)
  })

  it("plays each move by the rules the game was played by", () => {
    const replay = makeReplay(recording([[1000, FLAG, 1, 2], [2000, UNCOVER, 0, 2], [3000, FLAG, 1, 2]]))
    expect(draw(replay.boardAfter(1))).toEqual([".1##", ".1F#", ".1##"])
    expect(draw(replay.boardAfter(2))).toEqual([".11#", ".1F#", ".1##"])
    expect(draw(replay.boardAfter(3))).toEqual([".11#", ".1##", ".1##"])
  })

  it("chords an uncovered number that is clicked again", () => {
    // the mine flagged, then the 1 beside it clicked: the rest of the cells around that 1 open
    const replay = makeReplay(recording([[1000, FLAG, 1, 2], [2000, UNCOVER, 1, 1]]))
    expect(draw(replay.boardAfter(2))).toEqual([".11#", ".1F#", ".11#"])
  })

  it("has a mine go off and the game go on, outside singleplayer: what was uncovered around it is covered again", () => {
    const replay = makeReplay(recording([[1000, UNCOVER, 1, 2], [2500, UNCOVER, 0, 0]]))
    expect(draw(replay.boardAfter(1))).toEqual(["####", "##*#", "####"])
    expect(replay.mineHitsAfter(1)).toBe(1)
    expect(draw(replay.boardAfter(2))).toEqual([".1##", ".1*#", ".1##"])
    expect(replay.mineHitsAfter(2)).toBe(1)
  })

  it("has a mine end a singleplayer game: nothing after it changes the board", () => {
    const replay = makeReplay(recording([[1000, UNCOVER, 1, 2], [2500, UNCOVER, 0, 2], [3000, FLAG, 2, 3]], { mode: "classic" }))
    expect(draw(replay.boardAfter(1))).toEqual([".1##", ".1*#", ".1##"])
    expect(replay.boardAfter(1).status).toBe("lost")
    expect(draw(replay.boardAfter(3))).toEqual([".1##", ".1*#", ".1##"])
    expect(replay.mineHitsAfter(3)).toBe(1)
  })

  it("ends on a won board when the record is of a board being cleared", () => {
    const replay = makeReplay(recording([[1, UNCOVER, 0, 2], [2, UNCOVER, 0, 3], [3, UNCOVER, 1, 3], [4, UNCOVER, 2, 2], [5, UNCOVER, 2, 3]]))
    expect(replay.boardAfter(5).status).toBe("won")
    expect(draw(replay.boardAfter(5))).toEqual([".111", ".1#1", ".111"])
  })

  it("keeps to the moves there are, however many are asked for", () => {
    const replay = makeReplay(recording([[1000, UNCOVER, 0, 2]]))
    expect(draw(replay.boardAfter(99))).toEqual(draw(replay.boardAfter(1)))
    expect(draw(replay.boardAfter(-5))).toEqual(OPENED)
    expect(replay.mineHitsAfter(99)).toBe(0)
  })

  it("gives the same board for a moment however it is got to: forwards, backwards or straight there", () => {
    // long enough, on a big enough board, that only every few boards are kept and the rest worked out on demand
    const rows = 30, cols = 30
    let state = 7
    const random = (below: number) => (state = (state * 1664525 + 1013904223) % 2 ** 32) % below
    const moves: Move[] = Array.from({ length: 3000 }, (_, index) => [index * 10, FLAG, random(rows), random(cols)])
    // a wall of mines down the middle, so the opening leaves the far half covered for the flags to land on
    const layout = Array.from({ length: rows * cols }, (_, index) => index % cols === 15 ? "1" : "0").join("")
    const game = { mode: "race" as const, rows, cols, mines: rows, layout, openRow: 0, openCol: 0, durationMs: 30_000, moves }

    const forwards = makeReplay(game)
    const jumping = makeReplay(game)
    const wanted = [2999, 3, 1500, 1499, 1501, 0, 2998, 7, 2000]
    const straight = new Map(wanted.map(count => [count, draw(jumping.boardAfter(count))]))
    for (let count = 0; count <= 3000; count++) {
      const board = draw(forwards.boardAfter(count))
      if (straight.has(count)) expect(board).toEqual(straight.get(count))
    }
  })
})

describe("the clock of a replay", () => {
  it("runs from the start of the game to its end", () => {
    const replay = makeReplay(recording([[1000, FLAG, 1, 2], [3000, FLAG, 1, 2]], { durationMs: 4000 }))
    expect(replay).toMatchObject({ startMs: 0, times: [1000, 3000], lengthMs: 4000 })
  })

  it("starts just before the first move of a game whose clock had long been running", () => {
    const replay = makeReplay(recording([[60_000, FLAG, 1, 2], [61_500, FLAG, 1, 2]], { mode: "daily", durationMs: 70_000 }))
    expect(replay).toMatchObject({ startMs: 59_000, times: [1000, 2500], lengthMs: 11_000 })
  })

  it("runs at least as long as its last move, and never for no time at all", () => {
    expect(makeReplay(recording([[5000, FLAG, 1, 2]], { durationMs: 100 })).lengthMs).toBe(5000)
    expect(makeReplay(recording([], { durationMs: 0 })).lengthMs).toBe(1)
  })
})

describe("movesMadeBy", () => {
  const replay = makeReplay(recording([[1000, FLAG, 1, 2], [2000, FLAG, 1, 2], [2000, FLAG, 2, 3], [3000, FLAG, 2, 3]]))

  it("counts the moves made up to and including a moment", () => {
    expect(movesMadeBy(replay, 0)).toBe(0)
    expect(movesMadeBy(replay, 999)).toBe(0)
    expect(movesMadeBy(replay, 1000)).toBe(1)
    expect(movesMadeBy(replay, 2500)).toBe(3)
    expect(movesMadeBy(replay, 99_999)).toBe(4)
  })

  it("has made none before the replay begins", () => {
    expect(movesMadeBy(replay, -1)).toBe(0)
    expect(movesMadeBy(makeReplay(recording([])), 5000)).toBe(0)
  })
})

describe("the other players of a multiplayer game", () => {
  const game = { ...recording([[4000, UNCOVER, 0, 2]]), kind: "multiplayer" as const, id: 1, userId: "ann", username: "ann", image: null, rated: true, outcome: "gaveUp", mineHits: 0, at: "", others: [] }
  const other = { id: 2, userId: "bob", username: "bob", image: null, outcome: "cleared", durationMs: 6000, moves: [[1000, UNCOVER, 0, 2], [2000, UNCOVER, 0, 3], [3000, UNCOVER, 1, 3], [4000, UNCOVER, 2, 2], [6000, UNCOVER, 2, 3]] as Move[] }
  const record = { rows: 3, cols: 4, outcome: other.outcome, durationMs: other.durationMs }

  it("are played back on the same board, from the same opening, with their own moves", () => {
    const replay = makeOtherReplay(game, other)
    expect(draw(replay.boardAfter(0))).toEqual(OPENED)
    expect(replay.boardAfter(5).status).toBe("won")
    expect(replay.lengthMs).toBe(6000)
  })

  it("are as far along at a moment as their own moves up to it had got them", () => {
    const replay = makeOtherReplay(game, other)
    expect(progressAt(replay, record, 0)).toMatchObject({ percent: 54, outcome: "playing", finishedMs: null, mineHits: 0 })
    expect(progressAt(replay, record, 2500)).toMatchObject({ percent: 72, outcome: "playing" })
    expect(progressAt(replay, record, 2500).sections).toHaveLength(4)
  })

  it("are still playing until the moment their game was recorded as ending", () => {
    const replay = makeOtherReplay(game, other)
    expect(progressAt(replay, record, 5999)).toMatchObject({ percent: 90, outcome: "playing", finishedMs: null })
    expect(progressAt(replay, record, 6000)).toMatchObject({ percent: 100, outcome: "cleared", finishedMs: 6000 })
  })

  it("end as their record says, whatever that was", () => {
    const quitter = { ...other, outcome: "gaveUp", durationMs: 2500, moves: other.moves.slice(0, 2) }
    const replay = makeOtherReplay(game, quitter)
    expect(progressAt(replay, { ...record, outcome: "gaveUp", durationMs: 2500 }, 9000)).toMatchObject({ percent: 72, outcome: "gaveUp", finishedMs: null })
  })

  it("count the mines a player had hit by then", () => {
    const replay = makeOtherReplay(game, { ...other, moves: [[1000, UNCOVER, 1, 2]] })
    expect(progressAfter(replay, record, 0, false).mineHits).toBe(0)
    expect(progressAfter(replay, record, 1, false)).toMatchObject({ mineHits: 1, percent: 0 })
  })
})

describe("a game the runner played", () => {
  it("plays back exactly as it went, move for move, mines going off and all", () => {
    const START = 10_000
    for (const mode of ["race", "classic"] as const) {
      const game = startGame(mode, BEGINNER_BOARD, ["ann"], 0, { seed: seedFrom(3), startedAt: START, opening: { row: 4, col: 4 } })
      const layout = layoutOf(game)
      const cellsNow = () => ownGame(game, "ann", START)!.cells
      // what the player saw after each move that did something
      const seen: string[] = [cellsNow()]
      let now = START
      const each = (mines: boolean) => [...layout].flatMap((cell, at) => ((cell === "1") === mines ? [[Math.floor(at / 9), at % 9] as const] : []))
      const [flagged, hit] = each(true)

      // a flag, some safe cells, a mine, then the rest of the board
      const moves: (() => unknown)[] = [
        () => flag(game, "ann", flagged[0], flagged[1], now),
        ...each(false).slice(0, 12).map(([row, col]) => () => reveal(game, "ann", row, col, now)),
        () => reveal(game, "ann", hit[0], hit[1], now),
        ...each(false).map(([row, col]) => () => reveal(game, "ann", row, col, now)),
      ]
      for (const move of moves) {
        now += 1000
        const before = recordOf(game, "ann", now)!.moves.length
        move()
        if (recordOf(game, "ann", now)!.moves.length > before) seen.push(cellsNow())
      }

      const record = recordOf(game, "ann", now)!
      const replay = makeReplay({
        mode, ...BEGINNER_BOARD, layout, openRow: Math.floor(game.opening / 9), openCol: game.opening % 9, durationMs: record.durationMs, moves: record.moves,
      })
      expect(record.moves.length).toBeGreaterThan(5)
      seen.forEach((cells, moveCount) => expect(viewOf(replay.boardAfter(moveCount))).toBe(cells))
      expect(replay.mineHitsAfter(record.moves.length)).toBe(record.mineHits)
    }
  })
})
