import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useSettings, type ThemeMode } from '~/features/settings/store';
import { darkColors, lightColors, type ThemeColors } from './tokens';

export type ColorScheme = 'light' | 'dark';

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  /** The user's preference: follow the system, or force light / dark. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const mode = useSettings((s) => s.themeMode);
  const setMode = useSettings((s) => s.setThemeMode);
  const scheme: ColorScheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const value = useMemo<Theme>(() => ({ scheme, colors: scheme === 'dark' ? darkColors : lightColors, mode, setMode }), [scheme, mode, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
