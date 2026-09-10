"use client";

import React from "react";
import { BookOpen, X } from "lucide-react";
import type { ThemeColors } from "@/types";

interface TOCItem {
  id: number;
  title: string;
}

interface TOCDrawerProps {
  items: TOCItem[];
  themeColors: ThemeColors;
  onSelectChunk: (id: number) => void;
  onClose: () => void;
}

export default function TOCDrawer({
  items,
  themeColors,
  onSelectChunk,
  onClose,
}: TOCDrawerProps) {
  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className="relative w-80 max-w-full h-full shadow-2xl z-50 flex flex-col p-6 animate-slide-in-left border-r"
        style={{
          backgroundColor: themeColors.bg,
          borderColor: themeColors.headerBorder,
        }}
      >
        <div className="flex items-center justify-between pb-4 border-b mb-4">
          <h3
            className="text-base font-bold flex items-center gap-2"
            style={{ color: themeColors.originalText }}
          >
            <BookOpen className="w-5 h-5 text-emerald-600" />
            Mục lục sách
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-200/50 text-stone-400 hover:text-stone-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {items.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => onSelectChunk(item.id)}
              className="w-full text-left p-2.5 rounded-xl text-xs font-medium transition flex items-start gap-2 hover:bg-emerald-50 hover:text-emerald-700"
              style={{ color: themeColors.originalText }}
            >
              <span className="w-5 text-stone-400 font-mono text-[11px] flex-shrink-0">
                {idx + 1}.
              </span>
              <span className="line-clamp-2 leading-relaxed">{item.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
