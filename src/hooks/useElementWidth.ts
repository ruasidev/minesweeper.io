import { useElementSize } from "./useElementSize"

// The width of an element, kept up to date as it changes: put the ref on the element. 0 until it has been measured,
// which happens before anything is drawn
export function useElementWidth<T extends HTMLElement>(): [(element: T | null) => void, number] {
  const [ref, size] = useElementSize<T>()
  return [ref, size.width]
}
