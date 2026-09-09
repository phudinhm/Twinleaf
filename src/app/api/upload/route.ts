import { NextRequest, NextResponse } from "next/server";
import { toMarkdown as epubToMarkdown } from "@mdgate/epub";
import { toMarkdown as mobiToMarkdown } from "@mdgate/mobi";
import JSZip from "jszip";

// Extract cover and metadata from EPUB zip
async function extractEpubMetadata(bytes: Uint8Array): Promise<{
  coverDataUrl: string | null;
  bookTitle: string | null;
  bookAuthor: string | null;
}> {
  try {
    const zip = await JSZip.loadAsync(bytes);

    // 1. Locate OPF file path from container.xml
    const container = zip.file("META-INF/container.xml");
    let opfPath = "";
    if (container) {
      const containerXml = await container.async("text");
      const match = containerXml.match(/full-path=["']([^"']+)["']/i);
      if (match) opfPath = match[1];
    }

    let bookTitle: string | null = null;
    let bookAuthor: string | null = null;
    let coverHref: string | null = null;
    let opfDir = "";

    if (opfPath) {
      const parts = opfPath.split("/");
      parts.pop();
      opfDir = parts.join("/");
      if (opfDir) opfDir += "/";

      const opfFile = zip.file(opfPath);
      if (opfFile) {
        const opfXml = await opfFile.async("text");

        // Extract title
        const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
        if (titleMatch) bookTitle = titleMatch[1].trim();

        // Extract author
        const authorMatch = opfXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
        if (authorMatch) bookAuthor = authorMatch[1].trim();

        // Find cover image (EPUB 3: properties="cover-image")
        const ep3Match =
          opfXml.match(/<item[^>]+properties=["'][^"']*cover-image[^"']*["'][^>]+href=["']([^"']+)["']/i) ||
          opfXml.match(/<item[^>]+href=["']([^"']+)["'][^>]+properties=["'][^"']*cover-image[^"']*["']/i);

        if (ep3Match) {
          coverHref = ep3Match[1];
        } else {
          // EPUB 2: <meta name="cover" content="id"/>
          const ep2Match =
            opfXml.match(/<meta[^>]+name=["']cover["'][^>]+content=["']([^"']+)["']/i) ||
            opfXml.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']cover["']/i);

          if (ep2Match) {
            const coverId = ep2Match[1];
            const itemMatch =
              opfXml.match(new RegExp(`<item[^>]+id=["']${coverId}["'][^>]+href=["']([^"']+)["']`, "i")) ||
              opfXml.match(new RegExp(`<item[^>]+href=["']([^"']+)["'][^>]+id=["']${coverId}["']`, "i"));
            if (itemMatch) coverHref = itemMatch[1];
          }
        }
      }
    }

    let coverDataUrl: string | null = null;

    if (coverHref) {
      const resolved = (opfDir + decodeURIComponent(coverHref)).replace(/\/\.\//g, "/");
      const file = zip.file(resolved) || zip.file(decodeURIComponent(coverHref));
      if (file) {
        const buffer = await file.async("nodebuffer");
        const ext = resolved.split(".").pop()?.toLowerCase();
        const mime = ext === "png" ? "image/png" : "image/jpeg";
        coverDataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
      }
    }

    // Fallback: search for any image with "cover" in its filename
    if (!coverDataUrl) {
      for (const filename of Object.keys(zip.files)) {
        if (filename.match(/cover[s]?\.(jpg|jpeg|png|webp)$/i) && !zip.files[filename].dir) {
          const file = zip.file(filename);
          if (file) {
            const buffer = await file.async("nodebuffer");
            const ext = filename.split(".").pop()?.toLowerCase();
            const mime = ext === "png" ? "image/png" : "image/jpeg";
            coverDataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
            break;
          }
        }
      }
    }

    return { coverDataUrl, bookTitle, bookAuthor };
  } catch (err) {
    console.warn("Could not extract EPUB metadata:", err);
    return { coverDataUrl: null, bookTitle: null, bookAuthor: null };
  }
}

// Extract cover from MOBI / AZW3 buffer (first image in PalmDB records)
function extractMobiCover(buf: Buffer): string | null {
  try {
    if (buf.length < 78) return null;
    const numRecords = buf.readUInt16BE(76);
    for (let i = 0; i < Math.min(numRecords, 500); i++) {
      const offsetPos = 78 + i * 8;
      if (offsetPos + 4 > buf.length) break;
      const offset = buf.readUInt32BE(offsetPos);
      if (offset + 4 > buf.length) continue;

      // Check for JPEG: 0xFF, 0xD8, 0xFF
      if (buf[offset] === 0xff && buf[offset + 1] === 0xd8 && buf[offset + 2] === 0xff) {
        const nextOffset = i + 1 < numRecords ? buf.readUInt32BE(78 + (i + 1) * 8) : buf.length;
        const imgBuf = buf.subarray(offset, Math.min(nextOffset, offset + 2 * 1024 * 1024));
        return `data:image/jpeg;base64,${imgBuf.toString("base64")}`;
      }

      // Check for PNG: 0x89, 0x50, 0x4E, 0x47
      if (buf[offset] === 0x89 && buf[offset + 1] === 0x50 && buf[offset + 2] === 0x4e && buf[offset + 3] === 0x47) {
        const nextOffset = i + 1 < numRecords ? buf.readUInt32BE(78 + (i + 1) * 8) : buf.length;
        const imgBuf = buf.subarray(offset, Math.min(nextOffset, offset + 2 * 1024 * 1024));
        return `data:image/png;base64,${imgBuf.toString("base64")}`;
      }
    }
  } catch (err) {
    console.warn("Could not extract MOBI cover:", err);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const nodeBuf = Buffer.from(buffer);

    let markdown = "";
    let cover: string | null = null;
    let detectedTitle: string | null = null;
    let detectedAuthor: string | null = null;

    const filename = file.name.toLowerCase();

    if (filename.endsWith(".epub")) {
      markdown = await epubToMarkdown(bytes);
      const meta = await extractEpubMetadata(bytes);
      cover = meta.coverDataUrl;
      detectedTitle = meta.bookTitle;
      detectedAuthor = meta.bookAuthor;
    } else if (filename.endsWith(".mobi") || filename.endsWith(".azw") || filename.endsWith(".azw3")) {
      markdown = await mobiToMarkdown(bytes);
      cover = extractMobiCover(nodeBuf);
    } else {
      return NextResponse.json(
        { error: "Unsupported file format. Please upload .epub, .mobi, or .azw3" },
        { status: 400 }
      );
    }

    const fallbackTitle = file.name.replace(/\.[^/.]+$/, "");
    const title = detectedTitle || fallbackTitle;
    const author = detectedAuthor || "Unknown Author";

    return NextResponse.json({
      markdown,
      title,
      author,
      cover,
      filename: file.name,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process file" },
      { status: 500 }
    );
  }
}
