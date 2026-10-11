import { useRef, type ReactNode } from "react"

type ScreenDimProps = {
  visible: boolean
  children: ReactNode
  // a click on the dimmed area itself calls this
  onDismiss?: () => void
  // dim only a little, keep what's behind sharp, and come up quickly
  soft?: boolean
}

// Dims the whole screen behind `children`
export default function ScreenDim({ visible, children, onDismiss, soft }: ScreenDimProps) {
  // A click only dismisses if the press started on the dimmed area too,
  // so dragging out of a text box (selecting what's in it) doesn't close anything
  const pressedOnDim = useRef(false)

  return (
        <div
            onPointerDown={(e) => { pressedOnDim.current = e.target === e.currentTarget }}
            onClick={(e) => {
                if (pressedOnDim.current && e.target === e.currentTarget) onDismiss?.()
            }}
            // as tall as what can be seen of the screen, which on a phone is less than the screen while its keyboard is up
            className={`
            fixed inset-x-0 top-0 app-height z-60 grid place-items-center safe-top safe-bottom safe-left safe-right transition-opacity ease-out 
            ${soft ? "bg-black/40 duration-200" : "bg-black/60 backdrop-blur-sm duration-500"}
            ${visible ? "opacity-100" : "opacity-0"}
        `}>
            {children}
        </div>
  )
}
