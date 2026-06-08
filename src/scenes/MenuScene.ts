import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, CSS, FONT, COLORS, portraitKey } from "../config";
import { PortraitCard } from "../ui/PortraitCard";
import { addDifficultySlider } from "../ui/DifficultySlider";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("Menu");
  }

  create() {
    const cx = GAME_WIDTH / 2;
    this.cameras.main.setBackgroundColor(COLORS.ink);

    this.add
      .text(cx, 84, "FILIBUSTER", { fontFamily: FONT, fontSize: "82px", color: CSS.paper, fontStyle: "bold" })
      .setOrigin(0.5);
    this.add
      .text(cx, 146, "keep them talking", { fontFamily: FONT, fontSize: "26px", color: CSS.approval })
      .setOrigin(0.5);

    new PortraitCard(this, cx - 190, 290, portraitKey(3), 130).startIdle(0);
    new PortraitCard(this, cx, 305, portraitKey(7), 170).startIdle(200);
    new PortraitCard(this, cx + 190, 290, portraitKey(12), 130).startIdle(400);

    this.add
      .text(cx, 408, "Feed the senator topics. Keep the STEAM up and the\nfloor's APPROVAL high. Run dry or get gaveled down — you lose.", {
        fontFamily: FONT, fontSize: "17px", color: CSS.muted, align: "center",
      })
      .setOrigin(0.5);

    addDifficultySlider(this, cx, 500);

    const start = this.add
      .text(cx, 622, "▶  PRESS ENTER OR CLICK TO TAKE THE FLOOR", {
        fontFamily: FONT, fontSize: "23px", color: CSS.gold, fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: start, alpha: { from: 1, to: 0.4 }, duration: 700, yoyo: true, repeat: -1 });

    this.add
      .text(cx, GAME_HEIGHT - 20, "art: Francisco Lemos (CC-BY-4.0)  •  voice: qwen3.5:2b via ollama", {
        fontFamily: FONT, fontSize: "13px", color: CSS.muted,
      })
      .setOrigin(0.5);

    const begin = () => this.scene.start("Game");
    start.on("pointerdown", begin);
    this.input.keyboard?.once("keydown-ENTER", begin);
  }
}
