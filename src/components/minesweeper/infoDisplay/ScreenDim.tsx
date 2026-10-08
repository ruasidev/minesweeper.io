import { useRef, type ReactNode } from "react";

type ScreenDimProps = {
    visible: boolean
    children: ReactNode
    // a click on the dimmed area itself calls this
    onDismiss?: () => void
    // dim only a little and keep what's behind sharp
    soft?: boolean
}

// Dims the whole screen behind `children`
export default function ScreenDim({ visible, children, onDismiss, soft }: ScreenDimProps) {
    // A click only dismisses if the press started on the dimmed area too,
    // so dragging out of a text box (selecting what's in it) doesn't close anything
    const pressedOnDim = useRef(false)

    return (
        <div
            onMouseDown={(e) => { pressedOnDim.current = e.target === e.currentTarget }}
            onClick={(e) => {
                if (pressedOnDim.current && e.target === e.currentTarget) onDismiss?.()
            }}
            className={`
            fixed inset-0 z-60 grid place-items-center transition-opacity duration-500 ease-out 
            ${soft ? "bg-black/40" : "bg-black/60 backdrop-blur-sm"}
            ${visible ? "opacity-100" : "opacity-0"}
        `}>
            {children}
        </div>
    )
}
