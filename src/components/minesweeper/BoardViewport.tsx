import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { useSettings } from "../../context/SettingsContext"
import { useElementSize } from "../../hooks/useElementSize"
import { useLayout } from "../../hooks/useLayout"

// room kept around a board in the space it is panned about in, px
const EDGE = 8
// A board too big for the screen is shrunk to fit it, but only while its cells stay at least this big (px).
// Any smaller and a finger starts landing on the wrong one, so the board keeps its size and is panned instead
const FIT_MIN = 28
// how small and how big two fingers can make the cells, px
const ZOOM_MIN = 14
const ZOOM_MAX = 72
// let go within this share of the size the board would have had anyway, the cells go back to exactly that
const SNAP = 0.07

// what each size of board has been zoomed to, for as long as the page is open
const zooms = new Map<string, number>()

// How big the cells of a board are drawn when nobody has zoomed it: the size chosen in the settings if the whole
// board fits at that, otherwise the biggest that fits, as long as the cells stay big enough to press
function fittedSize(chosen: number, gap: number, rows: number, cols: number, room: { width: number, height: number }): number {
  // not measured yet
  if (!room.width || !room.height) return chosen
  const fitting = (space: number, count: number) => Math.floor((space - 2 * EDGE - (count - 1) * gap) / count)
  const across = Math.min(chosen, fitting(room.width, cols))
  const down = Math.min(chosen, fitting(room.height, rows))
  // all of it in view
  if (Math.min(across, down) >= FIT_MIN) return Math.min(across, down)
  // or fitting one way, so it only has to be panned the other
  if (Math.max(across, down) >= FIT_MIN) return Math.max(across, down)
  return chosen
}

const middle = (touches: TouchList) => ({ x: (touches[0].clientX + touches[1].clientX) / 2, y: (touches[0].clientY + touches[1].clientY) / 2 })
const spread = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)

type BoardViewportProps = {
  rows: number
  cols: number
  // nothing in it can be pressed: a board that is only being watched
  readOnly?: boolean
  // On a desktop: in the middle of the space it has, rather than against its left-hand edge
  centered?: boolean
  // On a desktop: how the strip the board scrolls sideways in is spaced
  className?: string
  style?: CSSProperties
  // the board, and whatever is laid over it
  children: ReactNode
}

// What every board in the app is drawn in. It decides how big the cells are, and hands that down to the board and
// to whatever is laid over it as CSS variables (see boardMetrics.ts).
//
// On a desktop the cells are the size chosen in the settings, and a board wider than its space scrolls sideways
// while the page scrolls down.
//
// On a phone or a tablet the board has a space of its own that it fills, and it is moved about inside that with a
// finger, like a map: either way at once, with everything else on the screen staying put. It starts out shrunk
// to fit where that leaves the cells big enough to press, and two fingers zoom it
export default function BoardViewport({ rows, cols, readOnly, centered, className = "", style, children }: BoardViewportProps) {
  const { settings } = useSettings()
  const { compact } = useLayout()
  const [viewportRef, room, viewport] = useElementSize<HTMLDivElement>()
  const boardRef = useRef<HTMLDivElement>(null)
  const gap = settings.cellGap

  // a size set by pinching belongs to the board it was set on
  const key = `${rows}x${cols}`
  const [zoom, setZoom] = useState({ key, size: zooms.get(key) ?? null })
  if (zoom.key !== key) setZoom({ key, size: zooms.get(key) ?? null })
  const fitted = compact ? fittedSize(settings.cellSize, gap, rows, cols, room) : settings.cellSize
  const size = compact && zoom.key === key && zoom.size !== null ? zoom.size : fitted

  const now = useRef({ size, fitted, gap, key })
  useEffect(() => {
    now.current = { size, fitted, gap, key }
  })

  // Two fingers on the board zoom it. The cells follow the fingers by way of the CSS variable alone, with nothing
  // redrawn until the fingers lift, and the spot between them stays under them the whole time
  useEffect(() => {
    const board = boardRef.current
    if (!viewport || !board) return
    let pinch: { spread: number, from: number, size: number, col: number, row: number } | null = null

    const start = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      const { size, gap } = now.current
      const at = board.getBoundingClientRect()
      const between = middle(e.touches)
      pinch = { spread: spread(e.touches), from: size, size, col: (between.x - at.left) / (size + gap), row: (between.y - at.top) / (size + gap) }
    }
    const move = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return
      // the fingers are zooming the board, not scrolling it
      if (e.cancelable) e.preventDefault()
      const size = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinch.from * spread(e.touches) / pinch.spread)))
      if (size !== pinch.size) {
        pinch.size = size
        viewport.style.setProperty("--cell-size", `${size}px`)
      }
      const at = board.getBoundingClientRect()
      const between = middle(e.touches)
      const step = size + now.current.gap
      viewport.scrollLeft += at.left + pinch.col * step - between.x
      viewport.scrollTop += at.top + pinch.row * step - between.y
    }
    const end = (e: TouchEvent) => {
      if (!pinch || e.touches.length >= 2) return
      const { fitted, key } = now.current
      const size = Math.abs(pinch.size - fitted) <= fitted * SNAP ? null : pinch.size
      pinch = null
      if (size === null) zooms.delete(key)
      else zooms.set(key, size)
      viewport.style.setProperty("--cell-size", `${size ?? fitted}px`)
      setZoom({ key, size })
    }

    viewport.addEventListener("touchstart", start, { passive: true })
    viewport.addEventListener("touchmove", move, { passive: false })
    viewport.addEventListener("touchend", end)
    viewport.addEventListener("touchcancel", end)
    return () => {
      viewport.removeEventListener("touchstart", start)
      viewport.removeEventListener("touchmove", move)
      viewport.removeEventListener("touchend", end)
      viewport.removeEventListener("touchcancel", end)
    }
  }, [viewport])

  const metrics = {
    "--cell-size": `${size}px`,
    "--cell-gap": `${gap}px`,
    "--cell-step": "calc(var(--cell-size) + var(--cell-gap))",
    "--cell-font": `calc(var(--cell-size) * ${settings.cellFontScale / 100})`,
  } as CSSProperties
  const held = readOnly ? "pointer-events-none" : ""

  if (!compact) {
    return (
      <div className={`overflow-x-auto hide-scrollbar ${className}`} style={{ ...metrics, ...style }}>
        {/* centred while it fits; a board wider than its space starts at the left and scrolls */}
        <div className={`relative w-max ${centered ? "mx-auto" : ""} ${held}`}>{children}</div>
      </div>
    )
  }

  return (
    <div ref={viewportRef} className="board-viewport flex-1 min-w-0 min-h-0 flex overflow-auto hide-scrollbar" style={metrics}>
      {/* margins that take up whatever room is over: a board smaller than its space sits in the middle of it,
          and a bigger one starts at the top left corner, where all of it can be reached by panning */}
      <div className="shrink-0 m-auto" style={{ padding: EDGE }}>
        <div ref={boardRef} className={`relative ${held}`}>{children}</div>
      </div>
    </div>
  )
}
