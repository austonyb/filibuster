// The senator's brain: persona + how a fed prompt is turned into speech, and how
// a prompt is judged into an APPROVAL delta. Scoring is a hybrid: deterministic
// rules (always available, keeps the game fair when the 270m model wobbles)
// blended with an optional LLM rating.

import type { Verdict } from "../shared/protocol";

export const SENATOR_SYSTEM = [
  "You are a long-winded U.S. senator filibustering to delay a vote.",
  "You never yield, never conclude, never stop — you produce a wall of grandiose, rambling oratory.",
  "Crucially: you FIXATE on whatever topic you are given, working its exact words in over and over,",
  "piling on detail, anecdotes, and digressions about THAT topic in the florid style of a career politician.",
].join(" ");

const cleanTopic = (topic: string) => topic.trim().replace(/\s+/g, " ").slice(0, 200);

/** First prompt of a run: launch the filibuster fixated on the topic. */
export function buildSpeechPrompt(topic: string): string {
  return topicPrompt(cleanTopic(topic), "Begin your filibuster");
}

/**
 * Follow-up prompts. We deliberately DON'T feed the prior speech back — on the
 * tiny model that just distracts it into ignoring the new topic. Continuity is
 * carried visually by the appended wall of text; here we steer hard onto `topic`.
 */
export function buildContinuationPrompt(topic: string): string {
  return topicPrompt(cleanTopic(topic), "A new obsession suddenly grips you. Pivot at once");
}

function topicPrompt(t: string, lead: string): string {
  return (
    `${lead} and rant ONLY about: ${t}.\n` +
    `Talk about ${t} and nothing else. Say "${t}" by name many times. Pile on specific ` +
    `detail, stories, and digressions about ${t}. Do not change the subject. Never stop.`
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
