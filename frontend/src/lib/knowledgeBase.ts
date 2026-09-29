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
