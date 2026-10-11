// The games there are to play, and the rules each is played by.
//
// Adding a game starts here: an entry in GAME_MODES is all the engine, the server's running of games and the site's
// drawing of them need to play it. What the server does with its results (experience, leaderboards, ratings) is the
// other half, in server/src/modes. See "Adding a game mode" in the README.

import type { MineRule } from "../engine/board.js"
import type { BoardSettings } from "../engine/field.js"

// How a game is played
export type Rules = {
  // What uncovering a mine does. "ends": that is the player's game over. "blast": it goes off, covering back up
  // what they had uncovered around it, and they sit out for a moment before playing on
  mine: "ends" | "blast"
  // How the board is opened. "click": by the player's own first click, with the mines laid around it and the clock
  // starting there and then. "dealt": on a cell picked for them, the same for everyone in the game, with a
  // countdown before anyone may play
  opening: "click" | "dealt"
  // Whether a player is shown where the mines were once their own game is over. Not where the same board is
  // still being played by somebody else, or will be
  showsMines: boolean
  // whether the players still going are put on the clock once half of them have cleared the board (see finishTimeMs)
  finishLimit: boolean
  // Whether the board is one that can be cleared from its opening by reasoning alone, never needing a guess (see
  // engine/generate.ts). Without it the mines fall wherever chance puts them, as in the minesweeper of old
  guessFree: boolean
}

// Where a game is played: alone on a board of the player's choosing, alone on the day's board, or in a room with
// others. The site has a page for each, and it is what a record of a game is filed under
export type GameFamily = "singleplayer" | "daily" | "multiplayer"

// what each is called, wherever games are listed by where they were played
export const GAME_FAMILIES: Record<GameFamily, { label: string }> = {
  singleplayer: { label: "Singleplayer" },
  daily: { label: "Daily challenge" },
  multiplayer: { label: "Multiplayer" },
}

export type GameMode = {
  id: string
  family: GameFamily
  // what players see it called
  label: string
  rules: Rules
}

export const GAME_MODES = {
  // Singleplayer as it is unless the player says otherwise: any board they like, over at the first mine, and never
  // a guess needed to clear it
  noGuess: {
    id: "noGuess",
    family: "singleplayer",
    label: "No guessing",
    rules: { mine: "ends", opening: "click", showsMines: true, finishLimit: false, guessFree: true },
  },
  // Minesweeper as it has always been: the same game with the mines wherever chance puts them, so that now and
  // then nothing but a guess will do. It is what every singleplayer game was before boards were checked
  classic: {
    id: "classic",
    family: "singleplayer",
    label: "Classic",
    rules: { mine: "ends", opening: "click", showsMines: true, finishLimit: false, guessFree: false },
  },
  // one board a day, the same for everybody, against the clock
  daily: {
    id: "daily",
    family: "daily",
    label: "Daily challenge",
    rules: { mine: "blast", opening: "dealt", showsMines: false, finishLimit: false, guessFree: true },
  },
  // everyone in the room on the same board at once: first to clear it wins
  race: {
    id: "race",
    family: "multiplayer",
    label: "Race",
    rules: { mine: "blast", opening: "dealt", showsMines: false, finishLimit: true, guessFree: true },
  },
} as const satisfies Record<string, GameMode>

export type GameModeId = keyof typeof GAME_MODES

type ModeIn<Family extends GameFamily> = {
  [Id in GameModeId]: (typeof GAME_MODES)[Id]["family"] extends Family ? Id : never
}[GameModeId]

// the games one player plays alone, and the ones a room plays together
export type SoloModeId = ModeIn<"singleplayer" | "daily">
export type RoomModeId = ModeIn<"multiplayer">
// ...and of those played alone, the ones played on a board of the player's own choosing
export type SingleplayerModeId = ModeIn<"singleplayer">

const modesWhere = <Id extends GameModeId>(belongs: (mode: GameMode) => boolean): Id[] =>
  Object.values(GAME_MODES).filter(belongs).map(mode => mode.id as Id)

export const SOLO_MODES = modesWhere<SoloModeId>(mode => mode.family !== "multiplayer")
export const ROOM_MODES = modesWhere<RoomModeId>(mode => mode.family === "multiplayer")
export const SINGLEPLAYER_MODES = modesWhere<SingleplayerModeId>(mode => mode.family === "singleplayer")

export const isGameMode = (id: unknown): id is GameModeId => typeof id === "string" && Object.hasOwn(GAME_MODES, id)
export const isSoloMode = (id: unknown): id is SoloModeId => isGameMode(id) && (SOLO_MODES as string[]).includes(id)
export const isRoomMode = (id: unknown): id is RoomModeId => isGameMode(id) && (ROOM_MODES as string[]).includes(id)
export const isSingleplayerMode = (id: unknown): id is SingleplayerModeId => isGameMode(id) && (SINGLEPLAYER_MODES as string[]).includes(id)

// what a new room plays, and what the singleplayer page plays until the player chooses otherwise
export const DEFAULT_ROOM_MODE: RoomModeId = "race"
export const DEFAULT_SOLO_MODE: SingleplayerModeId = "noGuess"
// ...and what it plays for a player who would rather have their boards as chance lays them
export const CHANCE_SOLO_MODE: SingleplayerModeId = "classic"

export const rulesOf = (mode: GameModeId): Rules => GAME_MODES[mode].rules

// What a game is called in a list of games: where it was played, and which game it was wherever there is more than
// one to be played there
export function gameName(mode: GameModeId): string {
  const { family, label } = GAME_MODES[mode]
  const alone = Object.values(GAME_MODES).filter(other => other.family === family).length === 1
  return alone ? GAME_FAMILIES[family].label : `${GAME_FAMILIES[family].label} · ${label}`
}

// --- What the rules are measured in --------------------------------------------------------------------------

// How long players get to look at a dealt board, and where it opens, before they may play
export const START_COUNTDOWN_MS = 3000

// How far the blast of a mine reaches, in cells: everything the player had uncovered within it is covered back up.
// A smaller blast on a small board
export const mineBlastRadius = ({ rows, cols }: { rows: number, cols: number }): number =>
  Math.max(2, Math.min(3, Math.round(Math.min(rows, cols) / 5))) + 0.5

// ...and how long they sit out while it plays out
export const MINE_COOLDOWN_MS = 800

// what the engine is told a mine does, for a game played by these rules on this board
export const mineRuleFor = (rules: Rules, settings: BoardSettings): MineRule =>
  rules.mine === "ends" ? { kind: "ends" } : { kind: "blast", radius: mineBlastRadius(settings) }

// Once at least half of the players have cleared the board, the rest get this long to finish before they are
// stopped: a bigger board gives more time. (About 55 seconds for Beginner, 1:45 for Intermediate, 2:55 for Expert.)
const FINISH_TIME_BASE_MS = 30_000
const FINISH_TIME_PER_CELL_MS = 300
const FINISH_TIME_MAX_MS = 10 * 60_000
export const finishTimeMs = ({ rows, cols }: { rows: number, cols: number }): number =>
  Math.min(FINISH_TIME_MAX_MS, FINISH_TIME_BASE_MS + rows * cols * FINISH_TIME_PER_CELL_MS)
