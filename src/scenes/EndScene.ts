import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, CSS, FONT, COLORS, portraitKey } from "../config";
import { PortraitCard } from "../ui/PortraitCard";
import { addDifficultySlider } from "../ui/DifficultySlider";
import type { Turn } from "./GameScene";

interface EndData {
  won: boolean;
  reason: string;
  billsKilled: number;
  summary: string;
  turns: Turn[];
}

export class EndScene extends Phaser.Scene {
  constructor() {
    super("End");
  }

  create(data: EndData) {
    const cx = GAME_WIDTH / 2;
    this.cameras.main.setBackgroundColor(COLORS.ink);
    const ui: Phaser.GameObjects.GameObject[] = []; // objects the transcript camera must ignore
    const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => { ui.push(o); return o; };

    const headline = data.won ? "FILIBUSTER VICTORIOUS" : "GAVELED DOWN";
    keep(this.add.text(cx, 28, headline, {
      fontFamily: FONT, fontSize: "48px", color: data.won ? CSS.gold : CSS.approval, fontStyle: "bold",
    }).setOrigin(0.5, 0));

    keep(new PortraitCard(this, 90, 130, portraitKey(data.won ? 7 : 14), 110));

    keep(this.add.text(170, 96, "THE CONGRESSIONAL RECORD", {
      fontFamily: FONT, fontSize: "16px", color: CSS.gold, fontStyle: "bold",
    }).setOrigin(0, 0));
    keep(this.add.text(170, 122, data.summary, {
      fontFamily: FONT, fontSize: "16px", color: CSS.paper,
      wordWrap: { width: GAME_WIDTH - 230 }, lineSpacing: 3,
    }).setOrigin(0, 0));

    // --- Full discussion transcript (scrollable) ---
    const tx = 60, ty = 210, tw = GAME_WIDTH - 120, th = 250;
    keep(this.add.rectangle(tx, ty, tw, th, COLORS.paper).setOrigin(0, 0).setStrokeStyle(3, COLORS.ink));
    keep(this.add.text(tx + 4, ty - 22, "THE FULL DISCUSSION  (↑/↓ to scroll)", {
      fontFamily: FONT, fontSize: "14px", color: CSS.muted,
    }).setOrigin(0, 0));

    // --- Difficulty (changeable before the rematch) ---
    ui.push(...addDifficultySlider(this, cx, 540));

    // --- Restart ---
    const again = keep(this.add.text(cx, GAME_HEIGHT - 22, "▶  PRESS ENTER TO TAKE THE FLOOR AGAIN", {
      fontFamily: FONT, fontSize: "22px", color: CSS.gold, fontStyle: "bold",
    }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true }));
    this.tweens.add({ targets: again, alpha: { from: 1, to: 0.4 }, duration: 700, yoyo: true, repeat: -1 });

    // Transcript text + its own clipping camera (built last; everything else is `ui`).
    const body =
      data.turns.length === 0
        ? "(the senator never got a word in)"
        : data.turns
            .map((t) => `» YOU FED: ${t.prompt}   [${t.verdict.toUpperCase()}]\n\n${t.speech}`)
            .join("\n\n— — — — —\n\n");
    const pad = 16;
    const transcript = this.add
      .text(tx + pad, ty + pad, body, {
        fontFamily: FONT, fontSize: "16px", color: CSS.ink,
        wordWrap: { width: tw - pad * 2 }, lineSpacing: 4,
      })
      .setOrigin(0, 0);

    const tcam = this.cameras.add(tx, ty, tw, th);
    tcam.setScroll(tx, ty);
    this.cameras.main.ignore(transcript);
    tcam.ignore(ui);

    const maxScroll = ty + Math.max(0, transcript.height - (th - pad));
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      tcam.scrollY = Phaser.Math.Clamp(tcam.scrollY + dy * 0.6, ty, maxScroll);
    });
    this.input.keyboard?.on("keydown-DOWN", () => {
      tcam.scrollY = Phaser.Math.Clamp(tcam.scrollY + 60, ty, maxScroll);
    });
    this.input.keyboard?.on("keydown-UP", () => {
      tcam.scrollY = Phaser.Math.Clamp(tcam.scrollY - 60, ty, maxScroll);
    });

    const restart = () => this.scene.start("Game");
    again.on("pointerdown", restart);
    this.input.keyboard?.once("keydown-ENTER", restart);
  }
}
