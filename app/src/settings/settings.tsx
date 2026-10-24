import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'majlis.settings.v1';

export type CommentaryPart = 'adab' | 'fawaid' | 'meaning';

export interface CommentarySettings {
  adab: boolean;
  fawaid: boolean;
  meaning: boolean;
}

export interface SettingsState {
  commentary: CommentarySettings;
}

const DEFAULT_SETTINGS: SettingsState = {
  commentary: { adab: true, fawaid: true, meaning: true },
};

interface SettingsContextValue {
  ready: boolean;
  settings: SettingsState;
  setCommentaryPart: (part: CommentaryPart, enabled: boolean) => void;
  resetCommentary: () => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  ready: false,
  settings: DEFAULT_SETTINGS,
  setCommentaryPart: () => {},
  resetCommentary: () => {},
});

function normalize(raw: unknown): SettingsState {
  const source = raw as Partial<SettingsState> | null;
  const commentary = (source?.commentary ?? {}) as Partial<CommentarySettings>;
  return {
    commentary: {
      adab: commentary.adab !== false,
      fawaid: commentary.fawaid !== false,
      meaning: commentary.meaning !== false,
    },
  };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setSettings(normalize(JSON.parse(raw)));
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback((next: SettingsState) => {
    setSettings(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const setCommentaryPart = useCallback(
    (part: CommentaryPart, enabled: boolean) => {
      setSettings((prev) => {
        const next = {
          ...prev,
          commentary: { ...prev.commentary, [part]: enabled },
        };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  const resetCommentary = useCallback(() => {
    persist(DEFAULT_SETTINGS);
  }, [persist]);

  const value = useMemo(
    () => ({ ready, settings, setCommentaryPart, resetCommentary }),
    [ready, settings, setCommentaryPart, resetCommentary]
  );

  return (
    <SettingsContext.Provider value={value}>
      {ready ? children : null}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
