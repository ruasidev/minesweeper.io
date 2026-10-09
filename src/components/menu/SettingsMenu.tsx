import { statusBarItems, statusBarPositions } from "../../game/settings"
import { useSettings } from "../../context/SettingsContext"
import { useTheme } from "../../context/ThemeContext"
import { ghostColors } from "../../game/themes"
import NumberInput from "../app/NumberInput"
import SidebarSectionHeader from "./SidebarSectionHeader"

// What the left pane shows for "Settings"
export default function SettingsMenu() {
  const { theme } = useTheme()
  const { settings, updateSettings } = useSettings()

  // One of several choices: the chosen one is filled with the theme's highlight, the others are bare
  const optionClass = (selected: boolean) => `p-2 rounded-md pressable font-semibold text-sm
    ${ghostColors(theme, selected)}
    ${selected ? "" : "opacity-70"}
  `
  // Something switched on or off by itself. Switched off it keeps a box: with nothing around it, and nothing
  // beside it that is filled in, it would read as a label rather than something to press
  const switchClass = (on: boolean) => `p-2 rounded-md border pressable font-semibold text-sm
    ${on ? `${theme.itemSelected} border-transparent` : `${theme.itemBg} ${theme.itemHoverBg} ${theme.itemBorder} ${theme.textBody} opacity-70`}
  `

  return (
    <>
      <div>
        <SidebarSectionHeader text="Status Bar Items" />
        <div className="grid grid-cols-2 gap-4">
          {statusBarItems.map(item => {
            const shown = settings.statusBarItems[item.id]
            return (
              <button
                key={item.id}
                aria-pressed={shown}
                className={switchClass(shown)}
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
        <div className="grid grid-cols-2 gap-4">
          {statusBarPositions.map(position => (
            <button
              key={position.id}
              aria-pressed={settings.statusBarPosition === position.id}
              className={`${optionClass(settings.statusBarPosition === position.id)} border border-transparent`}
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

      <div>
        <SidebarSectionHeader text="Sound" />
        <div className="flex flex-col gap-4">
          <button
            aria-pressed={settings.soundEffects}
            className={`${switchClass(settings.soundEffects)} w-full`}
            onClick={() => updateSettings({ soundEffects: !settings.soundEffects })}
          >
            Sound effects
          </button>
          {settings.soundEffects && (
            <NumberInput label="volume" unit="%" value={settings.soundVolume} min={0} max={100} onChange={soundVolume => updateSettings({ soundVolume })} />
          )}
        </div>
      </div>

      <div>
        <SidebarSectionHeader text="Motion" />
        <button
          aria-pressed={settings.reduceMotion}
          className={`${switchClass(settings.reduceMotion)} w-full`}
          onClick={() => updateSettings({ reduceMotion: !settings.reduceMotion })}
        >
          Reduce motion
        </button>
        <p className={`mt-2 text-sm opacity-70 cursor-default ${theme.textBody}`}>
          Screens and panes switch instantly, and nothing grows or bounces under the pointer. Win and loss animations still play.
        </p>
      </div>
    </>
  )
}
