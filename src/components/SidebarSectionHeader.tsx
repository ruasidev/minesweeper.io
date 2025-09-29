import type { SidebarSectionHeaderProps } from "../game/types"

export default function SidebarSectionHeader({ text, theme }: SidebarSectionHeaderProps) {
  return (
    <h2
      className={`
        ${theme.textHead}
        ${theme.menuBorder}
        text-sm font-semibold uppercase tracking-wide
        border-b 
        pb-1 mb-2
      `}
    >
      {text}
    </h2>
  )
}