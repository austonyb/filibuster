// Thin client for the local ollama HTTP API. The browser never talks to ollama
// directly — everything goes through the Bun backend so we can stream + judge
// server-side and keep CORS simple.

export const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
export const MODEL = process.env.FILIBUSTER_MODEL ?? "gemma3:270m";

export interface GenerateOptions {
  system?: string;
  temperature?: number;
  numPredict?: number;
  stop?: string[];
  signal?: AbortSignal;
  // Continuation: ollama's token context from a prior call. Passing it makes the
  // model CONTINUE rather than start over. onDone receives the new context.
  context?: number[];
  onDone?: (context: number[] | undefined) => void;
}

interface OllamaChunk {
  response?: string;
  done?: boolean;
  context?: number[];
}

function body(prompt: string, opts: GenerateOptions, stream: boolean) {
  return JSON.stringify({
    model: MODEL,
    prompt,
    system: opts.system,
    stream,
    ...(opts.context ? { context: opts.context } : {}),
    options: {
      temperature: opts.temperature ?? 0.9,
      num_predict: opts.numPredict ?? 96,
      // Push variety / suppress the verbatim-restart problem on the tiny model.
      top_p: 0.95,
      top_k: 64,
      repeat_penalty: 1.4,
      repeat_last_n: 256,
      ...(opts.stop ? { stop: opts.stop } : {}),
    },
  });
}

/** Stream a generation, yielding response chunks (NDJSON) as they arrive. */
export async function* generateStream(
  prompt: string,
  opts: GenerateOptions = {},
): AsyncGenerator<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body(prompt, opts, true),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`ollama generate failed: HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let obj: OllamaChunk;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      if (obj.response) yield obj.response;
      if (obj.done) {
        opts.onDone?.(obj.context);
        return;
      }
    }
  }
}

/** One-shot generation; returns the full trimmed response. */
export async function generateOnce(
  prompt: string,
  opts: GenerateOptions = {},
): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body(prompt, { temperature: 0.2, numPredict: 8, ...opts }, false),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`ollama generate failed: HTTP ${res.status}`);
  const data = (await res.json()) as { response?: string };
  return (data.response ?? "").trim();
}

/** Returns true if ollama is reachable and the target model is present. */
export async function health(): Promise<{ ok: boolean; model: string; hasModel: boolean }> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) return { ok: false, model: MODEL, hasModel: false };
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const hasModel = !!data.models?.some((m) => m.name === MODEL);
    return { ok: true, model: MODEL, hasModel };
  } catch {
    return { ok: false, model: MODEL, hasModel: false };
  }
}

/** Warm the model into memory so the first in-game prompt isn't slow. */
export async function warmup(): Promise<void> {
  try {
    await generateOnce("Say hi.", { numPredict: 1 });
  } catch {
    // best-effort
  }
}
