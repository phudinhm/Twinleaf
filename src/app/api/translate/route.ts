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
};

function buildTranslationPrompt(texts: string[], langName: string): string {
  return `You are a professional literary translator. Translate the following text passages into ${langName}.

IMPORTANT RULES:
- Translate naturally and contextually, not word-for-word
- Use appropriate pronouns based on context (e.g. for Vietnamese: "anh/em/cô/ông/ngài" instead of always "bạn" for "you")
- Preserve the tone, emotion and style of the original
- Keep proper nouns (names, places) unchanged
- Each passage is separated by "|||"
- Return ONLY the translations, separated by "|||", in the same order
- Do NOT add any explanation or notes

Passages:
${texts.join("\n|||\n")}`;
}

function parseTranslationResponse(response: string, originalTexts: string[]): string[] {
  const translated = response.trim().split("|||").map((s: string) => s.trim());
  while (translated.length < originalTexts.length) {
    translated.push(originalTexts[translated.length]);
  }
  return translated;
}

// ── Gemini ──
async function translateWithGemini(texts: string[], targetLang: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const langName = LANG_NAMES[targetLang] || targetLang;

  const result = await model.generateContent(buildTranslationPrompt(texts, langName));
  return parseTranslationResponse(result.response.text(), texts);
}

// ── Groq (Llama) ──
async function translateWithGroq(texts: string[], targetLang: string): Promise<string[]> {
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
        { role: "user", content: buildTranslationPrompt(texts, langName) },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
  const data = await res.json();
  return parseTranslationResponse(data.choices[0].message.content, texts);
}

// ── DeepSeek ──
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
        { role: "user", content: buildTranslationPrompt(texts, langName) },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`);
  const data = await res.json();
  return parseTranslationResponse(data.choices[0].message.content, texts);
}

// ── Mistral ──
async function translateWithMistral(texts: string[], targetLang: string): Promise<string[]> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY not set");

  const langName = LANG_NAMES[targetLang] || targetLang;

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [
        { role: "user", content: buildTranslationPrompt(texts, langName) },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) throw new Error(`Mistral API error: ${res.status}`);
  const data = await res.json();
  return parseTranslationResponse(data.choices[0].message.content, texts);
}

// ── Engine dispatcher ──
type Engine = "gemini" | "groq" | "deepseek" | "mistral" | "google";

const ENGINE_FNS: Record<string, (texts: string[], lang: string) => Promise<string[]>> = {
  gemini: translateWithGemini,
  groq: translateWithGroq,
  deepseek: translateWithDeepSeek,
  mistral: translateWithMistral,
};

export async function POST(req: NextRequest) {
  try {
    const { text, targetLang, engine } = await req.json();

    if (!text || (Array.isArray(text) && text.length === 0)) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const texts = Array.isArray(text) ? text : [text];

    // Try the selected AI engine first
    const aiTranslate = ENGINE_FNS[engine as string];
    if (aiTranslate) {
      try {
        const translatedText = await aiTranslate(texts, targetLang || "vi");
        return NextResponse.json({ translatedText, provider: engine });
      } catch (aiError: any) {
        console.warn(`${engine} failed, falling back to Google Translate:`, aiError.message);
      }
    }

    // Google Translate fallback
    try {
      const translatedText = await translate(texts, { to: targetLang || "vi" });
      return NextResponse.json({ translatedText, provider: "google-translate" });
    } catch (apiError: any) {
      console.warn("Translation API failed:", apiError.message);
      return NextResponse.json({ error: "API Rate limited or failed. " + apiError.message }, { status: 429 });
    }

  } catch (error: any) {
    console.error("Translation error:", error);
    return NextResponse.json({ error: error.message || "Failed to translate text" }, { status: 500 });
  }
}
