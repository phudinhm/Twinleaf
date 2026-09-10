import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { word, context, language } = await req.json();

    if (!word || !context || !language) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json({ error: "Missing Gemini API Key" }, { status: 500 });
    }

    let systemPrompt = `Bạn là một từ điển bách khoa toàn thư siêu việt, giải thích từ vựng tiếng ${language} sang tiếng Việt. 
Người dùng sẽ cung cấp 1 từ và 1 câu chứa từ đó (ngữ cảnh).
Nhiệm vụ của bạn:
1. Giải thích nghĩa gốc của từ.
2. Giải thích nghĩa CHÍNH XÁC của từ trong ngữ cảnh câu được cung cấp.
3. Giải thích ngắn gọn ngữ pháp (tại sao từ đó lại được chia như vậy trong câu).
4. Trình bày dưới dạng Markdown dễ đọc, chia phần rõ ràng bằng heading (###).`;

    if (language.toLowerCase() === "de" || language.toLowerCase() === "german" || language.toLowerCase() === "tiếng đức") {
      systemPrompt += `\nĐẶC BIỆT LƯU Ý VỚI TIẾNG ĐỨC:
- Bắt buộc phải cung cấp giống (Artikel: der, die, das) nếu là danh từ.
- Cung cấp dạng số nhiều (Plural) nếu là danh từ.
- Phân tích cách (Kasus: Nominativ, Akkusativ, Dativ, Genitiv) mà từ đó đang đảm nhiệm trong câu.
- Dịch toàn bộ câu ngữ cảnh sang tiếng Việt.`;
    }

    const prompt = `${systemPrompt}\n\nTừ cần tra: "${word}"\nCâu ngữ cảnh: "${context}"\n\nHãy giải thích chi tiết.`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API Error: ${err}`);
    }

    const data = await res.json();
    const explanation = data.candidates?.[0]?.content?.parts?.[0]?.text || "Không thể phân tích từ này.";

    return NextResponse.json({ explanation });
  } catch (error: any) {
    console.error("Dictionary API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch dictionary" }, { status: 500 });
  }
}
