import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, CSS, FONT, COLORS, portraitKey } from "../config";
import { PortraitCard } from "../ui/PortraitCard";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("Menu");
  }

  create() {
    const cx = GAME_WIDTH / 2;
    this.cameras.main.setBackgroundColor(COLORS.ink);

    this.add
      .text(cx, 130, "FILIBUSTER", {
        fontFamily: FONT,
        fontSize: "92px",
        color: CSS.paper,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 205, "keep them talking", {
        fontFamily: FONT,
        fontSize: "28px",
        color: CSS.approval,
      })
      .setOrigin(0.5);

    // A trio of strangers eyeing the floor.
    new PortraitCard(this, cx - 200, 380, portraitKey(3), 150).startIdle(0);
    new PortraitCard(this, cx, 400, portraitKey(7), 200).startIdle(200);
    new PortraitCard(this, cx + 200, 380, portraitKey(12), 150).startIdle(400);

    this.add
      .text(cx, 540, "Feed the senator topics. Keep the STEAM up and the\nfloor's APPROVAL high. Run dry or get gaveled down — you lose.", {
        fontFamily: FONT,
        fontSize: "18px",
        color: CSS.muted,
        align: "center",
      })
      .setOrigin(0.5);

    const start = this.add
      .text(cx, 630, "▶  PRESS ENTER OR CLICK TO TAKE THE FLOOR", {
        fontFamily: FONT,
        fontSize: "24px",
        color: CSS.gold,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: start, alpha: { from: 1, to: 0.4 }, duration: 700, yoyo: true, repeat: -1 });

    this.add
      .text(cx, GAME_HEIGHT - 24, "art: Francisco Lemos (CC-BY-4.0)  •  voice: qwen3.5:2b via ollama", {
        fontFamily: FONT,
        fontSize: "13px",
        color: CSS.muted,
      })
      .setOrigin(0.5);

    const begin = () => this.scene.start("Game");
    start.on("pointerdown", begin);
    this.input.keyboard?.once("keydown-ENTER", begin);
  }
}
