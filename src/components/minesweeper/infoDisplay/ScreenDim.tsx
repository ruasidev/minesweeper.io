import type { ReactNode } from "react";

export default function ScreenDim({ visible, children }: { visible: boolean, children: ReactNode }) {
    return (
        <div className={`
            fixed inset-0 z-60 grid place-items-center bg-black/60 backdrop-blur-sm transition-opacity duration-500 ease-out 
            ${visible ? "opacity-100" : "opacity-0"}
        `}>
            {children}
        </div>
    )
}