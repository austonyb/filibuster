// The senator's brain: persona + how a fed prompt is turned into speech, and how
// a prompt is judged into an APPROVAL delta. Scoring is a hybrid: deterministic
// rules (always available, keeps the game fair when the 270m model wobbles)
// blended with an optional LLM rating.

import type { Verdict } from "../shared/protocol";

export const SENATOR_SYSTEM = [
  "You are a long-winded United States senator holding the floor in a filibuster.",
  "Your only goal is to KEEP TALKING and NEVER yield the floor — produce a WALL OF TEXT.",
  "Take the topic you are given and go off on long, branching TANGENTS:",
  "pile clause upon clause, story upon story, digression upon digression. Drift from the",
  "topic into folksy anecdotes about the good people back home, your grandmother's kitchen,",
  "the weather, the Constitution, the price of a postage stamp — and never find your way back.",
  "Ask rhetorical questions and answer them with more questions. Never reach your point,",
  "never conclude, never agree to stop, never say goodbye. Write many long sentences.",
  "Speak in the florid, self-important style of a career politician.",
].join(" ");

const cleanTopic = (topic: string) => topic.trim().replace(/\s+/g, " ").slice(0, 200);

/** First prompt of a run: sends the senator off on a tangent about the topic. */
export function buildSpeechPrompt(topic: string): string {
  const t = cleanTopic(topic);
  return (
    `Continue your filibuster on the subject of "${t}". Name "${t}" explicitly and keep ` +
    `returning to it as you spin a long, rambling tangent — several meandering paragraphs, ` +
    `never reaching your point, never stopping.`
  );
}

/**
 * Follow-up prompts: the senator is mid-speech (we pass ollama `context`), so do
 * NOT restart — pivot the SAME ramble onto the new topic and barrel onward.
 */
export function buildContinuationPrompt(topic: string): string {
  const t = cleanTopic(topic);
  return (
    `Without pausing or restarting, pivot your ongoing remarks onto "${t}". Work the words ` +
    `"${t}" in by name and keep coming back to them as you ramble on with fresh material.`
  );
}

// --- Rule-based scoring (pure, unit-tested) ---------------------------------

const FILLER = new Set([
  "um", "uh", "er", "ok", "okay", "k", "yes", "no", "yeah", "nah",
  "bye", "stop", "quit", "done", "end", "nothing", "idk", "whatever",
]);

// Topics that are easy to ramble about forever -> reward filibuster-bait.
const BAIT = [
  "constitution", "freedom", "liberty", "children", "history", "future",
  "america", "founding", "founders", "procedure", "rule", "amendment",
  "people", "record", "duty", "tradition", "economy", "farmers", "veterans",
  "democracy", "justice", "rights", "taxes", "weather", "grandmother",
  "war", "peace", "flag", "values", "heartland", "promise",
];

const wordsOf = (s: string) =>
  s.toLowerCase().trim().split(/[^a-z']+/).filter(Boolean);

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const w of sa) if (sb.has(w)) inter++;
  return inter / (sa.size + sb.size - inter);
}

export interface RuleResult {
  score: number; // 0..10
  reason: string;
}

/** Deterministic score of a prompt given recent prompts (for repetition). */
export function ruleScore(prompt: string, recent: string[] = []): RuleResult {
  const words = wordsOf(prompt);
  if (words.length === 0) return { score: 0, reason: "said nothing" };
  if (words.length === 1 && FILLER.has(words[0])) {
    return { score: 0, reason: "dead-end filler" };
  }

  let score = 5;
  const reasons: string[] = [];

  // Length: a meatier prompt gives the senator more to chew on.
  if (words.length >= 3) score += 1;
  if (words.length >= 6) score += 1;
  if (words.length < 2) {
    score -= 2;
    reasons.push("too brief");
  }

  // Filler density drags it down.
  const fillerCount = words.filter((w) => FILLER.has(w)).length;
  if (fillerCount) {
    score -= fillerCount * 2;
    reasons.push("filler words");
  }

  // Filibuster-bait topics are gold.
  const baitHits = BAIT.filter((b) => words.includes(b)).length;
  if (baitHits) {
    score += Math.min(3, baitHits);
    reasons.push("juicy topic");
  }

  // Repeating a recent prompt bores the chamber.
  const repeated = recent.some((r) => jaccard(wordsOf(r), words) >= 0.6);
  if (repeated) {
    score -= 3;
    reasons.push("repeating yourself");
  }

  score = Math.max(0, Math.min(10, score));
  return { score, reason: reasons.join(", ") || "serviceable" };
}

// Stopwords so topicality looks at the meaningful words you fed.
const STOP = new Set([
  "the", "and", "but", "for", "with", "that", "this", "these", "those", "from",
  "your", "our", "are", "was", "were", "its", "it's", "you", "they", "them",
  "what", "when", "will", "would", "could", "should", "have", "has", "had",
  "about", "into", "over", "than", "then", "their", "there",
]);
const contentWords = (s: string) => wordsOf(s).filter((w) => w.length >= 4 && !STOP.has(w));

/**
 * Score the senator's OUTPUT (the speech your prompt produced) 0..10. This is
 * the real judge: did your topic spin into sustained, fresh, on-topic oratory?
 *   length (0..4)  +  non-repetition (0..3)  +  topicality (0..3)
 * minus penalties for rehashing earlier remarks or being handed pure filler.
 */
export function scoreOutput(
  prompt: string,
  output: string,
  recentOutputs: string[] = [],
): RuleResult {
  const out = wordsOf(output);
  const n = out.length;
  if (n < 6) return { score: 0, reason: "the senator fizzled out" };

  const lengthScore = Math.min(4, (n / 80) * 4); // ~80+ words = full marks
  const uniqRatio = new Set(out).size / n;
  const repScore = Math.min(3, uniqRatio * 4.5); // looping output tanks this

  const topics = contentWords(prompt);
  const lowerOut = output.toLowerCase();
  const hits = topics.filter((t) => lowerOut.includes(t)).length;
  const topicScore = topics.length === 0 ? 0.5 : Math.min(3, hits * 1.6);

  let score = lengthScore + repScore + topicScore;
  const faults: string[] = [];
  if (lengthScore < 2) faults.push("ran short");
  if (repScore < 1.5) faults.push("kept repeating");
  if (topics.length > 0 && topicScore < 1) faults.push("drifted off your topic");

  // Senator parroting an earlier ramble.
  if (recentOutputs.some((r) => jaccard(wordsOf(r), out) >= 0.55)) {
    score -= 3;
    faults.push("rehashing earlier remarks");
  }
  // You handed them nothing to work with.
  const pw = wordsOf(prompt);
  if (pw.length > 0 && pw.every((w) => FILLER.has(w))) {
    score -= 2;
    faults.push("you gave them nothing");
  }

  score = Math.max(0, Math.min(10, Math.round(score)));

  // Reason should match the verdict: praise when it lands, fault when it doesn't.
  let reason: string;
  if (score >= 7) {
    reason = topicScore >= 2 ? "worked your topic masterfully" : "a rousing tangent";
  } else if (faults.length > 0) {
    reason = faults.slice(0, 2).join(", ");
  } else {
    reason = "serviceable";
  }
  return { score, reason };
}

/** Map a 0..10 score to a signed APPROVAL delta. 4 is roughly neutral. */
export function approvalDelta(score: number): number {
  const s = Math.max(0, Math.min(10, score));
  // Below neutral falls hard; above neutral climbs gently. score4 = 0.
  const delta = s <= 4 ? (s - 4) * 5 : (s - 4) * 3;
  return Math.round(Math.max(-20, Math.min(18, delta)));
}

export function verdictFor(score: number): Verdict {
  if (score >= 7) return "landed";
  if (score >= 4) return "weak";
  return "flop";
}

export interface Judgement {
  score: number;
  approvalDelta: number;
  verdict: Verdict;
  reason: string;
  steamBonus: number; // STEAM awarded for how well it landed
}

/** Steam earned by the speech: a poor ramble barely refuels, a great one a lot. */
export function steamBonus(score: number): number {
  return Math.round(TUNING_STEAM_BONUS_BASE + Math.max(0, score) * TUNING_STEAM_BONUS_PER);
}
// Kept here (not config) so the pure judge stays dependency-free for tests.
const TUNING_STEAM_BONUS_BASE = 8;
const TUNING_STEAM_BONUS_PER = 3.5;

/** Judge the senator's OUTPUT into a full verdict (approval + steam). */
export function judge(prompt: string, output: string, recentOutputs: string[] = []): Judgement {
  const r = scoreOutput(prompt, output, recentOutputs);
  return {
    score: r.score,
    approvalDelta: approvalDelta(r.score),
    verdict: verdictFor(r.score),
    reason: r.reason,
    steamBonus: steamBonus(r.score),
  };
}
