import Phaser from "phaser";
import { COLORS, CSS, FONT } from "../config";

/**
 * In-canvas prompt input. Captures keyboard, renders the typed text with a
 * blinking cursor, and fires onSubmit(text) on Enter. No DOM overlay, so it
 * scales cleanly with the FIT scale manager.
 */
export class PromptInput extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Rectangle;
  private prompt: Phaser.GameObjects.Text;
  private valueText: Phaser.GameObjects.Text;
  private cursor: Phaser.GameObjects.Rectangle;
  private value = "";
  private enabled = true;
  private readonly maxLen = 80;
  private onSubmit: (text: string) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    onSubmit: (text: string) => void,
  ) {
    super(scene, x, y);
    this.onSubmit = onSubmit;
    const h = 56;

    this.bg = scene.add
      .rectangle(0, 0, width, h, COLORS.ink)
      .setOrigin(0, 0)
      .setStrokeStyle(3, COLORS.gold);
    this.prompt = scene.add.text(16, h / 2, "›", {
      fontFamily: FONT,
      fontSize: "26px",
      color: CSS.gold,
    }).setOrigin(0, 0.5);
    this.valueText = scene.add.text(44, h / 2, "", {
      fontFamily: FONT,
      fontSize: "24px",
      color: CSS.paper,
    }).setOrigin(0, 0.5);
    this.cursor = scene.add.rectangle(46, h / 2, 12, 26, COLORS.paper).setOrigin(0, 0.5);

    const hint = scene.add
      .text(width - 14, h / 2, "ENTER to feed", {
        fontFamily: FONT,
        fontSize: "14px",
        color: CSS.muted,
      })
      .setOrigin(1, 0.5);

    this.add([this.bg, this.prompt, this.valueText, this.cursor, hint]);
    scene.add.existing(this);

    scene.tweens.add({ targets: this.cursor, alpha: { from: 1, to: 0 }, duration: 500, yoyo: true, repeat: -1 });
    scene.input.keyboard?.on("keydown", this.onKey, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.keyboard?.off("keydown", this.onKey, this);
    });
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.bg.setStrokeStyle(3, on ? COLORS.gold : COLORS.muted);
    this.cursor.setVisible(on);
    return this;
  }

  clear(): this {
    this.value = "";
    this.refresh();
    return this;
  }

  private onKey(ev: KeyboardEvent) {
    if (!this.enabled) return;
    if (ev.key === "Enter") {
      const text = this.value.trim();
      if (text.length === 0) return;
      this.onSubmit(text);
      this.clear();
      return;
    }
    if (ev.key === "Backspace") {
      this.value = this.value.slice(0, -1);
      this.refresh();
      return;
    }
    if (ev.key.length === 1 && this.value.length < this.maxLen) {
      this.value += ev.key;
      this.refresh();
    }
  }

  private refresh() {
    this.valueText.setText(this.value);
    this.cursor.x = 46 + this.valueText.width;
  }
}
