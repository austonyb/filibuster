import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT, CSS, FONT, COLORS, portraitKey } from "../config";
import { PortraitCard } from "../ui/PortraitCard";

interface EndData {
  won: boolean;
  reason: string;
  billsKilled: number;
}

export class EndScene extends Phaser.Scene {
  constructor() {
    super("End");
  }

  create(data: EndData) {
    const cx = GAME_WIDTH / 2;
    this.cameras.main.setBackgroundColor(COLORS.ink);

    const headline = data.won ? "FILIBUSTER VICTORIOUS" : "GAVELED DOWN";
    this.add
      .text(cx, 140, headline, {
        fontFamily: FONT,
        fontSize: "72px",
        color: data.won ? CSS.gold : CSS.approval,
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    new PortraitCard(this, cx, 360, portraitKey(data.won ? 7 : 14), 220).startIdle();

    this.add
      .text(cx, 510, data.reason, {
        fontFamily: FONT,
        fontSize: "22px",
        color: CSS.paper,
        align: "center",
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 550, `Bills talked to death: ${data.billsKilled}`, {
        fontFamily: FONT,
        fontSize: "18px",
        color: CSS.muted,
      })
      .setOrigin(0.5);

    const again = this.add
      .text(cx, 630, "▶  PRESS ENTER TO TAKE THE FLOOR AGAIN", {
        fontFamily: FONT,
        fontSize: "24px",
        color: CSS.gold,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: again, alpha: { from: 1, to: 0.4 }, duration: 700, yoyo: true, repeat: -1 });

    const restart = () => this.scene.start("Game");
    again.on("pointerdown", restart);
    this.input.keyboard?.once("keydown-ENTER", restart);
  }
}
