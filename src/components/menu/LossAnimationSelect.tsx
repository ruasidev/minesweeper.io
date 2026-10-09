import AnimationPreview from "./AnimationPreview";
import { lossAnimations } from "../../game/animations";
import SidebarSectionHeader from "./SidebarSectionHeader";
import { useTheme } from "../../context/ThemeContext";
import { useGameAnimations } from "../../context/GameAnimationContext";

export function LossAnimationSelect() {
    const { theme } = useTheme()
    const { lossAnimationId, setLossAnimationId } = useGameAnimations()
    return (
        <div>
            <SidebarSectionHeader text="Loss Animations" />
            <div className="grid grid-cols-2 gap-4">
                {lossAnimations.map(anim => (
                    <button
                        key={anim.id}
                        className={`group border rounded p-2 flex flex-col items-center gap-2 pressable font-semibold
                            ${ lossAnimationId === anim.id ? theme.itemSelected : `${theme.background} ${theme.textBody}` }
                            ${ theme.itemBorder }
                            ${ theme.itemHoverBorder }
                        `}
                        onClick={() => setLossAnimationId(anim.id)}
                    >
                        <AnimationPreview animation={anim.id} />
                        <span className="text-sm">{anim.label}</span>
                    </button>
                ))}
            </div>
        </div>

    )
}