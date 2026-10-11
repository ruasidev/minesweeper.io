// How the app is laid out. It follows the size of the screen and what the screen is worked with:
// - "phone": a narrow screen. Tabs along the bottom, everything in one column
// - "rail": a tablet, a phone on its side, or a narrow window. The same tabs in a slim rail down the left
// - "desktop": a wide screen with a mouse. The pane floating on the left
export type LayoutMode = "phone" | "rail" | "desktop"

export type Layout = {
  mode: LayoutMode
  // phone or rail: the layouts made for small screens and for fingers
  compact: boolean
  // the main way of pointing is a finger, so there is no right button and nothing to hover with
  touch: boolean
  // too little height to stack bars above and below a board: a phone on its side
  short: boolean
}

// Below this width (px) the tabs go along the bottom; from the next one up, a mouse gets the full pane
export const PHONE_MAX = 640
const DESKTOP_MIN = 1024
// at most this tall (px), and wider than tall, is a phone on its side
const SHORT_MAX = 520

// The layout for a screen of a size, worked with a finger or not
export function layoutFor({ width, height, touch }: { width: number, height: number, touch: boolean }): Layout {
  const short = height <= SHORT_MAX && width > height
  const mode: LayoutMode = width < PHONE_MAX && !short ? "phone"
    : touch || width < DESKTOP_MIN ? "rail"
    : "desktop"
  return { mode, compact: mode !== "desktop", touch, short }
}

export const sameLayout = (a: Layout, b: Layout): boolean => a.mode === b.mode && a.touch === b.touch && a.short === b.short
