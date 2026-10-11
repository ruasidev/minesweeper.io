import { useEffect, type ReactNode } from "react"
import { useFormStyles } from "../../hooks/useFormStyles"

type MoreSheetProps = {
  open: boolean
  // the navigation is a rail down the left, and this comes out beside it; otherwise it is over the whole page
  beside: boolean
  onClose: () => void
  children: ReactNode
}

// What "More" brings up on a phone or a tablet: everything the left pane holds on a desktop, apart from the pages
// that have tabs. It is that same pane, floating over the page in the room the layout has for it: between the
// header and the tabs on a phone, and beside the rail on a tablet, where the page stays in sight behind it (so a
// theme can be seen on the board while it is being picked). A press on the dimmed page around it puts it away
export default function MoreSheet({ open, beside, onClose, children }: MoreSheetProps) {
  const styles = useFormStyles()
  // Where it starts beside the rail: the gap that is between every two panes on from the rail's own right-hand
  // edge. (Worked out from the rail itself and not from the room pages leave for the navigation, which on a
  // desktop takes in a gap more than the rail does)
  const besideRail = "calc(var(--gap) * 2 + var(--rail-w) + env(safe-area-inset-left))"

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  return (
    <>
      {/* under the navigation, which stays in reach to leave by */}
      <div
        className={`absolute inset-0 z-30 bg-black/40 transition-opacity duration-200 ${open ? "" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div
        // put away it can't be clicked or tabbed into
        inert={!open}
        className={`absolute z-40 overflow-hidden transition-[translate,opacity] duration-200 ease-out ${styles.pane}
          ${beside ? "w-88" : ""}
          ${open ? "" : `opacity-0 pointer-events-none ${beside ? "-translate-x-4" : "translate-y-4"}`}
        `}
        style={{
          top: "calc(var(--top-space) + var(--gap))",
          bottom: "calc(var(--bottom-space) + var(--gap))",
          left: beside ? besideRail : "calc(var(--gap) + env(safe-area-inset-left))",
          ...(beside ? { maxWidth: `calc(100% - ${besideRail} - var(--gap))` } : { right: "calc(var(--gap) + env(safe-area-inset-right))" }),
        }}
      >
        {children}
      </div>
    </>
  )
}
