import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api } from "../api/client";
import type {
  Assessment,
  ConditionTrace,
  Evaluation,
  FactorResult,
  RiskLevel,
  RuleTrace,
} from "../api/types";
import { ConditionText } from "../components/ConditionText";
import { NotFound } from "../components/NotFound";
import { RiskLabel } from "../components/RiskLabel";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { ButtonLink } from "../components/ui/Button";
import { Disclosure } from "../components/ui/Disclosure";
import { formatDateTime, formatQuantity, operatorSymbol } from "../lib/format";
import { indicatorMap, useKnowledgeBase } from "../lib/knowledgeBase";
import { interpret } from "../lib/interpret";
import { useResource } from "../lib/useResource";

const LEVELS: RiskLevel[] = ["Low", "Medium", "High"];
const SEVERITY: Record<RiskLevel, number> = { Low: 0, Medium: 1, High: 2 };

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
  if (assessment.loading) return <LoadingState label="Loading the assessment…" />;
  if (assessment.error?.status === 404) {
    return (
      <EmptyState
        title="Assessment not found"
        action={<ButtonLink to="/assessments">View all assessments</ButtonLink>}
      >
        <p>There is no assessment #{id}. It may have been mistyped.</p>
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
  if (!assessment.data) return <LoadingState label="Loading the assessment…" />;
  return <AssessmentResult assessment={assessment.data} justCreated={justCreated} />;
}

/** Indicators that met a condition of the rule that raised a factor above Low. */
function decisiveIndicators(evaluation: Evaluation): Set<string> {
  const decisive = new Set<string>();
  for (const factor of evaluation.factors) {
    if (factor.level === "Low") continue;
    const fired = factor.rules.find((rule) => rule.fired);
    for (const condition of fired?.conditions ?? []) {
      if (condition.satisfied) decisive.add(condition.indicator);
    }
  }
  return decisive;
}

function AssessmentResult({
  assessment,
  justCreated,
}: {
  assessment: Assessment;
  justCreated: boolean;
}) {
  const { evaluation } = assessment;
  const level = evaluation.overall_risk;

  return (
    <article className="result">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/assessments">Assessments</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Assessment {assessment.id}</span>
      </nav>

      <header className="conclusion reveal">
        <p className="t-label" style={{ "--i": 0 } as CSSProperties}>
          Conclusion
        </p>
        <h1 className="t-display conclusion__statement" style={{ "--i": 1 } as CSSProperties}>
          {assessment.community} is at{" "}
          <span className={`level-word level-word--${level.toLowerCase()}`}>
            {level.toLowerCase()} risk
          </span>{" "}
          from illegal-mining pollution.
        </h1>
        <p className="t-lead conclusion__interpretation" style={{ "--i": 2 } as CSSProperties}>
          {interpret(evaluation)}
        </p>
        <p className="t-meta conclusion__meta" style={{ "--i": 3 } as CSSProperties}>
          Recorded {formatDateTime(assessment.created_at)} · Ruleset {assessment.ruleset_version}
          {justCreated && (
            <span className="conclusion__saved" role="status">
              Saved to the assessment history
            </span>
          )}
        </p>
      </header>

      <ResultSection
        index="01"
        id="ratings"
        title="Factor ratings"
        description="Each factor is rated on its own. The highest rating becomes the overall risk."
      >
        <FactorScale evaluation={evaluation} />
      </ResultSection>

      <ResultSection
        index="02"
        id="reasoning"
        title="Reasoning"
        description="Rules are checked in order and the first one that matches decides the factor's rating."
      >
        <ol className="reasoning">
          {evaluation.factors.map((factor) => (
            <FactorReasoning key={factor.id} factor={factor} />
          ))}
        </ol>
        <aside className="caveat">
          <p className="t-subheading">About this result</p>
          <p>
            Ratings come from fixed thresholds, not a statistical model, so there is no confidence
            score. The same readings always give the same result, and the conclusion is only as
            reliable as the readings entered. <Link to="/rules">Read the rules</Link>.
          </p>
        </aside>
      </ResultSection>

      <ResultSection
        index="03"
        id="evidence"
        title="Evidence"
        description="The readings as recorded. Readings marked Decisive met a condition of the rule that raised a factor above Low."
      >
        <Readings assessment={assessment} />
      </ResultSection>

      <ResultSection
        index="04"
        id="next-steps"
        title="Next steps"
        description="Actions recommended for each factor above Low, most severe first."
      >
        <NextSteps assessment={assessment} />
      </ResultSection>
    </article>
  );
}

interface ResultSectionProps {
  index: string;
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}

function ResultSection({ index, id, title, description, children }: ResultSectionProps) {
  return (
    <section className="result-section" aria-labelledby={`${id}-title`}>
      <header className="result-section__head">
        <span className="result-section__index mono" aria-hidden="true">
          {index}
        </span>
        <h2 className="t-heading" id={`${id}-title`}>
          {title}
        </h2>
        <p className="t-meta">{description}</p>
      </header>
      <div className="result-section__body">{children}</div>
    </section>
  );
}

function FactorScale({ evaluation }: { evaluation: Evaluation }) {
  return (
    <table className="scale">
      <caption className="visually-hidden">Rating of each factor</caption>
      <thead>
        <tr>
          <th scope="col">Factor</th>
          {LEVELS.map((level) => (
            <th
              scope="col"
              key={level}
              className={`scale__level scale__level--${level.toLowerCase()}`}
            >
              {level}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {evaluation.factors.map((factor, index) => (
          <tr key={factor.id} style={{ "--i": index } as CSSProperties}>
            <th scope="row">{factor.name}</th>
            {LEVELS.map((level) => (
              <td key={level} className="scale__cell">
                {factor.level === level ? (
                  <span className={`scale__mark scale__mark--${level.toLowerCase()}`}>
                    <span className="visually-hidden">Rated {level}</span>
                  </span>
                ) : (
                  <span className="scale__tick" aria-hidden="true" />
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FactorReasoning({ factor }: { factor: FactorResult }) {
  const fired = factor.rules.find((rule) => rule.fired);
  return (
    <li className="reasoning__item">
      <div className="reasoning__head">
        <h3 className="t-subheading">{factor.name}</h3>
        <RiskLabel level={factor.level} />
      </div>
      {fired && (
        <p className="reasoning__because">
          <FiredReason rule={fired} />
        </p>
      )}
      <Disclosure
        summary={(open) =>
          open
            ? "Hide the rules checked"
            : `Show the ${factor.rules.length} ${factor.rules.length === 1 ? "rule" : "rules"} checked`
        }
      >
        <ol className="trace">
          {factor.rules.map((rule) => (
            <RuleTraceItem key={rule.id} rule={rule} />
          ))}
        </ol>
      </Disclosure>
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
      <span className="rule-id">{rule.id}</span> matched:{" "}
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
    <li className={`trace__rule${rule.fired ? " is-fired" : ""}`}>
      <div className="trace__head">
        <span className="rule-id">{rule.id}</span>
        <span>
          If {rule.match === "all" ? "all" : "any"} of these hold, rate{" "}
          <strong className="trace__conclusion">{rule.conclusion}</strong>
        </span>
        <span className="trace__outcome">{rule.fired ? "Matched" : "Did not match"}</span>
      </div>
      <table className="trace__table">
        <caption className="visually-hidden">Conditions of rule {rule.id}</caption>
        <thead>
          <tr>
            <th scope="col">Condition</th>
            <th scope="col">Observed</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {rule.conditions.map((c) => (
            <tr
              key={`${c.indicator}-${c.operator}`}
              className={c.satisfied ? "is-met" : "is-unmet"}
            >
              <td>
                <ConditionText
                  label={c.label}
                  unit={c.unit}
                  operator={c.operator}
                  threshold={c.threshold}
                />
              </td>
              <td className="num">{formatQuantity(c.observed, c.unit)}</td>
              <td>{c.satisfied ? "Met" : "Not met"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </li>
  );
}

function Readings({ assessment }: { assessment: Assessment }) {
  const knowledgeBase = useKnowledgeBase();
  const indicators = indicatorMap(knowledgeBase);
  const decisive = decisiveIndicators(assessment.evaluation);
  return (
    <>
      <dl className="readings">
        {Object.entries(assessment.observations).map(([key, value]) => {
          const indicator = indicators.get(key);
          const isDecisive = decisive.has(key);
          return (
            <div key={key} className={isDecisive ? "is-decisive" : undefined}>
              <dt>
                {indicator?.label ?? key}
                {isDecisive && <span className="readings__flag">Decisive</span>}
              </dt>
              <dd className="num">{formatQuantity(value, indicator?.unit ?? "")}</dd>
            </div>
          );
        })}
      </dl>
      <div className="notes">
        <p className="t-subheading">Assessor's notes</p>
        {assessment.notes ? (
          <p className="notes__text">{assessment.notes}</p>
        ) : (
          <p className="t-meta">No notes were recorded.</p>
        )}
      </div>
    </>
  );
}

function NextSteps({ assessment }: { assessment: Assessment }) {
  const raised = assessment.evaluation.factors
    .filter((factor) => factor.level !== "Low")
    .sort((a, b) => SEVERITY[b.level] - SEVERITY[a.level]);
  const reassess = `/assessments/new?community=${encodeURIComponent(assessment.community)}`;

  return (
    <>
      {raised.length > 0 ? (
        <ol className="actions">
          {raised.map((factor) => (
            <li key={factor.id}>
              <RiskLabel level={factor.level} appearance="tag" />
              <div>
                <p className="t-subheading">{factor.name}</p>
                <p className="t-muted">{factor.recommendation}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="t-muted">
          No factor is above Low. No action is needed beyond routine monitoring; reassess the
          community when conditions change.
        </p>
      )}
      <div className="result__actions">
        <ButtonLink to={reassess} variant="primary">
          Reassess {assessment.community}
        </ButtonLink>
        <ButtonLink to="/assessments" variant="quiet">
          All assessments
        </ButtonLink>
      </div>
    </>
  );
}
