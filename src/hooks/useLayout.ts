import { useSyncExternalStore } from "react"
import { layoutFor, sameLayout, type Layout } from "../lib/layout"

export type { Layout, LayoutMode } from "../lib/layout"

const coarsePointer = window.matchMedia("(pointer: coarse)")

const read = (): Layout => layoutFor({ width: window.innerWidth, height: window.innerHeight, touch: coarsePointer.matches })

// One reading shared by everything that asks, replaced only when something about it changes:
// most resizing changes nothing here, and then nothing is redrawn
let current = read()
const listeners = new Set<() => void>()

function check() {
  const next = read()
  if (sameLayout(next, current)) return
  current = next
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    window.addEventListener("resize", check)
    coarsePointer.addEventListener("change", check)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.removeEventListener("resize", check)
      coarsePointer.removeEventListener("change", check)
    }
  }
}

// How the app is laid out right now (see lib/layout.ts)
export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, () => current)
}
