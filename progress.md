# Progress Log: Filibuster

## Session 1 — 2026-06-07 (planning)
- Invoked planning-with-files for the Filibuster game concept.
- Inspected project: Bun project, `index.ts` stub, no phaser yet. ollama up with `gemma3:270m`.
- Inspected `assets/` — all zips. Peeked into Strangers Vol 1: 20 woodcut B&W 1000x1000 portraits,
  CC-BY-4.0 (credit Francisco Lemos). Viewed sample portrait to confirm style.
- Ran design Q&A with user. Locked decisions:
  - Mechanic: player feeds next prompt; gemma3 continues filibuster.
  - Judging: APPROVAL meter (0% = lose).
  - Pressure: live STEAM countdown (also 0 = lose).
  - Structure: defeat-the-bill rounds, escalating.
  - Presentation: senate floor with reacting crowd portraits.
- Verified: ollama API reachable on 11434; phaser NOT installed; GothicVania pack not on disk.
- Wrote task_plan.md, findings.md, progress.md.

### Next up
- Phase 1: `bun add phaser`, set up Bun.serve with HTML imports, extract Strangers Vol 1 into a
  served assets dir, establish scene/dir layout, add CREDITS.

## Session 1 — Phase 1 (scaffold + assets) — COMPLETE
- `bun add phaser` -> phaser@4.1.0 installed.
- Extracted Strangers Vol 1, optimized 20 portraits to 512x512 -> `public/assets/strangers/portrait_01..20.png` (1.9 MB).
- Wrote backend `index.ts`: `Bun.serve()` with HTML import (`/`), static `/assets/*` route (with path-traversal guard), `/api/health`.
- Frontend scaffold: `src/index.html`, `src/styles.css`, `src/main.ts` (Phaser game config), `src/config.ts` (constants/tuning), `src/scenes/BootScene.ts` (Phase-1 proof scene).
- Added `dev`/`start` scripts to package.json. Wrote `CREDITS.md`.
- Smoke test: health=200, HTML bundles (Phaser compiled clean), asset route serves portrait (200 image/png), traversal blocked (404).
- **Visual confirm via agent-browser**: title "FILIBUSTER" + "keep them talking" + portrait render correctly. Screenshot at /tmp/filibuster_phase1.png.
- FINDING: portraits are black-on-transparent (hasAlpha yes) -> invisible on dark bg. Phase 3 will mount them on cream cards (linocut look).
- FIX (user-reported): BootScene loading bar was never removed (lingered as a cream line) + portrait invisible on dark bg.
  -> destroy loader on `load.complete`; mount portrait on a cream paper card w/ ink border. Re-verified visually (/tmp/filibuster_phase1_fixed.png).

### Next up
- Phase 2: backend ollama bridge — WS protocol, streaming `/api/generate`, prompt judge (approval delta) + rule fallback, senator persona/system prompt.

### Errors / blockers
- (none)

### Notes
- Dev server currently running in background on PORT 3007 (pid 49059). Use `bun run dev` for HMR.

## Session 1 — Phase 2 (ollama bridge) — COMPLETE
- Committed Phase 1 as 21bd090 (git init; gitignored raw asset archives; 36 files tracked).
- Wrote `src/shared/protocol.ts` (ClientMessage/ServerMessage, WS_PATH).
- Wrote `src/server/ollama.ts`: generateStream (NDJSON), generateOnce, health, warmup; abort-signal support.
- Wrote `src/server/senator.ts`: SENATOR_SYSTEM persona, buildSpeechPrompt, ruleScore (pure), llmScore,
  combineScore, approvalDelta, verdictFor, judge() pipeline.
- Wired WebSocket into `index.ts`: /ws upgrade, per-conn state (recent prompts, abort, busy),
  feed -> judge -> stream speech; reset/ping; cancel-on-new-feed; warmup on boot; health reports ollama.
- Tests: `tests/senator.test.ts` (10 tests, pure scoring) -> all pass.
- Live WS smoke (/tmp/ws_smoke.ts): senator streams coherent oratory; judging separates good/dead-end prompts.
- BALANCE FIX: reweighted combineScore to rules 0.75 / LLM 0.25 after gemma3:270m rated good bait 0/10.
  Re-verified: "constitution and liberty" -> 7/landed/+9; "ok" -> 0/flop/-20.

### Next up
- Phase 3: Phaser scenes (Boot/Preload/Menu/Game/Win/GameOver) + senate-floor layout (speaker + crowd cards).

### Awaiting from user
- GothicVania town files (optional background) — drop into `assets/` if desired.
