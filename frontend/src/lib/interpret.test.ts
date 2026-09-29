import { describe, expect, it } from "vitest";
import type { Evaluation, FactorResult, RiskLevel } from "../api/types";
import { interpret } from "./interpret";

function evaluation(levels: Record<string, RiskLevel>): Evaluation {
  const factors = Object.entries(levels).map(
    ([name, level]) => ({ id: name, name, level }) as FactorResult,
  );
  const order: RiskLevel[] = ["Low", "Medium", "High"];
  const overall = order[Math.max(...factors.map((f) => order.indexOf(f.level)))]!;
  return { overall_risk: overall, factors, drivers: [], ruleset_version: "2" };
}

describe("interpret", () => {
  it("names the single deciding factor", () => {
    expect(interpret(evaluation({ Air: "High", Noise: "Medium", Health: "Low" }))).toBe(
      "Air is rated High. Of the other factors, 1 is Medium and 1 is Low. The overall risk takes the highest factor rating, so this one factor sets it.",
    );
  });

  it("names several deciding factors", () => {
    expect(interpret(evaluation({ Air: "Medium", Noise: "Medium", Health: "Low" }))).toBe(
      "Air and Noise are rated Medium. Of the other factors, 1 is Low. The overall risk takes the highest factor rating, so these factors set it.",
    );
  });

  it("explains an all-Low result", () => {
    expect(interpret(evaluation({ Air: "Low", Noise: "Low" }))).toBe(
      "All 2 factors are within the limits the rules set, so none of them raises the overall risk.",
    );
  });
});
