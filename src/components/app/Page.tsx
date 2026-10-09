import type { ReactNode } from "react"
import { useTheme } from "../../context/ThemeContext"
import { useLayout } from "../../hooks/useLayout"
import { NAV_SPACE } from "./MainNavigation"

type PageProps = {
  title?: string
  // beside the title: the day a daily challenge belongs to, a badge
  aside?: ReactNode
  // a limit on how wide the page's contents get, as a Tailwind max-w-* class
  maxWidth?: string
  // pinned under everything else, outside what scrolls: the room's chat
  footer?: ReactNode
  // On a small screen: the contents lay themselves out in the height there is instead of scrolling as a column,
  // and the title is left off to make room. For a board being played, which pans about inside its own space
  fill?: boolean
  children: ReactNode
}

// The room the app's panes take up at the top and the bottom of the screen (see App.tsx)
const TOP_SPACE = "var(--top-space, 0px)"
const BOTTOM_SPACE = "var(--bottom-space, 0px)"

// A page of the site: its title and, under it, a column of whatever it shows, which scrolls. Every page but the
// singleplayer game is one of these. The page itself is the whole screen: its contents start clear of the panes
// floating over it (the header, the navigation), and scroll away underneath them. The column is in the middle of
// the room the panes leave, no wider than `maxWidth`
export default function Page({ title, aside, maxWidth = "max-w-6xl", footer, fill, children }: PageProps) {
  const { theme } = useTheme()
  const { mode, compact } = useLayout()
  const filling = fill && compact
  const gutter = mode === "phone" ? "0.75rem" : "1rem"

  return (
    <div className="h-full flex flex-col" style={{ paddingLeft: NAV_SPACE, paddingRight: "env(safe-area-inset-right)" }}>
      {filling ? (
        <div className="flex-1 min-h-0 flex flex-col" style={{ paddingTop: TOP_SPACE, paddingBottom: BOTTOM_SPACE }}>{children}</div>
      ) : (
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden hide-scrollbar"
          // padding on what scrolls, not around it: the contents start below the header and pass under it as they go
          style={{ paddingTop: TOP_SPACE, paddingBottom: footer ? undefined : BOTTOM_SPACE }}
        >
          <div className={`flex flex-col min-h-full mx-auto ${mode === "phone" ? "gap-3" : "gap-4"} ${maxWidth}`} style={{ padding: gutter }}>
            {title && (
              <div className="flex items-center gap-3 cursor-default">
                <h1 className={`font-semibold ${mode === "phone" ? "text-xl" : "text-2xl"} ${theme.textHead}`}>{title}</h1>
                {aside}
              </div>
            )}
            {children}
          </div>
        </div>
      )}
      {/* in the same column as the page above it, so their edges line up */}
      {footer && (
        <div className="shrink-0" style={{ paddingBottom: BOTTOM_SPACE }}>
          <div className={`mx-auto ${maxWidth}`} style={{ padding: `0 ${gutter} ${gutter}` }}>{footer}</div>
        </div>
      )}
    </div>
  )
}
