import { AnimationPreview } from "./AnimationPreview";
import type { WinAnimationSelectProps } from "../game/animations";
import { winAnimations } from "../game/animations";

export function WinAnimationSelect({ animation, onChange }: WinAnimationSelectProps) {
    return (
        <div className="grid grid-cols-2 gap-4">
            {winAnimations.map(anim => (
                <button
                    key={anim.id}
                    className={`group border rounded p-2 flex flex-col items-center gap-2
                        ${ animation === anim.id ? "ring-2 ring-red-400" : "" }
                    `}
                    onClick={() => onChange(anim.id)}
                >
                    <AnimationPreview animation={anim.id} />
                    <span className="text-sm">{anim.label}</span>
                </button>
            ))}
        </div>
    )
}