import { dailyMode } from "./daily.js"
import { raceMode } from "./race.js"
import { singleplayerMode } from "./singleplayer.js"
import type { Modes, ModeServices } from "./types.js"

export type { Modes, ModeServices, RoomMode, SoloMode, SoloRequest } from "./types.js"

// Every game there is, as the server runs it. There has to be one here for each in shared/game/modes.ts:
// leaving one out doesn't compile
export function createModes(services: ModeServices): Modes {
  return {
    solo: { noGuess: singleplayerMode("noGuess", services), classic: singleplayerMode("classic", services), daily: dailyMode(services) },
    room: { race: raceMode(services) },
  }
}
