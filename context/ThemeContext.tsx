import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'dark' | 'light';

// Pre-defined palette configuration
const PALETTES = {
  dark: {
    background: '#121212',
    card: '#1e1e1e',
    cardElevated: '#2a2a2a',
    text: '#ffffff',
    textMuted: '#aaaaaa',
    border: '#333333',
    chartBackground: '#1e1e1e',
    chartBackgroundGradient: '#2c3e50',
    tabBarBackground: '#1e1e1e',
  },
  light: {
    background: '#f4f4f9',
    card: '#ffffff',
    cardElevated: '#fcfcfc',
    text: '#1a1a1a',
    textMuted: '#666666',
    border: '#e1e1e1',
    chartBackground: '#ffffff',
    chartBackgroundGradient: '#e8ecef',
    tabBarBackground: '#ffffff',
  }
};

interface ThemeColors {
  background: string;
  card: string;
  cardElevated: string;
  text: string;
  textMuted: string;
  border: string;
  chartBackground: string;
  chartBackgroundGradient: string;
  tabBarBackground: string;
  accent: string;
}

interface ThemeContextType {
  mode: ThemeMode;
  accentColor: string;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
  setAccentColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const DEFAULT_ACCENT = '#ff4757'; // Default Gym Tracker Pink/Red

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [accentColor, setAccentColorState] = useState<string>(DEFAULT_ACCENT);

  // Load saved theme on startup
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedMode = await AsyncStorage.getItem('@gym_tracker_theme_mode');
        const savedAccent = await AsyncStorage.getItem('@gym_tracker_theme_accent');
        
        if (savedMode === 'dark' || savedMode === 'light') {
          setModeState(savedMode);
        }
        if (savedAccent) {
          setAccentColorState(savedAccent);
        }
      } catch (e) {
        console.log('Failed to load theme prefs', e);
      }
    };
    loadTheme();
  }, []);

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    await AsyncStorage.setItem('@gym_tracker_theme_mode', newMode);
  };

  const setAccentColor = async (color: string) => {
    setAccentColorState(color);
    await AsyncStorage.setItem('@gym_tracker_theme_accent', color);
  };

  const colors: ThemeColors = {
    ...PALETTES[mode],
    accent: accentColor,
  };

  return (
    <ThemeContext.Provider value={{ mode, accentColor, colors, setMode, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
