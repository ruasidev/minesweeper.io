import { coveredBoard, uncover } from "../../../shared/engine/board.js"
import { cellAt, colOf, rowOf, type BoardSettings, type Field } from "../../../shared/engine/field.js"
import { generateField } from "../../../shared/engine/generate.js"
import { CELL_HIDDEN } from "../../../shared/engine/view.js"
import { rulesOf, type GameModeId } from "../../../shared/game/modes.js"
import type { ClientMessage, CellPosition, OwnGame, RoomDetail, ServerMessage } from "../../../shared/protocol.js"
import { createLobby } from "../lobby/lobby.js"
import type { Connection } from "../lobby/types.js"
import { memoryLedger } from "./memoryLedger.js"

// For tests: a lobby with nothing behind it but memory, and players to put in it.
// Every board in it is made from a seed the test knows, so the test (and nobody inside the lobby) can work out
// where the mines are

// sixteen bytes counting up from `first`
export const seedFrom = (first: number): Uint8Array => Uint8Array.from({ length: 16 }, (_, at) => (first + at) & 0xff)

export const FRESH_SEED = seedFrom(1)
export const DAILY_SEED = seedFrom(100)

export function testLobby() {
  const kept = memoryLedger()
  const lobby = createLobby({ ledger: kept.ledger, freshSeed: () => FRESH_SEED, dailySeed: () => DAILY_SEED })
  return { lobby, kept, join: (id: string) => joinAs(lobby, id) }
}

// A player in a lobby, with everything they have been sent
export function joinAs(lobby: ReturnType<typeof createLobby>, id: string) {
  const sent: ServerMessage[] = []
  const closed: { code: number, reason: string }[] = []
  const connection: Connection = lobby.connect(
    { id, username: id[0].toUpperCase() + id.slice(1), image: null },
    { send: message => sent.push(message), close: (code, reason) => closed.push({ code, reason }) },
  )

  // the latest message of a kind they were sent
  function last<Type extends ServerMessage["type"]>(type: Type): Extract<ServerMessage, { type: Type }> | undefined {
    return sent.findLast((message): message is Extract<ServerMessage, { type: Type }> => message.type === type)
  }

  return {
    id,
    connection,
    sent,
    closed,
    last,
    say: (message: ClientMessage) => lobby.handleMessage(connection, JSON.stringify(message)),
    sayRaw: (raw: string) => lobby.handleMessage(connection, raw),
    leave: () => lobby.disconnect(connection),
    // where they stand, by what they were last told
    get room(): RoomDetail | null {
      return last("room")?.room ?? null
    },
    get game(): OwnGame | null {
      return last("game")?.game ?? null
    },
    get error(): string | undefined {
      return last("error")?.message
    },
    forget: () => { sent.length = 0 },
  }
}

export type TestPlayer = ReturnType<typeof joinAs>

// The field a game was played on, for a test that knows its seed and which game it was. A dealt board is opened
// where the seed says; one opened by a click, where the click was
export function fieldFor(mode: GameModeId, settings: BoardSettings, seed: Uint8Array, opening?: CellPosition): { field: Field, opening: number } {
  return generateField(settings, seed, { opening: opening && cellAt(settings.cols, opening.row, opening.col), guessFree: rulesOf(mode).guessFree })
}

// The cells of a field that are mines, or aren't
export function cellsWhere(field: Field, mine: boolean): CellPosition[] {
  const cells: CellPosition[] = []
  for (let at = 0; at < field.mines.length; at++) {
    if (Boolean(field.mines[at]) === mine) cells.push({ row: rowOf(field.cols, at), col: colOf(field.cols, at) })
  }
  return cells
}

// How many cells the opening of a field uncovers
export const openedBy = (field: Field, opening: number): number => uncover(coveredBoard(field), opening).board.uncovered

// Has a player click every cell of their game that isn't a mine and is still covered, which clears the board
export function clearBoard(player: TestPlayer, field: Field): void {
  for (const { row, col } of cellsWhere(field, false)) {
    // one that an earlier click has already opened up is left alone: clicking it again would chord it
    if (player.game?.cells[cellAt(field.cols, row, col)] === CELL_HIDDEN) player.say({ type: "reveal", row, col })
  }
}
