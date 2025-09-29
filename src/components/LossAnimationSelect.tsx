import { AnimationPreview } from "./AnimationPreview";
import type { LossAnimationSelectProps } from "../game/animations";
import { lossAnimations } from "../game/animations";

export function LossAnimationSelect({ animation, onChange }: LossAnimationSelectProps) {
    return (
        <div className="grid grid-cols-2 gap-4">
            {lossAnimations.map(anim => (
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