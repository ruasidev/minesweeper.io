import type { SidebarProps } from "../../game/types"
import { statusBarItems, statusBarPositions } from "../../game/settings"
import { useSettings } from "../../context/SettingsContext"
import { useTheme } from "../../context/ThemeContext"
import NumberInput from "../app/NumberInput"
import SidebarPanel from "./SidebarPanel"
import SidebarSectionHeader from "./SidebarSectionHeader"

export default function SettingsMenu({ isOpen, onClose }: SidebarProps) {
  const { theme } = useTheme()
  const { settings, updateSettings } = useSettings()

  // Same look as the items in the themes menu: a ring marks what is selected
  const optionClass = (selected: boolean) => `p-2 rounded-md border pressable font-semibold text-sm
    ${theme.itemBg}
    ${theme.itemHoverBg}
    ${theme.itemHoverBorder}
    ${theme.itemBorder}
    ${theme.textBody}
    ${selected ? `ring-2 ${theme.itemSelectedBorder}` : "opacity-60"}
  `

  return (
    <SidebarPanel title="Settings" isOpen={isOpen} onClose={onClose}>
      <div>
        <SidebarSectionHeader text="Status Bar Items" />
        <div className="grid grid-cols-2 gap-4">
          {statusBarItems.map(item => {
            const shown = settings.statusBarItems[item.id]
            return (
              <button
                key={item.id}
                aria-pressed={shown}
                className={optionClass(shown)}
                onClick={() => updateSettings({ statusBarItems: { ...settings.statusBarItems, [item.id]: !shown } })}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <SidebarSectionHeader text="Status Bar Position" />
        <div className="grid grid-cols-3 gap-4">
          {statusBarPositions.map(position => (
            <button
              key={position.id}
              aria-pressed={settings.statusBarPosition === position.id}
              className={optionClass(settings.statusBarPosition === position.id)}
              onClick={() => updateSettings({ statusBarPosition: position.id })}
            >
              {position.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <SidebarSectionHeader text="Cells" />
        <div className="flex flex-col gap-4">
          <NumberInput label="size" unit="px" value={settings.cellSize} min={20} max={64} onChange={cellSize => updateSettings({ cellSize })} />
          <NumberInput label="spacing" unit="px" value={settings.cellGap} min={0} max={12} onChange={cellGap => updateSettings({ cellGap })} />
          <NumberInput label="font size" unit="%" value={settings.cellFontScale} min={30} max={100} onChange={cellFontScale => updateSettings({ cellFontScale })} />
        </div>
      </div>
    </SidebarPanel>
  )
}
