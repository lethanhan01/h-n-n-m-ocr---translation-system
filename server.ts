import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import net from "net";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GEMINI_API_VERSION = process.env.GEMINI_API_VERSION || "v1beta";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3-flash";
const OCR_PROMPT = `
  You are a highly specialized Hán Nôm OCR engine used for Vietnamese cultural research.
  Analyze the provided image of a Hán Nôm document.
  The text is written vertically (top-to-bottom) and lines are arranged from right-to-left.

  Tasks:
  1. Perform OCR to extract Hán Nôm characters exactly as they appear.
  2. Format the Hán Nôm characters into logical horizontal lines. Use a SINGLE NEWLINE (\\n) to separate lines.
  3. Provide the Sino-Vietnamese readings (Âm Hán Việt) for each line. Ensure the number of lines in sinoVietnamese MATCHES exactly the number of lines in verticalText. Do not use [N] markers in the raw string for sinoVietnamese, just provide the text per line.
  4. Provide a full translation into modern Vietnamese as a natural paragraph.

  Output only a JSON object with the following keys:
  - verticalText: string (Original Hán Nôm text, one line per array element/line)
  - sinoVietnamese: string (Sino-Vietnamese readings, one line per array element/line matching verticalText)
  - modernVietnamese: string (Full translation into modern Vietnamese)
  - confidence: number (0 to 1)
  - tokens: array of objects { char: string, confidence: number }
`;

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
}

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(findAvailablePort(startPort + 1));
    });

    server.once("listening", () => {
      server.close(() => resolve(startPort));
    });

    server.listen(startPort, "0.0.0.0");
  });
}

async function startServer() {
  const app = express();
  const DEFAULT_PORT = 3000;
  const DEFAULT_HMR_PORT = 24678;

  const PORT = await findAvailablePort(DEFAULT_PORT);
  const HMR_PORT = await findAvailablePort(DEFAULT_HMR_PORT);

  app.use(express.json({ limit: "50mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Hán Nôm OCR Server is active" });
  });

  app.post("/api/gemini/ocr", async (req, res) => {
    const { imageBase64, mimeType = "image/jpeg" } = req.body ?? {};
    const apiKey = getGeminiApiKey();

    if (!apiKey) {
      res.status(500).json({ error: "Gemini API key is not configured." });
      return;
    }

    if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
      res.status(400).json({ error: "imageBase64 is required." });
      return;
    }

    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: OCR_PROMPT },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: imageBase64,
                    },
                  },
                ],
              },
            ],
          }),
        },
      );

      const geminiPayload = await geminiResponse.json().catch(() => ({}));

      if (!geminiResponse.ok) {
        console.error("Gemini API request failed:", geminiPayload);
        res.status(geminiResponse.status).json({
          error: geminiPayload?.error?.message || "Gemini API request failed.",
        });
        return;
      }

      const text = geminiPayload?.candidates?.[0]?.content?.parts?.find(
        (part: { text?: unknown }) => typeof part.text === "string",
      )?.text;

      if (!text) {
        res.status(502).json({ error: "Gemini response did not include text output." });
        return;
      }

      res.json({ text });
    } catch (error) {
      console.error("Gemini OCR proxy failed:", error);
      res.status(502).json({ error: "Unable to reach Gemini OCR service." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          port: HMR_PORT,
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    if (process.env.NODE_ENV !== "production") {
      console.log(`✅ Vite HMR listening on port ${HMR_PORT}`);
    }
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
