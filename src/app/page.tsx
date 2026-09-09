"use client";

import { useState, useRef, useCallback } from "react";
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
  Moon,
  Sun,
  Type,
  Sparkles,
  Sliders,
} from "lucide-react";

type Theme = "sand" | "sepia" | "white" | "dark";
type LayoutMode = "interlinear" | "columns" | "translated_only" | "original_only";

interface BookChunk {
  original: string;
  translated?: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState("vi");
  const [engine, setEngine] = useState("gemini-pro");
  const [isUploading, setIsUploading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [chunks, setChunks] = useState<BookChunk[]>([]);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Reader customization state
  const [theme, setTheme] = useState<Theme>("sand");
  const [layout, setLayout] = useState<LayoutMode>("interlinear");
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState<"serif" | "sans">("serif");
  const [showSettings, setShowSettings] = useState(false);

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

  const fixSpacing = (text: string): string => {
    if (!text) return text;
    return text
      .replace(/([.!?\u2026:;])([A-Z\u00C0-\u024F\u1EA0-\u1EF9\u201C\u0022\u0027\u2018])/gu, "$1 $2")
      .replace(/([\p{L}\d][.!?\u2026])([\p{L}])/gu, "$1 $2")
      .replace(/ {2,}/g, " ");
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
      const initialChunks: BookChunk[] = rawChunks
        .map((text: string) => ({
          original: fixSpacing(text.trim()),
        }))
        .filter((c: BookChunk) => c.original.length > 0);

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
    const BATCH_SIZE = 8;
    const PARALLEL = 3;

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
          const timeoutId = setTimeout(() => controller.abort(), 35000);
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: batch.texts, targetLang, engine }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (res.status === 429 || res.status >= 500) throw new Error(`API_${res.status}`);
          if (!res.ok) throw new Error("Unknown error");
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
              translated: fixSpacing(translations[arrayIdx] ?? "[Missing]"),
            };
            completed++;
          });
        } else {
          console.warn("Batch failed:", r.reason?.message);
          needsRetry = true;
        }
      }

      setChunks([...currentChunks]);
      setProgress(Math.round((completed / currentChunks.length) * 100));

      if (needsRetry) {
        const failed = wave.filter((_, i) => results[i].status === "rejected");
        allBatches.splice(w + PARALLEL, 0, ...failed);
        await new Promise((r) => setTimeout(r, 4000));
      } else {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    setIsTranslating(false);
  };

  const handleExport = async () => {
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

  // Theme styles helper
  const themeStyles = {
    sand: {
      bg: "#faf8f5",
      headerBg: "rgba(255, 255, 255, 0.85)",
      headerBorder: "#e8ded0",
      originalText: "#2c2418",
      translatedText: "#8c755c",
      quoteBorder: "#dccdbb",
      cardBg: "#f2ecdf",
    },
    sepia: {
      bg: "#f5ede0",
      headerBg: "rgba(246, 239, 226, 0.9)",
      headerBorder: "#e2d2ba",
      originalText: "#332617",
      translatedText: "#886f4e",
      quoteBorder: "#d9c4a8",
      cardBg: "#ebdfcc",
    },
    white: {
      bg: "#ffffff",
      headerBg: "rgba(255, 255, 255, 0.9)",
      headerBorder: "#e2e8f0",
      originalText: "#0f172a",
      translatedText: "#64748b",
      quoteBorder: "#cbd5e1",
      cardBg: "#f8fafc",
    },
    dark: {
      bg: "#121214",
      headerBg: "rgba(24, 24, 27, 0.9)",
      headerBorder: "#27272a",
      originalText: "#f1f5f9",
      translatedText: "#94a3b8",
      quoteBorder: "#3f3f46",
      cardBg: "#1c1c20",
    },
  }[theme];

  // ───────────────────────────────────────────────
  // 1. Landing & Upload View
  // ───────────────────────────────────────────────
  if (chunks.length === 0) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50/30 to-stone-100 flex items-center justify-center p-4">
        <div className="w-full max-w-xl space-y-6">
          {/* Logo & Header */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2.5 mb-2">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-amber-500 flex items-center justify-center shadow-lg shadow-emerald-200/50">
                <Leaf className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-stone-800">
                Twinleaf
              </h1>
            </div>
            <p className="text-stone-500 text-sm">
              Đọc & Dịch song ngữ sách điện tử với AI văn học đỉnh cao
            </p>
          </div>

          {/* Settings Grid */}
          <div className="bg-white/70 backdrop-blur-md p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* AI Engine Selection */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                  Trí tuệ nhân tạo (AI Engine)
                </label>
                <select
                  value={engine}
                  onChange={(e) => setEngine(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 shadow-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition font-medium"
                >
                  <option value="gemini-pro">🌟 Gemini 1.5 Pro (Văn học sâu sắc)</option>
                  <option value="deepseek">🧠 DeepSeek V3 (Giàu cảm xúc)</option>
                  <option value="gemini">✨ Gemini 2.0 Flash (Nhanh & Tự nhiên)</option>
                  <option value="groq">⚡ Groq Llama 3.3 70B (Siêu tốc)</option>
                  <option value="claude">👑 Claude 3.5 Sonnet (Đỉnh cao)</option>
                  <option value="openai">🤖 OpenAI GPT-4o</option>
                  <option value="google">🔤 Google Translate (Cơ bản)</option>
                </select>
              </div>

              {/* Language Selection */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">
                  Ngôn ngữ đích (Translate To)
                </label>
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-700 shadow-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition font-medium"
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
            className={`relative rounded-3xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-300 ${
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
                  Hỗ trợ định dạng EPUB, MOBI, AZW, AZW3 (Giữ nguyên bìa gốc)
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
      className="h-screen flex flex-col transition-colors duration-300"
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
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
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
                className="w-7 h-10 object-cover rounded shadow-sm flex-shrink-0 border border-stone-300"
              />
            )}

            <div className="min-w-0">
              <h1
                className="text-sm font-bold truncate max-w-xs md:max-w-md"
                style={{ color: themeStyles.originalText }}
              >
                {title || "Reading Book"}
              </h1>
              <div className="flex items-center gap-2">
                {isTranslating ? (
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-24 bg-stone-200/80 rounded-full overflow-hidden">
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
                {author && (
                  <span className="text-[11px] text-stone-400 hidden sm:inline truncate">
                    • {author}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Controls & Actions */}
          <div className="flex items-center gap-2">
            {/* Layout Switcher */}
            <div
              className="hidden md:flex items-center rounded-xl p-0.5 border"
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
                  : "border-stone-200 text-stone-600 hover:bg-stone-100"
              }`}
              title="Tùy chỉnh giao diện đọc"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Export EPUB Button */}
            <button
              onClick={handleExport}
              className="px-3.5 py-2 bg-stone-900 text-white hover:bg-stone-800 rounded-xl text-xs font-semibold shadow-sm transition inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất EPUB</span>
            </button>
          </div>
        </div>

        {/* ── Settings Dropdown Panel ── */}
        {showSettings && (
          <div
            className="mt-3 pt-3 border-t max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs animate-in fade-in duration-200"
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
                  {fontFamily === "serif" ? "Serif" : "Sans"}
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

      {/* ── Main Book Reader Area ── */}
      <div
        ref={readerRef}
        className="flex-1 overflow-y-auto scroll-smooth"
        style={{ backgroundColor: themeStyles.bg }}
      >
        <article className="max-w-3xl mx-auto px-6 py-10 md:px-12 md:py-16">
          {/* Book Hero Card (Title & Cover) */}
          <div className="text-center mb-14 pb-10 border-b" style={{ borderColor: themeStyles.headerBorder }}>
            {cover && (
              <div className="inline-block mb-6 relative group">
                <img
                  src={cover}
                  alt={title}
                  className="w-36 md:w-44 h-auto rounded-xl shadow-2xl mx-auto object-cover border-2 border-white/60 transform group-hover:scale-105 transition duration-300"
                />
              </div>
            )}
            <h1
              className="text-2xl md:text-4xl font-bold tracking-tight mb-2"
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
          <div className="space-y-6">
            {chunks.map((chunk, idx) => {
              const orig = chunk.original.trim();
              const trans = chunk.translated?.trim();
              if (!orig) return null;

              // Check if heading
              const isHeading = orig.startsWith("#");

              if (isHeading) {
                return (
                  <div key={idx} className="pt-6 pb-2 text-center">
                    <h2
                      className="text-xl md:text-2xl font-bold tracking-tight"
                      style={{ color: themeStyles.originalText }}
                    >
                      {orig.replace(/^#+\s*/, "")}
                    </h2>
                    {trans && layout !== "original_only" && (
                      <p
                        className="text-sm italic mt-1"
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
                    key={idx}
                    className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2 border-b border-dashed"
                    style={{ borderColor: themeStyles.headerBorder }}
                  >
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
                    <div
                      className="leading-relaxed italic pl-3 border-l-2"
                      style={{
                        color: themeStyles.translatedText,
                        borderColor: themeStyles.quoteBorder,
                        fontSize: `${fontSize - 1}px`,
                        fontFamily:
                          fontFamily === "serif"
                            ? "Bookerly, Georgia, serif"
                            : "system-ui, sans-serif",
                      }}
                    >
                      {chunk.translated ? (
                        <ReactMarkdown>{chunk.translated}</ReactMarkdown>
                      ) : isTranslating ? (
                        <span className="animate-pulse text-xs">Đang dịch...</span>
                      ) : null}
                    </div>
                  </div>
                );
              }

              // Interlinear & Single-view Layout
              return (
                <div key={idx} className="group">
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
                      className="leading-relaxed pl-3.5 border-l-2 mb-5 transition-opacity"
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
                      className="text-xs mb-4 pl-3.5 animate-pulse font-mono"
                      style={{ color: themeStyles.translatedText }}
                    >
                      ···
                    </div>
                  )}
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
                className="mt-4 px-6 py-2.5 bg-stone-800 text-white rounded-xl text-xs font-semibold hover:bg-stone-900 transition shadow-sm inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Xuất file EPUB (Kèm bìa gốc)
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
