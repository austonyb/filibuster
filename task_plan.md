# Task Plan: Filibuster (game)

## Goal
Build a browser game called **Filibuster** where the player keeps a senator talking by
feeding them the next prompt/topic. A small local LLM (`gemma3:270m` via ollama) generates
the senator's rambling speech from each prompt. The player IS the senator's brain: feed good
prompts to keep the filibuster alive; feed weak/dull ones and the floor turns on you.

Engine: **Phaser.js**. Runtime/bundler/server: **Bun** (`Bun.serve()` + HTML imports, no vite/express).
LLM: **ollama** running `gemma3:270m` locally (API reachable on `localhost:11434`).

## Design (locked with user 2026-06-07)
- **Core mechanic** — Player types the next prompt/topic. gemma3 continues the filibuster speech
  from it. The player's words are the "tokens" that feed the senator.
- **Judging = Approval meter.** Each prompt shifts a Senate/crowd APPROVAL meter. Good/filibuster-worthy
  prompts raise it; dull ones drop it. Hit **0% = gaveled down = lose**. Recoverable, tunable signal
  (not instant death). Scored by gemma3 with a rule-based hybrid/fallback.
- **Time pressure = Live countdown.** A STEAM meter drains while the senator talks. Submit the next
  prompt before it empties. **Two lose conditions: STEAM hits 0, OR APPROVAL hits 0.**
- **Win/lose structure = Defeat the bill.** Each round = hold the floor for a target (time/word count)
  to "kill the bill", then advance to a harder bill (faster drain, stricter judging, more hecklers).
- **Presentation = Senate floor.** Wide scene: one big SPEAKER portrait + a row of audience/heckler
  portraits that react to the approval meter. Speech bubble streams gemma3's words. HUD: STEAM,
  APPROVAL, bill progress, and the prompt input box.

## Assets
- **Strangers Vol 1** (`assets/Strangers Vol 1.zip`) — 20 woodcut B&W 1000x1000 portraits.
  CC-BY-4.0, credit "Francisco Lemos" (link http://lemos.itch.io). Used for SPEAKER + audience/hecklers.
- **GothicVania town** — user mentioned as a background option; NOT yet present on disk. Needs to be
  dropped into `assets/`. Until then, use a simple drawn/placeholder senate-floor background.
- Many other itch.io packs are in `assets/` as zips (Gandalf Hardcore, gangster, zombies, critters,
  WinXp, etc.) — available as fallback/extra flavor, not required for MVP.

## Architecture
- **Backend** (`index.ts`, Bun.serve): serves the HTML/Phaser bundle via HTML imports; exposes a
  WebSocket for the game loop. Bridges to ollama:
  - *Generate*: player prompt + senator persona/context -> stream gemma3 tokens back to the speech bubble.
  - *Judge*: score the prompt's filibuster-worthiness -> APPROVAL delta (gemma3 rating + rule fallback).
- **Frontend** (Phaser): Boot/Preload -> Menu -> Game (senate floor) -> Win/GameOver scenes.
- **Risk**: `gemma3:270m` is tiny — judging/coherence may be unreliable. Mitigate with a rule-based
  scoring layer (length, repetition, on-topic keywords, banned filler) blended with the LLM score.

## Phases
| # | Phase | Status |
|---|-------|--------|
| 1 | Scaffold + asset prep (install phaser, Bun.serve HTML, extract Strangers, dir layout, credits) | complete |
| 2 | Backend ollama bridge (WS protocol, streaming generate, prompt judge + rule fallback, persona) | complete |
| 3 | Phaser scenes + senate-floor layout (Boot/Preload/Menu/Game/Win/GameOver, load assets) | pending |
| 4 | Gameplay systems (STEAM + APPROVAL meters, bill progress, input box, wire WS, lose/win logic) | pending |
| 5 | Feel + polish (crowd reactions, streaming bubble anim, hecklers, woodcut styling, bill escalation) | pending |
| 6 | Testing + balance (bun test for judge/meter math, playtest, tune gemma3 prompts/difficulty) | pending |

## Decisions
- Talk to ollama via its native HTTP API (`/api/generate` with `stream:true`) from the Bun backend;
  the browser never calls ollama directly (keeps CORS/streaming simple, allows server-side judging).
- Two-meter design (STEAM = time, APPROVAL = quality) keeps both user-chosen fail conditions.

## Open Questions / TODO for user
- GothicVania town files for the background — drop into `assets/` if you want them used; otherwise
  MVP ships with a placeholder senate-floor background.

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |
