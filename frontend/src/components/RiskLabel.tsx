import type { RiskLevel } from "../api/types";

interface Props {
  level: RiskLevel;
  /** "tag" adds a tinted background for dense contexts such as tables. */
  appearance?: "text" | "tag";
}

export function RiskLabel({ level, appearance = "text" }: Props) {
  return (
    <span className={`risk risk--${level.toLowerCase()} risk--${appearance}`}>
      <span className="risk__mark" aria-hidden="true" />
      {level}
    </span>
  );
}
