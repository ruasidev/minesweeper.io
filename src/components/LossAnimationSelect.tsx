import { AnimationPreview } from "./AnimationPreview";
import type { LossAnimationSelectProps } from "../game/animations";
import { lossAnimations } from "../game/animations";
import SidebarSectionHeader from "./SidebarSectionHeader";

export function LossAnimationSelect({ animation, theme, onChange }: LossAnimationSelectProps) {
    return (
        <div>
            <SidebarSectionHeader text="Loss Animations" theme={theme} />
            <div className="grid grid-cols-2 gap-4">
                {lossAnimations.map(anim => (
                    <button
                        key={anim.id}
                        className={`group border rounded p-2 flex flex-col items-center gap-2 pressable
                            ${ animation === anim.id ? `ring-2 ${theme.itemSelectedBorder}` : "" }
                            ${ theme.itemBorder }
                            ${ theme.itemHoverBorder }
                            ${ theme.background }
                        `}
                        onClick={() => onChange(anim.id)}
                    >
                        <AnimationPreview animation={anim.id} theme={theme} />
                        <span className={`text-sm ${theme.textBody}`}>{anim.label}</span>
                    </button>
                ))}
            </div>
        </div>

    )
}