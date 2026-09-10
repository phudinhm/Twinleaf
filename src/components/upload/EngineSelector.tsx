"use client";

import React from "react";

interface EngineSelectorProps {
  engine: string;
  onEngineChange: (engine: string) => void;
  targetLang: string;
  onTargetLangChange: (lang: string) => void;
}

export default function EngineSelector({
  engine,
  onEngineChange,
  targetLang,
  onTargetLangChange,
}: EngineSelectorProps) {
  return (
    <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-stone-200/80 shadow-sm space-y-3.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* AI Engine Selection */}
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
            Trí tuệ nhân tạo
          </label>
          <select
            value={engine}
            onChange={(e) => onEngineChange(e.target.value)}
            className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-700 shadow-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition font-medium"
          >
            <optgroup label="⚡ Siêu nhanh">
              <option value="qwen">🌸 Qwen 3.8 — Dịch văn học thơ mộng nhất</option>
              <option value="groq-gpt">🌟 GPT-OSS 120B — Trí tuệ 120B tham số</option>
            </optgroup>
            <optgroup label="🎯 Cân bằng">
              <option value="gemini">⚡ Gemini 3.6 Flash — Tự nhiên & Hiện đại</option>
            </optgroup>
            <optgroup label="📚 Đỉnh cao văn học">
              <option value="claude">👑 Claude 3.5 Sonnet — Chất lượng cao nhất</option>
              <option value="openai">🤖 OpenAI GPT-4o</option>
              <option value="openrouter">🌐 OpenRouter (Claude / GPT / DeepSeek)</option>
            </optgroup>
            <optgroup label="📋 Khác">
              <option value="deepseek">🧠 DeepSeek V3 (Cần số dư tài khoản)</option>
              <option value="google">🔤 Google Translate (Cơ bản)</option>
            </optgroup>
          </select>
        </div>

        {/* Language Selection */}
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
            Ngôn ngữ đích
          </label>
          <select
            value={targetLang}
            onChange={(e) => onTargetLangChange(e.target.value)}
            className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm text-stone-700 shadow-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none transition font-medium"
          >
            <option value="vi">🇻🇳 Tiếng Việt</option>
            <option value="en">🇬🇧 English</option>
            <option value="es">🇪🇸 Español</option>
            <option value="fr">🇫🇷 Français</option>
            <option value="de">🇩🇪 Deutsch</option>
            <option value="ja">🇯🇵 日本語</option>
            <option value="zh-CN">🇨🇳 中文</option>
            <option value="ko">🇰🇷 한국어</option>
            <option value="th">🇹🇭 ภาษาไทย</option>
          </select>
        </div>
      </div>
    </div>
  );
}
