import { useLayoutEffect, useRef, useState, type RefObject } from "react"

// The width of an element, kept up to date as it changes: put the ref on the element. 0 until it has been measured,
// which happens before anything is drawn
export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    setWidth(element.clientWidth)
    const observer = new ResizeObserver(() => setWidth(element.clientWidth))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}
