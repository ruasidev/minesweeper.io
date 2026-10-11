import { describe, expect, it } from "vitest"
import {
  CHANCE_SOLO_MODE, DEFAULT_ROOM_MODE, DEFAULT_SOLO_MODE, GAME_MODES, ROOM_MODES, SINGLEPLAYER_MODES, SOLO_MODES, finishTimeMs, gameName, isGameMode,
  isRoomMode, isSingleplayerMode, isSoloMode, mineBlastRadius, mineRuleFor, rulesOf,
} from "./modes.js"

describe("the games there are", () => {
  it("are each known by the name they are listed under", () => {
    for (const [id, mode] of Object.entries(GAME_MODES)) expect(mode.id).toBe(id)
  })

  it("are either played alone or in a room, never both", () => {
    expect([...SOLO_MODES, ...ROOM_MODES].sort()).toEqual(Object.keys(GAME_MODES).sort())
    expect(SOLO_MODES).toEqual(["noGuess", "classic", "daily"])
    expect(ROOM_MODES).toEqual(["race"])
    expect(SOLO_MODES).toContain(DEFAULT_SOLO_MODE)
    expect(ROOM_MODES).toContain(DEFAULT_ROOM_MODE)
  })

  it("include two played alone on a board of the player's choosing, alike but for how the board is made", () => {
    expect(SINGLEPLAYER_MODES).toEqual(["noGuess", "classic"])
    expect(isSingleplayerMode("classic")).toBe(true)
    expect(isSingleplayerMode("daily")).toBe(false)
    expect(isSingleplayerMode("bogus")).toBe(false)
    const { guessFree: _, ...checked } = rulesOf("noGuess")
    const { guessFree: __, ...byChance } = rulesOf("classic")
    expect(checked).toEqual(byChance)
  })

  it("are played on a board that needs no guess, all but the classic one, which a player has to ask for", () => {
    for (const mode of Object.values(GAME_MODES)) expect(mode.rules.guessFree).toBe(mode.id !== "classic")
    expect(rulesOf(DEFAULT_SOLO_MODE).guessFree).toBe(true)
    expect(rulesOf(CHANCE_SOLO_MODE).guessFree).toBe(false)
  })

  it("are named by where they are played, and by which game it was where there is more than one", () => {
    expect(gameName("noGuess")).toBe("Singleplayer · No guessing")
    expect(gameName("classic")).toBe("Singleplayer · Classic")
    expect(gameName("daily")).toBe("Daily challenge")
    expect(gameName("race")).toBe("Multiplayer")
  })

  it("can be told from anything else that might arrive in their place", () => {
    expect(isGameMode("classic")).toBe(true)
    expect(isSoloMode("daily")).toBe(true)
    expect(isSoloMode("race")).toBe(false)
    expect(isRoomMode("race")).toBe(true)
    expect(isRoomMode("classic")).toBe(false)
    for (const id of ["", "toString", "constructor", "Classic", 3, null, undefined, {}]) {
      expect(isGameMode(id)).toBe(false)
      expect(isSoloMode(id)).toBe(false)
      expect(isRoomMode(id)).toBe(false)
    }
  })

  it("never show the mines of a board that others are playing too", () => {
    for (const mode of Object.values(GAME_MODES)) {
      if (mode.family !== "singleplayer") expect(mode.rules.showsMines).toBe(false)
    }
  })
})

describe("mineRuleFor", () => {
  it("ends the game where the rules say a mine does", () => {
    expect(mineRuleFor(rulesOf("classic"), { rows: 9, cols: 9, mines: 10 })).toEqual({ kind: "ends" })
  })

  it("is a blast as big as the board allows where it doesn't", () => {
    expect(mineRuleFor(rulesOf("race"), { rows: 16, cols: 30, mines: 99 })).toEqual({ kind: "blast", radius: 3.5 })
  })
})

describe("mineBlastRadius", () => {
  it("is smaller on a small board", () => {
    expect(mineBlastRadius({ rows: 4, cols: 4 })).toBe(2.5)
    expect(mineBlastRadius({ rows: 9, cols: 9 })).toBe(2.5)
    expect(mineBlastRadius({ rows: 16, cols: 16 })).toBe(3.5)
    expect(mineBlastRadius({ rows: 99, cols: 99 })).toBe(3.5)
  })

  it("goes by the shorter side", () => {
    expect(mineBlastRadius({ rows: 5, cols: 99 })).toBe(2.5)
  })
})

describe("finishTimeMs", () => {
  it("gives a bigger board longer", () => {
    expect(finishTimeMs({ rows: 9, cols: 9 })).toBe(54_300)
    expect(finishTimeMs({ rows: 16, cols: 16 })).toBe(106_800)
    expect(finishTimeMs({ rows: 16, cols: 30 })).toBe(174_000)
  })

  it("never gives more than ten minutes", () => {
    expect(finishTimeMs({ rows: 99, cols: 99 })).toBe(600_000)
  })
})
