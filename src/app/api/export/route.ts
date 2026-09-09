import { NextRequest, NextResponse } from "next/server";
import epub from "epub-gen-memory";
import { marked } from "marked";

export async function POST(req: NextRequest) {
  try {
    const { title, markdown } = await req.json();

    if (!markdown) {
      return NextResponse.json({ error: "No markdown content provided" }, { status: 400 });
    }

    // Convert markdown to HTML for EPUB generation
    const htmlContent = marked.parse(markdown);

    const options = {
      title: title || "Translated Book",
      author: "eBook Translator App",
    };

    const chapters = [
      {
        title: title || "Content",
        content: htmlContent as string,
      }
    ];

    const epubBuffer = await epub(options, chapters);

    return new NextResponse(epubBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(options.title)}.epub"`,
      },
    });

  } catch (error: any) {
    console.error("Export error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate EPUB" }, { status: 500 });
  }
}
