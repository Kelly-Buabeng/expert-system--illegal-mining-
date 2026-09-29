import type { Operator } from "../api/types";
import { formatQuantity, operatorSymbol } from "../lib/format";

interface Props {
  label: string;
  unit: string;
  operator: Operator;
  threshold: number;
}

/** Renders a rule condition such as "Water turbidity > 100 NTU". */
export function ConditionText({ label, unit, operator, threshold }: Props) {
  return (
    <>
      {label} <span className="operator">{operatorSymbol(operator)}</span>{" "}
      <span className="num">{formatQuantity(threshold, unit)}</span>
    </>
  );
}
