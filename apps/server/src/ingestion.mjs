import { promises as fs } from "node:fs";
import { basename, extname, join } from "node:path";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { UPLOADS_DIR } from "./config.mjs";
import { generateText, transcribeAudio } from "./providerRuntime.mjs";
import { chunkText } from "./retrieval.mjs";

const safeName = (value) => basename(value).replace(/[^a-zA-Z0-9._-]/g, "_");

const extractPdfText = async (buffer) => {
  const document = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(text);
  }

  return pages.join("\n\n");
};

export const persistUpload = async ({ materialId, fileName, buffer }) => {
  const path = join(UPLOADS_DIR, `${materialId}-${safeName(fileName)}`);
  await fs.writeFile(path, buffer);
  return path;
};

export const extractMaterialText = async ({ mimeType, fileName, buffer, providers }) => {
  const lower = fileName.toLowerCase();

  if (mimeType.startsWith("text/") || [".md", ".txt", ".csv", ".json"].includes(extname(lower))) {
    return { extractedText: buffer.toString("utf8"), processingStatus: "ready" };
  }

  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    try {
      const extractedText = await extractPdfText(buffer);
      return { extractedText, processingStatus: "ready" };
    } catch {
      return { extractedText: "", processingStatus: "pdf_parse_failed" };
    }
  }

  const visionProvider = providers.find(
    (provider) => provider.enabled && (provider.capabilities?.vision || provider.capabilities?.multimodal)
  );
  const transcriptionProvider = providers.find(
    (provider) => provider.enabled && provider.capabilities?.transcription
  );

  if (mimeType.startsWith("image/") && visionProvider) {
    try {
      const extractedText = await generateText({
        provider: visionProvider,
        systemPrompt:
          "You extract academic content from technical images with attention to formulas, axes, labels, and diagram meaning.",
        userPrompt: "Extract all useful academic text, formulas, labels, and diagram cues from this image.",
        temperature: 0,
        image: {
          mimeType,
          base64: buffer.toString("base64")
        }
      });
      return { extractedText, processingStatus: "ready" };
    } catch {
      return { extractedText: "", processingStatus: "provider_required" };
    }
  }

  if (mimeType.startsWith("audio/") && transcriptionProvider) {
    try {
      const extractedText = await transcribeAudio({
        provider: transcriptionProvider,
        fileName,
        mimeType,
        buffer
      });
      return { extractedText, processingStatus: "ready" };
    } catch {
      return { extractedText: "", processingStatus: "provider_required" };
    }
  }

  return { extractedText: "", processingStatus: "provider_required" };
};

export const buildChunks = (text) => chunkText(text || "");
