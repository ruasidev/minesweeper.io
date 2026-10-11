import { describe, expect, it } from "vitest"
import { layoutFor, sameLayout } from "./layout"

const mouse = (width: number, height: number) => layoutFor({ width, height, touch: false })
const finger = (width: number, height: number) => layoutFor({ width, height, touch: true })

describe("layoutFor", () => {
  it("is a phone on a narrow screen, however it is worked", () => {
    expect(finger(390, 844)).toEqual({ mode: "phone", compact: true, touch: true, short: false })
    expect(mouse(500, 900).mode).toBe("phone")
    expect(finger(639, 900).mode).toBe("phone")
  })

  it("is a rail on a tablet, whichever way up", () => {
    expect(finger(820, 1180)).toMatchObject({ mode: "rail", compact: true, short: false })
    expect(finger(1180, 820).mode).toBe("rail")
    // however wide: a finger has no use for a pane made for a mouse
    expect(finger(1920, 1080).mode).toBe("rail")
  })

  it("is a rail in a window too narrow for the pane", () => {
    expect(mouse(640, 900).mode).toBe("rail")
    expect(mouse(1023, 900).mode).toBe("rail")
  })

  it("is a desktop from a wide enough window with a mouse", () => {
    expect(mouse(1024, 768)).toEqual({ mode: "desktop", compact: false, touch: false, short: false })
    expect(mouse(2560, 1440).mode).toBe("desktop")
  })

  it("is short, and a rail, for a phone on its side", () => {
    expect(finger(844, 390)).toEqual({ mode: "rail", compact: true, touch: true, short: true })
    // even one narrow enough to be a phone the right way up
    expect(finger(600, 340)).toMatchObject({ mode: "rail", short: true })
  })

  it("isn't short just for being small: a low window that is taller than wide is a phone", () => {
    expect(finger(360, 500)).toMatchObject({ mode: "phone", short: false })
    expect(mouse(1400, 520).short).toBe(true)
    expect(mouse(1400, 521).short).toBe(false)
  })
})

describe("sameLayout", () => {
  it("is true while nothing a layout is made of has changed", () => {
    expect(sameLayout(mouse(1200, 800), mouse(1900, 1000))).toBe(true)
    expect(sameLayout(mouse(1200, 800), mouse(900, 800))).toBe(false)
    expect(sameLayout(mouse(1200, 800), finger(1200, 800))).toBe(false)
    expect(sameLayout(finger(844, 390), finger(844, 600))).toBe(false)
  })
})
