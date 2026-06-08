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

## Session 1 — Phase 3 + playtest fixes — COMPLETE (Phase 4 networking pulled in)
- Scenes: Boot (preload), Menu, Game (senate floor), End. Registered in main.ts.
- UI components: PortraitCard (cream cards + say() canned bubbles), Meter, SpeechPanel (scrolling wall,
  front-trim since Phaser4 dropped WebGL masks), PromptInput (canvas keyboard capture).
- Wall-of-text pivot: large scrolling speech panel is the hero; speaker+meters+crowd in left column.
- Wired live WS into GameScene (NetClient): feed -> judge ruling + crowd heckles -> streamed wall.
- Playtest fixes round 1:
  * Continuous speech via ollama `context` (no restart/verbatim); +creativity opts (repeat_penalty/top_p/top_k).
  * Opening prompt starts the clock (started flag; update() idles until first feed).
  * Crowd speech bubbles with canned reactions by verdict (CROWD_REACTIONS pools).
  * FIXED new-game-input-ignored: field `this.input` shadowed Phaser `scene.input`; renamed to `promptBox`.
  * Switched dev server to `bun --hot` (server hot-reload; no manual restarts).
- Verified in-browser (r_bubbles.png): feed, LANDED +9 ruling, crowd "Hear hear!/Bravo!/Tell em!", streaming
  wall, meters. Continuation verified via WS (/tmp/ws_cont.ts).
- Tooling note: agent-browser `press <letter>`/`keyboard type` don't reach window keydown + sometimes spawn an
  about:blank tab (blank screenshots). Drive Phaser input via `eval` dispatching KeyboardEvent (incl keyCode for Enter).

### To verify with user (couldn't auto-capture restart cleanly due to about:blank tooling)
- New-game input now works after the `promptBox` rename (high confidence by root-cause).

### Known follow-ups (Phase 5/6)
- Balance: one good prompt currently sustains a long time (steam refill generous). Tune drain/refill.
- Senator sometimes drifts to 3rd-person narration ("Senator Johnson…") on continuation — refine persona if desired.

## Session 1 — Phase 6 start: output judging + tuning
- Per user: judge the senator's OUTPUT, not the prompt. Rewrote senator.ts:
  scoreOutput(length+non-repetition+topicality, penalties for rehash/filler); judge() now over output.
  Removed llmScore/combineScore. Added steamBonus(score). Reasons match verdict.
- index.ts: stream speech first, then judge output; push outputs (not prompts) into recent for rehash detection.
- protocol: judge msg gains steamBonus.
- config TUNING: steam model (idle drain 8, talkDrainMult 0.35, start 75); GameScene applies steamBonus + flash,
  talking-aware drain; ruling shows "+N steam".
- Topic-weaving prompts so the senator names/returns to the topic (responsive + topicality signal).
- Tests: 16 pass (added scoreOutput/steamBonus/judge-over-output cases; removed combineScore test).
- Verified live (ws_judge.ts): rich->LANDED +9/+33, "ok"->WEAK, drift+rehash->WEAK +0. In-browser confirmed.
- --hot caveat learned: server-logic module edits (src/server/*) need a restart; frontend HMR is fine.

### Awaiting from user
- Playtest the new judging/difficulty and tell me too-hard/too-easy + feel. Knobs in config.ts TUNING + BILLS.
- GothicVania town files (optional background) — drop into `assets/` if desired.
