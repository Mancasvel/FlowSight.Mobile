/**
 * FlowSight Theme Context
 *
 * Provides light/dark theme with system detection.
 * Respects Reduce Motion and accessibility settings.
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme, type Theme } from './tokens';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  mode: 'system',
  isDark: false,
});

export function ThemeProvider({
  mode = 'system',
  children,
}: {
  mode?: ThemeMode;
  children: React.ReactNode;
}) {
  const systemScheme = useColorScheme();

  const value = useMemo<ThemeContextValue>(() => {
    const isDark =
      mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
    return {
      theme: isDark ? darkTheme : lightTheme,
      mode,
      isDark,
    };
  }, [mode, systemScheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
