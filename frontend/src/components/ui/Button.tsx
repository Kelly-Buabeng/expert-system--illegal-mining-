import type { ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "sm" | "md" | "lg";

interface Appearance {
  variant?: Variant;
  size?: Size;
}

function buttonClass({ variant = "secondary", size = "md" }: Appearance, extra = ""): string {
  return `button button--${variant} button--${size} ${extra}`.trim();
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, Appearance {
  loading?: boolean;
}

export function Button({
  variant,
  size,
  loading = false,
  className = "",
  type = "button",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, className = "", ...rest }: LinkProps & Appearance) {
  return <Link className={buttonClass({ variant, size }, className)} {...rest} />;
}
