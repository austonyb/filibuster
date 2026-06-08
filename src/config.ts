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
export const TUNING = {
  steamMax: 100,
  steamStart: 70,
  steamDrainPerSec: 9, // base drain while talking
  // When the senator is actively streaming speech, steam holds/recovers a bit.
  steamRefillPerChunk: 0.6,
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
