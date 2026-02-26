/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-function */
import { createContext } from 'react';

export type ThemeMode = 'light' | 'dark';

export const defaultState = {
  highlightColor: 'yellow',
  setHighlightColor: (color: string) => {},
  theme: 'light' as ThemeMode,
  setTheme: (theme: ThemeMode) => {},
  toggleTheme: () => {},
};

export const AppContext = createContext(defaultState);
