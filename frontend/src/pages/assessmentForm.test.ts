import { describe, expect, it } from "vitest";
import { knowledgeBase } from "../test/fixtures";
import { emptyForm, toPayload, validateForm, validateIndicator } from "./assessmentForm";

const indicator = (key: string) => knowledgeBase.indicators.find((i) => i.key === key)!;

describe("validateIndicator", () => {
  it.each([
    ["ph", "", "Enter a value."],
    ["ph", "abc", "Must be a number."],
    ["ph", "14.5", "Must be between 0 and 14."],
    ["reports", "2.5", "Must be a whole number."],
    ["turbidity", "10001", "Must be between 0 and 10,000."],
  ])("%s = %j → %s", (key, raw, message) => {
    expect(validateIndicator(indicator(key), raw)).toBe(message);
  });

  it("accepts values inside the range, including the limits", () => {
    expect(validateIndicator(indicator("ph"), "0")).toBeUndefined();
    expect(validateIndicator(indicator("ph"), " 14 ")).toBeUndefined();
    expect(validateIndicator(indicator("reports"), "6")).toBeUndefined();
  });
});

describe("validateForm and toPayload", () => {
  it("reports every empty field", () => {
    const errors = validateForm(knowledgeBase, emptyForm(knowledgeBase));
    expect(Object.keys(errors)).toHaveLength(12);
    expect(errors.community).toBe("Enter the community name.");
  });

  it("builds the API payload with numbers", () => {
    const values = emptyForm(knowledgeBase, "  Tarkwa ");
    for (const i of knowledgeBase.indicators) values.observations[i.key] = "7";
    expect(validateForm(knowledgeBase, values)).toEqual({});
    const payload = toPayload(knowledgeBase, values);
    expect(payload.community).toBe("Tarkwa");
    expect(payload.observations.ph).toBe(7);
    expect(Object.keys(payload.observations)).toHaveLength(11);
  });
});
