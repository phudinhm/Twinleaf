"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import {
  UploadCloud,
  BookOpen,
  Download,
  Loader2,
  Languages,
  Leaf,
  ChevronUp,
  Columns,
  AlignJustify,
  Sliders,
  Sparkles,
  Search,
  Volume2,
  List,
  Copy,
  Check,
  X,
  FileText,
} from "lucide-react";

type Theme = "sand" | "sepia" | "white" | "dark";
type LayoutMode = "interlinear" | "columns" | "translated_only" | "original_only";

interface BookChunk {
  id: number;
  original: string;
  translated?: string;
  isHeading?: boolean;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState("vi");
  const [engine, setEngine] = useState("qwen");
  const [isUploading, setIsUploading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [chunks, setChunks] = useState<BookChunk[]>([]);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Reader customization
  const [theme, setTheme] = useState<Theme>("sand");
  const [layout, setLayout] = useState<LayoutMode>("interlinear");
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState<"serif" | "sans">("serif");
  const [showSettings, setShowSettings] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [activeChunkId, setActiveChunkId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [speakingId, setSpeakingId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) setFile(droppedFile);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const cleanEbookText = (text: string): string => {
    if (!text) return "";
    let s = text;

    // 1. Remove XML declarations, DOCTYPE, metadata, and structural tags
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

    // 2. Remove XML attributes like xmlns, epub:type, xml:lang
    s = s.replace(/\s*(xmlns(:[a-z0-9]+)?|xml:lang|epub:type)=["'][^"']*["']/gi, "");

    // 3. Remove raw HTML/XML tags (keeping inner text)
    s = s.replace(/<[^>]+>/g, "");

    // 4. Decode common HTML entities
    s = s
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&mdash;/gi, "—")
      .replace(/&ndash;/gi, "–");

    // 5. Fix sentence spacing after punctuation
    s = s
      .replace(/([.!?\u2026:;])([A-Z\u00C0-\u024F\u1EA0-\u1EF9\u201C\u0022\u0027\u2018])/gu, "$1 $2")
      .replace(/([\p{L}\d][.!?\u2026])([\p{L}])/gu, "$1 $2")
      .replace(/ {2,}/g, " ");

    return s.trim();
  };

  const isJunkChunk = (text: string): boolean => {
    if (!text || text.length === 0) return true;
    // Check if it's leftover CSS rules like body { ... } or .calibre { ... }
    if (text.match(/^[a-z0-9_#.-]+\s*\{[^}]*\}/i)) return true;
    if (text.match(/^@(page|namespace|font-face)/i)) return true;
    // Check if it's an XML namespace remnant
    if (text.match(/^(xmlns|epub:|xml:)/i)) return true;
    // Check if it contains no actual text (only punctuation/symbols)
    if (!text.match(/[\p{L}\d]/u)) return true;
    return false;
  };

  const handleUploadAndParse = async () => {
    if (!file) return;
    setIsUploading(true);
    setChunks([]);
    setProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await res.json();
      setTitle(data.title || file.name.replace(/\.[^/.]+$/, ""));
      setAuthor(data.author || "Unknown Author");
      setCover(data.cover || null);

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
      translateChunks(initialChunks);
    } catch (err: any) {
      alert(err.message);
      setIsUploading(false);
    }
  };

  const translateChunks = async (initialChunks: BookChunk[]) => {
    setIsTranslating(true);
    let currentChunks = [...initialChunks];
    let completed = 0;
    const BATCH_SIZE = 3;
    const PARALLEL = 1;

    type Batch = { indices: number[]; texts: string[] };
    const allBatches: Batch[] = [];

    for (let i = 0; i < currentChunks.length; i += BATCH_SIZE) {
      const batch: Batch = { indices: [], texts: [] };
      for (let j = 0; j < BATCH_SIZE && i + j < currentChunks.length; j++) {
        const idx = i + j;
        const chunk = currentChunks[idx];
        if (!chunk.original.trim() || chunk.original.match(/^[-_*]{3,}$/)) {
          completed++;
        } else {
          batch.indices.push(idx);
          batch.texts.push(chunk.original);
        }
      }
      if (batch.texts.length > 0) allBatches.push(batch);
    }

    for (let w = 0; w < allBatches.length; w += PARALLEL) {
      const wave = allBatches.slice(w, w + PARALLEL);

      const results = await Promise.allSettled(
        wave.map(async (batch) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 40000);
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: batch.texts, targetLang, engine }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "Translation request failed");
          }
          const { translatedText } = await res.json();
          return { batch, translatedText };
        })
      );

      let needsRetry = false;

      for (const r of results) {
        if (r.status === "fulfilled") {
          const { batch, translatedText } = r.value;
          const translations = Array.isArray(translatedText) ? translatedText : [translatedText];
          batch.indices.forEach((chunkIdx, arrayIdx) => {
            currentChunks[chunkIdx] = {
              ...currentChunks[chunkIdx],
              translated: translations[arrayIdx] ?? "[Missing]",
            };
            completed++;
          });
        } else {
          console.warn("Batch failed, will retry:", r.reason?.message);
          needsRetry = true;
        }
      }

      setChunks([...currentChunks]);
      setProgress(Math.round((completed / currentChunks.length) * 100));

      if (needsRetry) {
        const failed = wave.filter((_, i) => results[i].status === "rejected");
        allBatches.splice(w + PARALLEL, 0, ...failed);
        await new Promise((r) => setTimeout(r, 3000));
      } else {
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    setIsTranslating(false);
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
          cover: cover,
          chunks: chunks,
          targetLang: targetLang,
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

  const handleReset = () => {
    setFile(null);
    setChunks([]);
    setTitle("");
    setAuthor("");
    setCover(null);
    setProgress(0);
    setIsTranslating(false);
    setIsUploading(false);
  };

  const scrollToTop = () => {
    readerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToChunk = (id: number) => {
    setShowToc(false);
    const el = document.getElementById(`chunk-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setActiveChunkId(id);
    }
  };

  const handleCopyPair = (orig: string, trans?: string, id?: number) => {
    const text = trans ? `${orig}\n\n${trans}` : orig;
    navigator.clipboard.writeText(text);
    if (id !== undefined) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSpeak = (text: string, lang: string, id: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "vi" ? "vi-VN" : "en-US";
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  // Table of contents items
  const tableOfContents = useMemo(() => {
    return chunks
      .filter((c) => c.isHeading || c.original.toLowerCase().startsWith("chapter"))
      .map((c) => ({
        id: c.id,
        title: c.original.replace(/^#+\s*/, "").slice(0, 60),
      }));
  }, [chunks]);

  // Total words & estimated reading time
  const readingStats = useMemo(() => {
    const totalWords = chunks.reduce((acc, c) => acc + c.original.split(/\s+/).length, 0);
    const estMinutes = Math.max(1, Math.round(totalWords / 200));
    return { totalWords, estMinutes };
  }, [chunks]);

  // Filtered chunks based on search query
  const filteredChunks = useMemo(() => {
    if (!searchQuery.trim()) return chunks;
    const q = searchQuery.toLowerCase();
    return chunks.filter(
      (c) =>
        c.original.toLowerCase().includes(q) ||
        (c.translated && c.translated.toLowerCase().includes(q))
    );
  }, [chunks, searchQuery]);

  // Theme palettes
  const themeStyles = {
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
  }[theme];

  // ───────────────────────────────────────────────
  // 1. Landing & Upload View
  // ───────────────────────────────────────────────
  if (chunks.length === 0) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50/25 to-stone-100 flex items-center justify-center p-4">
        <div className="w-full max-w-xl space-y-6">
          {/* Logo & Header */}
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

          {/* Settings Grid */}
          <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-stone-200/80 shadow-sm space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* AI Engine Selection */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                  Trí tuệ nhân tạo (AI Engine)
                </label>
                <select
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-700 shadow-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition font-medium"
                >
                  <option value="qwen">🌸 Qwen 3.8 (Groq) — Dịch văn học thơ mộng nhất (Siêu tốc)</option>
                  <option value="groq-gpt">🌟 GPT-OSS 120B (Groq) — Trí tuệ 120B tham số (Siêu tốc)</option>
                  <option value="gemini">⚡ Gemini 3.6 Flash (Google AI) — Tự nhiên & Hiện đại</option>
                  <option value="claude">👑 Claude 3.5 Sonnet (Đỉnh cao văn học thế giới)</option>
                  <option value="openai">🤖 OpenAI GPT-4o</option>
                  <option value="openrouter">🌐 OpenRouter (Dùng Claude / GPT / DeepSeek R1)</option>
                  <option value="deepseek">🧠 DeepSeek V3 (Cần số dư tài khoản)</option>
                  <option value="google">🔤 Google Translate (Cơ bản)</option>
                </select>
              </div>

              {/* Language Selection */}
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
                  Ngôn ngữ đích (Translate To)
                </label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-700 shadow-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition font-medium"
                >
                  <option value="vi">🇻🇳 Tiếng Việt (Vietnamese)</option>
                  <option value="en">🇬🇧 Tiếng Anh (English)</option>
                  <option value="es">🇪🇸 Tiếng Tây Ban Nha (Spanish)</option>
                  <option value="fr">🇫🇷 Tiếng Pháp (French)</option>
                  <option value="de">🇩🇪 Tiếng Đức (German)</option>
                  <option value="ja">🇯🇵 Tiếng Nhật (Japanese)</option>
                  <option value="zh-CN">🇨🇳 Tiếng Trung (Chinese)</option>
                  <option value="ko">🇰🇷 Tiếng Hàn (Korean)</option>
                  <option value="th">🇹🇭 Tiếng Thái (Thai)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <div
            className={`relative rounded-3xl border-2 border-dashed p-9 text-center cursor-pointer transition-all duration-300 ${
              isDragging
                ? "border-emerald-500 bg-emerald-50/80 scale-[1.02] shadow-xl shadow-emerald-100"
                : file
                ? "border-emerald-500 bg-emerald-50/40 shadow-md shadow-stone-100"
                : "border-stone-300 bg-white/80 hover:border-emerald-400 hover:shadow-lg"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".epub,.mobi,.azw,.azw3"
              className="hidden"
            />

            {isDragging ? (
              <div className="py-6">
                <UploadCloud className="w-16 h-16 text-emerald-500 mx-auto mb-3 animate-bounce" />
                <p className="text-emerald-700 font-semibold text-lg">Thả file sách vào đây!</p>
              </div>
            ) : file ? (
              <div className="py-4">
                <div className="w-16 h-20 mx-auto mb-4 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-lg shadow-md flex items-center justify-center text-white font-bold text-xs uppercase tracking-widest border border-white/40">
                  {file.name.split(".").pop()}
                </div>
                <p className="text-stone-800 font-bold text-lg max-w-sm mx-auto truncate">
                  {file.name}
                </p>
                <p className="text-stone-400 text-xs mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB • Nhấp để chọn file khác
                </p>
              </div>
            ) : (
              <div className="py-6">
                <div className="w-14 h-14 mx-auto mb-4 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-400">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <p className="text-stone-700 font-semibold text-base">
                  Kéo thả file sách hoặc nhấp để tải lên
                </p>
                <p className="text-stone-400 text-xs mt-1.5">
                  Hỗ trợ định dạng EPUB, MOBI, AZW, AZW3 (Tự động giữ nguyên bìa gốc)
                </p>
              </div>
            )}
          </div>

          {/* Action Button */}
          {file && (
            <button
              onClick={handleUploadAndParse}
              disabled={isUploading}
              className="w-full py-4 rounded-2xl font-semibold text-white text-base shadow-xl shadow-emerald-500/25 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:shadow-emerald-500/40 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang trích xuất nội dung & Bìa sách...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Bắt đầu dịch & Đọc song ngữ</span>
                </>
              )}
            </button>
          )}

          <div className="text-center">
            <p className="text-xs text-stone-400">
              💡 File xuất ra tương thích 100% với Amazon Kindle (Send to Kindle)
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ───────────────────────────────────────────────
  // 2. Kindle-Style Reading View
  // ───────────────────────────────────────────────
  return (
    <main
      className="h-screen flex flex-col transition-colors duration-300 overflow-hidden"
      style={{ backgroundColor: themeStyles.bg }}
    >
      {/* ── Top Sticky Toolbar ── */}
      <header
        className="flex-shrink-0 backdrop-blur-md border-b px-4 py-2.5 z-30 transition-colors duration-300 shadow-sm"
        style={{
          backgroundColor: themeStyles.headerBg,
          borderColor: themeStyles.headerBorder,
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Home & Book Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleReset}
              className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-sm hover:opacity-90 transition"
              title="Đổi sách khác"
            >
              <Leaf className="w-4 h-4 text-white" />
            </button>

            {/* Book Cover Thumbnail */}
            {cover && (
              <img
                src={cover}
                alt="Book cover"
                className="w-7 h-10 object-cover rounded shadow-sm flex-shrink-0 border border-stone-300 cursor-pointer hover:opacity-80 transition"
                onClick={() => scrollToTop()}
                title="Về đầu trang"
              />
            )}

            <div className="min-w-0">
              <h1
                className="text-sm font-bold truncate max-w-[180px] sm:max-w-xs md:max-w-md"
                style={{ color: themeStyles.originalText }}
              >
                {title || "Reading Book"}
              </h1>
              <div className="flex items-center gap-2">
                {isTranslating ? (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-20 sm:w-28 bg-stone-200/80 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-emerald-600">
                      {progress}%
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    ✓ Đã dịch xong
                  </span>
                )}
                <span className="text-[11px] text-stone-400 hidden md:inline truncate">
                  • {readingStats.estMinutes} phút đọc ({readingStats.totalWords} từ)
                </span>
              </div>
            </div>
          </div>

          {/* Right: Controls & Actions */}
          <div className="flex items-center gap-2">
            {/* Table of Contents Button */}
            {tableOfContents.length > 0 && (
              <button
                onClick={() => setShowToc(true)}
                className="p-2 rounded-xl text-xs font-medium border transition border-stone-200 text-stone-600 hover:bg-stone-100/80"
                title="Mục lục các chương"
              >
                <List className="w-4 h-4" />
              </button>
            )}

            {/* Search Button */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-xl text-xs font-medium border transition ${
                showSearch
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : "border-stone-200 text-stone-600 hover:bg-stone-100/80"
              }`}
              title="Tìm kiếm trong sách"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Layout Switcher */}
            <div
              className="hidden lg:flex items-center rounded-xl p-0.5 border"
              style={{
                backgroundColor: themeStyles.cardBg,
                borderColor: themeStyles.headerBorder,
              }}
            >
              <button
                onClick={() => setLayout("interlinear")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  layout === "interlinear"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-stone-500 hover:text-stone-800"
                }`}
                title="Dòng dưới dòng"
              >
                <AlignJustify className="w-3.5 h-3.5 inline mr-1" />
                Dưới dòng
              </button>
              <button
                onClick={() => setLayout("columns")}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  layout === "columns"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-stone-500 hover:text-stone-800"
                }`}
                title="Song song 2 cột"
              >
                <Columns className="w-3.5 h-3.5 inline mr-1" />
                Song song
              </button>
            </div>

            {/* Customizer Drawer Trigger */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-xl text-xs font-medium border transition ${
                showSettings
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : "border-stone-200 text-stone-600 hover:bg-stone-100/80"
              }`}
              title="Tùy chỉnh giao diện đọc"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Export EPUB Button */}
            <button
              onClick={handleExport}
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

        {/* ── Search Bar Sub-Panel ── */}
        {showSearch && (
          <div className="mt-2.5 max-w-6xl mx-auto flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm từ khóa trong cả bản gốc và bản dịch..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-stone-200 bg-white shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchQuery && (
              <span className="text-xs text-stone-500 whitespace-nowrap">
                Tìm thấy {filteredChunks.length} đoạn
              </span>
            )}
          </div>
        )}

        {/* ── Settings Dropdown Panel ── */}
        {showSettings && (
          <div
            className="mt-3 pt-3 border-t max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs animate-in fade-in duration-200"
            style={{ borderColor: themeStyles.headerBorder }}
          >
            {/* Themes */}
            <div>
              <span className="block font-semibold mb-2 text-stone-500 uppercase tracking-wider text-[10px]">
                Chủ đề màu sắc
              </span>
              <div className="flex gap-2">
                {(
                  [
                    { key: "sand", label: "Ấm áp", bg: "#faf8f5" },
                    { key: "sepia", label: "Sepia", bg: "#f5ede0" },
                    { key: "white", label: "Sáng", bg: "#ffffff" },
                    { key: "dark", label: "Tối", bg: "#18181b" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTheme(t.key)}
                    className={`flex-1 py-1.5 px-2 rounded-lg border text-center font-medium transition ${
                      theme === t.key
                        ? "ring-2 ring-emerald-500 border-transparent shadow-sm"
                        : "border-stone-200"
                    }`}
                    style={{
                      backgroundColor: t.bg,
                      color: t.key === "dark" ? "#f1f5f9" : "#1e293b",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size & Font Family */}
            <div>
              <span className="block font-semibold mb-2 text-stone-500 uppercase tracking-wider text-[10px]">
                Cỡ chữ & Kiểu chữ
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFontSize((s) => Math.max(14, s - 2))}
                  className="flex-1 py-1.5 bg-stone-100 text-stone-700 rounded-lg font-bold hover:bg-stone-200 transition"
                >
                  A -
                </button>
                <span className="px-2 font-semibold text-stone-600">
                  {fontSize}px
                </span>
                <button
                  onClick={() => setFontSize((s) => Math.min(32, s + 2))}
                  className="flex-1 py-1.5 bg-stone-100 text-stone-700 rounded-lg font-bold hover:bg-stone-200 transition"
                >
                  A +
                </button>
                <button
                  onClick={() =>
                    setFontFamily(fontFamily === "serif" ? "sans" : "serif")
                  }
                  className="px-3 py-1.5 border border-stone-200 rounded-lg font-medium hover:bg-stone-100 transition"
                >
                  {fontFamily === "serif" ? "Bookerly Serif" : "Modern Sans"}
                </button>
              </div>
            </div>

            {/* Display Mode */}
            <div>
              <span className="block font-semibold mb-2 text-stone-500 uppercase tracking-wider text-[10px]">
                Hiển thị bản dịch
              </span>
              <div className="flex gap-1.5">
                {(
                  [
                    { key: "interlinear", label: "Cả hai" },
                    { key: "translated_only", label: "Chỉ dịch" },
                    { key: "original_only", label: "Chỉ gốc" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setLayout(m.key)}
                    className={`flex-1 py-1.5 rounded-lg border text-center font-medium transition ${
                      layout === m.key
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "border-stone-200 text-stone-600 hover:bg-stone-100"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── Table of Contents Drawer ── */}
      {showToc && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowToc(false)}
          />
          <div
            className="relative w-80 max-w-full h-full shadow-2xl z-50 flex flex-col p-6 animate-in slide-in-from-left duration-200 border-r"
            style={{
              backgroundColor: themeStyles.bg,
              borderColor: themeStyles.headerBorder,
            }}
          >
            <div className="flex items-center justify-between pb-4 border-b mb-4">
              <h3
                className="text-base font-bold flex items-center gap-2"
                style={{ color: themeStyles.originalText }}
              >
                <BookOpen className="w-5 h-5 text-emerald-600" />
                Mục lục sách
              </h3>
              <button
                onClick={() => setShowToc(false)}
                className="p-1.5 rounded-lg hover:bg-stone-200/50 text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {tableOfContents.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => scrollToChunk(item.id)}
                  className="w-full text-left p-2.5 rounded-xl text-xs font-medium transition flex items-start gap-2 hover:bg-emerald-50 hover:text-emerald-700"
                  style={{ color: themeStyles.originalText }}
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
      )}

      {/* ── Main Book Reader Area ── */}
      <div
        ref={readerRef}
        className="flex-1 overflow-y-auto scroll-smooth"
        style={{ backgroundColor: themeStyles.bg }}
      >
        <article className="max-w-3xl mx-auto px-6 py-10 md:px-12 md:py-16">
          {/* Book Hero Card (Title & Cover) */}
          <div
            className="text-center mb-14 pb-10 border-b"
            style={{ borderColor: themeStyles.headerBorder }}
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
              style={{
                color: themeStyles.originalText,
                fontFamily:
                  fontFamily === "serif"
                    ? "Bookerly, Georgia, 'Times New Roman', serif"
                    : "system-ui, sans-serif",
              }}
            >
              {title}
            </h1>
            {author && (
              <p className="text-sm font-medium tracking-wide uppercase text-stone-400">
                {author}
              </p>
            )}
          </div>

          {/* Book Content Paragraphs */}
          <div className="space-y-4">
            {filteredChunks.map((chunk) => {
              const orig = chunk.original.trim();
              const trans = chunk.translated?.trim();
              if (!orig) return null;

              const isHeading = chunk.isHeading;
              const isActive = activeChunkId === chunk.id;

              if (isHeading) {
                return (
                  <div
                    key={chunk.id}
                    id={`chunk-${chunk.id}`}
                    className="pt-8 pb-3 text-center border-b mb-4"
                    style={{ borderColor: themeStyles.headerBorder }}
                  >
                    <h2
                      className="text-xl md:text-2xl font-bold tracking-tight"
                      style={{ color: themeStyles.originalText }}
                    >
                      {orig.replace(/^#+\s*/, "")}
                    </h2>
                    {trans && layout !== "original_only" && (
                      <p
                        className="text-sm italic mt-1.5"
                        style={{ color: themeStyles.translatedText }}
                      >
                        {trans.replace(/^#+\s*/, "")}
                      </p>
                    )}
                  </div>
                );
              }

              // Column Layout (Desktop)
              if (layout === "columns") {
                return (
                  <div
                    key={chunk.id}
                    id={`chunk-${chunk.id}`}
                    onClick={() => setActiveChunkId(chunk.id)}
                    className={`grid grid-cols-1 md:grid-cols-2 gap-6 p-3 rounded-2xl transition border-b border-dashed relative group ${
                      isActive ? "ring-1 ring-emerald-500/40" : ""
                    }`}
                    style={{
                      backgroundColor: isActive ? themeStyles.highlightBg : "transparent",
                      borderColor: themeStyles.headerBorder,
                    }}
                  >
                    {/* Left Column: Original */}
                    <div
                      className="leading-relaxed"
                      style={{
                        color: themeStyles.originalText,
                        fontSize: `${fontSize}px`,
                        fontFamily:
                          fontFamily === "serif"
                            ? "Bookerly, Georgia, serif"
                            : "system-ui, sans-serif",
                      }}
                    >
                      <ReactMarkdown>{chunk.original}</ReactMarkdown>
                    </div>

                    {/* Right Column: Translated */}
                    <div
                      className="leading-relaxed pl-4 border-l-2 relative"
                      style={{
                        color: themeStyles.translatedText,
                        borderColor: themeStyles.quoteBorder,
                        fontSize: `${fontSize - 1}px`,
                        fontStyle: "italic",
                        fontFamily:
                          fontFamily === "serif"
                            ? "Bookerly, Georgia, serif"
                            : "system-ui, sans-serif",
                      }}
                    >
                      {chunk.translated ? (
                        <ReactMarkdown>{chunk.translated}</ReactMarkdown>
                      ) : isTranslating ? (
                        <span className="animate-pulse text-xs font-mono">Đang dịch...</span>
                      ) : null}

                      {/* Floating Micro-Actions */}
                      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSpeak(chunk.translated || chunk.original, targetLang, chunk.id);
                          }}
                          className="p-1 rounded-lg hover:bg-stone-200/50 text-stone-400 hover:text-emerald-700"
                          title="Đọc to bằng giọng nói"
                        >
                          <Volume2 className={`w-3.5 h-3.5 ${speakingId === chunk.id ? "text-emerald-600 animate-pulse" : ""}`} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyPair(chunk.original, chunk.translated, chunk.id);
                          }}
                          className="p-1 rounded-lg hover:bg-stone-200/50 text-stone-400 hover:text-emerald-700"
                          title="Sao chép đoạn này"
                        >
                          {copiedId === chunk.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              // Interlinear & Single-view Layout
              return (
                <div
                  key={chunk.id}
                  id={`chunk-${chunk.id}`}
                  onClick={() => setActiveChunkId(chunk.id)}
                  className={`p-3 rounded-2xl transition relative group ${
                    isActive ? "ring-1 ring-emerald-500/40" : ""
                  }`}
                  style={{
                    backgroundColor: isActive ? themeStyles.highlightBg : "transparent",
                  }}
                >
                  {/* Original Text */}
                  {layout !== "translated_only" && (
                    <div
                      className="leading-relaxed mb-2"
                      style={{
                        color: themeStyles.originalText,
                        fontSize: `${fontSize}px`,
                        fontFamily:
                          fontFamily === "serif"
                            ? "Bookerly, Georgia, 'Times New Roman', serif"
                            : "system-ui, -apple-system, sans-serif",
                      }}
                    >
                      <ReactMarkdown>{chunk.original}</ReactMarkdown>
                    </div>
                  )}

                  {/* Translated Text */}
                  {layout !== "original_only" && chunk.translated && (
                    <div
                      className="leading-relaxed pl-3.5 border-l-2 mb-2 transition-opacity"
                      style={{
                        color: themeStyles.translatedText,
                        borderColor: themeStyles.quoteBorder,
                        fontSize: `${Math.max(13, fontSize - 3)}px`,
                        fontStyle: "italic",
                        fontFamily: "system-ui, -apple-system, sans-serif",
                      }}
                    >
                      <ReactMarkdown>{chunk.translated}</ReactMarkdown>
                    </div>
                  )}

                  {/* Translating Indicator */}
                  {layout !== "original_only" && !chunk.translated && isTranslating && (
                    <div
                      className="text-xs mb-2 pl-3.5 animate-pulse font-mono"
                      style={{ color: themeStyles.translatedText }}
                    >
                      ···
                    </div>
                  )}

                  {/* Floating Action Buttons on Hover */}
                  <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition flex items-center gap-1 bg-white/80 dark:bg-stone-900/80 backdrop-blur-md rounded-lg p-1 shadow-sm border border-stone-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpeak(chunk.translated || chunk.original, targetLang, chunk.id);
                      }}
                      className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-emerald-600"
                      title="Nghe đọc đoạn này"
                    >
                      <Volume2 className={`w-3.5 h-3.5 ${speakingId === chunk.id ? "text-emerald-600 animate-pulse" : ""}`} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyPair(chunk.original, chunk.translated, chunk.id);
                      }}
                      className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 hover:text-emerald-600"
                      title="Sao chép đoạn song ngữ"
                    >
                      {copiedId === chunk.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* End of book marker */}
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

      {/* Floating Scroll-to-Top Button */}
      <button
        onClick={scrollToTop}
        className="fixed bottom-6 right-6 w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition hover:scale-110 active:scale-95 z-20 border"
        style={{
          backgroundColor: themeStyles.headerBg,
          borderColor: themeStyles.headerBorder,
          color: themeStyles.originalText,
        }}
        title="Cuộn lên đầu trang"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </main>
  );
}
