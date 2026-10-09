import { useTheme } from "../context/ThemeContext"
import { ghostColors, type ThemeProps } from "../game/themes"

// Kept apart from the hook for the few places that have a theme in hand and build their own classes around it
export const paneLook = (theme: ThemeProps) =>
  `rounded-2xl border shadow-2xl shadow-black/60 ring-1 ring-white/15 ${theme.menuBg} ${theme.menuBorder}`

// The themed look of the pieces forms and panels are made of
export function useFormStyles() {
  const { theme } = useTheme()
  return {
    // A pane: a piece of the app itself that floats over the page with a gap all round it, and that the page passes
    // underneath. The header, the navigation in whichever shape it takes, and whatever is brought up over the page
    pane: paneLook(theme),
    // A card: a block of the page's own content. Lower and squarer than a pane, so the two read as different layers
    card: `rounded-xl border shadow-lg shadow-black/40 ring-1 ring-white/10 ${theme.menuBg} ${theme.menuBorder}`,
    input: `w-full px-3 py-2 rounded-md border select-text outline-none focus:ring-2
      ${theme.itemBg} ${theme.itemBorder} ${theme.textBody} ${theme.itemSelectedBorder}`,
    // The thing to press where it is: the main action of a form or a card. It has a box of its own
    button: `px-3 py-2 rounded-md border pressable font-semibold disabled:opacity-50
      ${theme.itemBg} ${theme.itemHoverBg} ${theme.itemHoverBorder} ${theme.itemBorder} ${theme.textBody}`,
    // The one thing to do next on a screen: filled in with the theme's highlight
    primary: `px-4 py-2.5 rounded-lg pressable font-bold disabled:opacity-50 ${theme.itemSelected}`,
    // A button among others, in a toolbar or beside a heading: nothing around it until the pointer is over it
    ghost: `px-3 py-2 rounded-md pressable font-semibold disabled:opacity-50 ${ghostColors(theme)}`,
    // ...and a small one, for a row of a table or a list
    ghostSmall: `px-2 py-1 pointer-coarse:px-3 pointer-coarse:py-2.5 rounded text-xs font-semibold pressable disabled:opacity-50 ${ghostColors(theme)}`,
    // one of a set of choices: the chosen one is filled with the theme's highlight, the others are bare and stand back a little
    option: (selected: boolean) => `p-2 rounded-md pressable font-semibold text-sm
      ${ghostColors(theme, selected)}
      ${selected ? "" : "opacity-70"}`,
    // a small label attached to something, like "Host"
    tag: `px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide leading-none cursor-default
      ${theme.itemBg} ${theme.itemBorder} ${theme.textBody}`,
  }
}
