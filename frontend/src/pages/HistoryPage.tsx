import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { AssessmentSummary, RiskLevel } from "../api/types";
import { PageHeader } from "../components/PageHeader";
import { RiskLabel } from "../components/RiskLabel";
import { EmptyState, ErrorState, Skeleton } from "../components/States";
import { Button, ButtonLink } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { SegmentedControl } from "../components/ui/SegmentedControl";
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

  function clearFilters() {
    setSearchText("");
    setSearchParams({}, { replace: true });
  }

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
    body = <Skeleton lines={5} label="Loading assessments…" />;
  } else if (data.total === 0 && !filtered) {
    body = (
      <EmptyState
        title="No assessments yet"
        action={
          <ButtonLink to="/assessments/new" variant="primary">
            Start the first assessment
          </ButtonLink>
        }
      >
        <p>
          An assessment rates a community's pollution risk from eleven field readings and records
          the reasoning behind the result.
        </p>
        <p>Each one you run appears here, where you can search and filter them later.</p>
      </EmptyState>
    );
  } else if (data.items.length === 0 && data.total > 0) {
    body = (
      <EmptyState
        title="Nothing on this page"
        action={
          <Button onClick={() => updateParams({ page: undefined })}>Go to the first page</Button>
        }
      >
        <p>This page is past the end of the results.</p>
      </EmptyState>
    );
  } else if (data.items.length === 0) {
    body = (
      <EmptyState
        title="No matching assessments"
        action={<Button onClick={clearFilters}>Clear filters</Button>}
      >
        <p>
          Nothing matches{q ? <> &ldquo;{q}&rdquo;</> : null}
          {risk ? ` with ${risk.toLowerCase()} overall risk` : null}. Try a shorter name or another
          risk level.
        </p>
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
          <p className="t-meta" aria-live="polite">
            {formatNumber(first)}–{formatNumber(last)} of {formatNumber(data.total)}
          </p>
          {lastPage > 1 && (
            <div className="pagination__buttons">
              <Button
                size="sm"
                disabled={page <= 1}
                onClick={() => updateParams({ page: page - 1 > 1 ? String(page - 1) : undefined })}
              >
                Previous
              </Button>
              <Button
                size="sm"
                disabled={page >= lastPage}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          )}
        </nav>
      </div>
    );
  }

  return (
    <div className="history">
      <PageHeader
        title="Assessments"
        lead="Every assessment recorded, newest first. Open one to see its conclusion and the reasoning behind it."
      />
      <div className="toolbar" role="search">
        <div className="toolbar__search">
          <Field id="search" label="Community">
            {(control) => (
              <input
                {...control}
                type="search"
                className="input"
                placeholder="Search by name"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            )}
          </Field>
        </div>
        <SegmentedControl
          legend="Overall risk"
          name="risk"
          value={risk ?? "all"}
          options={[
            { value: "all", label: "All" },
            ...RISK_FILTERS.map((level) => ({ value: level, label: level })),
          ]}
          onChange={(value) =>
            updateParams({ risk: value === "all" ? undefined : value, page: undefined })
          }
        />
      </div>
      {body}
    </div>
  );
}

function AssessmentTable({ items }: { items: AssessmentSummary[] }) {
  const { factors } = useKnowledgeBase();
  const navigate = useNavigate();
  return (
    <table className="table history-table">
      <thead>
        <tr>
          <th scope="col">Community</th>
          <th scope="col">Overall risk</th>
          <th scope="col">
            Factors <span className="visually-hidden">, in the order shown on the Rules page</span>
          </th>
          <th scope="col">Recorded</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr
            key={item.id}
            className="history-table__row"
            onClick={(event) => {
              // The community link handles keyboard and modified clicks itself.
              if ((event.target as HTMLElement).closest("a")) return;
              navigate(`/assessments/${item.id}`);
            }}
          >
            <td data-label="Community">
              <Link to={`/assessments/${item.id}`} className="history-table__community">
                {item.community}
              </Link>
              <span className="history-table__id">#{item.id}</span>
            </td>
            <td data-label="Overall risk">
              <RiskLabel level={item.overall_risk} />
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
            <td data-label="Recorded" className="t-muted">
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
