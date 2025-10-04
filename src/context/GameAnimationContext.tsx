import { createContext, useContext, type ReactNode } from "react";
import { lossAnimations, winAnimations, type AnimationProps, type LossAnimationChoices, type WinAnimationChoices } from "../game/animations";
import { useLocalStorage } from "../hooks/useLocalStorage";

interface GameAnimationContextType {
    lossAnimationId: LossAnimationChoices
    winAnimationId: WinAnimationChoices
    lossAnimation: AnimationProps<LossAnimationChoices>
    winAnimation: AnimationProps<WinAnimationChoices>
    setLossAnimationId: (id: LossAnimationChoices) => void
    setWinAnimationId: (id: WinAnimationChoices) => void
}

const GameAnimationContext = createContext<GameAnimationContextType | undefined>(undefined)

export function GameAnimationProvider({ children }: { children: ReactNode }) {
    const [lossAnimationId, setLossAnimationId] = useLocalStorage<LossAnimationChoices>("lossAnimationId", "explode")
    const [winAnimationId, setWinAnimationId] = useLocalStorage<WinAnimationChoices>("winAnimationId", "celebrate")
    const lossAnimation = lossAnimations.find((anim) => anim.id === lossAnimationId) ?? lossAnimations[0]
    const winAnimation = winAnimations.find((anim) => anim.id === winAnimationId) ?? winAnimations[0]

    return (
        <GameAnimationContext.Provider value={{ lossAnimationId, winAnimationId, lossAnimation, winAnimation, setLossAnimationId, setWinAnimationId }}>
            {children}
        </GameAnimationContext.Provider>
    )
}

export function useGameAnimations() {
    const ctx = useContext(GameAnimationContext)
    if(!ctx) throw new Error("useGameAnimations must be used within GameAnimationProvider")
    return ctx;
}