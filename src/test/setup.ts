import { afterEach, vi } from "vitest"

// Nothing makes a sound in a test, or goes looking for the sound files: what is played can be asked of this instead
vi.mock("../lib/sounds", () => ({
  playSound: vi.fn(() => () => {}),
  configureSounds: vi.fn(),
}))

// What every test starts with. Most of them run without a page and need none of it; the ones that ask for one
// (// @vitest-environment jsdom) get the few things a real browser has that the stand-in doesn't
// What a browser keeps under localStorage, kept in memory for the length of one test
class MemoryStorage implements Storage {
  private items = new Map<string, string>()
  get length() { return this.items.size }
  clear() { this.items.clear() }
  getItem(key: string) { return this.items.get(key) ?? null }
  key(index: number) { return [...this.items.keys()][index] ?? null }
  removeItem(key: string) { this.items.delete(key) }
  setItem(key: string, value: string) { this.items.set(key, String(value)) }
}

if (typeof window !== "undefined") {
  // Newer versions of Node have a localStorage of their own, which does nothing until it is given a file to keep
  // things in, and which gets in ahead of the stand-in page's. This one is the page's for every test
  Object.defineProperty(globalThis, "localStorage", { value: new MemoryStorage(), configurable: true })

  // nothing here is a touch screen or prefers less motion, unless a test says so
  window.matchMedia ??= (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })

  // each test gets an empty page, and nothing saved from the one before
  const { cleanup } = await import("@testing-library/react")
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })
}
