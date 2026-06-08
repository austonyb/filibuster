import Phaser from "phaser";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  PORTRAIT_COUNT,
  portraitKey,
  portraitPath,
} from "../config";

/**
 * Phase 1 placeholder boot scene.
 * Loads the Strangers portraits and renders a proof-of-pipeline screen
 * (title + one portrait) to confirm the Bun + Phaser + assets toolchain works
 * end to end. Real scene flow (Preload -> Menu -> Game) lands in Phase 3.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    const barBg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 400, 6, 0x3a352b);
    const bar = this.add.rectangle(
      GAME_WIDTH / 2 - 200,
      GAME_HEIGHT / 2,
      0,
      6,
      0xefe7d3,
    ).setOrigin(0, 0.5);
    this.load.on("progress", (p: number) => {
      bar.width = 400 * p;
    });
    // Remove the loader UI once everything is in — otherwise it lingers on screen.
    this.load.on("complete", () => {
      bar.destroy();
      barBg.destroy();
    });

    for (let i = 1; i <= PORTRAIT_COUNT; i++) {
      this.load.image(portraitKey(i), portraitPath(i));
    }
  }

  create() {
    this.add
      .text(GAME_WIDTH / 2, 120, "FILIBUSTER", {
        fontFamily: "Courier New, monospace",
        fontSize: "72px",
        color: "#efe7d3",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 190, "keep them talking", {
        fontFamily: "Courier New, monospace",
        fontSize: "24px",
        color: "#c23b22",
      })
      .setOrigin(0.5);

    // Proof the portrait assets loaded and render. Portraits are black ink on a
    // transparent background, so mount on a cream "paper" card to read on the dark bg
    // (this is the linocut look the real senate floor will use).
    const cx = GAME_WIDTH / 2;
    const cy = 440;
    this.add
      .rectangle(cx, cy, 340, 340, 0xefe7d3)
      .setStrokeStyle(6, 0x14110d);
    const speaker = this.add.image(cx, cy, portraitKey(1));
    speaker.setDisplaySize(320, 320);

    this.add
      .text(GAME_WIDTH / 2, 650, "Phase 1 scaffold OK — art: Francisco Lemos (CC-BY-4.0)", {
        fontFamily: "Courier New, monospace",
        fontSize: "16px",
        color: "#8a8470",
      })
      .setOrigin(0.5);
  }
}
