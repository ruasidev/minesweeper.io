import type { SidebarProps } from "../../game/types"
import { LossAnimationSelect } from "./LossAnimationSelect"
import WinAnimationSelect from "./WinAnimationSelect"
import ThemeSelect from "./ThemeSelect"
import SidebarPanel from "./SidebarPanel"

export default function SidebarMenu({ isOpen, onClose }: SidebarProps) {
  return (
    <SidebarPanel title="Menu" isOpen={isOpen} onClose={onClose}>
      <ThemeSelect />
      <WinAnimationSelect />
      <LossAnimationSelect />
    </SidebarPanel>
  )
}
