import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import type { Factor, RiskLevel } from "../api/types";
import { ConditionText } from "../components/ConditionText";
import { PageHeader } from "../components/PageHeader";
import { RiskLabel } from "../components/RiskLabel";
import { formatQuantity } from "../lib/format";
import { indicatorMap, ruleCount, useKnowledgeBase } from "../lib/knowledgeBase";

const LEVELS_HIGH_FIRST: RiskLevel[] = ["High", "Medium", "Low"];

/** Tracks which section is in view so the contents list can mark it. */
function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = useState<string>();
  const key = ids.join(",");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const id of key.split(",")) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [key]);
  return active;
}

export function RulesPage() {
  const knowledgeBase = useKnowledgeBase();
  const sections = [
    { id: "method", label: "How a conclusion is reached" },
    ...knowledgeBase.factors.map((factor) => ({ id: `factor-${factor.id}`, label: factor.name })),
    { id: "readings", label: "Readings and ranges" },
  ];
  const active = useActiveSection(sections.map((section) => section.id));
  const { hash } = useLocation();

  // The page renders after the knowledge base loads, so the browser's own jump to
  // "#section" has already been missed; do it once the sections exist.
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  }, [hash]);

  return (
    <div className="rules">
      <PageHeader
        title="Rules"
        lead={`The knowledge base behind every assessment: ${ruleCount(knowledgeBase)} rules across ${knowledgeBase.factors.length} factors, ruleset ${knowledgeBase.ruleset_version}. They are fixed thresholds, so the same readings always produce the same conclusion.`}
      />

      <div className="rules__layout">
        <nav className="toc" aria-label="On this page">
          <p className="t-label">On this page</p>
          <ol>
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  aria-current={active === section.id ? "location" : undefined}
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="rules__content">
          <section id="method" className="rules-section" aria-labelledby="method-title">
            <h2 className="t-heading" id="method-title">
              How a conclusion is reached
            </h2>
            <ol className="method">
              <li>
                <p className="t-subheading">Readings</p>
                <p>
                  The assessor records {knowledgeBase.indicators.length} field readings for a
                  community.
                </p>
              </li>
              <li>
                <p className="t-subheading">Factor rules</p>
                <p>
                  Each factor's rules are checked from top to bottom. The first rule whose
                  conditions hold sets the factor's rating.
                </p>
              </li>
              <li>
                <p className="t-subheading">Overall risk</p>
                <p>
                  The highest factor rating wins: one High factor makes the community High;
                  otherwise any Medium factor makes it Medium.
                </p>
              </li>
              <li>
                <p className="t-subheading">Explanation</p>
                <p>
                  Every rule checked, with the observed value for each condition, is saved with the
                  assessment.
                </p>
              </li>
            </ol>
          </section>

          {knowledgeBase.factors.map((factor) => (
            <FactorRules key={factor.id} factor={factor} />
          ))}

          <section id="readings" className="rules-section" aria-labelledby="readings-title">
            <h2 className="t-heading" id="readings-title">
              Readings and ranges
            </h2>
            <p className="t-muted rules-section__intro">
              Values outside these ranges are rejected before any rule runs.
            </p>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Reading</th>
                    <th scope="col">Accepted range</th>
                    <th scope="col">What it measures</th>
                  </tr>
                </thead>
                <tbody>
                  {knowledgeBase.indicators.map((indicator) => (
                    <tr key={indicator.key}>
                      <th scope="row">{indicator.label}</th>
                      <td className="num nowrap">
                        {formatQuantity(indicator.minimum, indicator.unit)} –{" "}
                        {formatQuantity(indicator.maximum, indicator.unit)}
                        {indicator.kind === "integer" && (
                          <span className="t-meta"> whole numbers</span>
                        )}
                      </td>
                      <td className="t-muted">{indicator.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function FactorRules({ factor }: { factor: Factor }) {
  const knowledgeBase = useKnowledgeBase();
  const indicators = indicatorMap(knowledgeBase);

  return (
    <section
      id={`factor-${factor.id}`}
      className="rules-section"
      aria-labelledby={`${factor.id}-title`}
    >
      <h2 className="t-heading" id={`${factor.id}-title`}>
        {factor.name}
      </h2>
      <p className="t-muted rules-section__intro">{factor.description}</p>

      <ol className="rule-list" aria-label={`Rules for ${factor.name}, checked in order`}>
        {factor.rules.map((rule) => (
          <li key={rule.id} className="rule-list__item">
            <span className="rule-id">{rule.id}</span>
            <div className="rule-list__body">
              <p className="rule-list__lead">
                {rule.conditions.length === 1
                  ? "If"
                  : rule.match === "all"
                    ? "If all of these hold"
                    : "If any of these hold"}
              </p>
              <ul className="rule-list__conditions">
                {rule.conditions.map((condition) => {
                  const indicator = indicators.get(condition.indicator);
                  return (
                    <li key={`${condition.indicator}-${condition.operator}`}>
                      <ConditionText
                        label={indicator?.label ?? condition.indicator}
                        unit={indicator?.unit ?? ""}
                        operator={condition.operator}
                        threshold={condition.threshold}
                      />
                    </li>
                  );
                })}
              </ul>
              {rule.note && <p className="rule-list__note">{rule.note}</p>}
            </div>
            <p className="rule-list__then">
              <span className="t-meta">then</span> <RiskLabel level={rule.conclusion} />
            </p>
          </li>
        ))}
      </ol>

      <h3 className="t-label rules-section__subhead">Recommended actions</h3>
      <dl className="recommendations">
        {LEVELS_HIGH_FIRST.map((level) => (
          <div key={level}>
            <dt>
              <RiskLabel level={level} />
            </dt>
            <dd>{factor.recommendations[level]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
