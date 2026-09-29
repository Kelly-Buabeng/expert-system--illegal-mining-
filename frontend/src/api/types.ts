// Mirrors the JSON contract of the Flask API (backend/app/api.py).

export type RiskLevel = "Low" | "Medium" | "High";
export type Operator = ">" | ">=" | "<" | "<=";

export interface Indicator {
  key: string;
  label: string;
  unit: string;
  kind: "integer" | "decimal";
  minimum: number;
  maximum: number;
  description: string;
}

export interface RuleCondition {
  indicator: string;
  operator: Operator;
  threshold: number;
}

export interface Rule {
  id: string;
  conclusion: RiskLevel;
  match: "all" | "any";
  note: string;
  conditions: RuleCondition[];
}

export interface Factor {
  id: string;
  name: string;
  description: string;
  indicators: string[];
  rules: Rule[];
  recommendations: Record<RiskLevel, string>;
}

export interface KnowledgeBase {
  ruleset_version: string;
  risk_levels: RiskLevel[];
  indicators: Indicator[];
  factors: Factor[];
}

export interface ConditionTrace extends RuleCondition {
  label: string;
  unit: string;
  observed: number;
  satisfied: boolean;
}

export interface RuleTrace {
  id: string;
  conclusion: RiskLevel;
  match: "all" | "any";
  fired: boolean;
  conditions: ConditionTrace[];
}

export interface FactorResult {
  id: string;
  name: string;
  level: RiskLevel;
  fired_rule: string;
  recommendation: string;
  rules: RuleTrace[];
}

export interface Evaluation {
  overall_risk: RiskLevel;
  ruleset_version: string;
  drivers: string[];
  factors: FactorResult[];
}

export interface Assessment {
  id: number;
  community: string;
  notes: string;
  observations: Record<string, number>;
  evaluation: Evaluation;
  overall_risk: RiskLevel;
  ruleset_version: string;
  created_at: string;
}

export interface AssessmentSummary {
  id: number;
  community: string;
  overall_risk: RiskLevel;
  factor_levels: Record<string, RiskLevel>;
  ruleset_version: string;
  created_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface NewAssessment {
  community: string;
  notes: string;
  observations: Record<string, number>;
}

export interface ListQuery {
  q?: string;
  risk?: RiskLevel;
  limit?: number;
  offset?: number;
}
