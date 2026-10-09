import { useEffect, useState } from "react"

const coarsePointer = window.matchMedia("(pointer: coarse)")

// Keeps the app exactly as tall as the part of the screen that can be seen, on a phone or a tablet. That is not
// always the window: an iPhone's keyboard comes up over the page without resizing it, which would leave the
// bottom of the app (and the box being typed in) underneath it. The height goes in --app-height (see App.css)
export function useVisibleHeight() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport || !coarsePointer.matches) return
    const root = document.documentElement

    const update = () => {
      // pinched in to read something: the page is being looked at more closely, not given less room
      if (viewport.scale > 1.01) return
      root.style.setProperty("--app-height", `${Math.round(viewport.height)}px`)
      // the browser may have slid the page up to bring a text box above the keyboard; room has been made for it
      // already, so the page goes back where it was
      if (viewport.offsetTop > 0) window.scrollTo(0, 0)
    }
    update()
    viewport.addEventListener("resize", update)
    viewport.addEventListener("scroll", update)
    return () => {
      viewport.removeEventListener("resize", update)
      viewport.removeEventListener("scroll", update)
      root.style.removeProperty("--app-height")
    }
  }, [])
}

// what a keyboard comes up for
const isTextBox = (target: EventTarget | null) =>
  target instanceof HTMLTextAreaElement
  || (target instanceof HTMLInputElement && !["range", "checkbox", "radio", "file", "button", "submit"].includes(target.type))

// Whether something is being typed on a touch screen, which means its keyboard is up and room is short
export function useTyping(): boolean {
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      if (coarsePointer.matches && isTextBox(e.target)) setTyping(true)
    }
    const handleBlur = (e: FocusEvent) => {
      // going straight from one box to the next: the keyboard stays up
      if (!isTextBox(e.relatedTarget)) setTyping(false)
    }
    document.addEventListener("focusin", handleFocus)
    document.addEventListener("focusout", handleBlur)
    return () => {
      document.removeEventListener("focusin", handleFocus)
      document.removeEventListener("focusout", handleBlur)
    }
  }, [])

  return typing
}
