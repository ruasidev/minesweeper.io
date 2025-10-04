import { useTheme } from "../../../context/ThemeContext";

export default function GameResultItem({ value }: { value: string }) {
    const { theme } = useTheme()

    return (
        <div className={`p-3 ${theme.itemBg} rounded ${theme.itemBorder} border font-semibold cursor-default scale-hover-105`}>
            {value}
        </div>
    )
}