import Phaser from "phaser";
import { COLORS, CSS, FONT } from "../config";

/**
 * A Strangers portrait mounted on a cream "paper" card with an ink border —
 * the linocut-print presentation. Portraits are black-on-transparent, so the
 * card is what makes them read. Used for the speaker and the crowd.
 */
export class PortraitCard extends Phaser.GameObjects.Container {
  private card: Phaser.GameObjects.Rectangle;
  private portrait: Phaser.GameObjects.Image;
  private size: number;
  private bubble?: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey: string,
    size: number,
    borderWidth = 5,
  ) {
    super(scene, x, y);
    this.size = size;

    this.card = scene.add
      .rectangle(0, 0, size, size, COLORS.paper)
      .setStrokeStyle(borderWidth, COLORS.ink);
    this.portrait = scene.add.image(0, 0, textureKey).setDisplaySize(size - borderWidth * 2, size - borderWidth * 2);

    this.add([this.card, this.portrait]);
    scene.add.existing(this);
  }

  setTexture(key: string): this {
    this.portrait.setTexture(key).setDisplaySize(this.size - 10, this.size - 10);
    return this;
  }

  /** Tint the card to signal mood (e.g. crowd approval). */
  setMood(color: number): this {
    this.card.setFillStyle(color);
    return this;
  }

  /** Pop a small canned speech bubble above the card for a moment. */
  say(text: string, positive: boolean): this {
    this.bubble?.destroy();
    const label = this.scene.add
      .text(0, 0, text, { fontFamily: FONT, fontSize: "15px", color: CSS.ink, fontStyle: "bold" })
      .setOrigin(0.5);
    const bg = this.scene.add
      .rectangle(0, 0, label.width + 18, label.height + 12, positive ? COLORS.paper : 0xe7c3bb)
      .setStrokeStyle(2, COLORS.ink);
    const tail = this.scene.add
      .triangle(0, bg.height / 2 + 4, -6, -6, 6, -6, 0, 4, positive ? COLORS.paper : 0xe7c3bb)
      .setStrokeStyle(2, COLORS.ink);
    const c = this.scene.add.container(0, -this.size / 2 - 22, [bg, tail, label]).setDepth(50);
    this.add(c);
    this.bubble = c;

    c.setScale(0);
    this.scene.tweens.add({ targets: c, scale: 1, duration: 130, ease: "Back.easeOut" });
    this.scene.time.delayedCall(1900, () => {
      if (!c.active) return;
      this.scene.tweens.add({
        targets: c,
        alpha: 0,
        duration: 300,
        onComplete: () => c.destroy(),
      });
      if (this.bubble === c) this.bubble = undefined;
    });
    return this;
  }

  /** A small reaction wobble. */
  react(): this {
    this.scene.tweens.add({
      targets: this,
      scale: { from: 1, to: 1.12 },
      duration: 90,
      yoyo: true,
      ease: "Quad.easeOut",
    });
    return this;
  }

  /** A subtle idle bob so the chamber feels alive. */
  startIdle(delay = 0): this {
    this.scene.tweens.add({
      targets: this,
      y: this.y - 4,
      duration: 1400 + delay,
      delay,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    return this;
  }
}
