import { GoogleGenAI } from "@google/genai";

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(err: any): boolean {
  const code =
    err?.status ||
    err?.error?.code ||
    err?.error?.status ||
    err?.response?.status;

  return code === 503 || code === "UNAVAILABLE";
}


type GenResponse = {
  text: string | null;
  raw: any;
};

function extractTextFromResponse(resp: any): string | null {
  try {
    if (!resp) return null;
    if (typeof resp.text === "string" && resp.text.length) return resp.text;
    if (typeof resp.outputText === "string" && resp.outputText.length) return resp.outputText;

    const cand = resp.candidates?.[0];
    if (cand?.content?.parts && Array.isArray(cand.content.parts)) {
      const parts = cand.content.parts.map((p: any) => p?.text || "").filter((s: string) => s.length > 0);
      if (parts.length) return parts.join("\n\n");
    }

    if (Array.isArray(resp.output) && resp.output.length) {
      const texts = resp.output.map((o: any) => o.text || "").filter((s: string) => s.length);
      if (texts.length) return texts.join("\n\n");
    }

    const s = JSON.stringify(resp);
    return s.length ? s : null;
  } catch (e) {
    console.error("extractTextFromResponse error", e);
    return null;
  }
}

/**
 * generateFromInlineData
 * @param apiKey Gemini API key
 * @param model model id (string)
 * @param prompt user prompt (string)
 * @param mimeType file mime type (e.g. application/pdf)
 * @param base64Data base64 string (without data: prefix)
 */
export async function generateFromInlineData(
  apiKey: string,
  model: string,
  prompt: string,
  mimeType: string,
  base64Data: string,
  retryIntervalSec: number,
  maxRetryWaitSec: number
): Promise<GenResponse> {

  const ai = new (GoogleGenAI as any)({ apiKey });

  const contents = [
    {
      role: "user",
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType,
            data: base64Data
          }
        }
      ]
    }
  ];

  const retryIntervalMs = retryIntervalSec * 1000;
  const maxRetryWaitMs = maxRetryWaitSec * 1000;

  let elapsedMs = 0;
  let lastError: any = null;
  let attempt = 0;

  while (elapsedMs <= maxRetryWaitMs) {
    attempt++;
    try {
      console.log(`Gemini attempt ${attempt}`);
      const resp = await ai.models.generateContent({
        model,
        contents
      });

      const text = extractTextFromResponse(resp);
      return { text, raw: resp };

    } catch (err: any) {
      console.error(`Gemini error (attempt ${attempt})`, err);
      lastError = err;

      if (!isRetryableError(err)) {
        throw err;
      }

      if (elapsedMs + retryIntervalMs > maxRetryWaitMs) {
        break;
      }

      await sleep(retryIntervalMs);
      elapsedMs += retryIntervalMs;
    }
  }

  throw lastError;
}
