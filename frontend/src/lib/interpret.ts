import type { Evaluation, RiskLevel } from "../api/types";
import { joinNames } from "./format";

const LEVELS_HIGH_FIRST: RiskLevel[] = ["High", "Medium", "Low"];

/** Plain-language reading of how the factor ratings produced the overall risk. */
export function interpret(evaluation: Evaluation): string {
  const { factors, overall_risk: overall } = evaluation;
  if (overall === "Low") {
    return `All ${factors.length} factors are within the limits the rules set, so none of them raises the overall risk.`;
  }
  const drivers = factors.filter((f) => f.level === overall);
  const others = factors.filter((f) => f.level !== overall);
  const verb = drivers.length === 1 ? "is" : "are";
  const parts = [`${joinNames(drivers.map((f) => f.name))} ${verb} rated ${overall}.`];
  if (others.length > 0) {
    const counts = LEVELS_HIGH_FIRST.map(
      (level) => [level, others.filter((f) => f.level === level).length] as const,
    )
      .filter(([, count]) => count > 0)
      .map(([level, count]) => `${count} ${count === 1 ? "is" : "are"} ${level}`);
    parts.push(`Of the other factors, ${joinNames(counts)}.`);
  }
  parts.push(
    drivers.length === 1
      ? "The overall risk takes the highest factor rating, so this one factor sets it."
      : "The overall risk takes the highest factor rating, so these factors set it.",
  );
  return parts.join(" ");
}
