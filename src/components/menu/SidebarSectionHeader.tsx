import { useTheme } from "../../context/ThemeContext"

type SidebarSectionHeaderProps = {
  text: string
}

export default function SidebarSectionHeader({ text }: SidebarSectionHeaderProps) {
  const { theme } = useTheme()
  return (
    <h2
      className={`
        text-sm font-semibold uppercase tracking-wide border-b pb-1 mb-2 cursor-default
        ${theme.textHead}
        ${theme.menuBorder}
      `}
    >
      {text}
    </h2>
  )
}
