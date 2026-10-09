import { useLayoutEffect, useState } from "react"

type Size = { width: number, height: number }

// The size of the inside of an element, kept up to date as it changes: put the ref on the element.
// 0 by 0 until it has been measured, which happens before anything is drawn. The element itself is handed back
// too, for whatever else needs to get at it
export function useElementSize<T extends HTMLElement>(): [(element: T | null) => void, Size, T | null] {
  // kept as state rather than in a ref, so the measuring starts again if a different element takes its place
  const [element, setElement] = useState<T | null>(null)
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useLayoutEffect(() => {
    if (!element) return
    const measure = () => setSize(before =>
      before.width === element.clientWidth && before.height === element.clientHeight
        ? before
        : { width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return [setElement, size, element]
}
