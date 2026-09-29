import type { Factor, RiskLevel } from "../api/types";
import { ConditionText } from "../components/ConditionText";
import { PageHeader } from "../components/PageHeader";
import { RiskLevelTag } from "../components/RiskLevelTag";
import { formatQuantity } from "../lib/format";
import { indicatorMap, useKnowledgeBase } from "../lib/knowledgeBase";

const LEVELS_HIGH_FIRST: RiskLevel[] = ["High", "Medium", "Low"];

export function RulesPage() {
  const knowledgeBase = useKnowledgeBase();

  return (
    <div className="page">
      <PageHeader
        title="Rules"
        description={`The knowledge base behind every assessment (ruleset ${knowledgeBase.ruleset_version}). Rules are fixed thresholds, so the same readings always produce the same result.`}
      />

      <section className="section" aria-labelledby="how-title">
        <h2 id="how-title">How a result is reached</h2>
        <ol className="steps">
          <li>
            <strong>Readings.</strong> The assessor records {knowledgeBase.indicators.length} field
            readings for a community.
          </li>
          <li>
            <strong>Factor rules.</strong> Readings are grouped into {knowledgeBase.factors.length}{" "}
            risk factors. Each factor's rules are checked from top to bottom, and the first rule
            whose conditions hold sets the factor's rating.
          </li>
          <li>
            <strong>Overall risk.</strong> The overall risk is the highest factor rating: any High
            factor makes the community High; otherwise any Medium factor makes it Medium.
          </li>
          <li>
            <strong>Explanation.</strong> Every rule checked, with the observed value for each
            condition, is saved with the assessment.
          </li>
        </ol>
      </section>

      <nav className="toc" aria-label="Factors">
        <h2 className="toc__title">Factors</h2>
        <ul>
          {knowledgeBase.factors.map((factor) => (
            <li key={factor.id}>
              <a href={`#factor-${factor.id}`}>{factor.name}</a>
            </li>
          ))}
          <li>
            <a href="#indicators">Readings and accepted ranges</a>
          </li>
        </ul>
      </nav>

      {knowledgeBase.factors.map((factor) => (
        <FactorRules key={factor.id} factor={factor} />
      ))}

      <section className="section" id="indicators" aria-labelledby="indicators-title">
        <h2 id="indicators-title">Readings and accepted ranges</h2>
        <div className="table-scroll">
          <table className="data-table data-table--static">
            <thead>
              <tr>
                <th scope="col">Reading</th>
                <th scope="col">Unit</th>
                <th scope="col">Accepted range</th>
                <th scope="col">What it measures</th>
              </tr>
            </thead>
            <tbody>
              {knowledgeBase.indicators.map((indicator) => (
                <tr key={indicator.key}>
                  <th scope="row">{indicator.label}</th>
                  <td>{indicator.unit}</td>
                  <td className="num">
                    {formatQuantity(indicator.minimum, indicator.unit)} –{" "}
                    {formatQuantity(indicator.maximum, indicator.unit)}
                    {indicator.kind === "integer" && " (whole numbers)"}
                  </td>
                  <td>{indicator.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FactorRules({ factor }: { factor: Factor }) {
  const knowledgeBase = useKnowledgeBase();
  const indicators = indicatorMap(knowledgeBase);

  return (
    <section className="section" id={`factor-${factor.id}`} aria-labelledby={`${factor.id}-title`}>
      <h2 id={`${factor.id}-title`}>{factor.name}</h2>
      <p className="section__intro">{factor.description}</p>
      <div className="table-scroll">
        <table className="data-table data-table--static rules-table">
          <caption className="visually-hidden">Rules for {factor.name}, checked in order</caption>
          <thead>
            <tr>
              <th scope="col">Rule</th>
              <th scope="col">If</th>
              <th scope="col">Rating</th>
            </tr>
          </thead>
          <tbody>
            {factor.rules.map((rule) => (
              <tr key={rule.id}>
                <td>
                  <span className="rule-id">{rule.id}</span>
                </td>
                <td>
                  <span className="rules-table__match">
                    {rule.conditions.length === 1
                      ? ""
                      : rule.match === "all"
                        ? "All of:"
                        : "Any of:"}
                  </span>
                  <ul className="condition-list">
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
                  {rule.note && <p className="rules-table__note">{rule.note}</p>}
                </td>
                <td>
                  <RiskLevelTag level={rule.conclusion} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="subheading">Recommended actions</h3>
      <dl className="recommendations">
        {LEVELS_HIGH_FIRST.map((level) => (
          <div key={level} className="recommendations__row">
            <dt>
              <RiskLevelTag level={level} />
            </dt>
            <dd>{factor.recommendations[level]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
