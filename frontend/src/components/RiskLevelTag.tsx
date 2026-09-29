import type { RiskLevel } from "../api/types";

interface Props {
  level: RiskLevel;
  size?: "default" | "large";
}

export function RiskLevelTag({ level, size = "default" }: Props) {
  return (
    <span className={`risk risk--${level.toLowerCase()} risk--${size}`}>
      <span className="risk__mark" aria-hidden="true" />
      {level}
    </span>
  );
}
