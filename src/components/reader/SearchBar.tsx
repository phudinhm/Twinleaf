"use client";

import React, { useCallback } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  matchCount: number;
  currentMatch: number;
  onPrevMatch: () => void;
  onNextMatch: () => void;
  onClose: () => void;
}

export default function SearchBar({
  query,
  onQueryChange,
  matchCount,
  currentMatch,
  onPrevMatch,
  onNextMatch,
  onClose,
}: SearchBarProps) {
  const handleClear = useCallback(() => {
    onQueryChange("");
  }, [onQueryChange]);

  return (
    <div className="mt-2.5 max-w-6xl mx-auto flex items-center gap-2 animate-fade-in-scale">
      <div className="relative flex-1">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Tìm từ khóa trong cả bản gốc và bản dịch..."
          className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-stone-200 bg-white shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/30 transition"
          autoFocus
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {query && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-stone-500 whitespace-nowrap tabular-nums">
            {matchCount > 0 ? `${currentMatch + 1}/${matchCount}` : "0 kết quả"}
          </span>
          <button
            onClick={onPrevMatch}
            disabled={matchCount === 0}
            className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 disabled:opacity-40 transition"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onNextMatch}
            disabled={matchCount === 0}
            className="p-1.5 rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-100 disabled:opacity-40 transition"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <button
        onClick={onClose}
        className="p-1.5 rounded-lg border border-stone-200 text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
