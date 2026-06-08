import { serve, type ServerWebSocket } from "bun";
import index from "./src/index.html";
import { WS_PATH, type ClientMessage, type ServerMessage } from "./src/shared/protocol";
import { generateStream, health, warmup } from "./src/server/ollama";
import { SENATOR_SYSTEM, buildSpeechPrompt, judge } from "./src/server/senator";

const PORT = Number(process.env.PORT ?? 3000);

// Per-connection state.
interface WSData {
  recent: string[]; // recent prompts, for repetition detection
  abort: AbortController | null; // cancels an in-flight speech stream
  busy: boolean;
}

const send = (ws: ServerWebSocket<WSData>, msg: ServerMessage) =>
  ws.send(JSON.stringify(msg));

async function handleFeed(ws: ServerWebSocket<WSData>, prompt: string) {
  if (ws.data.busy) {
    // Cancel whatever the senator is currently saying and take the new prompt.
    ws.data.abort?.abort();
  }
  ws.data.busy = true;
  const abort = new AbortController();
  ws.data.abort = abort;

  try {
    // 1. Judge the prompt -> approval delta (rules + LLM).
    const j = await judge(prompt, ws.data.recent, abort.signal);
    send(ws, { type: "judge", ...j });

    ws.data.recent.push(prompt);
    if (ws.data.recent.length > 6) ws.data.recent.shift();

    // 2. Stream the senator's continued ramble.
    send(ws, { type: "speech_start" });
    let full = "";
    let chunkCount = 0;
    for await (const tok of generateStream(buildSpeechPrompt(prompt), {
      system: SENATOR_SYSTEM,
      numPredict: 90,
      temperature: 0.95,
      signal: abort.signal,
    })) {
      full += tok;
      chunkCount++;
      send(ws, { type: "speech", token: tok });
    }
    send(ws, { type: "speech_end", text: full, chunkCount });
  } catch (err) {
    if (!abort.signal.aborted) {
      send(ws, { type: "error", message: err instanceof Error ? err.message : String(err) });
    }
  } finally {
    if (ws.data.abort === abort) {
      ws.data.busy = false;
      ws.data.abort = null;
    }
  }
}

const server = serve({
  port: PORT,

  development: {
    hmr: true,
    console: true,
  },

  routes: {
    // Phaser frontend (bundled via HTML import)
    "/": index,

    // WebSocket upgrade for the game loop
    [WS_PATH]: (req, srv) => {
      const ok = srv.upgrade(req, {
        data: { recent: [], abort: null, busy: false } satisfies WSData,
      });
      return ok ? undefined : new Response("Expected a WebSocket upgrade", { status: 426 });
    },

    // Static game assets (portraits, audio, etc.) served from ./public
    "/assets/*": async (req) => {
      const url = new URL(req.url);
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      if (rel.includes("..")) return new Response("Forbidden", { status: 403 });
      const file = Bun.file(`./public/${rel}`);
      if (!(await file.exists())) return new Response("Not found", { status: 404 });
      return new Response(file);
    },

    // Health/info endpoint — also reports ollama/model status
    "/api/health": async () => {
      const llm = await health();
      return Response.json({ ok: true, game: "filibuster", llm });
    },
  },

  websocket: {
    open(ws: ServerWebSocket<WSData>) {
      send(ws, { type: "ready" });
    },
    async message(ws: ServerWebSocket<WSData>, raw) {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        send(ws, { type: "error", message: "bad message" });
        return;
      }
      switch (msg.type) {
        case "feed":
          await handleFeed(ws, msg.prompt);
          break;
        case "reset":
          ws.data.abort?.abort();
          ws.data.recent = [];
          ws.data.busy = false;
          break;
        case "ping":
          send(ws, { type: "pong" });
          break;
      }
    },
    close(ws: ServerWebSocket<WSData>) {
      ws.data.abort?.abort();
    },
  },
});

console.log(`🏛️  Filibuster running at ${server.url}`);
warmup().then(() => console.log("🔥 model warmed"));
