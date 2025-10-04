import AnimationPreview from "./AnimationPreview";
import { winAnimations } from "../../game/animations";
import SidebarSectionHeader from "./SidebarSectionHeader";
import { useTheme } from "../../context/ThemeContext";
import { useGameAnimations } from "../../context/GameAnimationContext";

export default function WinAnimationSelect() {
    const { theme } = useTheme()
    const { winAnimationId, setWinAnimationId } = useGameAnimations()
    return (
        <div>
            <SidebarSectionHeader text="Win Animations" />
            <div className="grid grid-cols-2 gap-4">
                {winAnimations.map(anim => (
                    <button
                        key={anim.id}
                        className={`group border rounded p-2 flex flex-col items-center gap-2 pressable font-semibold
                            ${ winAnimationId === anim.id ? `ring-2 ${theme.itemSelectedBorder}` : "" }
                            ${ theme.itemBorder }
                            ${ theme.itemHoverBorder }
                            ${ theme.background }
                        `}
                        onClick={() => setWinAnimationId(anim.id)}
                    >
                        <AnimationPreview animation={anim.id} />
                        <span className={`text-sm ${theme.textBody}`}>{anim.label}</span>
                    </button>
                ))}
            </div>
        </div>

    )
}