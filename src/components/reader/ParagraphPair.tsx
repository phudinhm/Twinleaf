"use client";

import React, { useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Volume2, Copy, Check } from "lucide-react";
import type { BookChunk, LayoutMode, ThemeColors } from "@/types";

interface ParagraphPairProps {
  chunk: BookChunk;
  layout: LayoutMode;
  fontSize: number;
  fontStack: string;
  themeColors: ThemeColors;
  isTranslating: boolean;
  isActive: boolean;
  isCopied: boolean;
  isSpeaking: boolean;
  searchQuery: string;
  targetLang: string;
  onActivate: (id: number) => void;
  onCopy: (original: string, translated: string | undefined, id: number) => void;
  onSpeak: (text: string, lang: string, id: number) => void;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="search-highlight">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function ParagraphPairInner({
  chunk,
  layout,
  fontSize,
  fontStack,
  themeColors,
  isTranslating,
  isActive,
  isCopied,
  isSpeaking,
  searchQuery,
  targetLang,
  onActivate,
  onCopy,
  onSpeak,
}: ParagraphPairProps) {
  const orig = chunk.original.trim();
  const trans = chunk.translated?.trim();
  if (!orig) return null;

  const handleClick = useCallback(() => onActivate(chunk.id), [onActivate, chunk.id]);
  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCopy(chunk.original, chunk.translated, chunk.id);
    },
    [onCopy, chunk]
  );
  const handleSpeak = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSpeak(chunk.translated || chunk.original, targetLang, chunk.id);
    },
    [onSpeak, chunk, targetLang]
  );

  // Action buttons (shared across layouts)
  const actionButtons = (
    <div className="chunk-actions absolute right-2 top-2 flex items-center gap-1 bg-white/90 backdrop-blur-md rounded-lg p-1 shadow-sm border border-stone-200">
      <button
        onClick={handleSpeak}
        className={`p-1 rounded hover:bg-stone-100 text-stone-500 hover:text-emerald-600 transition`}
        title="Nghe đọc đoạn này"
      >
        <Volume2
          className={`w-3.5 h-3.5 ${
            isSpeaking ? "text-emerald-600 animate-pulse" : ""
          }`}
        />
      </button>
      <button
        onClick={handleCopy}
        className="p-1 rounded hover:bg-stone-100 text-stone-500 hover:text-emerald-600 transition"
        title="Sao chép đoạn này"
      >
        {isCopied ? (
          <Check className="w-3.5 h-3.5 text-emerald-600" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );

  // ── Heading ──
  if (chunk.isHeading) {
    return (
      <div
        id={`chunk-${chunk.id}`}
        className="pt-8 pb-3 text-center border-b mb-4"
        style={{ borderColor: themeColors.headerBorder }}
      >
        <h2
          className="text-xl md:text-2xl font-bold tracking-tight"
          style={{ color: themeColors.originalText }}
        >
          {searchQuery ? highlightText(orig.replace(/^#+\s*/, ""), searchQuery) : orig.replace(/^#+\s*/, "")}
        </h2>
        {trans && layout !== "original_only" && (
          <p
            className="text-sm italic mt-1.5"
            style={{ color: themeColors.translatedText }}
          >
            {searchQuery ? highlightText(trans.replace(/^#+\s*/, ""), searchQuery) : trans.replace(/^#+\s*/, "")}
          </p>
        )}
      </div>
    );
  }

  // ── Column Layout ──
  if (layout === "columns") {
    return (
      <div
        id={`chunk-${chunk.id}`}
        onClick={handleClick}
        className={`grid grid-cols-1 md:grid-cols-2 gap-6 p-3 rounded-2xl transition border-b border-dashed relative group ${
          isActive ? "ring-1 ring-emerald-500/40" : ""
        }`}
        style={{
          backgroundColor: isActive ? themeColors.highlightBg : "transparent",
          borderColor: themeColors.headerBorder,
        }}
      >
        <div
          className="leading-[1.8]"
          style={{ color: themeColors.originalText, fontSize: `${fontSize}px`, fontFamily: fontStack }}
        >
          {searchQuery ? <p>{highlightText(orig, searchQuery)}</p> : <ReactMarkdown>{chunk.original}</ReactMarkdown>}
        </div>
        <div
          className="leading-[1.8] pl-4 border-l-2 relative"
          style={{
            color: themeColors.translatedText,
            borderColor: themeColors.quoteBorder,
            fontSize: `${fontSize - 1}px`,
            fontStyle: "italic",
            fontFamily: fontStack,
          }}
        >
          {trans ? (
            searchQuery ? <p>{highlightText(trans, searchQuery)}</p> : <ReactMarkdown>{trans}</ReactMarkdown>
          ) : isTranslating ? (
            <span className="animate-pulse text-xs font-mono">Đang dịch...</span>
          ) : null}
          {actionButtons}
        </div>
      </div>
    );
  }

  // ── Interlinear / Single View ──
  return (
    <div
      id={`chunk-${chunk.id}`}
      onClick={handleClick}
      className={`p-3 rounded-2xl transition relative group ${
        isActive ? "ring-1 ring-emerald-500/40" : ""
      }`}
      style={{ backgroundColor: isActive ? themeColors.highlightBg : "transparent" }}
    >
      {layout !== "translated_only" && (
        <div
          className="leading-[1.8] mb-2"
          style={{ color: themeColors.originalText, fontSize: `${fontSize}px`, fontFamily: fontStack }}
        >
          {searchQuery ? <p>{highlightText(orig, searchQuery)}</p> : <ReactMarkdown>{chunk.original}</ReactMarkdown>}
        </div>
      )}

      {layout !== "original_only" && trans && (
        <div
          className="leading-[1.8] pl-3.5 border-l-2 mb-2"
          style={{
            color: themeColors.translatedText,
            borderColor: themeColors.quoteBorder,
            fontSize: `${Math.max(13, fontSize - 3)}px`,
            fontStyle: "italic",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          {searchQuery ? <p>{highlightText(trans, searchQuery)}</p> : <ReactMarkdown>{trans}</ReactMarkdown>}
        </div>
      )}

      {layout !== "original_only" && !trans && isTranslating && (
        <div
          className="text-xs mb-2 pl-3.5 animate-pulse font-mono"
          style={{ color: themeColors.translatedText }}
        >
          ···
        </div>
      )}

      {actionButtons}
    </div>
  );
}

// Custom comparison: only re-render when these specific props change
const ParagraphPair = React.memo(ParagraphPairInner, (prev, next) => {
  return (
    prev.chunk.id === next.chunk.id &&
    prev.chunk.translated === next.chunk.translated &&
    prev.chunk.original === next.chunk.original &&
    prev.layout === next.layout &&
    prev.fontSize === next.fontSize &&
    prev.fontStack === next.fontStack &&
    prev.themeColors === next.themeColors &&
    prev.isTranslating === next.isTranslating &&
    prev.isActive === next.isActive &&
    prev.isCopied === next.isCopied &&
    prev.isSpeaking === next.isSpeaking &&
    prev.searchQuery === next.searchQuery
  );
});

export default ParagraphPair;
