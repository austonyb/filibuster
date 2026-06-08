// The senator's brain: persona + how a fed prompt is turned into speech, and how
// a prompt is judged into an APPROVAL delta. Scoring is a hybrid: deterministic
// rules (always available, keeps the game fair when the 270m model wobbles)
// blended with an optional LLM rating.

import { generateOnce } from "./ollama";
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
  return (
    `Continue your filibuster. Seize on this and spin it into a long, rambling tangent ` +
    `— several meandering paragraphs, never reaching your point, never stopping: "${cleanTopic(topic)}".`
  );
}

/**
 * Follow-up prompts: the senator is mid-speech (we pass ollama `context`), so do
 * NOT restart — pivot the SAME ramble onto the new topic and barrel onward.
 */
export function buildContinuationPrompt(topic: string): string {
  return (
    `Without pausing or restarting, pivot your ongoing remarks onto this and keep ` +
    `rambling — a fresh tangent, new words, never circling back: "${cleanTopic(topic)}".`
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

/** Ask the LLM to rate the prompt 0..10. Returns null on failure/garbage. */
export async function llmScore(
  prompt: string,
  signal?: AbortSignal,
): Promise<number | null> {
  try {
    const out = await generateOnce(
      `On a scale of 0 to 10, how good is this topic as endless fuel for a filibuster ` +
        `(10 = you could talk about it forever, 0 = a conversational dead end)? ` +
        `Topic: "${prompt}". Answer with ONLY a single integer 0 to 10.`,
      { numPredict: 4, temperature: 0, signal },
    );
    const m = out.match(/\d+/);
    if (!m) return null;
    return Math.max(0, Math.min(10, parseInt(m[0], 10)));
  } catch {
    return null;
  }
}

/**
 * Blend the deterministic rule score with the optional LLM score (0..10).
 * Rules dominate: gemma3:270m is a fine *talker* but an unreliable *judge*
 * (it rates obviously-good filibuster bait near 0), so the LLM only nudges.
 */
export function combineScore(rule: number, llm: number | null): number {
  if (llm == null) return rule;
  return Math.round(rule * 0.75 + llm * 0.25);
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
}

/** Full judging pipeline: rules + LLM blended into a final verdict. */
export async function judge(
  prompt: string,
  recent: string[],
  signal?: AbortSignal,
): Promise<Judgement> {
  const rule = ruleScore(prompt, recent);
  // Hard dead-ends skip the LLM call entirely.
  const llm = rule.score === 0 ? null : await llmScore(prompt, signal);
  const score = combineScore(rule.score, llm);
  return {
    score,
    approvalDelta: approvalDelta(score),
    verdict: verdictFor(score),
    reason: rule.reason,
  };
}
