import { LossAnimationSelect } from "./LossAnimationSelect"
import WinAnimationSelect from "./WinAnimationSelect"
import ThemeSelect from "./ThemeSelect"

// What the left pane shows for "Themes"
export default function SidebarMenu() {
  return (
    <>
      <ThemeSelect />
      <WinAnimationSelect />
      <LossAnimationSelect />
    </>
  )
}
