import { useState, type CSSProperties, type ReactNode } from "react"

type ViewTransitionProps<T extends string> = {
  // which view is showing
  view: T
  // every view, in order: a view later in the list eases in from the right, an earlier one from the left
  order: readonly T[]
  className?: string
  children: ReactNode
}

// Eases a view in from the side it lies on whenever the view changes. The old view simply goes.
// Used for the pages of the site and for the stages of multiplayer, so they all move the same way
export default function ViewTransition<T extends string>({ view, order, className = "", children }: ViewTransitionProps<T>) {
  // direction is null until the view has changed once: nothing plays on first showing
  const [shown, setShown] = useState<{ view: T, direction: 1 | -1 | null }>({ view, direction: null })
  if (view !== shown.view) {
    setShown({ view, direction: order.indexOf(view) > order.indexOf(shown.view) ? 1 : -1 })
  }

  return (
    // keyed by view, so each one arrives as a new element and plays the animation
    <div
      key={view}
      className={`${className} ${shown.direction === null ? "" : "animate-viewIn"}`}
      style={{ "--view-direction": shown.direction ?? 1 } as CSSProperties}
    >
      {children}
    </div>
  )
}
