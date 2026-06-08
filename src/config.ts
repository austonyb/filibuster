// Central game constants. Tuning values live here so Phase 6 balancing is one file.

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const COLORS = {
  ink: 0x14110d,
  paper: 0xefe7d3,
  approval: 0xc23b22,
  steam: 0x2e6e8e,
} as const;

export const PORTRAIT_COUNT = 20;
export const portraitKey = (n: number) => `portrait_${String(n).padStart(2, "0")}`;
export const portraitPath = (n: number) =>
  `/assets/strangers/portrait_${String(n).padStart(2, "0")}.png`;

// Placeholder tuning — refined in Phase 4/6.
export const TUNING = {
  steamMax: 100,
  steamDrainPerSec: 8,
  approvalStart: 60,
  approvalMax: 100,
} as const;
