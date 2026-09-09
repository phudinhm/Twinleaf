import { NextRequest, NextResponse } from "next/server";
import epub from "epub-gen-memory";

interface Chunk {
  original: string;
  translated?: string;
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
      }
      h1, h2, h3 {
        text-align: center;
        margin-top: 1.5em;
        margin-bottom: 1em;
        font-weight: bold;
      }
      .bilingual-pair {
        margin-bottom: 1.4em;
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
        color: #555555;
        padding-left: 0.75em;
        border-left: 2px solid #bbbbbb;
        line-height: 1.5;
        margin-top: 0;
        margin-bottom: 0.5em;
      }
      hr {
        border: none;
        border-top: 1px solid #e0e0e0;
        margin: 2em auto;
        width: 60%;
      }
    `;

    // Process chapters to prevent single gigantic chapter (which crashes Kindle/Send-to-Kindle)
    const chapters: { title: string; content: string }[] = [];

    if (Array.isArray(chunks) && chunks.length > 0) {
      const PARAGRAPHS_PER_CHAPTER = 40;
      let currentChapterContent = "";
      let chapterIndex = 1;

      for (let i = 0; i < chunks.length; i++) {
        const item = chunks[i] as Chunk;
        const orig = (item.original || "").trim();
        const trans = (item.translated || "").trim();

        if (!orig && !trans) continue;

        // Escape HTML entities to avoid XML parsing errors in EPUB
        const escapeHtml = (str: string) =>
          str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        // Check if this chunk is a chapter title (starts with #)
        if (orig.startsWith("#")) {
          // If we already have content, push previous chapter
          if (currentChapterContent.trim()) {
            chapters.push({
              title: `Chapter ${chapterIndex}`,
              content: currentChapterContent,
            });
            chapterIndex++;
            currentChapterContent = "";
          }

          const headingText = orig.replace(/^#+\s*/, "");
          currentChapterContent += `<h2>${escapeHtml(headingText)}</h2>`;
          if (trans) {
            currentChapterContent += `<div class="translated-text"><em>${escapeHtml(trans.replace(/^#+\s*/, ""))}</em></div>`;
          }
          continue;
        }

        const origHtml = escapeHtml(orig).replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br/>");
        const transHtml = trans ? escapeHtml(trans).replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br/>") : "";

        currentChapterContent += `
          <div class="bilingual-pair">
            <p class="original-text">${origHtml}</p>
            ${transHtml ? `<p class="translated-text">${transHtml}</p>` : ""}
          </div>
        `;

        // Split chapter every ~40 paragraphs
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
      // Fallback if raw markdown string is passed
      chapters.push({
        title: bookTitle,
        content: `<div>${markdown.replace(/\n\n/g, "<br/><br/>")}</div>`,
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
    return NextResponse.json({ error: error.message || "Failed to generate EPUB" }, { status: 500 });
  }
}
