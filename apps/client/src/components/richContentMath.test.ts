import assert from "node:assert/strict";
import test from "node:test";

import { normalizeMathDelimiters } from "./richContentMath.ts";

test("preserves blockquote prefixes for display math blocks", () => {
  const input = ["> Key idea", "> \\[", "> x^2 + y^2 = z^2", "> \\]"].join("\n");
  const expected = ["> Key idea", "> $$", "> x^2 + y^2 = z^2", "> $$"].join("\n");

  assert.equal(normalizeMathDelimiters(input), expected);
});

test("preserves list indentation for display math blocks", () => {
  const input = ["- note", "  \\[", "  x^2", "  \\]"].join("\n");
  const expected = ["- note", "  $$", "  x^2", "  $$"].join("\n");

  assert.equal(normalizeMathDelimiters(input), expected);
});

test("normalizes same-line bracket math to inline math", () => {
  const input = "> Formula: \\[x^2 + y^2 = z^2\\]";
  const expected = "> Formula: $x^2 + y^2 = z^2$";

  assert.equal(normalizeMathDelimiters(input), expected);
});

test("wraps raw formula clauses that arrive without delimiters", () => {
  const input = "The Lagrangian: L(q_i, \\dot{q}_i, t) = T - V.";
  const expected = "The Lagrangian: $L(q_i, \\dot{q}_i, t) = T - V$.";

  assert.equal(normalizeMathDelimiters(input), expected);
});

test("wraps loose symbol tokens and later formula clauses on the same line", () => {
  const input = "Euler-Lagrange (E-L) Equations: For each q_i: d/dt ( ∂L/∂\\dot{q}_i ) - ∂L/∂q_i = 0.";
  const expected =
    "Euler-Lagrange (E-L) Equations: For each $q_i$: $d/dt ( ∂L/∂\\dot{q}_i ) - ∂L/∂q_i = 0$.";

  assert.equal(normalizeMathDelimiters(input), expected);
});

test("wraps leading formula text before explanatory prose", () => {
  const input = "x = l sin θ, y = -l cos θ (if y=0 at pivot, down is negative).";
  const expected = "$x = l sin θ, y = -l cos θ$ (if y=0 at pivot, down is negative).";

  assert.equal(normalizeMathDelimiters(input), expected);
});
