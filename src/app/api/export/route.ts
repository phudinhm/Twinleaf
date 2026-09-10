import { NextRequest, NextResponse } from "next/server";
import epub from "epub-gen-memory";
import { marked } from "marked";

interface Chunk {
  original: string;
  translated?: string;
}

function cleanXmlArtifacts(text: string): string {
  if (!text) return "";
  return text
    // Remove XML declarations, DOCTYPE, namespaces
    .replace(/<\?xml[^>]*\?>/gi, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<package[\s\S]*?<\/package>/gi, "")
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
    .replace(/<manifest[\s\S]*?<\/manifest>/gi, "")
    .replace(/<spine[\s\S]*?<\/spine>/gi, "")
    .replace(/<guide[\s\S]*?<\/guide>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    // Remove XML attributes like xmlns, epub:type
    .replace(/\s*(xmlns(:[a-z0-9]+)?|xml:lang|epub:type)=["'][^"']*["']/gi, "")
    // Remove structural wrapper tags that shouldn't appear in text
    .replace(/<\/?(html|head|body|div|span|section|article|nav|header|footer|aside)[^>]*>/gi, "")
    // Fix sentence spacing
    .replace(/([.!?\u2026:;])([A-Z\u00C0-\u024F\u1EA0-\u1EF9\u201C\u0022\u0027\u2018])/gu, "$1 $2")
    .replace(/([\p{L}\d][.!?\u2026])([\p{L}])/gu, "$1 $2")
    .replace(/ {2,}/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const { title, author: bookAuthor, cover, chunks, markdown, targetLang } = await req.json();

    const bookTitle = (title || "Translated Book").trim();
    const bookLang = targetLang || "en";
    const authorName = (bookAuthor || "Twinleaf Translator").trim();

    // Prepare cover image if provided
    let coverFile: File | undefined = undefined;
    if (cover && typeof cover === "string" && cover.startsWith("data:image/")) {
      try {
        const [header, b64] = cover.split(",");
        const mimeMatch = header.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const ext = mimeType.includes("png") ? "png" : "jpeg";
        const imgBuffer = Buffer.from(b64, "base64");
        coverFile = new File([imgBuffer], `cover.${ext}`, { type: mimeType });
      } catch (e) {
        console.warn("Could not process cover for export:", e);
      }
    }

    // Kindle optimized CSS for e-ink screens
    const kindleCss = `
      body {
        margin: 5% 4%;
        font-family: "Bookerly", "Georgia", "Times New Roman", serif;
        line-height: 1.6;
        color: #111111;
      }
      h1, h2, h3 {
        text-align: center;
        margin-top: 1.8em;
        margin-bottom: 1em;
        font-weight: bold;
      }
      .bilingual-pair {
        margin-bottom: 1.5em;
        page-break-inside: avoid;
      }
      .original-text {
        font-size: 1.05em;
        line-height: 1.65;
        margin-bottom: 0.35em;
      }
      .translated-text {
        font-size: 0.9em;
        font-style: italic;
        color: #444444;
        padding-left: 0.8em;
        border-left: 2px solid #aaaaaa;
        line-height: 1.5;
        margin-top: 0;
        margin-bottom: 0.6em;
      }
      hr {
        border: none;
        border-top: 1px solid #cccccc;
        margin: 2em auto;
        width: 60%;
      }
    `;

    // Process chapters cleanly
    const chapters: { title: string; content: string }[] = [];

    if (Array.isArray(chunks) && chunks.length > 0) {
      const PARAGRAPHS_PER_CHAPTER = 40;
      let currentChapterContent = "";
      let chapterIndex = 1;

      for (let i = 0; i < chunks.length; i++) {
        const item = chunks[i] as Chunk;
        const orig = cleanXmlArtifacts(item.original || "");
        const trans = cleanXmlArtifacts(item.translated || "");

        // Skip chunks that are empty or purely XML tag remnants
        if (!orig && !trans) continue;
        if (orig.startsWith("<?xml") || orig.startsWith("<package") || orig.startsWith("<!DOCTYPE")) continue;

        // Check if this chunk is a chapter title (starts with #)
        if (orig.startsWith("#")) {
          if (currentChapterContent.trim()) {
            chapters.push({
              title: `Chapter ${chapterIndex}`,
              content: currentChapterContent,
            });
            chapterIndex++;
            currentChapterContent = "";
          }

          const headingText = orig.replace(/^#+\s*/, "");
          const transHeading = trans.replace(/^#+\s*/, "");
          currentChapterContent += `<h2>${marked.parseInline(headingText)}</h2>`;
          if (transHeading) {
            currentChapterContent += `<div class="translated-text"><em>${marked.parseInline(transHeading)}</em></div>`;
          }
          continue;
        }

        // Parse markdown formatting (bold, italics) into clean HTML without escaping tags into &lt;
        const origParsed = marked.parseInline(orig);
        const transParsed = trans ? marked.parseInline(trans) : "";

        currentChapterContent += `
          <div class="bilingual-pair">
            <p class="original-text">${origParsed}</p>
            ${transParsed ? `<p class="translated-text">${transParsed}</p>` : ""}
          </div>
        `;

        // Split into new chapter every 40 paragraphs
        if ((i + 1) % PARAGRAPHS_PER_CHAPTER === 0 && currentChapterContent.trim()) {
          chapters.push({
            title: `Chapter ${chapterIndex}`,
            content: currentChapterContent,
          });
          chapterIndex++;
          currentChapterContent = "";
        }
      }

      if (currentChapterContent.trim()) {
        chapters.push({
          title: `Chapter ${chapterIndex}`,
          content: currentChapterContent,
        });
      }
    } else if (markdown) {
      const cleanMd = cleanXmlArtifacts(markdown);
      chapters.push({
        title: bookTitle,
        content: marked.parse(cleanMd) as string,
      });
    }

    if (chapters.length === 0) {
      chapters.push({
        title: bookTitle,
        content: "<p>No content translated.</p>",
      });
    }

    const options: any = {
      title: bookTitle,
      author: authorName,
      publisher: "Twinleaf",
      lang: bookLang,
      css: kindleCss,
      version: 3,
    };

    if (coverFile) {
      options.cover = coverFile;
    }

    const epubBuffer = await epub(options, chapters);

    return new NextResponse(epubBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(bookTitle)}.epub"`,
      },
    });
  } catch (error: any) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate EPUB" },
      { status: 500 }
    );
  }
}
