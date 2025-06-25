import { SearchResult, Document } from "@/lib/types";
import axios from "axios";
import { htmlToText } from "html-to-text";
import { v4 as uuidv4 } from "uuid";

// CRITICAL: NO 'import pdf from "pdf-parse"' at the top of the file.

// This variable will hold the module after it's loaded for the first time.
let pdfParser: any = null;

export async function fetchAndParseContent(
  result: SearchResult
): Promise<Document | null> {
  try {
    const response = await axios.get<Buffer>(result.url, {
      responseType: "arraybuffer",
      timeout: 15000,
    });

    const contentType = response.headers["content-type"] || "";
    let text: string;

    if (contentType.includes("application/pdf")) {
      // DYNAMIC IMPORT: Load 'pdf-parse' only when a PDF is actually being processed.
      if (!pdfParser) {
        // This tells Node.js to load the module at runtime.
        pdfParser = (await import("pdf-parse")).default;
      }

      const data = await pdfParser(response.data);
      text = data.text;
    } else {
      text = htmlToText(response.data.toString("utf-8"), {
        wordwrap: false,
        selectors: [
          { selector: "a", options: { ignoreHref: true } },
          { selector: "img", format: "skip" },
        ],
      });
    }

    if (!text.trim()) {
      console.warn(`DOCUMENT_EMPTY: url=${result.url}`);
      return null;
    }

    const document: Document = {
      id: uuidv4(),
      text: text.replace(/\s\s+/g, " ").trim(),
      metadata: {
        title: result.title,
        url: result.url,
        publishedAt: result.publishedAt,
      },
    };

    console.log(`DOCUMENT_FETCHED: url=${result.url}`);
    return document;
  } catch (error: any) {
    console.error(
      `DOCUMENT_FAILED: url=${result.url}, message=${error.message}`
    );
    return null;
  }
}
