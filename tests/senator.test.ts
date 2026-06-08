import { test, expect } from "bun:test";
import {
  ruleScore,
  combineScore,
  approvalDelta,
  verdictFor,
  buildSpeechPrompt,
} from "../src/server/senator";

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

test("combineScore: rules dominate, falls back to rule when LLM missing", () => {
  expect(combineScore(6, null)).toBe(6);
  expect(combineScore(9, 0)).toBe(7); // round(9*.75 + 0) -> good prompt survives a bad LLM rating
  expect(combineScore(10, 0)).toBe(8); // round(7.5)
  expect(combineScore(0, 10)).toBe(3); // round(2.5) -> LLM only nudges
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
