import Phaser from "phaser";
import {
  CSS,
  FONT,
  COLORS,
  TUNING,
  BILLS,
  PORTRAIT_COUNT,
  CROWD_REACTIONS,
  portraitKey,
} from "../config";
import { PortraitCard } from "../ui/PortraitCard";
import { Meter } from "../ui/Meter";
import { SpeechPanel } from "../ui/SpeechPanel";
import { PromptInput } from "../ui/PromptInput";
import { NetClient } from "../net/NetClient";
import type { ServerMessage, Verdict } from "../shared/protocol";

export interface Turn {
  prompt: string;
  speech: string;
  verdict: Verdict;
  approvalDelta: number;
}

/**
 * The senate floor. Wall of text is the hero; speaker/crowd/meters in a left
 * column. Flow: player types an OPENING topic, then the clock starts. Each feed
 * CONTINUES the senator's speech (no restart) and the crowd heckles by verdict.
 */
export class GameScene extends Phaser.Scene {
  private net!: NetClient;
  private steam!: Meter;
  private approval!: Meter;
  private progress!: Meter;
  private panel!: SpeechPanel;
  private promptBox!: PromptInput; // NB: never name this `input` — that shadows scene.input
  private speaker!: PortraitCard;
  private ruling!: Phaser.GameObjects.Text;
  private billText!: Phaser.GameObjects.Text;
  private crowd: PortraitCard[] = [];

  private billIndex = 0;
  private held = 0;
  private over = false;
  private talking = false;
  private started = false; // clock starts only after the opening prompt

  // Record of the whole discussion, for the end-of-game recap.
  private turns: Turn[] = [];
  private elapsed = 0;
  private curPrompt = "";
  private curSpeech = "";

  constructor() {
    super("Game");
  }

  create() {
    this.over = false;
    this.talking = false;
    this.started = false;
    this.held = 0;
    this.turns = [];
    this.elapsed = 0;
    this.curPrompt = "";
    this.curSpeech = "";
    this.crowd = [];
    this.cameras.main.setBackgroundColor(COLORS.ink);
    const bill = BILLS[this.billIndex];

    // --- Left column ---
    this.speaker = new PortraitCard(this, 150, 185, portraitKey(1), 250, 6);

    this.approval = new Meter(this, 22, 345, {
      width: 258, height: 22, color: COLORS.approval, lowColor: COLORS.approvalLow,
      lowThreshold: 0.25, label: "APPROVAL", max: TUNING.approvalMax,
    });
    this.approval.set(TUNING.approvalStart);

    this.steam = new Meter(this, 22, 405, {
      width: 258, height: 22, color: COLORS.steam, lowColor: COLORS.steamLow,
      lowThreshold: 0.3, label: "STEAM", max: TUNING.steamMax,
    });
    this.steam.set(TUNING.steamStart);

    this.progress = new Meter(this, 22, 462, {
      width: 258, height: 14, color: COLORS.gold, label: `HOLD THE FLOOR (${bill.holdSeconds}s)`, max: bill.holdSeconds,
    });
    this.progress.set(0);

    for (let i = 0; i < 6; i++) {
      const x = 70 + (i % 3) * 80;
      const y = 545 + Math.floor(i / 3) * 80;
      const key = portraitKey(((i * 3 + 2) % PORTRAIT_COUNT) + 1);
      this.crowd.push(new PortraitCard(this, x, y, key, 72, 4).startIdle(i * 120));
    }

    // --- Right: the WALL OF TEXT ---
    this.billText = this.add
      .text(785, 18, `BILL ${bill.id} — ${bill.title}`, {
        fontFamily: FONT, fontSize: "20px", color: CSS.gold, fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    this.panel = new SpeechPanel(this, 308, 58, 952, 510);
    this.panel.system("Take the floor — type your OPENING topic and press ENTER.\nThe clock starts when you do.");

    this.ruling = this.add
      .text(308, 582, "", { fontFamily: FONT, fontSize: "16px", color: CSS.muted })
      .setOrigin(0, 0);

    this.promptBox = new PromptInput(this, 308, 620, 952, (text) => this.feedTopic(text));
    this.promptBox.setEnabled(true);

    // --- Network (fresh per run) ---
    this.net = new NetClient().connect();
    const off = this.net.onMessage((m) => this.onServer(m));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      this.net.close();
    });
  }

  private feedTopic(text: string) {
    if (this.over) return;
    if (!this.started) {
      this.started = true; // opening prompt -> clock begins (see update)
      this.panel.begin();
    }
    this.curPrompt = text;
    this.ruling.setColor(CSS.muted).setText(`the senator takes up “${text}”…`);
    this.net.send({ type: "feed", prompt: text });
  }

  private onServer(m: ServerMessage) {
    if (this.over) return;
    switch (m.type) {
      case "ready":
        this.promptBox.setEnabled(true);
        break;
      case "judge":
        this.applyJudge(m);
        break;
      case "speech_start":
        this.talking = true;
        this.curSpeech = "";
        this.panel.paragraphBreak(); // continue the wall, don't restart it
        break;
      case "speech":
        this.curSpeech += m.token;
        this.panel.append(m.token);
        break;
      case "speech_end":
        this.talking = false;
        break;
      case "error":
        this.panel.system(`(the senator stammers) ${m.message}`);
        this.talking = false;
        break;
    }
  }

  private applyJudge(m: Extract<ServerMessage, { type: "judge" }>) {
    this.approval.set(this.approval.value + m.approvalDelta);
    this.approval.flash();
    // Steam reward scales with how well the speech landed.
    this.steam.set(Math.min(TUNING.steamMax, this.steam.value + m.steamBonus));
    this.steam.flash();
    const sign = m.approvalDelta >= 0 ? "+" : "";
    this.ruling
      .setColor(m.approvalDelta >= 0 ? CSS.gold : CSS.approval)
      .setText(`${m.verdict.toUpperCase()}  ${sign}${m.approvalDelta} approval  +${m.steamBonus} steam — ${m.reason}`);

    // Record this turn for the end-of-game discussion.
    if (this.curPrompt) {
      this.turns.push({
        prompt: this.curPrompt,
        speech: this.curSpeech.trim(),
        verdict: m.verdict,
        approvalDelta: m.approvalDelta,
      });
    }

    const pool = CROWD_REACTIONS[m.verdict];
    const negative = m.verdict === "flop";
    this.crowd.forEach((c, i) =>
      this.time.delayedCall(i * 60, () => {
        if (!c.active) return;
        c.react();
        c.setMood(negative ? COLORS.approvalLow : COLORS.paper);
        c.say(pool[Math.floor(Math.random() * pool.length)], !negative);
      }),
    );
    this.speaker.react();
  }

  update(_t: number, dms: number) {
    if (this.over || !this.started) return;
    const dt = dms / 1000;
    this.elapsed += dt;
    const bill = BILLS[this.billIndex];

    // Steam drains gently while the senator holds forth, fast while you're idle.
    const drainMult = this.talking ? TUNING.talkDrainMult : 1;
    this.steam.set(this.steam.value - TUNING.steamDrainPerSec * bill.steamDrainMult * drainMult * dt);
    this.approval.set(this.approval.value - bill.approvalDrainPerSec * dt);

    this.held += dt;
    this.progress.set(this.held);

    if (this.steam.value <= 0) return this.end(false, "The senator ran out of steam.");
    if (this.approval.value <= 0) return this.end(false, "Gaveled down — the floor turned on you.");
    if (this.held >= bill.holdSeconds) {
      if (this.billIndex >= BILLS.length - 1) {
        return this.end(true, "Every bill talked to death. The session collapses!");
      }
      this.advanceBill();
    }
  }

  private advanceBill() {
    this.billIndex++;
    const bill = BILLS[this.billIndex];
    this.held = 0;
    this.billText.setText(`BILL ${bill.id} — ${bill.title}`);
    this.ruling.setColor(CSS.gold).setText(`Bill killed! Next up: ${bill.title}`);
    this.approval.set(Math.min(TUNING.approvalMax, this.approval.value + 15));
    this.steam.set(Math.min(TUNING.steamMax, this.steam.value + 20));
    this.progress.set(0);
  }

  private end(won: boolean, reason: string) {
    this.over = true;
    this.promptBox.setEnabled(false);
    this.net.send({ type: "reset" });
    const billsKilled = this.billIndex + (won ? 1 : 0);
    this.billIndex = 0;
    this.scene.start("End", {
      won,
      reason,
      billsKilled,
      turns: this.turns,
      summary: this.buildSummary(won, reason, billsKilled),
    });
  }

  /** A short "Congressional Record" recap of the run (deterministic). */
  private buildSummary(won: boolean, reason: string, billsKilled: number): string {
    const mm = Math.floor(this.elapsed / 60);
    const ss = Math.round(this.elapsed % 60);
    const time = `${mm}:${String(ss).padStart(2, "0")}`;
    const topics = this.turns.map((t) => t.prompt);
    const topicList = topics.length
      ? topics.slice(0, 6).join(", ") + (topics.length > 6 ? `, and ${topics.length - 6} more` : "")
      : "nothing of substance";
    const landed = this.turns.filter((t) => t.verdict === "landed").length;
    return (
      `The senator held the floor for ${time}, killing ${billsKilled} bill(s) across ` +
      `${topics.length} topic(s) — ${topicList}. ${landed} of them truly landed. ` +
      (won ? "The session collapsed in triumph." : reason)
    );
  }
}
