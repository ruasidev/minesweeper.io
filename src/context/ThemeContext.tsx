import { createContext, useContext, type ReactNode } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { DEFAULT_THEME, themes, type ThemeChoices, type ThemeProps } from "../game/themes";

// Classic was what everyone got until the game had colours of its own, so a browser that has "classic" saved has
// almost certainly never chosen anything. Those are moved over to the new default, once: picking Classic again
// after that sticks like any other choice
const MOVED_KEY = "themeMovedOffClassic"
function moveOffOldDefault() {
  if (localStorage.getItem(MOVED_KEY)) return
  localStorage.setItem(MOVED_KEY, "1")
  if (localStorage.getItem("themeId") === JSON.stringify("classic")) localStorage.removeItem("themeId")
}
moveOffOldDefault()

interface ThemeContextType {
  themeId: ThemeChoices;
  theme: ThemeProps;
  setThemeId: (id: ThemeChoices) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useLocalStorage<ThemeChoices>("themeId", DEFAULT_THEME);
  // a theme that has since been removed may still be the one saved: the default stands in for it
  const theme = themes.find((t) => t.id === themeId) ?? themes.find((t) => t.id === DEFAULT_THEME)!;

  return (
    <ThemeContext.Provider value={{ themeId: theme.id, theme, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
