import { AnimationPreview } from "./AnimationPreview";
import type { WinAnimationSelectProps } from "../game/animations";
import { winAnimations } from "../game/animations";
import SidebarSectionHeader from "./SidebarSectionHeader";

export function WinAnimationSelect({ animation, theme, onChange }: WinAnimationSelectProps) {
    return (
        <div>
            <SidebarSectionHeader text="Win Animations" theme={theme} />
            <div className="grid grid-cols-2 gap-4">
                {winAnimations.map(anim => (
                    <button
                        key={anim.id}
                        className={`group border rounded p-2 flex flex-col items-center gap-2 pressable font-semibold
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