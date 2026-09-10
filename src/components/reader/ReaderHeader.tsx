"use client";

import React from "react";
import {
  Leaf,
  List,
  Search,
  Sliders,
  Download,
  Loader2,
} from "lucide-react";
import type { ThemeColors } from "@/types";

interface ReaderHeaderProps {
  title: string;
  cover: string | null;
  isTranslating: boolean;
  progress: number;
  readingStats: { totalWords: number; estMinutes: number };
  hasTOC: boolean;
  showSearch: boolean;
  showSettings: boolean;
  isExporting: boolean;
  themeColors: ThemeColors;
  onReset: () => void;
  onScrollToTop: () => void;
  onToggleTOC: () => void;
  onToggleSearch: () => void;
  onToggleSettings: () => void;
  onExport: () => void;
}

export default function ReaderHeader({
  title,
  cover,
  isTranslating,
  progress,
  readingStats,
  hasTOC,
  showSearch,
  showSettings,
  isExporting,
  themeColors,
  onReset,
  onScrollToTop,
  onToggleTOC,
  onToggleSearch,
  onToggleSettings,
  onExport,
}: ReaderHeaderProps) {
  return (
    <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
      {/* Left: Home & Book Identity */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onReset}
          className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-sm hover:opacity-90 transition"
          title="Đổi sách khác"
        >
          <Leaf className="w-4 h-4 text-white" />
        </button>

        {cover && (
          <img
            src={cover}
            alt="Book cover"
            className="w-7 h-10 object-cover rounded shadow-sm flex-shrink-0 border border-stone-300 cursor-pointer hover:opacity-80 transition"
            onClick={onScrollToTop}
            title="Về đầu trang"
          />
        )}

        <div className="min-w-0">
          <h1
            className="text-sm font-bold truncate max-w-[180px] sm:max-w-xs md:max-w-md"
            style={{ color: themeColors.originalText }}
          >
            {title || "Reading Book"}
          </h1>
          <div className="flex items-center gap-2">
            {isTranslating ? (
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-20 sm:w-28 bg-stone-200/80 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 progress-shimmer"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 tabular-nums">
                  {progress}%
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                ✓ Đã dịch xong
              </span>
            )}
            <span className="text-[11px] text-stone-400 hidden md:inline truncate">
              • {readingStats.estMinutes} phút đọc ({readingStats.totalWords.toLocaleString()} từ)
            </span>
          </div>
        </div>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1.5">
        {hasTOC && (
          <button
            onClick={onToggleTOC}
            className="p-2 rounded-xl text-xs font-medium border transition border-stone-200 text-stone-600 hover:bg-stone-100/80"
            title="Mục lục"
          >
            <List className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={onToggleSearch}
          className={`p-2 rounded-xl text-xs font-medium border transition ${
            showSearch
              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
              : "border-stone-200 text-stone-600 hover:bg-stone-100/80"
          }`}
          title="Tìm kiếm"
        >
          <Search className="w-4 h-4" />
        </button>

        <div className="relative">
          <button
            onClick={onToggleSettings}
            className={`p-2 rounded-xl text-xs font-medium border transition ${
              showSettings
                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                : "border-stone-200 text-stone-600 hover:bg-stone-100/80"
            }`}
            title="Tùy chỉnh"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={onExport}
          disabled={isExporting}
          className="px-3.5 py-2 bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-60 rounded-xl text-xs font-semibold shadow-sm transition inline-flex items-center gap-1.5"
        >
          {isExporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Xuất EPUB</span>
        </button>
      </div>
    </div>
  );
}
