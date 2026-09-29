import { Link, useLocation, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Assessment, ConditionTrace, FactorResult, RuleTrace } from "../api/types";
import { ConditionText } from "../components/ConditionText";
import { NotFound } from "../components/NotFound";
import { PageHeader } from "../components/PageHeader";
import { RiskLevelTag } from "../components/RiskLevelTag";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { formatDateTime, formatQuantity, joinNames, operatorSymbol } from "../lib/format";
import { indicatorMap, useKnowledgeBase } from "../lib/knowledgeBase";
import { useResource } from "../lib/useResource";

export function AssessmentPage() {
  const params = useParams();
  const location = useLocation();
  const id = Number(params.id);
  const valid = Number.isInteger(id) && id > 0;
  const assessment = useResource(`assessment-${id}`, (signal) =>
    valid ? api.getAssessment(id, signal) : Promise.reject(new Error("invalid id")),
  );
  const justCreated = (location.state as { created?: boolean } | null)?.created === true;

  if (!valid) return <NotFound />;
  if (assessment.loading) return <LoadingState label="Loading assessment…" />;
  if (assessment.error?.status === 404) {
    return (
      <EmptyState
        title="Assessment not found"
        action={
          <Link className="button button--secondary" to="/assessments">
            View all assessments
          </Link>
        }
      >
        Assessment #{id} does not exist.
      </EmptyState>
    );
  }
  if (assessment.error) {
    return (
      <ErrorState
        title="This assessment could not be loaded"
        error={assessment.error}
        onRetry={assessment.reload}
      />
    );
  }
  if (!assessment.data) return <LoadingState label="Loading assessment…" />;
  return <AssessmentDetail assessment={assessment.data} justCreated={justCreated} />;
}

function AssessmentDetail({
  assessment,
  justCreated,
}: {
  assessment: Assessment;
  justCreated: boolean;
}) {
  const { evaluation } = assessment;
  const drivers = evaluation.factors.filter((f) => evaluation.drivers.includes(f.id));

  return (
    <div className="page">
      <Link to="/assessments" className="back-link">
        ← All assessments
      </Link>

      {justCreated && (
        <div className="alert alert--success" role="status">
          Assessment saved. It is now part of the assessment history.
        </div>
      )}

      <PageHeader
        eyebrow={`Assessment #${assessment.id}`}
        title={assessment.community}
        description={
          <>
            Recorded {formatDateTime(assessment.created_at)} · Ruleset {assessment.ruleset_version}
          </>
        }
        actions={
          <Link
            className="button button--secondary"
            to={`/assessments/new?community=${encodeURIComponent(assessment.community)}`}
          >
            Reassess community
          </Link>
        }
      />

      <section
        className={`verdict verdict--${evaluation.overall_risk.toLowerCase()}`}
        aria-labelledby="verdict-title"
      >
        <h2 id="verdict-title" className="verdict__label">
          Overall risk
        </h2>
        <RiskLevelTag level={evaluation.overall_risk} size="large" />
        <p className="verdict__reason">
          {evaluation.overall_risk === "Low" ? (
            <>Every factor is rated Low.</>
          ) : (
            <>
              Rated {evaluation.overall_risk} because{" "}
              <strong>{joinNames(drivers.map((f) => f.name))}</strong>{" "}
              {drivers.length === 1 ? "is" : "are"} rated {evaluation.overall_risk}.
            </>
          )}{" "}
          The overall risk is the highest rating among the {evaluation.factors.length} factors.
        </p>
      </section>

      <section className="section" aria-labelledby="factors-title">
        <h2 id="factors-title">Factor ratings</h2>
        <p className="section__intro">
          Each factor's rules are checked in order and the first rule that matches decides its
          rating.
        </p>
        <ol className="factor-list">
          {evaluation.factors.map((factor) => (
            <FactorRow key={factor.id} factor={factor} />
          ))}
        </ol>
      </section>

      <div className="detail-columns">
        <Observations assessment={assessment} />
        <section className="section" aria-labelledby="notes-title">
          <h2 id="notes-title">Notes</h2>
          {assessment.notes ? (
            <p className="notes">{assessment.notes}</p>
          ) : (
            <p className="muted">No notes were recorded.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function FactorRow({ factor }: { factor: FactorResult }) {
  const fired = factor.rules.find((rule) => rule.fired);
  return (
    <li className="factor">
      <div className="factor__head">
        <h3 className="factor__name">{factor.name}</h3>
        <RiskLevelTag level={factor.level} />
      </div>
      {fired && (
        <p className="factor__why">
          <span className="rule-id">{fired.id}</span> <FiredReason rule={fired} />
        </p>
      )}
      <p className="factor__action">
        <span className="factor__action-label">Recommended action</span> {factor.recommendation}
      </p>
      <details className="trace">
        <summary>
          Show reasoning ({factor.rules.length} {factor.rules.length === 1 ? "rule" : "rules"}{" "}
          checked)
        </summary>
        <ol className="trace__rules">
          {factor.rules.map((rule) => (
            <RuleTraceItem key={rule.id} rule={rule} />
          ))}
        </ol>
      </details>
    </li>
  );
}

function FiredReason({ rule }: { rule: RuleTrace }) {
  const shown = rule.match === "all" ? rule.conditions : rule.conditions.filter((c) => c.satisfied);
  // Range rules test one reading twice ("> 20" and "<= 50"); state the reading once.
  const byIndicator = new Map<string, ConditionTrace[]>();
  for (const condition of shown) {
    byIndicator.set(condition.indicator, [
      ...(byIndicator.get(condition.indicator) ?? []),
      condition,
    ]);
  }
  return (
    <>
      matched:{" "}
      {[...byIndicator.values()].map((conditions, index) => {
        const [first] = conditions;
        if (!first) return null;
        return (
          <span key={first.indicator}>
            {index > 0 && "; "}
            {first.label} was{" "}
            <span className="num">{formatQuantity(first.observed, first.unit)}</span> (rule:{" "}
            {conditions.map((c, i) => (
              <span key={c.operator}>
                {i > 0 && " and "}
                <span className="operator">{operatorSymbol(c.operator)}</span>{" "}
                <span className="num">{formatQuantity(c.threshold, c.unit)}</span>
              </span>
            ))}
            )
          </span>
        );
      })}
      .
    </>
  );
}

function RuleTraceItem({ rule }: { rule: RuleTrace }) {
  return (
    <li className={`trace-rule ${rule.fired ? "trace-rule--fired" : ""}`}>
      <div className="trace-rule__head">
        <span className="rule-id">{rule.id}</span>
        <span>
          If {rule.match === "all" ? "all" : "any"} of these hold, rate{" "}
          <strong>{rule.conclusion}</strong>
        </span>
        <span className="trace-rule__outcome">{rule.fired ? "Matched" : "Did not match"}</span>
      </div>
      <table className="trace-table">
        <caption className="visually-hidden">Conditions of rule {rule.id}</caption>
        <thead>
          <tr>
            <th scope="col">Condition</th>
            <th scope="col">Observed</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {rule.conditions.map((condition) => (
            <ConditionRow key={`${condition.indicator}-${condition.operator}`} c={condition} />
          ))}
        </tbody>
      </table>
    </li>
  );
}

function ConditionRow({ c }: { c: ConditionTrace }) {
  return (
    <tr className={c.satisfied ? "is-met" : "is-unmet"}>
      <td>
        <ConditionText
          label={c.label}
          unit={c.unit}
          operator={c.operator}
          threshold={c.threshold}
        />
      </td>
      <td className="num">{formatQuantity(c.observed, c.unit)}</td>
      <td>
        <span className="check" aria-hidden="true">
          {c.satisfied ? "✓" : "✗"}
        </span>{" "}
        {c.satisfied ? "Met" : "Not met"}
      </td>
    </tr>
  );
}

function Observations({ assessment }: { assessment: Assessment }) {
  const knowledgeBase = useKnowledgeBase();
  const indicators = indicatorMap(knowledgeBase);
  return (
    <section className="section" aria-labelledby="observations-title">
      <h2 id="observations-title">Field readings</h2>
      <table className="readings">
        <tbody>
          {Object.entries(assessment.observations).map(([key, value]) => {
            const indicator = indicators.get(key);
            return (
              <tr key={key}>
                <th scope="row">{indicator?.label ?? key}</th>
                <td className="num">{formatQuantity(value, indicator?.unit ?? "")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
