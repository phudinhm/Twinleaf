"use client";
import { useState, useEffect, useCallback } from "react";
import { Theme, LayoutMode, THEME_MAP, ThemeColors } from "@/types";

const STORAGE_KEY = "twinleaf-reader-settings";

interface ReaderSettings {
  theme: Theme;
  layout: LayoutMode;
  fontSize: number;
  fontFamily: "serif" | "sans";
}

const defaults: ReaderSettings = {
  theme: "sand",
  layout: "interlinear",
  fontSize: 18,
  fontFamily: "serif",
};

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(defaults);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaults, ...parsed });
      }
    } catch {}
    setIsHydrated(true);
  }, []);

  // Persist to localStorage on change (after hydration)
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch {}
    }
  }, [settings, isHydrated]);

  const setTheme = useCallback((theme: Theme) => {
    setSettings(s => ({ ...s, theme }));
  }, []);

  const setLayout = useCallback((layout: LayoutMode) => {
    setSettings(s => ({ ...s, layout }));
  }, []);

  const setFontSize = useCallback((updater: number | ((prev: number) => number)) => {
    setSettings(s => ({
      ...s,
      fontSize: typeof updater === "function" ? updater(s.fontSize) : updater,
    }));
  }, []);

  const setFontFamily = useCallback((fontFamily: "serif" | "sans") => {
    setSettings(s => ({ ...s, fontFamily }));
  }, []);

  const themeColors: ThemeColors = THEME_MAP[settings.theme];

  const fontStack = settings.fontFamily === "serif"
    ? "'Literata', Georgia, 'Times New Roman', serif"
    : "var(--font-geist-sans), system-ui, -apple-system, sans-serif";

  return {
    ...settings,
    themeColors,
    fontStack,
    setTheme,
    setLayout,
    setFontSize,
    setFontFamily,
  };
}
