"use client";

import React, { useRef, useEffect } from "react";
import { X } from "lucide-react";
import type { Theme, LayoutMode } from "@/types";

interface SettingsPanelProps {
  theme: Theme;
  layout: LayoutMode;
  fontSize: number;
  fontFamily: "serif" | "sans";
  onThemeChange: (theme: Theme) => void;
  onLayoutChange: (layout: LayoutMode) => void;
  onFontSizeChange: (updater: number | ((prev: number) => number)) => void;
  onFontFamilyChange: (family: "serif" | "sans") => void;
  onClose: () => void;
}

export default function SettingsPanel({
  theme,
  layout,
  fontSize,
  fontFamily,
  onThemeChange,
  onLayoutChange,
  onFontSizeChange,
  onFontFamilyChange,
  onClose,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const themes = [
    { key: "sand" as const, label: "Ấm áp", bg: "#faf8f5", text: "#1e293b" },
    { key: "sepia" as const, label: "Sepia", bg: "#f5ede0", text: "#1e293b" },
    { key: "white" as const, label: "Sáng", bg: "#ffffff", text: "#1e293b" },
    { key: "dark" as const, label: "Tối", bg: "#18181b", text: "#f1f5f9" },
  ];

  const displayModes = [
    { key: "interlinear" as const, label: "Cả hai" },
    { key: "columns" as const, label: "Song song" },
    { key: "translated_only" as const, label: "Chỉ dịch" },
    { key: "original_only" as const, label: "Chỉ gốc" },
  ];

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-stone-200 p-5 z-50 animate-fade-in-scale"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-stone-700">Tùy chỉnh đọc sách</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Theme Selector */}
      <div className="mb-4">
        <span className="block text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Chủ đề màu sắc
        </span>
        <div className="flex gap-2">
          {themes.map((t) => (
            <button
              key={t.key}
              onClick={() => onThemeChange(t.key)}
              className={`flex-1 py-2 px-2 rounded-xl border text-center text-xs font-medium transition ${
                theme === t.key
                  ? "ring-2 ring-emerald-500 border-transparent shadow-sm"
                  : "border-stone-200 hover:border-stone-300"
              }`}
              style={{ backgroundColor: t.bg, color: t.text }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div className="mb-4">
        <span className="block text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Cỡ chữ
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFontSizeChange((s) => Math.max(14, s - 2))}
            className="flex-1 py-2 bg-stone-100 text-stone-700 rounded-xl font-bold hover:bg-stone-200 transition text-sm"
          >
            A−
          </button>
          <span className="px-3 font-semibold text-stone-600 text-sm tabular-nums">
            {fontSize}px
          </span>
          <button
            onClick={() => onFontSizeChange((s) => Math.min(32, s + 2))}
            className="flex-1 py-2 bg-stone-100 text-stone-700 rounded-xl font-bold hover:bg-stone-200 transition text-sm"
          >
            A+
          </button>
        </div>
      </div>

      {/* Font Family */}
      <div className="mb-4">
        <span className="block text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Kiểu chữ
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => onFontFamilyChange("serif")}
            className={`flex-1 py-2 rounded-xl border text-xs font-medium transition ${
              fontFamily === "serif"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "border-stone-200 text-stone-600 hover:bg-stone-50"
            }`}
            style={{ fontFamily: "'Literata', Georgia, serif" }}
          >
            Literata Serif
          </button>
          <button
            onClick={() => onFontFamilyChange("sans")}
            className={`flex-1 py-2 rounded-xl border text-xs font-medium transition ${
              fontFamily === "sans"
                ? "bg-emerald-600 text-white border-emerald-600"
                : "border-stone-200 text-stone-600 hover:bg-stone-50"
            }`}
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            Modern Sans
          </button>
        </div>
      </div>

      {/* Display Mode */}
      <div>
        <span className="block text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2">
          Chế độ hiển thị
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {displayModes.map((m) => (
            <button
              key={m.key}
              onClick={() => onLayoutChange(m.key)}
              className={`py-2 rounded-xl border text-center text-xs font-medium transition ${
                layout === m.key
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "border-stone-200 text-stone-600 hover:bg-stone-50"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
