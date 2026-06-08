// Central game constants. Tuning + layout live here so balancing is one file.

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// Numeric colors for Phaser fills.
export const COLORS = {
  ink: 0x14110d,
  paper: 0xefe7d3,
  parchment: 0xe4d9bd,
  muted: 0x8a8470,
  approval: 0xc23b22,
  approvalLow: 0x7a1f12,
  steam: 0x2e6e8e,
  steamLow: 0x1c4456,
  gold: 0xc9a227,
} as const;

// String colors for text styles / CSS.
export const CSS = {
  ink: "#14110d",
  paper: "#efe7d3",
  muted: "#8a8470",
  approval: "#c23b22",
  steam: "#5fa8ca",
  gold: "#c9a227",
} as const;

export const FONT = "Courier New, monospace";

export const PORTRAIT_COUNT = 20;
export const portraitKey = (n: number) => `portrait_${String(n).padStart(2, "0")}`;
export const portraitPath = (n: number) =>
  `/assets/strangers/portrait_${String(n).padStart(2, "0")}.png`;

// --- Gameplay tuning --------------------------------------------------------
// STEAM model: drains fast while you're idle (feed another topic!), drains
// gently while the senator is talking, and is refilled by a quality bonus
// (steamBonus, server-side) when a speech lands. Good topics = breathing room.
export const TUNING = {
  steamMax: 100,
  steamStart: 80,
  steamDrainPerSec: 3.5, // idle drain (scaled per bill) — slow enough to type a prompt
  talkDrainMult: 0.3, // drain multiplier while the senator is streaming (nearly paused)
  approvalStart: 55,
  approvalMax: 100,
  crowdSize: 7,
} as const;

// Canned crowd reactions, pulled by verdict when a prompt is judged.
export const CROWD_REACTIONS: Record<"landed" | "weak" | "flop", string[]> = {
  landed: ["Hear, hear!", "Well said!", "Go on!", "Bravo!", "Tell 'em!", "Amen!", "Quite right!", "Yes!"],
  weak: ["Hmm.", "...go on?", "Eh.", "Mhm.", "I suppose.", "*yawn*", "Get to it.", "So?"],
  flop: ["Nonsense!", "Nope!", "Sit down!", "Boo!", "Order!", "Rubbish!", "Oh, please.", "Wrap it up!"],
};

export interface Bill {
  id: string;
  title: string;
  holdSeconds: number; // hold the floor this long to kill the bill
  steamDrainMult: number;
  approvalDrainPerSec: number; // passive approval bleed (hecklers)
}

// Escalating bills. Phase 4 advances through these on a win.
export const BILLS: Bill[] = [
  { id: "HR-0001", title: "The Daylight Savings Repeal Act", holdSeconds: 30, steamDrainMult: 1.0, approvalDrainPerSec: 0.8 },
  { id: "S-0042", title: "The Mandatory Broccoli Act", holdSeconds: 45, steamDrainMult: 1.2, approvalDrainPerSec: 1.2 },
  { id: "HR-1138", title: "The Sentient Toaster Regulation Act", holdSeconds: 60, steamDrainMult: 1.4, approvalDrainPerSec: 1.6 },
];

// --- Difficulty ------------------------------------------------------------
// Index 0 is the easiest (= the original tuning). Harder tiers drain faster,
// reward less, punish more, and make the gallery meaner (heckle negatively even
// when the speech lands). Selected on the menu, stored in the Phaser registry.
export interface Difficulty {
  name: string;
  desc: string;
  steamDrainMult: number; // x idle steam drain
  approvalDrainMult: number; // x heckler approval bleed
  approvalStart: number; // starting approval
  rewardMult: number; // x positive approval + steam bonus (lower = harder)
  penaltyMult: number; // x negative approval delta (higher = harder)
  meanness: number; // chance a crowd member heckles negatively regardless of verdict
}

export const DIFFICULTIES: Difficulty[] = [
  { name: "GENTLE",  desc: "a sympathetic chamber",          steamDrainMult: 1.0, approvalDrainMult: 1.0, approvalStart: 60, rewardMult: 1.0,  penaltyMult: 1.0, meanness: 0.0 },
  { name: "ORDERLY", desc: "polite, but watching the clock", steamDrainMult: 1.3, approvalDrainMult: 1.5, approvalStart: 56, rewardMult: 0.9,  penaltyMult: 1.25, meanness: 0.2 },
  { name: "ROWDY",   desc: "the hecklers are warming up",    steamDrainMult: 1.6, approvalDrainMult: 2.0, approvalStart: 52, rewardMult: 0.8,  penaltyMult: 1.5, meanness: 0.4 },
  { name: "UNRULY",  desc: "a hostile floor",               steamDrainMult: 2.0, approvalDrainMult: 2.6, approvalStart: 48, rewardMult: 0.7,  penaltyMult: 1.85, meanness: 0.6 },
  { name: "BEDLAM",  desc: "open revolt — good luck",        steamDrainMult: 2.5, approvalDrainMult: 3.2, approvalStart: 44, rewardMult: 0.6,  penaltyMult: 2.2, meanness: 0.8 },
];

export const DIFFICULTY_KEY = "difficulty"; // Phaser registry key (stores the index)
