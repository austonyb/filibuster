import Phaser from "phaser";
import { COLORS, CSS, FONT } from "../config";

export interface MeterOptions {
  width: number;
  height: number;
  color: number;
  lowColor?: number;
  lowThreshold?: number; // fraction 0..1 below which lowColor is used
  label: string;
  max: number;
}

/**
 * A labelled horizontal bar (STEAM, APPROVAL, bill progress). Fills left->right.
 * Smoothly tweens toward the target value set via `set()`.
 */
export class Meter extends Phaser.GameObjects.Container {
  private opts: MeterOptions;
  private fill: Phaser.GameObjects.Rectangle;
  private labelText: Phaser.GameObjects.Text;
  private valueText: Phaser.GameObjects.Text;
  private current: number;
  private w: number;
  private h: number;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: MeterOptions) {
    super(scene, x, y);
    this.opts = opts;
    this.w = opts.width;
    this.h = opts.height;
    this.current = opts.max;

    const track = scene.add
      .rectangle(0, 0, this.w, this.h, COLORS.ink)
      .setOrigin(0, 0)
      .setStrokeStyle(3, COLORS.paper);
    this.fill = scene.add
      .rectangle(2, 2, this.w - 4, this.h - 4, opts.color)
      .setOrigin(0, 0);
    this.labelText = scene.add.text(0, -22, opts.label, {
      fontFamily: FONT,
      fontSize: "16px",
      color: CSS.paper,
      fontStyle: "bold",
    });
    this.valueText = scene.add
      .text(this.w, -22, "", { fontFamily: FONT, fontSize: "16px", color: CSS.muted })
      .setOrigin(1, 0);

    this.add([track, this.fill, this.labelText, this.valueText]);
    scene.add.existing(this);
    this.render();
  }

  /** Set the value (clamped); tweens the fill toward it. */
  set(value: number): this {
    const v = Phaser.Math.Clamp(value, 0, this.opts.max);
    this.current = v;
    const frac = v / this.opts.max;
    const targetW = Math.max(0, (this.w - 4) * frac);
    const low = this.opts.lowColor && frac <= (this.opts.lowThreshold ?? 0.25);
    this.fill.setFillStyle(low ? this.opts.lowColor! : this.opts.color);
    this.scene.tweens.add({
      targets: this.fill,
      width: targetW,
      duration: 180,
      ease: "Quad.easeOut",
    });
    this.valueText.setText(`${Math.round(v)}/${this.opts.max}`);
    return this;
  }

  get value(): number {
    return this.current;
  }

  /** Flash the bar (e.g. on a hit). */
  flash(color = COLORS.paper): this {
    const orig = this.fill.fillColor;
    this.fill.setFillStyle(color);
    this.scene.time.delayedCall(120, () => this.fill.setFillStyle(orig));
    return this;
  }

  private render() {
    const frac = this.current / this.opts.max;
    this.fill.width = (this.w - 4) * frac;
    this.valueText.setText(`${Math.round(this.current)}/${this.opts.max}`);
  }
}
