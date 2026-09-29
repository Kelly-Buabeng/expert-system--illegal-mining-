import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { KnowledgeBaseContext } from "../lib/knowledgeBase";
import { useResource } from "../lib/useResource";
import { ErrorState, LoadingState } from "./States";
import { ButtonLink } from "./ui/Button";

export function Layout() {
  const knowledgeBase = useResource("knowledge-base", api.knowledgeBase);
  const location = useLocation();
  const onNewAssessment = location.pathname === "/assessments/new";

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="masthead">
        <div className="masthead__inner">
          <Link to="/assessments" className="wordmark">
            <svg className="wordmark__mark" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 19 9 7l4.5 7 2.5-3.5L22 19z" />
            </svg>
            <span>Mining Pollution Risk</span>
          </Link>
          <nav className="masthead__nav" aria-label="Main">
            <NavLink to="/assessments" end className="nav-link">
              Assessments
            </NavLink>
            <NavLink to="/rules" className="nav-link">
              Rules
            </NavLink>
          </nav>
          {!onNewAssessment && (
            <ButtonLink to="/assessments/new" variant="primary" size="sm" className="masthead__cta">
              New<span className="masthead__cta-more">&nbsp;assessment</span>
            </ButtonLink>
          )}
        </div>
      </header>

      <main id="main" className="main" tabIndex={-1}>
        {knowledgeBase.data ? (
          <KnowledgeBaseContext.Provider value={knowledgeBase.data}>
            <div className="route" key={location.pathname}>
              <Outlet />
            </div>
          </KnowledgeBaseContext.Provider>
        ) : knowledgeBase.error ? (
          <ErrorState
            title="Can't reach the assessment service"
            error={knowledgeBase.error}
            onRetry={knowledgeBase.reload}
          />
        ) : (
          <LoadingState label="Loading the knowledge base…" />
        )}
      </main>

      {knowledgeBase.data && (
        <footer className="colophon">
          <p>
            Ratings come from fixed thresholds in ruleset {knowledgeBase.data.ruleset_version}.{" "}
            <Link to="/rules">See how they work</Link>.
          </p>
        </footer>
      )}
    </div>
  );
}
