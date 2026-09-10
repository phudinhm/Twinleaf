export type Theme = "sand" | "sepia" | "white" | "dark";
export type LayoutMode = "interlinear" | "columns" | "translated_only" | "original_only";

export interface BookChunk {
  id: number;
  original: string;
  translated?: string;
  isHeading?: boolean;
}

export interface ThemeColors {
  bg: string;
  headerBg: string;
  headerBorder: string;
  originalText: string;
  translatedText: string;
  quoteBorder: string;
  cardBg: string;
  highlightBg: string;
}

export const THEME_MAP: Record<Theme, ThemeColors> = {
  sand: {
    bg: "#faf8f5",
    headerBg: "rgba(255, 255, 255, 0.9)",
    headerBorder: "#e8ded0",
    originalText: "#2c2418",
    translatedText: "#7e664e",
    quoteBorder: "#dccdbb",
    cardBg: "#f2ecdf",
    highlightBg: "rgba(225, 215, 198, 0.35)",
  },
  sepia: {
    bg: "#f5ede0",
    headerBg: "rgba(245, 237, 224, 0.95)",
    headerBorder: "#e2d2ba",
    originalText: "#332617",
    translatedText: "#846c4d",
    quoteBorder: "#d9c4a8",
    cardBg: "#ebdfcc",
    highlightBg: "rgba(217, 196, 168, 0.35)",
  },
  white: {
    bg: "#ffffff",
    headerBg: "rgba(255, 255, 255, 0.95)",
    headerBorder: "#e2e8f0",
    originalText: "#0f172a",
    translatedText: "#475569",
    quoteBorder: "#cbd5e1",
    cardBg: "#f8fafc",
    highlightBg: "rgba(241, 245, 249, 0.8)",
  },
  dark: {
    bg: "#121214",
    headerBg: "rgba(22, 22, 26, 0.95)",
    headerBorder: "#27272a",
    originalText: "#f1f5f9",
    translatedText: "#94a3b8",
    quoteBorder: "#3f3f46",
    cardBg: "#1c1c20",
    highlightBg: "rgba(39, 39, 42, 0.5)",
  },
};

export interface SavedBook {
  id: string;
  title: string;
  author: string;
  cover: string | null;
  targetLang: string;
  lastReadAt: number;
  chunks: BookChunk[];
}

export interface LibraryBookMeta {
  id: string;
  title: string;
  author: string;
  cover: string | null;
  targetLang: string;
  lastReadAt: number;
  progress: number;
}
