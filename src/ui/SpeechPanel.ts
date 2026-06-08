import Phaser from "phaser";
import { COLORS, CSS, FONT } from "../config";

/**
 * The wall of text. The senator's speech accumulates here; when it grows past
 * the panel, the oldest lines are trimmed off the top so the newest words stay
 * in view (auto-scroll). Phaser 4 dropped WebGL geometry masks, so we bound the
 * text by trimming the buffer to what fits rather than clipping.
 */
export class SpeechPanel extends Phaser.GameObjects.Container {
  private text: Phaser.GameObjects.Text;
  private buffer = "";
  private trimmed = false;
  private readonly pad = 18;
  private readonly innerH: number;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
    super(scene, x, y);
    this.innerH = height - this.pad * 2;

    const bg = scene.add
      .rectangle(0, 0, width, height, COLORS.paper)
      .setOrigin(0, 0)
      .setStrokeStyle(4, COLORS.ink);

    this.text = scene.add.text(this.pad, this.pad, "", {
      fontFamily: FONT,
      fontSize: "21px",
      color: CSS.ink,
      wordWrap: { width: width - this.pad * 2 },
      lineSpacing: 5,
    });

    this.add([bg, this.text]);
    scene.add.existing(this);
  }

  clear(): this {
    this.buffer = "";
    this.trimmed = false;
    this.text.setText("").setColor(CSS.ink);
    return this;
  }

  /** A muted system line (chair announcements, errors). */
  system(line: string): this {
    this.clear();
    this.text.setColor(CSS.muted).setText(line);
    return this;
  }

  /** Begin a fresh ramble (new run). */
  begin(): this {
    return this.clear();
  }

  /** Continue the wall: drop a paragraph break before the next segment. */
  paragraphBreak(): this {
    if (this.buffer.length > 0) {
      this.buffer += "\n\n";
      this.text.setColor(CSS.ink);
      this.render();
    }
    return this;
  }

  /** Append a streamed chunk; trim the top so the latest text stays visible. */
  append(chunk: string): this {
    this.buffer += chunk;
    this.text.setColor(CSS.ink);
    this.render();
    // Drop whole words off the front until the text fits the panel height.
    let guard = 0;
    while (this.text.height > this.innerH && this.buffer.length > 1 && guard++ < 200) {
      const cut = this.buffer.indexOf(" ", 24);
      this.buffer = cut > 0 ? this.buffer.slice(cut + 1) : this.buffer.slice(24);
      this.trimmed = true;
      this.render();
    }
    return this;
  }

  private render() {
    this.text.setText(this.trimmed ? "…" + this.buffer : this.buffer);
  }
}
