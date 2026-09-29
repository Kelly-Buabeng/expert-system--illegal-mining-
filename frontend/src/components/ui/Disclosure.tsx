import { useId, useState, type ReactNode } from "react";

interface Props {
  summary: (open: boolean) => ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

/** A toggle that reveals its panel with a height transition. */
export function Disclosure({ summary, children, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className={`disclosure${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="disclosure__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <svg className="disclosure__chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {summary(open)}
      </button>
      <div id={panelId} className="disclosure__panel" inert={!open}>
        <div className="disclosure__inner">{children}</div>
      </div>
    </div>
  );
}
