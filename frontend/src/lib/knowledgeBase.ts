import { createContext, useContext } from "react";
import type { Indicator, KnowledgeBase } from "../api/types";

export const KnowledgeBaseContext = createContext<KnowledgeBase | null>(null);

export function useKnowledgeBase(): KnowledgeBase {
  const knowledgeBase = useContext(KnowledgeBaseContext);
  if (!knowledgeBase) throw new Error("useKnowledgeBase must be used inside KnowledgeBaseContext");
  return knowledgeBase;
}

export function indicatorMap(knowledgeBase: KnowledgeBase): Map<string, Indicator> {
  return new Map(knowledgeBase.indicators.map((indicator) => [indicator.key, indicator]));
}

/** Distinct thresholds the rules compare an indicator against, ascending. */
export function thresholdsFor(knowledgeBase: KnowledgeBase, indicatorKey: string): number[] {
  const values = new Set<number>();
  for (const factor of knowledgeBase.factors) {
    for (const rule of factor.rules) {
      for (const condition of rule.conditions) {
        if (condition.indicator === indicatorKey) values.add(condition.threshold);
      }
    }
  }
  return [...values].sort((a, b) => a - b);
}

export function ruleCount(knowledgeBase: KnowledgeBase): number {
  return knowledgeBase.factors.reduce((total, factor) => total + factor.rules.length, 0);
}
