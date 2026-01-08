import { createContext, useContext, useState, useEffect } from 'react';
import { STORAGE_KEYS, getFromStorage, saveToStorage } from '../utils/localStorage';
import { api } from '../lib/api-client';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');
  const [branding, setBranding] = useState({
    logo: null,
    colors: {
      primary50: '#eff6ff',
      primary100: '#dbeafe',
      primary200: '#bfdbfe',
      primary300: '#93c5fd',
      primary400: '#60a5fa',
      primary500: '#3b82f6',
      primary600: '#2563eb',
      primary700: '#1d4ed8',
      primary800: '#1e40af',
      primary900: '#1e3a8a',
    },
  });

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    applyTheme(savedTheme);

    // Load branding from localStorage
    const savedBranding = getFromStorage(STORAGE_KEYS.BRANDING);
    if (savedBranding) {
      setBranding(savedBranding);
      applyBrandColors(savedBranding.colors);
    }
  }, []);

  const applyTheme = (newTheme) => {
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const applyBrandColors = (colors) => {
    const root = document.documentElement;
    Object.entries(colors).forEach(([key, value]) => {
      const cssVarName = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVarName, value);
    });
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);

    // Save to database if user is authenticated
    try {
      const token = localStorage.getItem('authToken');
      if (token) {
        await api.users.updatePreferences({ theme: newTheme });
      }
    } catch (error) {
      console.error('Error saving theme preference:', error);
      // Continue anyway - localStorage backup exists
    }
  };

  const setThemeFromPreference = (preferredTheme) => {
    if (preferredTheme && ['light', 'dark'].includes(preferredTheme)) {
      setTheme(preferredTheme);
      localStorage.setItem('theme', preferredTheme);
      applyTheme(preferredTheme);
    }
  };

  const updateBranding = (newBranding) => {
    const updated = { ...branding, ...newBranding };
    setBranding(updated);
    saveToStorage(STORAGE_KEYS.BRANDING, updated);
    if (newBranding.colors) {
      applyBrandColors(newBranding.colors);
    }
  };

  const value = {
    theme,
    toggleTheme,
    setThemeFromPreference,
    branding,
    updateBranding,
    isDark: theme === 'dark',
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
