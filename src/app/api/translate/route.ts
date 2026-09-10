import { NextRequest, NextResponse } from "next/server";
import translate from "translate-google";
import { GoogleGenerativeAI } from "@google/generative-ai";

const LANG_NAMES: Record<string, string> = {
  vi: "Vietnamese",
  es: "Spanish",
  fr: "French",
  de: "German",
  ja: "Japanese",
  "zh-CN": "Simplified Chinese",
  ko: "Korean",
  th: "Thai",
  pt: "Portuguese",
  ru: "Russian",
  it: "Italian",
};

function buildTranslationPrompt(texts: string[], langName: string): string {
  return `You are an elite literary translator and novelist specializing in publishing-grade book translations into ${langName}.

CRITICAL LITERARY TRANSLATION RULES:
1. PRONOUNS & CONTEXTUAL HIERARCHY (Especially for Vietnamese):
   - NEVER mechanically translate "you" as "bạn" or "I" as "tôi". This sounds robotic and amateurish.
   - Accurately deduce relationship, social class, intimacy, and emotional tension from the dialogue and narrative:
     * Lovers/Romantic: anh - em, chàng - nàng
     * Friends/Companions: cậu - tớ, mình - bạn, hoặc gọi thẳng tên
     * Family & Generations: bố/mẹ - con, ông/bà - cháu, anh/chị - em
     * Authority & Royalty: ngài, bệ hạ, đại nhân, phu nhân, tướng quân - thần, kẻ hèn này
     * Conflict / Quarrel: ngươi - ta, mày - tao (when hostile or fighting)
     * Master & Subordinate: ông chủ / thiếu gia - tôi / dạ
   - In natural narrative prose, omit unnecessary repetitive pronouns where the subject is clear from context.

2. PROSE QUALITY & IDIOMS:
   - Translate for emotional resonance, cadence, and elegance as if the book was written natively in ${langName}.
   - Never produce stiff literal ("dịch thô / dịch máy") sentences. Use vivid verbs, rich cultural idioms, and natural rhythm.
   - Preserve metaphors, irony, humor, wit, and distinctive character voices.

3. PUNCTUATION & SPACING (STRICT REQUIREMENT):
   - ALWAYS ensure proper spacing after punctuation marks: periods (.), commas (,), exclamation marks (!), question marks (?), colons (:), semicolons (;).
   - NEVER stick the next sentence directly to the period of the previous sentence without a space (e.g. write "câu một. Câu hai", NEVER "câu một.Câu hai").

4. PRESERVATION & FORMAT:
   - Keep proper names (people, kingdoms, cities) consistent and unchanged unless there is a universally accepted convention.
   - Each input passage is separated by "|||".
   - Return EXACTLY the same number of passages, separated by "|||", in the exact same sequence.
   - Output ONLY the translated text. Do NOT add notes, explanations, or quotes around the output.

Passages:
${texts.join("\n|||\n")}`;
}

export function fixPunctuationSpacing(text: string): string {
  if (!text) return text;
  return text
    // Fix punctuation immediately followed by letter or quote without space (e.g. "câu trước.Câu sau" -> "câu trước. Câu sau")
    .replace(/([.!?\u2026:;])([A-Z\u00C0-\u024F\u1EA0-\u1EF9\u201C\u0022\u0027\u2018])/gu, (_m, p1, p2) => p1 + " " + p2)
    // Fix letter followed by period and letter (e.g. "xong.nhưng" -> "xong. nhưng")
    .replace(/([\p{L}\d][.!?\u2026])([\p{L}])/gu, (_m, p1, p2) => p1 + " " + p2)
    .replace(/ {2,}/g, " ");
}

function parseTranslationResponse(response: string, originalTexts: string[]): string[] {
  const cleaned = response.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
  const translated = cleaned.split("|||").map((s: string) => fixPunctuationSpacing(s.trim()));
  while (translated.length < originalTexts.length) {
    translated.push(originalTexts[translated.length]);
  }
  return translated;
}

// ── Gemini 1.5 Flash (Fast & Great) ──
async function translateWithGeminiFlash(texts: string[], targetLang: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const langName = LANG_NAMES[targetLang] || targetLang;

  const result = await model.generateContent(buildTranslationPrompt(texts, langName));
  return parseTranslationResponse(result.response.text(), texts);
}

// ── Gemini Pro (Thinking / Literary context) ──
async function translateWithGeminiPro(texts: string[], targetLang: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  // Try gemini-3.6-flash (or pro preview)
  const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
  const langName = LANG_NAMES[targetLang] || targetLang;

  const result = await model.generateContent(buildTranslationPrompt(texts, langName));
  return parseTranslationResponse(result.response.text(), texts);
}

// ── DeepSeek V3 (Reasoning & Deep Literary Sense) ──
async function translateWithDeepSeek(texts: string[], targetLang: string): Promise<string[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY not set");

  const langName = LANG_NAMES[targetLang] || targetLang;

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "You are a master literary translator." },
        { role: "user", content: buildTranslationPrompt(texts, langName) },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return parseTranslationResponse(data.choices[0].message.content, texts);
}

// ── Groq Qwen (Top Literary Asian/Multilingual Model - Lightning Fast) ──
async function translateWithGroqQwen(texts: string[], targetLang: string): Promise<string[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const langName = LANG_NAMES[targetLang] || targetLang;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "qwen-2.5-32b",
      messages: [
        { role: "system", content: "You are an award-winning literary translator and novelist." },
        { role: "user", content: buildTranslationPrompt(texts, langName) },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    if (res.status === 429 || res.status === 404) {
      console.log("Qwen rate limited or invalid, auto-switching to Llama 3.3 70B...");
      return translateWithGroqGPT(texts, targetLang);
    }
    const errText = await res.text();
    throw new Error(`Groq Qwen API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return parseTranslationResponse(data.choices[0].message.content, texts);
}

// ── Groq Llama 3.3 70B (Massive Open Foundation Model) ──
async function translateWithGroqGPT(texts: string[], targetLang: string): Promise<string[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const langName = LANG_NAMES[targetLang] || targetLang;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "You are an award-winning literary translator and novelist." },
        { role: "user", content: buildTranslationPrompt(texts, langName) },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq GPT-OSS API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return parseTranslationResponse(data.choices[0].message.content, texts);
}

// ── Claude (Anthropic Claude 3.5 Sonnet - Literary Gold Standard) ──
async function translateWithClaude(texts: string[], targetLang: string): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const langName = LANG_NAMES[targetLang] || targetLang;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      messages: [
        { role: "user", content: buildTranslationPrompt(texts, langName) },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  const textContent = data.content?.[0]?.text || "";
  return parseTranslationResponse(textContent, texts);
}

// ── OpenAI (GPT-4o) ──
async function translateWithOpenAI(texts: string[], targetLang: string): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const langName = LANG_NAMES[targetLang] || targetLang;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a master literary translator." },
        { role: "user", content: buildTranslationPrompt(texts, langName) },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return parseTranslationResponse(data.choices[0].message.content, texts);
}

// ── OpenRouter (Access Claude 3.5, GPT-4o, DeepSeek R1 with 1 key) ──
async function translateWithOpenRouter(texts: string[], targetLang: string): Promise<string[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const langName = LANG_NAMES[targetLang] || targetLang;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Twinleaf eBook Translator",
    },
    body: JSON.stringify({
      model: "anthropic/claude-3.5-sonnet",
      messages: [
        { role: "system", content: "You are an elite literary translator into " + langName },
        { role: "user", content: buildTranslationPrompt(texts, langName) },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error (${res.status}): ${errText}`);
  }
  const data = await res.json();
  return parseTranslationResponse(data.choices[0].message.content, texts);
}

const ENGINE_FNS: Record<string, (texts: string[], lang: string) => Promise<string[]>> = {
  qwen: translateWithGroqQwen,
  groq: translateWithGroqQwen,
  "groq-gpt": translateWithGroqGPT,
  gemini: translateWithGeminiFlash,
  "gemini-pro": translateWithGeminiPro,
  deepseek: translateWithDeepSeek,
  claude: translateWithClaude,
  openai: translateWithOpenAI,
  openrouter: translateWithOpenRouter,
};

export async function POST(req: NextRequest) {
  try {
    const { text, targetLang, engine } = await req.json();

    if (!text || (Array.isArray(text) && text.length === 0)) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const texts = Array.isArray(text) ? text : [text];
    const selectedEngine = engine || "qwen";

    // If Google Translate is explicitly selected:
    if (selectedEngine === "google") {
      try {
        const translatedText = await translate(texts, { to: targetLang || "vi" });
        const cleaned = Array.isArray(translatedText)
          ? translatedText.map((t: string) => fixPunctuationSpacing(t))
          : fixPunctuationSpacing(translatedText);
        return NextResponse.json({ translatedText: cleaned, provider: "google-translate" });
      } catch (apiError: any) {
        return NextResponse.json({ error: "Google Translate rate limited: " + apiError.message }, { status: 429 });
      }
    }

    // Waterfall Translation Chain: NEVER STOPS
    const chain: string[] = [];
    if (selectedEngine === "qwen" || selectedEngine === "groq") {
      chain.push("qwen", "groq-gpt", "gemini");
    } else if (selectedEngine === "groq-gpt") {
      chain.push("groq-gpt", "qwen", "gemini");
    } else if (selectedEngine === "gemini" || selectedEngine === "gemini-pro") {
      chain.push("gemini", "qwen", "groq-gpt");
    } else {
      chain.push(selectedEngine, "qwen", "gemini");
    }

    // Try each AI engine in the chain
    for (const eng of chain) {
      const fn = ENGINE_FNS[eng];
      if (!fn) continue;
      try {
        const translatedText = await fn(texts, targetLang || "vi");
        if (translatedText && translatedText.length > 0) {
          return NextResponse.json({ translatedText, provider: eng });
        }
      } catch (err: any) {
        console.warn(`[Waterfall] Engine ${eng} paused/failed (${err.message?.slice(0, 80)}), trying next AI engine...`);
        // Continue to next AI engine!
      }
    }

    // Ultimate Safety Net: Google Translate Scraper
    try {
      const translatedText = await translate(texts, { to: targetLang || "vi" });
      const cleaned = Array.isArray(translatedText)
        ? translatedText.map((t: string) => fixPunctuationSpacing(t))
        : fixPunctuationSpacing(translatedText);
      return NextResponse.json({ translatedText: cleaned, provider: "google-fallback" });
    } catch (finalError: any) {
      console.error("All engines failed:", finalError);
      return NextResponse.json(
        { error: "Tất cả các cổng dịch tạm thời bận. Đang thử lại..." },
        { status: 429 }
      );
    }
  } catch (error: any) {
    console.error("Translation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to translate text" },
      { status: 500 }
    );
  }
}
