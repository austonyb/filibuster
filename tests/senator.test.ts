import { test, expect } from "bun:test";
import {
  ruleScore,
  approvalDelta,
  verdictFor,
  buildSpeechPrompt,
  scoreOutput,
  steamBonus,
  judge,
} from "../src/server/senator";

// A long, varied, on-topic ramble for output-judging tests.
const GOOD_OUTPUT =
  "My friends, the postage stamp! That humble square of gummed paper carries within it " +
  "the entire weight of our republic, from the founding farmers to the quiet clerks who " +
  "sort our letters by lamplight, and I say to you that no committee, no clever amendment, " +
  "no procedural trick shall ever diminish the dignity of the postage stamp in this chamber, " +
  "for it binds the prairie to the seaport and the grandmother to her distant grandson.";

test("empty prompt scores zero", () => {
  expect(ruleScore("").score).toBe(0);
  expect(ruleScore("   ").score).toBe(0);
});

test("single filler word is a dead end", () => {
  expect(ruleScore("ok").score).toBe(0);
  expect(ruleScore("bye").score).toBe(0);
  expect(ruleScore("no").score).toBe(0);
});

test("bait topics score higher than bland ones", () => {
  const bland = ruleScore("the chair and the table").score;
  const bait = ruleScore("the constitution and our liberty").score;
  expect(bait).toBeGreaterThan(bland);
});

test("longer prompts beat terse ones", () => {
  const terse = ruleScore("taxes").score;
  const rich = ruleScore("the burden of taxes on hardworking farmers").score;
  expect(rich).toBeGreaterThanOrEqual(terse);
});

test("repeating a recent prompt is penalized", () => {
  const fresh = ruleScore("the future of american democracy", []).score;
  const repeat = ruleScore("the future of american democracy", [
    "the future of american democracy",
  ]).score;
  expect(repeat).toBeLessThan(fresh);
});

test("scores clamp to 0..10", () => {
  expect(ruleScore("constitution liberty freedom children history future america").score)
    .toBeLessThanOrEqual(10);
  expect(ruleScore("um uh ok bye no nothing").score).toBeGreaterThanOrEqual(0);
});

test("approvalDelta: low scores hurt, high scores help, neutral ~ 0", () => {
  expect(approvalDelta(0)).toBeLessThan(0);
  expect(approvalDelta(4)).toBe(0);
  expect(approvalDelta(10)).toBeGreaterThan(0);
  // bounds
  expect(approvalDelta(0)).toBeGreaterThanOrEqual(-20);
  expect(approvalDelta(10)).toBeLessThanOrEqual(18);
});

test("verdicts map sensibly", () => {
  expect(verdictFor(9)).toBe("landed");
  expect(verdictFor(5)).toBe("weak");
  expect(verdictFor(1)).toBe("flop");
});

test("buildSpeechPrompt embeds and clamps the topic", () => {
  const p = buildSpeechPrompt("  the  weather   back home ");
  expect(p).toContain("the weather back home");
  // Topic is clamped to 200 chars before being wrapped in the instruction.
  const long = buildSpeechPrompt("x".repeat(500));
  expect(long).not.toContain("x".repeat(201));
  expect(long).toContain("x".repeat(200));
});

// --- Output-based judging (the real judge) ---

test("a short fizzle scores zero", () => {
  expect(scoreOutput("the constitution", "Well, I...").score).toBe(0);
});

test("a long varied on-topic ramble lands", () => {
  const r = scoreOutput("the postage stamp", GOOD_OUTPUT);
  expect(r.score).toBeGreaterThanOrEqual(7);
  expect(verdictFor(r.score)).toBe("landed");
});

test("a repetitive ramble is penalized vs a varied one", () => {
  const loop = ("freedom ").repeat(60);
  const varied = scoreOutput("freedom", GOOD_OUTPUT).score;
  expect(scoreOutput("freedom", loop).score).toBeLessThan(varied);
});

test("ignoring the topic scores lower than addressing it", () => {
  const offTopic =
    "Banana banana orchard orchard sailing ships beneath the moon and the tide " +
    "rolls gently across forgotten harbors while gulls wheel overhead in silence indeed.";
  const on = scoreOutput("the postage stamp", GOOD_OUTPUT).score;
  const off = scoreOutput("the postage stamp", offTopic).score;
  expect(off).toBeLessThan(on);
});

test("rehashing a recent output is penalized", () => {
  const fresh = scoreOutput("the postage stamp", GOOD_OUTPUT, []).score;
  const rehash = scoreOutput("the postage stamp", GOOD_OUTPUT, [GOOD_OUTPUT]).score;
  expect(rehash).toBeLessThan(fresh);
});

test("steamBonus rises with score and is always positive", () => {
  expect(steamBonus(0)).toBeGreaterThan(0);
  expect(steamBonus(10)).toBeGreaterThan(steamBonus(0));
});

test("judge returns a full verdict over the output", () => {
  const j = judge("the postage stamp", GOOD_OUTPUT, []);
  expect(j.verdict).toBe("landed");
  expect(j.approvalDelta).toBeGreaterThan(0);
  expect(j.steamBonus).toBeGreaterThan(0);
  expect(typeof j.reason).toBe("string");
});
