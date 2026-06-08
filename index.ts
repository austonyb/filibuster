import { serve } from "bun";
import index from "./src/index.html";

const PORT = Number(process.env.PORT ?? 3000);

const server = serve({
  port: PORT,
  development: {
    hmr: true,
    console: true,
  },
  routes: {
    // Phaser frontend (bundled via HTML import)
    "/": index,

    // Static game assets (portraits, audio, etc.) served from ./public
    "/assets/*": async (req) => {
      const url = new URL(req.url);
      // strip leading slash, prevent path traversal
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      if (rel.includes("..")) return new Response("Forbidden", { status: 403 });
      const file = Bun.file(`./public/${rel}`);
      if (!(await file.exists())) return new Response("Not found", { status: 404 });
      return new Response(file);
    },

    // Health/info endpoint
    "/api/health": () =>
      Response.json({ ok: true, game: "filibuster", model: "gemma3:270m" }),
  },
});

console.log(`🏛️  Filibuster running at ${server.url}`);
