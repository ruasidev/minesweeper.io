import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { defaultSettings, type Settings } from "../game/settings";
import { configureSounds } from "../lib/sounds";

interface SettingsContextType {
  settings: Settings;
  updateSettings: (changes: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

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
