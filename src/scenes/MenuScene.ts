import Phaser from "phaser";
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  CSS,
  FONT,
  COLORS,
  DIFFICULTIES,
  DIFFICULTY_KEY,
  portraitKey,
} from "../config";
import { PortraitCard } from "../ui/PortraitCard";

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

    this.buildDifficultySlider(cx, 500);

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

  /** ◀ NAME ▶ with a row of notches (more red = hotter chamber). */
  private buildDifficultySlider(cx: number, y: number) {
    const n = DIFFICULTIES.length;
    let idx = (this.registry.get(DIFFICULTY_KEY) as number) ?? 0;

    this.add
      .text(cx, y - 40, "DIFFICULTY  (← / →)", { fontFamily: FONT, fontSize: "15px", color: CSS.muted })
      .setOrigin(0.5);
    const nameT = this.add
      .text(cx, y - 6, "", { fontFamily: FONT, fontSize: "30px", color: CSS.gold, fontStyle: "bold" })
      .setOrigin(0.5);
    const descT = this.add
      .text(cx, y + 24, "", { fontFamily: FONT, fontSize: "16px", color: CSS.muted })
      .setOrigin(0.5);

    const trackW = 240;
    const x0 = cx - trackW / 2;
    const notches: Phaser.GameObjects.Rectangle[] = [];
    for (let i = 0; i < n; i++) {
      const x = x0 + trackW * (i / (n - 1));
      const dot = this.add
        .rectangle(x, y + 56, 18, 18, COLORS.muted)
        .setStrokeStyle(2, COLORS.ink)
        .setInteractive({ useHandCursor: true });
      dot.on("pointerdown", () => { idx = i; render(); });
      notches.push(dot);
    }

    const arrow = (x: number, ch: string, delta: number) =>
      this.add
        .text(x, y + 56, ch, { fontFamily: FONT, fontSize: "30px", color: CSS.paper })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => change(delta));
    arrow(x0 - 42, "◀", -1);
    arrow(x0 + trackW + 42, "▶", 1);

    const render = () => {
      const d = DIFFICULTIES[idx];
      nameT.setText(d.name);
      descT.setText(d.desc + (idx === 0 ? "  (easiest)" : idx === n - 1 ? "  (hardest)" : ""));
      notches.forEach((dot, i) => dot.setFillStyle(i <= idx ? COLORS.approval : COLORS.muted));
      this.registry.set(DIFFICULTY_KEY, idx);
    };
    const change = (delta: number) => { idx = Phaser.Math.Clamp(idx + delta, 0, n - 1); render(); };

    this.input.keyboard?.on("keydown-LEFT", () => change(-1));
    this.input.keyboard?.on("keydown-RIGHT", () => change(1));
    render();
  }
}
