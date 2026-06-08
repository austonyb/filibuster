import { serve, type ServerWebSocket } from "bun";
import index from "./src/index.html";
import { WS_PATH, type ClientMessage, type ServerMessage } from "./src/shared/protocol";
import { generateStream, health, warmup } from "./src/server/ollama";
import {
  SENATOR_SYSTEM,
  buildSpeechPrompt,
  buildContinuationPrompt,
  judge,
} from "./src/server/senator";

const PORT = Number(process.env.PORT ?? 3000);

// Per-connection state.
interface WSData {
  recent: string[]; // recent outputs, for rehash detection
  abort: AbortController | null; // cancels an in-flight speech stream
  busy: boolean;
  transcript: string; // full speech so far (continuity tail + end-game recap)
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
    // 1. Stream the senator's ramble. If we have prior context the model
    //    CONTINUES the same speech; otherwise it's the opening salvo.
    send(ws, { type: "speech_start" });
    let full = "";
    let chunkCount = 0;
    const continuing = ws.data.transcript.length > 0;
    for await (const tok of generateStream(
      continuing ? buildContinuationPrompt(prompt) : buildSpeechPrompt(prompt),
      {
        system: SENATOR_SYSTEM,
        numPredict: 160, // paragraph per turn (~9s on qwen3.5:2b); the wall accrues over turns
        temperature: 0.7, // lower so the model follows your topic
        signal: abort.signal,
      },
    )) {
      full += tok;
      chunkCount++;
      send(ws, { type: "speech", token: tok });
    }
    send(ws, { type: "speech_end", text: full, chunkCount });

    // 2. Judge the OUTPUT (what your prompt actually produced) -> approval + steam.
    const j = judge(prompt, full, ws.data.recent);
    send(ws, { type: "judge", ...j });
    ws.data.recent.push(full);
    if (ws.data.recent.length > 4) ws.data.recent.shift();
    ws.data.transcript += (ws.data.transcript ? "\n\n" : "") + full.trim();
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
        data: { recent: [], abort: null, busy: false, transcript: "" } satisfies WSData,
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
          ws.data.transcript = ""; // new run -> fresh speech
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
