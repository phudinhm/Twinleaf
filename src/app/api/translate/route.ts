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

3. PRESERVATION & FORMAT:
   - Keep proper names (people, kingdoms, cities) consistent and unchanged unless there is a universally accepted convention.
   - Each input passage is separated by "|||".
   - Return EXACTLY the same number of passages, separated by "|||", in the exact same sequence.
   - Output ONLY the translated text. Do NOT add notes, explanations, or quotes around the output.

Passages:
${texts.join("\n|||\n")}`;
}

function parseTranslationResponse(response: string, originalTexts: string[]): string[] {
  const cleaned = response.trim().replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
  const translated = cleaned.split("|||").map((s: string) => s.trim());
  while (translated.length < originalTexts.length) {
    translated.push(originalTexts[translated.length]);
  }
  return translated;
}

// ── Gemini 2.0 Flash (Fast & Great) ──
async function translateWithGeminiFlash(texts: string[], targetLang: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const langName = LANG_NAMES[targetLang] || targetLang;

  const result = await model.generateContent(buildTranslationPrompt(texts, langName));
  return parseTranslationResponse(result.response.text(), texts);
}

// ── Gemini 1.5 Pro / Thinking (Smartest, Deep Context) ──
async function translateWithGeminiPro(texts: string[], targetLang: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
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

// ── Groq (Llama 3.3 70B - Lightning Fast) ──
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
        { role: "system", content: "You are a master literary translator." },
        { role: "user", content: buildTranslationPrompt(texts, langName) },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText}`);
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

const ENGINE_FNS: Record<string, (texts: string[], lang: string) => Promise<string[]>> = {
  gemini: translateWithGeminiFlash,
  "gemini-pro": translateWithGeminiPro,
  deepseek: translateWithDeepSeek,
  groq: translateWithGroq,
  claude: translateWithClaude,
  openai: translateWithOpenAI,
};

export async function POST(req: NextRequest) {
  try {
    const { text, targetLang, engine } = await req.json();

    if (!text || (Array.isArray(text) && text.length === 0)) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const texts = Array.isArray(text) ? text : [text];

    // 1. Try requested engine
    const selectedEngine = engine || "gemini-pro";
    const aiTranslate = ENGINE_FNS[selectedEngine] || ENGINE_FNS["gemini"];

    if (aiTranslate) {
      try {
        const translatedText = await aiTranslate(texts, targetLang || "vi");
        return NextResponse.json({ translatedText, provider: selectedEngine });
      } catch (aiError: any) {
        console.warn(`${selectedEngine} failed, trying fallback:`, aiError.message);

        // Fallback 1: If pro failed, try Gemini Flash
        if (selectedEngine === "gemini-pro" && process.env.GEMINI_API_KEY) {
          try {
            const translatedText = await translateWithGeminiFlash(texts, targetLang || "vi");
            return NextResponse.json({ translatedText, provider: "gemini-flash" });
          } catch (e) {}
        }
      }
    }

    // Fallback 2: Google Translate scraper
    try {
      const translatedText = await translate(texts, { to: targetLang || "vi" });
      return NextResponse.json({ translatedText, provider: "google-translate" });
    } catch (apiError: any) {
      console.warn("Translation API failed:", apiError.message);
      return NextResponse.json(
        { error: "API Rate limited or failed. " + apiError.message },
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
