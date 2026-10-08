import { useEffect, useState } from "react"

// The width of the window, kept up to date as it is resized
export function useViewportWidth(): number {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])
  return width
}
