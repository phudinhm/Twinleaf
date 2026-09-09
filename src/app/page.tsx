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
} from "lucide-react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState("vi");
  const [engine, setEngine] = useState("gemini");
  const [isUploading, setIsUploading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [title, setTitle] = useState("");
  const [chunks, setChunks] = useState<{ original: string; translated?: string }[]>([]);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);

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
      setTitle(data.title);

      const rawChunks = data.markdown.split(/\n\n+/);
      const initialChunks: { original: string; translated?: string }[] = rawChunks.map(
        (text: string) => ({ original: text })
      );
      setChunks(initialChunks);
      setIsUploading(false);
      translateChunks(initialChunks);
    } catch (err: any) {
      alert(err.message);
      setIsUploading(false);
    }
  };

  const translateChunks = async (
    initialChunks: { original: string; translated?: string }[]
  ) => {
    setIsTranslating(true);
    let currentChunks = [...initialChunks];
    let completed = 0;
    const BATCH_SIZE = 10;
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
          const timeoutId = setTimeout(() => controller.abort(), 25000);
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
              translated: translations[arrayIdx] ?? "[Missing]",
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
    const fullMarkdown = chunks
      .map((c) => {
        const original = c.original.trim();
        const translated = c.translated?.trim();
        if (!original) return "";
        if (!translated) return original;
        return `${original}\n\n*${translated}*`;
      })
      .filter(Boolean)
      .join("\n\n---\n\n");

    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "Translated Book", markdown: fullMarkdown }),
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
    setProgress(0);
    setIsTranslating(false);
    setIsUploading(false);
  };

  const scrollToTop = () => {
    readerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Landing / Upload View ──
  if (chunks.length === 0) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50/30 to-stone-100 flex items-center justify-center p-4">
        <div className="w-full max-w-xl space-y-8">
          {/* Logo */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-stone-800">
                Twinleaf
              </h1>
            </div>
            <p className="text-stone-500 text-sm">
              AI-powered bilingual eBook reader & translator
            </p>
          </div>

          {/* Settings Row */}
          <div className="flex gap-3">
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 shadow-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none transition"
            >
              <option value="gemini">✨ Gemini</option>
              <option value="groq">⚡ Groq / Llama</option>
              <option value="deepseek">🧠 DeepSeek</option>
              <option value="mistral">🇫🇷 Mistral</option>
              <option value="google">🔤 Google Translate</option>
            </select>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-700 shadow-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 outline-none transition"
            >
              <option value="vi">🇻🇳 Vietnamese</option>
              <option value="es">🇪🇸 Spanish</option>
              <option value="fr">🇫🇷 French</option>
              <option value="de">🇩🇪 German</option>
              <option value="ja">🇯🇵 Japanese</option>
              <option value="zh-CN">🇨🇳 Chinese</option>
              <option value="ko">🇰🇷 Korean</option>
              <option value="th">🇹🇭 Thai</option>
              <option value="pt">🇵🇹 Portuguese</option>
              <option value="ru">🇷🇺 Russian</option>
            </select>
          </div>

          {/* Drop Zone */}
          <div
            className={`relative rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all duration-300 ${
              isDragging
                ? "border-emerald-400 bg-emerald-50 scale-[1.02]"
                : file
                  ? "border-emerald-500 bg-emerald-50/50"
                  : "border-stone-300 bg-white hover:border-stone-400 hover:shadow-md"
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
              <>
                <UploadCloud className="w-14 h-14 text-emerald-400 mx-auto mb-4 animate-bounce" />
                <p className="text-emerald-600 font-medium text-lg">Drop it here!</p>
              </>
            ) : file ? (
              <>
                <BookOpen className="w-14 h-14 text-emerald-600 mx-auto mb-4" />
                <p className="text-emerald-800 font-semibold text-lg">{file.name}</p>
                <p className="text-stone-400 text-sm mt-1">
                  {(file.size / 1024 / 1024).toFixed(1)} MB • Click to change
                </p>
              </>
            ) : (
              <>
                <UploadCloud className="w-14 h-14 text-stone-300 mx-auto mb-4" />
                <p className="text-stone-600 font-medium text-lg">
                  Drop your eBook here
                </p>
                <p className="text-stone-400 text-sm mt-1">
                  Supports .epub, .mobi, .azw3
                </p>
              </>
            )}
          </div>

          {/* Start Button */}
          {file && (
            <button
              onClick={handleUploadAndParse}
              disabled={isUploading}
              className="w-full py-4 rounded-xl font-semibold text-white text-lg shadow-lg transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 hover:shadow-xl hover:shadow-emerald-200 active:scale-[0.98]"
            >
              {isUploading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Parsing eBook…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Languages className="w-5 h-5" />
                  Start Translating
                </span>
              )}
            </button>
          )}

          {/* Footer */}
          <p className="text-center text-xs text-stone-400">
            DRM-free books only • Your files are never stored on the server
          </p>
        </div>
      </main>
    );
  }

  // ── Reader View ──
  return (
    <main className="h-screen flex flex-col bg-stone-100">
      {/* Sticky Toolbar */}
      <header className="flex-shrink-0 bg-white/80 backdrop-blur-lg border-b border-stone-200 px-4 py-2.5 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleReset}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center"
              title="Back to home"
            >
              <Leaf className="w-4 h-4 text-white" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-stone-800 truncate">
                {title || "Reading"}
              </h1>
              {isTranslating ? (
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-24 bg-stone-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-stone-500">{progress}%</span>
                </div>
              ) : (
                <p className="text-xs text-emerald-600">✓ Complete</p>
              )}
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTranslation(!showTranslation)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                showTranslation
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-stone-100 text-stone-500"
              }`}
              title="Toggle translations"
            >
              <Languages className="w-3.5 h-3.5 inline mr-1" />
              {showTranslation ? "ON" : "OFF"}
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-medium hover:bg-stone-800 transition inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
          </div>
        </div>
      </header>

      {/* Reading Area */}
      <div
        ref={readerRef}
        className="flex-1 overflow-y-auto scroll-smooth"
        style={{ backgroundColor: "#faf8f5" }}
      >
        <article className="max-w-2xl mx-auto px-6 py-10 md:px-10 md:py-14">
          {chunks.map((chunk, idx) => (
            <div key={idx} className="mb-1">
              {/* Original */}
              <div
                className="leading-[1.9] max-w-none [&>p]:mb-4 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-4 [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:mb-3 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:mb-2"
                style={{ color: "#2c2418", fontSize: "1.1rem", fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                <ReactMarkdown>{chunk.original}</ReactMarkdown>
              </div>

              {/* Translation */}
              {showTranslation && chunk.translated && (
                <div
                  className="leading-relaxed max-w-none [&>p]:mb-1 pl-3 border-l-2 mb-5 transition-opacity duration-300"
                  style={{
                    color: "#b89e7a",
                    borderColor: "#e6ddd0",
                    fontSize: "0.8rem",
                    fontFamily: "system-ui, sans-serif",
                  }}
                >
                  <ReactMarkdown>{chunk.translated}</ReactMarkdown>
                </div>
              )}

              {showTranslation && !chunk.translated && isTranslating && (
                <div
                  className="text-xs mb-5 pl-3 animate-pulse"
                  style={{ color: "#d4c4a8" }}
                >
                  ···
                </div>
              )}
            </div>
          ))}

          {/* End of book marker */}
          {!isTranslating && (
            <div className="text-center py-12 text-stone-300">
              <span className="text-2xl">🍃</span>
              <p className="text-sm mt-2">End of book</p>
            </div>
          )}
        </article>
      </div>

      {/* Scroll-to-top FAB */}
      <button
        onClick={scrollToTop}
        className="fixed bottom-6 right-6 w-10 h-10 rounded-full bg-white shadow-lg border border-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-800 hover:shadow-xl transition-all z-20"
        title="Scroll to top"
      >
        <ChevronUp className="w-5 h-5" />
      </button>
    </main>
  );
}
