import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { DEFAULT_ANTHROPIC_MODEL, getSettings } from "./settings-manager.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function sanitizeTitle(raw: string): string | null {
  const title = raw.replace(/^"|"$/g, "").replace(/^'|'$/g, "").trim();
  if (!title || title.length >= 100) return null;
  return title;
}

/** Resolve auth from settings → env vars → Claude Code OAuth credentials file. */
function resolveAuth(): { headers: Record<string, string> } | null {
  // 1. Explicit API key in Companion settings
  const settingsKey = getSettings().anthropicApiKey.trim();
  if (settingsKey) {
    return { headers: { "x-api-key": settingsKey } };
  }

  // 2. ANTHROPIC_API_KEY env var
  const envKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (envKey) {
    return { headers: { "x-api-key": envKey } };
  }

  // 3. ANTHROPIC_AUTH_TOKEN env var (OAuth)
  const envToken = process.env.ANTHROPIC_AUTH_TOKEN?.trim();
  if (envToken) {
    return { headers: { "Authorization": `Bearer ${envToken}` } };
  }

  // 4. Claude Code OAuth credentials file
  try {
    const credPath = join(homedir(), ".claude", ".credentials.json");
    const creds = JSON.parse(readFileSync(credPath, "utf-8")) as {
      claudeAiOauth?: { accessToken?: string; expiresAt?: number };
    };
    const token = creds.claudeAiOauth?.accessToken?.trim();
    const expiresAt = creds.claudeAiOauth?.expiresAt ?? 0;
    if (token && expiresAt > Date.now()) {
      return { headers: { "Authorization": `Bearer ${token}` } };
    }
  } catch {
    // credentials file absent or unreadable — not an error
  }

  return null;
}

/**
 * Generates a short session title using the Anthropic Messages API.
 * Returns null if no auth is available or if generation fails.
 */
export async function generateSessionTitle(
  firstUserMessage: string,
  _model: string,
  options?: {
    timeoutMs?: number;
  },
): Promise<string | null> {
  const timeout = options?.timeoutMs || 15_000;

  const auth = resolveAuth();
  if (!auth) {
    return null;
  }

  const model = getSettings().anthropicModel?.trim() || DEFAULT_ANTHROPIC_MODEL;
  const truncated = firstUserMessage.slice(0, 500);
  const userPrompt = `Generate a concise 3-5 word session title for this user request. Output only the title.\n\nRequest: ${truncated}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        ...auth.headers,
      },
      body: JSON.stringify({
        model,
        max_tokens: 256,
        messages: [{ role: "user", content: userPrompt }],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[auto-namer] Anthropic request failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json() as {
      content?: Array<{ type: string; text?: string }>;
    };

    const raw = data.content?.[0]?.type === "text"
      ? (data.content[0].text ?? "")
      : "";
    return sanitizeTitle(raw);
  } catch (err) {
    console.warn("[auto-namer] Failed to generate session title:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
