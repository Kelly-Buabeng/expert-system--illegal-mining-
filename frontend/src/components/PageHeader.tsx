import type { ReactNode } from "react";

interface Props {
  title: ReactNode;
  lead?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, lead, eyebrow, actions }: Props) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        {eyebrow && <p className="t-label page-header__eyebrow">{eyebrow}</p>}
        <h1 className="t-title">{title}</h1>
        {lead && <p className="t-lead page-header__lead">{lead}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}
