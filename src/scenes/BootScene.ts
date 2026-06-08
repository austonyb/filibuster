import Phaser from "phaser";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  PORTRAIT_COUNT,
  CSS,
  FONT,
  COLORS,
  portraitKey,
  portraitPath,
} from "../config";

/** Loads all assets, shows a progress bar, then hands off to the Menu. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload() {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    this.add
      .text(cx, cy - 60, "FILIBUSTER", {
        fontFamily: FONT,
        fontSize: "56px",
        color: CSS.paper,
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const barBg = this.add.rectangle(cx, cy + 20, 400, 6, 0x3a352b);
    const bar = this.add
      .rectangle(cx - 200, cy + 20, 0, 6, COLORS.paper)
      .setOrigin(0, 0.5);
    this.load.on("progress", (p: number) => (bar.width = 400 * p));
    this.load.on("complete", () => {
      bar.destroy();
      barBg.destroy();
    });

    for (let i = 1; i <= PORTRAIT_COUNT; i++) {
      this.load.image(portraitKey(i), portraitPath(i));
    }
  }

  create() {
    this.scene.start("Menu");
  }
}
