import type { Operator } from "../api/types";

const OPERATOR_SYMBOLS: Record<Operator, string> = { ">": ">", ">=": "≥", "<": "<", "<=": "≤" };

const numberFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const shortDateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

/** "180 µg/m³"; pH values have no unit suffix and counts read "12 reports". */
export function formatQuantity(value: number, unit: string): string {
  if (unit === "pH" || unit === "") return formatNumber(value);
  if (unit === "%") return `${formatNumber(value)}%`;
  return `${formatNumber(value)} ${unit}`;
}

export function operatorSymbol(operator: Operator): string {
  return OPERATOR_SYMBOLS[operator];
}

export function formatDateTime(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatDate(iso: string): string {
  return shortDateFormat.format(new Date(iso));
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
