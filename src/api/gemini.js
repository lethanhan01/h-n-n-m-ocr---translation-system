function extractJsonObject(text) {
  if (typeof text !== "string") {
    throw new Error("Gemini response text is missing.");
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
    throw new Error("Gemini response did not contain a JSON object.");
  }

  return JSON.parse(text.substring(firstBrace, lastBrace + 1));
}

function requireString(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Gemini response field "${fieldName}" is missing.`);
  }

  return value;
}

function normalizeConfidence(value, fallback = 0) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, numberValue));
}

function normalizeTokens(tokens, verticalText, confidence) {
  if (Array.isArray(tokens)) {
    const normalizedTokens = tokens
      .map((token) => ({
        char: typeof token?.char === "string" ? token.char : "",
        confidence: normalizeConfidence(token?.confidence, confidence),
      }))
      .filter((token) => token.char.length > 0);

    if (normalizedTokens.length > 0) {
      return normalizedTokens;
    }
  }

  return Array.from(verticalText.replace(/\s/g, "")).map((char) => ({
    char,
    confidence,
  }));
}

export function parseRecognitionResult(text) {
  const data = extractJsonObject(text);
  const verticalText = requireString(data.verticalText, "verticalText");
  const sinoVietnamese = requireString(data.sinoVietnamese, "sinoVietnamese");
  const modernVietnamese = requireString(data.modernVietnamese, "modernVietnamese");
  const confidence = normalizeConfidence(data.confidence);

  return {
    verticalText,
    sinoVietnamese,
    modernVietnamese,
    confidence,
    tokens: normalizeTokens(data.tokens, verticalText, confidence),
  };
}

export async function recognizeHanNomImage({ imageBase64, mimeType }) {
  const response = await fetch("/api/gemini/ocr", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageBase64, mimeType }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Gemini OCR request failed.");
  }

  return parseRecognitionResult(payload.text);
}
