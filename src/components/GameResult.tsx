import { useEffect, useState } from "react"
import type { GameResultProps } from "../game/types"

export default function GameResult({ status, onReset }: GameResultProps) {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if(status === 'won' || status === 'lost') setVisible(true)
        else setTimeout(() => setVisible(false), 500)
    }, [status])
    return (
        <div className={
            `fixed grid h-screen place-items-center inset-0 flex z-50 
            bg-black/60 backdrop-blur-xs transition-opacity duration-500 
            ease-in-out ${status === "won" || status === "lost" ? "opacity-100" : "opacity-0"}`}
        >
            {visible && (
                <div className="bg-gray-800 p-7 border rounded-lg text-center space-y-5 shadow-xl">
                    <h2 className="text-3xl font-bold text-white">
                        {status === "won" ? "Board Cleared!" : "Game over."}
                    </h2>
                    <p className="text-gray-300">
                        {status === "won" ? "Some stats for win" : "Some stats for loss"}
                    </p>
                    <button 
                        className="mt-2 px-4 py-2 rounded-md border border-red-400 bg-gray-700 text-white hover:bg-gray-600 hover:scale-105 transition-all"
                        onClick={onReset}
                    >
                        Reset
                    </button>
                </div>
            )}
        </div>
    )
}
