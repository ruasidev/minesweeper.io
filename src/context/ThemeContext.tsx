import { createContext, useContext, type ReactNode } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { themes, type ThemeChoices, type ThemeProps } from "../game/themes";

interface ThemeContextType {
  themeId: ThemeChoices;
  theme: ThemeProps;
  setThemeId: (id: ThemeChoices) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useLocalStorage<ThemeChoices>("theme", "classic");
  const theme = themes.find((t) => t.id === themeId) ?? themes[0];

  return (
    <ThemeContext.Provider value={{ themeId, theme, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
