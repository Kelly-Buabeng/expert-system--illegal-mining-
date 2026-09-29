import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { AssessmentSummary, RiskLevel } from "../api/types";
import { PageHeader } from "../components/PageHeader";
import { RiskLevelTag } from "../components/RiskLevelTag";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { formatDate, formatDateTime, formatNumber } from "../lib/format";
import { useKnowledgeBase } from "../lib/knowledgeBase";
import { useResource } from "../lib/useResource";

const PAGE_SIZE = 20;
const RISK_FILTERS: RiskLevel[] = ["High", "Medium", "Low"];

function parseRisk(value: string | null): RiskLevel | undefined {
  return RISK_FILTERS.find((level) => level === value);
}

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const risk = parseRisk(searchParams.get("risk"));
  const page = parsePage(searchParams.get("page"));
  const [searchText, setSearchText] = useState(q);

  const list = useResource(`assessments?${q}|${risk ?? ""}|${page}`, (signal) =>
    api.listAssessments({ q, risk, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }, signal),
  );

  function updateParams(changes: Record<string, string | undefined>) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  }

  // Apply the search after the user pauses typing.
  useEffect(() => {
    if (searchText.trim() === q) return;
    const timer = window.setTimeout(() => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (searchText.trim()) next.set("q", searchText.trim());
          else next.delete("q");
          next.delete("page");
          return next;
        },
        { replace: true },
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchText, q, setSearchParams]);

  const filtered = q !== "" || risk !== undefined;
  const data = list.data;

  let body;
  if (list.error) {
    body = (
      <ErrorState
        title="Assessments could not be loaded"
        error={list.error}
        onRetry={list.reload}
      />
    );
  } else if (!data) {
    body = <LoadingState label="Loading assessments…" />;
  } else if (data.total === 0 && !filtered) {
    body = (
      <EmptyState
        title="No assessments yet"
        action={
          <Link className="button button--primary" to="/assessments/new">
            Start the first assessment
          </Link>
        }
      >
        Record field readings for a community to get its pollution risk rating, with the reasoning
        behind it.
      </EmptyState>
    );
  } else if (data.items.length === 0 && data.total > 0) {
    body = (
      <EmptyState
        title="Nothing on this page"
        action={
          <button
            type="button"
            className="button button--secondary"
            onClick={() => updateParams({ page: undefined })}
          >
            Go to the first page
          </button>
        }
      >
        This page is past the end of the results.
      </EmptyState>
    );
  } else if (data.items.length === 0) {
    body = (
      <EmptyState
        title="No matching assessments"
        action={
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              setSearchText("");
              setSearchParams({}, { replace: true });
            }}
          >
            Clear filters
          </button>
        }
      >
        No assessments match the current search and risk filter.
      </EmptyState>
    );
  } else {
    const first = data.offset + 1;
    const last = data.offset + data.items.length;
    const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
    body = (
      <div className={list.loading ? "is-refreshing" : undefined} aria-busy={list.loading}>
        <AssessmentTable items={data.items} />
        <nav className="pagination" aria-label="Pagination">
          <p className="pagination__status" aria-live="polite">
            {formatNumber(first)}–{formatNumber(last)} of {formatNumber(data.total)}
          </p>
          <div className="pagination__buttons">
            <button
              type="button"
              className="button button--secondary"
              disabled={page <= 1}
              onClick={() => updateParams({ page: page - 1 > 1 ? String(page - 1) : undefined })}
            >
              Previous
            </button>
            <button
              type="button"
              className="button button--secondary"
              disabled={page >= lastPage}
              onClick={() => updateParams({ page: String(page + 1) })}
            >
              Next
            </button>
          </div>
        </nav>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title="Assessments" description="Every assessment recorded, newest first." />
      <div className="toolbar" role="search">
        <div className="field field--inline">
          <label htmlFor="search">Community</label>
          <input
            id="search"
            type="search"
            className="input"
            placeholder="Search by name"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </div>
        <fieldset className="segmented">
          <legend>Overall risk</legend>
          {[undefined, ...RISK_FILTERS].map((level) => (
            <label key={level ?? "all"} className="segmented__option">
              <input
                type="radio"
                name="risk"
                checked={risk === level}
                onChange={() => updateParams({ risk: level, page: undefined })}
              />
              <span>{level ?? "All"}</span>
            </label>
          ))}
        </fieldset>
      </div>
      {body}
    </div>
  );
}

function AssessmentTable({ items }: { items: AssessmentSummary[] }) {
  const { factors } = useKnowledgeBase();
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Community</th>
          <th scope="col">Overall risk</th>
          <th scope="col">Factors</th>
          <th scope="col">Recorded</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td data-label="Community">
              <Link to={`/assessments/${item.id}`} className="data-table__primary">
                {item.community}
              </Link>
              <span className="data-table__secondary">#{item.id}</span>
            </td>
            <td data-label="Overall risk">
              <RiskLevelTag level={item.overall_risk} />
            </td>
            <td data-label="Factors">
              <ul className="factor-strip" aria-label="Factor ratings">
                {factors.map((factor) => {
                  const level = item.factor_levels[factor.id];
                  if (!level) return null;
                  return (
                    <li
                      key={factor.id}
                      className={`factor-strip__cell factor-strip__cell--${level.toLowerCase()}`}
                      title={`${factor.name}: ${level}`}
                    >
                      <span className="visually-hidden">
                        {factor.name}: {level}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </td>
            <td data-label="Recorded">
              <time dateTime={item.created_at} title={formatDateTime(item.created_at)}>
                {formatDate(item.created_at)}
              </time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
