import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { defaultSettings, type Settings } from "../game/settings";
import { configureSounds } from "../lib/sounds";

interface SettingsContextType {
  settings: Settings;
  updateSettings: (changes: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// The status bar used to start out with all six of its figures on. A browser with all six saved has almost certainly
// never chosen that, so those are moved over to the three it starts with now, once: switching the others back on
// after that sticks like any other setting
const MOVED_KEY = "statusBarMovedOffAll"
function moveOffOldStatusBar() {
  if (localStorage.getItem(MOVED_KEY)) return
  localStorage.setItem(MOVED_KEY, "1")
  try {
    const saved = JSON.parse(localStorage.getItem("settings") ?? "null") as Partial<Settings> | null
    if (!saved?.statusBarItems || !Object.values(saved.statusBarItems).every(Boolean)) return
    localStorage.setItem("settings", JSON.stringify({ ...saved, statusBarItems: defaultSettings.statusBarItems }))
  } catch {
    // whatever is saved can't be read: the defaults take over as they would anyway
  }
}
moveOffOldStatusBar()

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [saved, setSettings] = useLocalStorage<Settings>("settings", defaultSettings);
  // Settings saved before a newer setting existed don't have it; those use its default
  const settings: Settings = { ...defaultSettings, ...saved };

  // Sounds are played from all over the app, so they keep their own copy of these two settings
  useEffect(() => {
    configureSounds({ enabled: settings.soundEffects, volume: settings.soundVolume / 100 });
  }, [settings.soundEffects, settings.soundVolume]);
  const updateSettings = (changes: Partial<Settings>) => setSettings(prev => ({ ...prev, ...changes }));

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
