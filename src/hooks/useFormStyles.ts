import { useTheme } from "../context/ThemeContext"
import { itemColors } from "../game/themes"

// The themed look of the pieces forms and panels are made of
export function useFormStyles() {
  const { theme } = useTheme()
  return {
    card: `rounded-xl border shadow-lg shadow-black/40 ring-1 ring-white/10 ${theme.menuBg} ${theme.menuBorder}`,
    input: `w-full px-3 py-2 rounded-md border select-text outline-none focus:ring-2
      ${theme.itemBg} ${theme.itemBorder} ${theme.textBody} ${theme.itemSelectedBorder}`,
    button: `px-3 py-2 rounded-md border pressable font-semibold disabled:opacity-50
      ${theme.itemBg} ${theme.itemHoverBg} ${theme.itemHoverBorder} ${theme.itemBorder} ${theme.textBody}`,
    // one of a set of choices: the chosen one is filled with the theme's highlight, the others stand back a little
    option: (selected: boolean) => `p-2 rounded-md border pressable font-semibold text-sm
      ${itemColors(theme, selected)} ${theme.itemHoverBorder} ${theme.itemBorder}
      ${selected ? "" : "opacity-60"}`,
    // a small label attached to something, like "Host"
    tag: `px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide leading-none cursor-default
      ${theme.itemBg} ${theme.itemBorder} ${theme.textBody}`,
  }
}
