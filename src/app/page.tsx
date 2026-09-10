"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Leaf, ChevronUp, Download, Loader2, BookA } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

import type { BookChunk } from "@/types";
import { useReaderSettings } from "@/hooks/useReaderSettings";
import { useTranslator } from "@/hooks/useTranslator";
import { useLibrary } from "@/hooks/useLibrary";
import { useTTS } from "@/hooks/useTTS";

import FileDropzone from "@/components/upload/FileDropzone";
import EngineSelector from "@/components/upload/EngineSelector";
import LibraryView from "@/components/upload/LibraryView";
import ReaderHeader from "@/components/reader/ReaderHeader";
import SettingsPanel from "@/components/reader/SettingsPanel";
import TOCDrawer from "@/components/reader/TOCDrawer";
import SearchBar from "@/components/reader/SearchBar";
import ParagraphPair from "@/components/reader/ParagraphPair";
import AudioPlayer from "@/components/reader/AudioPlayer";
import DictionaryDrawer from "@/components/reader/DictionaryDrawer";

// ── Ebook text cleanup utilities ──
const cleanEbookText = (text: string): string => {
  if (!text) return "";
  let s = text;
  s = s.replace(/<\?xml[^>]*\?>/gi, "");
  s = s.replace(/<!DOCTYPE[^>]*>/gi, "");
  s = s.replace(/<package[\s\S]*?<\/package>/gi, "");
  s = s.replace(/<metadata[\s\S]*?<\/metadata>/gi, "");
  s = s.replace(/<manifest[\s\S]*?<\/manifest>/gi, "");
  s = s.replace(/<spine[\s\S]*?<\/spine>/gi, "");
  s = s.replace(/<guide[\s\S]*?<\/guide>/gi, "");
  s = s.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/\s*(xmlns(:[a-z0-9]+)?|xml:lang|epub:type)=["'][^"']*["']/gi, "");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–");
  s = s
    .replace(/([.!?\u2026:;])([A-Z\u00C0-\u024F\u1EA0-\u1EF9\u201C\u0022\u0027\u2018])/gu, "$1 $2")
    .replace(/([\p{L}\d][.!?\u2026])([\p{L}])/gu, "$1 $2")
    .replace(/ {2,}/g, " ");
  return s.trim();
};

const isJunkChunk = (text: string): boolean => {
  if (!text || text.length === 0) return true;
  if (text.match(/^[a-z0-9_#.-]+\s*\{[^}]*\}/i)) return true;
  if (text.match(/^@(page|namespace|font-face)/i)) return true;
  if (text.match(/^(xmlns|epub:|xml:)/i)) return true;
  if (!text.match(/[\p{L}\d]/u)) return true;
  return false;
};

export default function Home() {
  // ── Core state ──
  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState("vi");
  const [engine, setEngine] = useState("qwen");
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [chunks, setChunks] = useState<BookChunk[]>([]);
  const [bookId, setBookId] = useState<string>("");

  // ── UI state ──
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [activeChunkId, setActiveChunkId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  
  // ── Dictionary state ──
  const [selectedText, setSelectedText] = useState<{ word: string; context: string; x: number; y: number } | null>(null);
  const [dictQuery, setDictQuery] = useState<{ word: string; context: string } | null>(null);

  // ── Hooks ──
  const settings = useReaderSettings();
  const { isTranslating, progress, translateChunks } = useTranslator();
  const { library, isLoadingLibrary, saveBook, getBook, deleteBook, clearLibrary } = useLibrary();
  const tts = useTTS(chunks, targetLang);

  // ── Refs ──
  const readerRef = useRef<HTMLDivElement>(null);

  // ── Dictionary Text Selection Listener ──
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        // Prevent clearing if we click inside the popup
        setTimeout(() => {
          const newSelection = window.getSelection();
          if (!newSelection || newSelection.isCollapsed) {
            setSelectedText(null);
          }
        }, 100);
        return;
      }
      
      const text = selection.toString().trim();
      if (!text || text.length > 80 || text.includes("\n")) return; // Only allow short phrases
      
      try {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const node = selection.anchorNode;
        const contextNode = node?.parentElement?.closest("div");
        const contextText = contextNode?.textContent || "";

        setSelectedText({
          word: text,
          context: contextText.slice(0, 400),
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        });
      } catch (err) {}
    };

    document.addEventListener("mouseup", handleSelection);
    return () => document.removeEventListener("mouseup", handleSelection);
  }, []);

  // ── Auto-save when translation finishes ──
  useEffect(() => {
    if (!isTranslating && chunks.length > 0 && title) {
      saveBook({
        id: bookId || Date.now().toString(),
        title,
        author,
        cover,
        targetLang,
        lastReadAt: Date.now(),
        chunks,
      });
    }
  }, [isTranslating, chunks, title, author, cover, targetLang, bookId, saveBook]);

  // ── Search match IDs ──
  const searchMatchIds = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return chunks
      .filter(
        (c) =>
          c.original.toLowerCase().includes(q) ||
          (c.translated && c.translated.toLowerCase().includes(q))
      )
      .map((c) => c.id);
  }, [chunks, searchQuery]);

  // ── Table of Contents ──
  const tableOfContents = useMemo(() => {
    return chunks
      .filter((c) => c.isHeading || c.original.toLowerCase().startsWith("chapter"))
      .map((c) => ({
        id: c.id,
        title: c.original.replace(/^#+\s*/, "").slice(0, 60),
      }));
  }, [chunks]);

  // ── Reading Stats ──
  const readingStats = useMemo(() => {
    const totalWords = chunks.reduce((acc, c) => acc + c.original.split(/\s+/).length, 0);
    const estMinutes = Math.max(1, Math.round(totalWords / 200));
    return { totalWords, estMinutes };
  }, [chunks]);

  // ── Virtual Scrolling ──
  const virtualizer = useVirtualizer({
    count: chunks.length,
    getScrollElement: () => readerRef.current,
    estimateSize: () => 120,
    overscan: 10,
  });

  const scrollToChunk = useCallback((id: number) => {
    setShowToc(false);
    const idx = chunks.findIndex((c) => c.id === id);
    if (idx >= 0) {
      virtualizer.scrollToIndex(idx, { align: "center", behavior: "smooth" });
      setActiveChunkId(id);
    }
  }, [chunks, virtualizer]);

  // ── Auto-scroll for TTS ──
  useEffect(() => {
    if (tts.isPlaying && tts.currentChunkId !== null) {
      scrollToChunk(tts.currentChunkId);
    }
  }, [tts.currentChunkId, tts.isPlaying, scrollToChunk]);

  // ── Handlers ──
  const handleOpenSavedBook = async (id: string) => {
    const book = await getBook(id);
    if (!book) return;
    setBookId(book.id);
    setChunks(book.chunks);
    setTitle(book.title);
    setAuthor(book.author);
    setCover(book.cover);
    setTargetLang(book.targetLang);
  };

  const handleUploadAndParse = async () => {
    if (!file) return;
    setIsUploading(true);
    setChunks([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await res.json();
      const parsedTitle = data.title || file.name.replace(/\.[^/.]+$/, "");
      setTitle(parsedTitle);
      setAuthor(data.author || "Unknown Author");
      setCover(data.cover || null);
      const newBookId = Date.now().toString();
      setBookId(newBookId);

      const rawChunks = data.markdown.split(/\n\n+/);
      let idCounter = 0;
      const initialChunks: BookChunk[] = rawChunks
        .map((text: string) => {
          const isHeading = text.trim().startsWith("#");
          const cleaned = cleanEbookText(text);
          if (!cleaned || isJunkChunk(cleaned)) return null;
          return {
            id: idCounter++,
            original: isHeading && !cleaned.startsWith("#") ? `# ${cleaned}` : cleaned,
            isHeading: isHeading || cleaned.startsWith("#"),
          };
        })
        .filter((c: BookChunk | null): c is BookChunk => c !== null);

      setChunks(initialChunks);
      setIsUploading(false);
      translateChunks(initialChunks, targetLang, engine, setChunks);
    } catch (err: any) {
      alert(err.message);
      setIsUploading(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || "Translated Book",
          author: author || "Twinleaf Translator",
          cover,
          chunks,
          targetLang,
        }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "book"}-${targetLang}.epub`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Export failed: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleReset = useCallback(() => {
    tts.stop();
    setFile(null);
    setChunks([]);
    setTitle("");
    setAuthor("");
    setCover(null);
    setShowSearch(false);
    setSearchQuery("");
    setDictQuery(null);
  }, [tts]);

  const scrollToTop = useCallback(() => {
    readerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleCopyPair = useCallback((orig: string, trans?: string, id?: number) => {
    const text = trans ? `${orig}\n\n${trans}` : orig;
    navigator.clipboard.writeText(text);
    if (id !== undefined) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  const handleSearchNav = useCallback(
    (direction: "prev" | "next") => {
      if (searchMatchIds.length === 0) return;
      let next = direction === "next"
        ? (currentMatchIndex + 1) % searchMatchIds.length
        : (currentMatchIndex - 1 + searchMatchIds.length) % searchMatchIds.length;
      setCurrentMatchIndex(next);
      const targetId = searchMatchIds[next];
      scrollToChunk(targetId);
    },
    [searchMatchIds, currentMatchIndex, scrollToChunk]
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. Landing & Upload View
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (chunks.length === 0) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50/25 to-stone-100 flex items-center justify-center p-4">
        <div className="w-full max-w-xl space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2.5 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-amber-500 flex items-center justify-center shadow-lg shadow-emerald-200/50">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-stone-800">
                Twinleaf
              </h1>
            </div>
            <p className="text-stone-500 text-sm">
              Đọc & Dịch song ngữ sách điện tử với AI văn học đỉnh cao
            </p>
          </div>

          <EngineSelector
            engine={engine}
            onEngineChange={setEngine}
            targetLang={targetLang}
            onTargetLangChange={setTargetLang}
          />

          <FileDropzone
            file={file}
            onFileChange={setFile}
            onSubmit={handleUploadAndParse}
            isUploading={isUploading}
          />

          {!isLoadingLibrary && library.length > 0 && (
            <LibraryView
              library={library}
              onOpenBook={handleOpenSavedBook}
              onDeleteBook={deleteBook}
              onClearLibrary={clearLibrary}
            />
          )}
        </div>
      </main>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. Kindle-Style Reading View
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const ts = settings.themeColors;

  return (
    <main
      className="h-screen flex flex-col reader-transition overflow-hidden relative"
      style={{ backgroundColor: ts.bg }}
    >
      {/* ── Top Sticky Toolbar ── */}
      <header
        className="flex-shrink-0 backdrop-blur-md border-b px-4 py-2.5 z-30 reader-transition shadow-sm relative"
        style={{ backgroundColor: ts.headerBg, borderColor: ts.headerBorder }}
      >
        <ReaderHeader
          title={title}
          cover={cover}
          isTranslating={isTranslating}
          progress={progress}
          readingStats={readingStats}
          hasTOC={tableOfContents.length > 0}
          showSearch={showSearch}
          showSettings={showSettings}
          isExporting={isExporting}
          themeColors={ts}
          onReset={handleReset}
          onScrollToTop={scrollToTop}
          onToggleTOC={() => setShowToc(!showToc)}
          onToggleSearch={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(""); }}
          onToggleSettings={() => setShowSettings(!showSettings)}
          onExport={handleExport}
        />

        {/* Search Bar */}
        {showSearch && (
          <SearchBar
            query={searchQuery}
            onQueryChange={(q) => { setSearchQuery(q); setCurrentMatchIndex(0); }}
            matchCount={searchMatchIds.length}
            currentMatch={currentMatchIndex}
            onPrevMatch={() => handleSearchNav("prev")}
            onNextMatch={() => handleSearchNav("next")}
            onClose={() => { setShowSearch(false); setSearchQuery(""); }}
          />
        )}

        {/* Floating Settings Panel */}
        {showSettings && (
          <div className="relative max-w-6xl mx-auto flex justify-end">
            <SettingsPanel
              theme={settings.theme}
              layout={settings.layout}
              fontSize={settings.fontSize}
              fontFamily={settings.fontFamily}
              onThemeChange={settings.setTheme}
              onLayoutChange={settings.setLayout}
              onFontSizeChange={settings.setFontSize}
              onFontFamilyChange={settings.setFontFamily}
              onClose={() => setShowSettings(false)}
            />
          </div>
        )}
      </header>

      {/* ── TOC Drawer ── */}
      {showToc && (
        <TOCDrawer
          items={tableOfContents}
          themeColors={ts}
          onSelectChunk={scrollToChunk}
          onClose={() => setShowToc(false)}
        />
      )}
      
      {/* ── AI Dictionary Drawer ── */}
      {dictQuery && (
        <DictionaryDrawer
          word={dictQuery.word}
          context={dictQuery.context}
          language={targetLang}
          onClose={() => setDictQuery(null)}
        />
      )}

      {/* ── Floating Tra Từ Button ── */}
      {selectedText && (
        <button
          className="fixed z-50 transform -translate-x-1/2 -translate-y-[120%] bg-stone-900 text-white px-3 py-1.5 rounded-lg shadow-xl font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-600 transition animate-fade-in-scale cursor-pointer"
          style={{ left: selectedText.x, top: selectedText.y }}
          onMouseDown={(e) => {
            // Use onMouseDown to prevent the text selection from clearing before click registers
            e.preventDefault(); 
            setDictQuery({ word: selectedText.word, context: selectedText.context });
            setSelectedText(null);
            window.getSelection()?.removeAllRanges();
          }}
        >
          <BookA className="w-3.5 h-3.5" /> Tra từ bằng AI
        </button>
      )}

      {/* ── Main Book Reader Area (Virtualized) ── */}
      <div
        ref={readerRef}
        className="flex-1 overflow-y-auto scroll-smooth relative"
        style={{ backgroundColor: ts.bg }}
      >
        <article className="max-w-3xl mx-auto px-6 py-10 md:px-12 md:py-16">
          {/* Book Hero Card */}
          <div
            className="text-center mb-14 pb-10 border-b reader-transition"
            style={{ borderColor: ts.headerBorder }}
          >
            {cover && (
              <div className="inline-block mb-6 relative group">
                <img
                  src={cover}
                  alt={title}
                  className="w-36 md:w-48 h-auto rounded-2xl shadow-2xl mx-auto object-cover border-4 border-white/80 transform group-hover:scale-105 transition duration-300"
                />
              </div>
            )}
            <h1
              className="text-2xl md:text-4xl font-bold tracking-tight mb-2 leading-tight"
              style={{ color: ts.originalText, fontFamily: settings.fontStack }}
            >
              {title}
            </h1>
            {author && (
              <p className="text-sm font-medium tracking-wide uppercase text-stone-400">
                {author}
              </p>
            )}
          </div>

          {/* Virtualized Book Content */}
          <div
            style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const chunk = chunks[virtualRow.index];
              return (
                <div
                  key={chunk.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ParagraphPair
                    chunk={chunk}
                    layout={settings.layout}
                    fontSize={settings.fontSize}
                    fontStack={settings.fontStack}
                    themeColors={ts}
                    isTranslating={isTranslating}
                    isActive={activeChunkId === chunk.id}
                    isTTSActive={tts.currentChunkId === chunk.id && tts.isPlaying}
                    isCopied={copiedId === chunk.id}
                    isSpeaking={tts.currentChunkId === chunk.id && tts.isPlaying}
                    searchQuery={searchQuery}
                    targetLang={targetLang}
                    onActivate={setActiveChunkId}
                    onCopy={handleCopyPair}
                    onSpeak={() => {
                      if (tts.isPlaying && tts.currentChunkId === chunk.id) {
                        tts.stop();
                      } else {
                        tts.playChunk(chunk.id);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* End of book */}
          {!isTranslating && chunks.length > 0 && (
            <div className="text-center py-16 space-y-2 text-stone-400">
              <span className="text-3xl">🍃</span>
              <p className="text-sm font-medium">Hết sách • Chúc bạn đọc sách vui vẻ</p>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="mt-4 px-6 py-2.5 bg-stone-800 text-white rounded-xl text-xs font-semibold hover:bg-stone-900 transition shadow-sm inline-flex items-center gap-2"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Xuất file EPUB (Kèm bìa gốc chuẩn Kindle)</span>
              </button>
            </div>
          )}
        </article>
      </div>

      {/* Floating Audio Player */}
      <AudioPlayer tts={tts} />

      {/* Floating Scroll-to-Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed right-6 w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition hover:scale-110 active:scale-95 z-40 border reader-transition ${tts.isPlaying ? 'bottom-28' : 'bottom-6'}`}
        style={{
          backgroundColor: ts.headerBg,
          borderColor: ts.headerBorder,
          color: ts.originalText,
        }}
        title="Cuộn lên đầu trang"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </main>
  );
}
