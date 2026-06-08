// Message protocol shared by the Phaser frontend and the Bun backend.
// Types only — safe to import from both client and server bundles.

export type Verdict = "landed" | "weak" | "flop";

/** Messages the game (client) sends to the server. */
export type ClientMessage =
  | { type: "feed"; prompt: string } // player feeds the senator a topic
  | { type: "reset" } // start a fresh run / abort current speech
  | { type: "ping" };

/** Messages the server sends back to the game. */
export type ServerMessage =
  | { type: "ready" } // socket open, model warmed
  | {
      type: "judge"; // result of scoring the senator's OUTPUT (sent after the speech)
      score: number; // 0..10
      approvalDelta: number; // signed change to apply to the APPROVAL meter
      steamBonus: number; // STEAM awarded for how well the speech landed
      verdict: Verdict;
      reason: string; // short human-readable rationale
    }
  | { type: "speech_start" }
  | { type: "speech"; token: string } // one streamed chunk of senator speech
  | { type: "speech_end"; text: string; chunkCount: number }
  | { type: "error"; message: string }
  | { type: "pong" };

export const WS_PATH = "/ws";
