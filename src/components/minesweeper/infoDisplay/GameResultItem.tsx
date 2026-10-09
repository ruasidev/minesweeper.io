import type { ReactNode } from "react";
import { useTheme } from "../../../context/ThemeContext";

// One figure on the result screen, under its small caption: the same pairing as on the status bar
export default function GameResultItem({ label, children }: { label: string, children: ReactNode }) {
    const { theme } = useTheme()

    return (
        <div className={`flex flex-col gap-1 px-3 py-2 rounded-lg border cursor-default scale-hover-105 ${theme.itemBg} ${theme.itemBorder}`}>
            <span className={`text-[10px] font-semibold uppercase tracking-wide leading-none opacity-60 ${theme.textBody}`}>{label}</span>
            <span className={`text-base font-bold tabular-nums leading-tight ${theme.textHead}`}>{children}</span>
        </div>
    )
}
