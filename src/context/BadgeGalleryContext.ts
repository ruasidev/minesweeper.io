import { createContext, useContext } from "react"
import type { BadgeId } from "../../shared/badges"

// Opens the window that shows every badge there is, with the given ones marked as earned
export const BadgeGalleryContext = createContext<(earned: BadgeId[]) => void>(() => {})

export const useBadgeGallery = () => useContext(BadgeGalleryContext)
