import type { Indicator, KnowledgeBase, NewAssessment } from "../api/types";
import { formatNumber } from "../lib/format";

export const COMMUNITY_MAX_LENGTH = 120;
export const NOTES_MAX_LENGTH = 2000;

export interface FormValues {
  community: string;
  notes: string;
  observations: Record<string, string>;
}

/** Field errors keyed like the API's: "community", "notes", "observations.<key>". */
export type FormErrors = Record<string, string>;

export function emptyForm(knowledgeBase: KnowledgeBase, community = ""): FormValues {
  return {
    community,
    notes: "",
    observations: Object.fromEntries(knowledgeBase.indicators.map((i) => [i.key, ""])),
  };
}

// Mirrors backend/app/validation.py so users get the same messages before submitting.
export function validateIndicator(indicator: Indicator, raw: string): string | undefined {
  const text = raw.trim();
  if (text === "") return "Enter a value.";
  const value = Number(text);
  if (!Number.isFinite(value)) return "Must be a number.";
  if (indicator.kind === "integer" && !Number.isInteger(value)) return "Must be a whole number.";
  if (value < indicator.minimum || value > indicator.maximum) {
    return `Must be between ${formatNumber(indicator.minimum)} and ${formatNumber(indicator.maximum)}.`;
  }
  return undefined;
}

export function validateCommunity(value: string): string | undefined {
  const text = value.trim();
  if (!text) return "Enter the community name.";
  if (text.length > COMMUNITY_MAX_LENGTH) return `Use ${COMMUNITY_MAX_LENGTH} characters or fewer.`;
  return undefined;
}

export function validateNotes(value: string): string | undefined {
  if (value.trim().length > NOTES_MAX_LENGTH) return `Use ${NOTES_MAX_LENGTH} characters or fewer.`;
  return undefined;
}

export function validateForm(knowledgeBase: KnowledgeBase, values: FormValues): FormErrors {
  const errors: FormErrors = {};
  const community = validateCommunity(values.community);
  if (community) errors.community = community;
  const notes = validateNotes(values.notes);
  if (notes) errors.notes = notes;
  for (const indicator of knowledgeBase.indicators) {
    const error = validateIndicator(indicator, values.observations[indicator.key] ?? "");
    if (error) errors[`observations.${indicator.key}`] = error;
  }
  return errors;
}

export function toPayload(knowledgeBase: KnowledgeBase, values: FormValues): NewAssessment {
  return {
    community: values.community.trim(),
    notes: values.notes.trim(),
    observations: Object.fromEntries(
      knowledgeBase.indicators.map((i) => [i.key, Number(values.observations[i.key])]),
    ),
  };
}

/** DOM id for a field, derived from its error key. */
export function fieldId(key: string): string {
  return `field-${key.replace(".", "-")}`;
}
