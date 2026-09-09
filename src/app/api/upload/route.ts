import { NextRequest, NextResponse } from "next/server";
import { toMarkdown as epubToMarkdown } from "@mdgate/epub";
import { toMarkdown as mobiToMarkdown } from "@mdgate/mobi";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    let markdown = "";
    const filename = file.name.toLowerCase();
    
    if (filename.endsWith(".epub")) {
      markdown = await epubToMarkdown(bytes);
    } else if (filename.endsWith(".mobi") || filename.endsWith(".azw") || filename.endsWith(".azw3")) {
      markdown = await mobiToMarkdown(bytes);
    } else {
      return NextResponse.json({ error: "Unsupported file format. Please upload .epub, .mobi, or .azw3" }, { status: 400 });
    }

    // We can extract a rudimentary title from the filename
    const title = file.name.replace(/\.[^/.]+$/, "");

    return NextResponse.json({ markdown, title, filename: file.name });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Failed to process file" }, { status: 500 });
  }
}
