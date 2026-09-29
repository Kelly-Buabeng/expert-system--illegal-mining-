import type { ReactNode } from "react";

export interface ControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  /** Keep the hint out of the way until the field is focused. */
  hintOnFocus?: boolean;
  children: (control: ControlProps) => ReactNode;
}

/** Label, control, contextual hint and validation message, wired for assistive tech. */
export function Field({ id, label, hint, error, optional, hintOnFocus, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`field${error ? " field--invalid" : ""}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {optional && <span className="field__optional">Optional</span>}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {error && (
        <p className="field__error" id={errorId}>
          {error}
        </p>
      )}
      {hint && (
        <p className={`field__hint${hintOnFocus ? " field__hint--on-focus" : ""}`} id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}
