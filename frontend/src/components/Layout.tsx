import { Link, NavLink, Outlet } from "react-router-dom";
import { api } from "../api/client";
import { KnowledgeBaseContext } from "../lib/knowledgeBase";
import { useResource } from "../lib/useResource";
import { ErrorState, LoadingState } from "./States";

export function Layout() {
  const knowledgeBase = useResource("knowledge-base", api.knowledgeBase);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar__inner">
          <Link to="/assessments" className="brand">
            <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="6" />
              <path d="M6 23 13 11l5 8 3-4 5 8z" />
            </svg>
            <span>Mining Pollution Risk</span>
          </Link>
          <nav className="nav" aria-label="Main">
            <NavLink to="/assessments" end className="nav__link">
              Assessments
            </NavLink>
            <NavLink to="/rules" className="nav__link">
              Rules
            </NavLink>
          </nav>
          <Link to="/assessments/new" className="button button--primary topbar__cta">
            New assessment
          </Link>
        </div>
      </header>
      <main id="main" className="main" tabIndex={-1}>
        {knowledgeBase.data ? (
          <KnowledgeBaseContext.Provider value={knowledgeBase.data}>
            <Outlet />
          </KnowledgeBaseContext.Provider>
        ) : knowledgeBase.error ? (
          <ErrorState
            title="The assessment service is unavailable"
            error={knowledgeBase.error}
            onRetry={knowledgeBase.reload}
          />
        ) : (
          <LoadingState label="Loading…" />
        )}
      </main>
    </div>
  );
}
