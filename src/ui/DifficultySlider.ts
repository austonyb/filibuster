import Phaser from "phaser";
import { CSS, FONT, COLORS, DIFFICULTIES, DIFFICULTY_KEY } from "../config";

/**
 * The difficulty selector: ◀ NAME ▶ with a row of notches (red = hotter).
 * ← / → keys, click arrows, or click a notch. Selection is stored in the Phaser
 * registry under DIFFICULTY_KEY so every scene (Menu, End) shares it. Returns the
 * created objects so a scene with extra cameras can exclude them from clipping.
 */
export function addDifficultySlider(
  scene: Phaser.Scene,
  cx: number,
  y: number,
): Phaser.GameObjects.GameObject[] {
  const n = DIFFICULTIES.length;
  let idx = (scene.registry.get(DIFFICULTY_KEY) as number) ?? 0;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
    objs.push(o);
    return o;
  };

  add(scene.add.text(cx, y - 40, "DIFFICULTY  (← / →)", { fontFamily: FONT, fontSize: "15px", color: CSS.muted }).setOrigin(0.5));
  const nameT = add(scene.add.text(cx, y - 6, "", { fontFamily: FONT, fontSize: "28px", color: CSS.gold, fontStyle: "bold" }).setOrigin(0.5));
  const descT = add(scene.add.text(cx, y + 22, "", { fontFamily: FONT, fontSize: "15px", color: CSS.muted }).setOrigin(0.5));

  const trackW = 230;
  const x0 = cx - trackW / 2;
  const notches: Phaser.GameObjects.Rectangle[] = [];
  for (let i = 0; i < n; i++) {
    const x = x0 + trackW * (i / (n - 1));
    const dot = add(
      scene.add.rectangle(x, y + 52, 18, 18, COLORS.muted).setStrokeStyle(2, COLORS.ink).setInteractive({ useHandCursor: true }),
    );
    dot.on("pointerdown", () => { idx = i; render(); });
    notches.push(dot);
  }

  const arrow = (x: number, ch: string, delta: number) =>
    add(
      scene.add
        .text(x, y + 52, ch, { fontFamily: FONT, fontSize: "28px", color: CSS.paper })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => change(delta)),
    );
  arrow(x0 - 40, "◀", -1);
  arrow(x0 + trackW + 40, "▶", 1);

  const render = () => {
    const d = DIFFICULTIES[idx];
    nameT.setText(d.name);
    descT.setText(d.desc + (idx === 0 ? "  (easiest)" : idx === n - 1 ? "  (hardest)" : ""));
    notches.forEach((dot, i) => dot.setFillStyle(i <= idx ? COLORS.approval : COLORS.muted));
    scene.registry.set(DIFFICULTY_KEY, idx);
  };
  const change = (delta: number) => { idx = Phaser.Math.Clamp(idx + delta, 0, n - 1); render(); };

  scene.input.keyboard?.on("keydown-LEFT", () => change(-1));
  scene.input.keyboard?.on("keydown-RIGHT", () => change(1));
  render();
  return objs;
}
