import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, api } from "../api/client";
import type { Indicator, KnowledgeBase } from "../api/types";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Field } from "../components/ui/Field";
import { formatQuantity, joinNames } from "../lib/format";
import { indicatorMap, ruleCount, thresholdsFor, useKnowledgeBase } from "../lib/knowledgeBase";
import { useResource } from "../lib/useResource";
import {
  COMMUNITY_MAX_LENGTH,
  STEPS,
  emptyForm,
  errorsForStep,
  fieldId,
  firstIncompleteStep,
  parseStep,
  stepOf,
  toPayload,
  validateCommunity,
  validateForm,
  validateIndicator,
  validateNotes,
  type FormErrors,
  type FormValues,
  type Step,
} from "./assessmentForm";

const DRAFT_KEY = "assessment-draft";

const STEP_LABELS: Record<Step, string> = {
  community: "Community",
  readings: "Field readings",
  review: "Review and run",
};

function loadDraft(knowledgeBase: KnowledgeBase, community: string | null): FormValues {
  const blank = emptyForm(knowledgeBase, community ?? "");
  if (community !== null) return blank;
  try {
    const stored = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null") as FormValues | null;
    if (!stored) return blank;
    return {
      community: String(stored.community ?? ""),
      notes: String(stored.notes ?? ""),
      observations: { ...blank.observations, ...stored.observations },
    };
  } catch {
    return blank;
  }
}

function saveDraft(values: FormValues | null) {
  try {
    if (values) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(values));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage can be unavailable (private mode, quota); the draft is only a convenience.
  }
}

function isDirty(values: FormValues): boolean {
  return (
    values.community.trim() !== "" ||
    values.notes.trim() !== "" ||
    Object.values(values.observations).some((v) => v.trim() !== "")
  );
}

export function NewAssessmentPage() {
  const knowledgeBase = useKnowledgeBase();
  const indicators = indicatorMap(knowledgeBase);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [values, setValues] = useState(() =>
    loadDraft(knowledgeBase, searchParams.get("community")),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [summaryStep, setSummaryStep] = useState<Step | null>(null);
  // Incremented on each blocked attempt so the summary receives focus once per attempt.
  const [blockedAttempts, setBlockedAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const communities = useResource("communities", api.communities);

  const reachable = firstIncompleteStep(knowledgeBase, values);
  const requested = parseStep(searchParams.get("step"));
  const step = STEPS.indexOf(requested) > STEPS.indexOf(reachable) ? reachable : requested;

  useEffect(() => saveDraft(values), [values]);

  // "?community=" only seeds a new draft; drop it so a refresh restores the draft instead.
  useEffect(() => {
    if (!searchParams.has("community")) return;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("community");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (blockedAttempts > 0) summaryRef.current?.focus();
  }, [blockedAttempts]);

  // Moving between steps: bring the step into view and move focus to its heading,
  // or to a specific group when arriving from an "Edit" link.
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    const target = location.hash ? document.getElementById(location.hash.slice(1)) : null;
    if (target) {
      target.scrollIntoView({ block: "start" });
      target.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true });
    } else {
      window.scrollTo({ top: 0 });
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [step, location.hash]);

  function goTo(next: Step, hash = "") {
    setSummaryStep(null);
    navigate({ search: next === "community" ? "" : `?step=${next}`, hash });
  }

  function labelFor(key: string): string {
    if (key === "community") return "Community name";
    if (key === "notes") return "Notes";
    return indicators.get(key.replace("observations.", ""))?.label ?? key;
  }

  function setFieldError(key: string, error: string | undefined) {
    setErrors((current) => {
      if (current[key] === error) return current;
      const next = { ...current };
      if (error) next[key] = error;
      else delete next[key];
      return next;
    });
  }

  function validateField(key: string, next: FormValues): string | undefined {
    if (key === "community") return validateCommunity(next.community);
    if (key === "notes") return validateNotes(next.notes);
    const indicator = indicators.get(key.replace("observations.", ""));
    return indicator && validateIndicator(indicator, next.observations[indicator.key] ?? "");
  }

  function readValue(key: string, from: FormValues): string {
    if (key === "community" || key === "notes") return from[key];
    return from.observations[key.replace("observations.", "")] ?? "";
  }

  function update(key: string, value: string) {
    const next =
      key === "community" || key === "notes"
        ? { ...values, [key]: value }
        : {
            ...values,
            observations: { ...values.observations, [key.replace("observations.", "")]: value },
          };
    setValues(next);
    // Once a field shows an error, re-check it as the user types so it clears promptly.
    if (errors[key]) setFieldError(key, validateField(key, next));
  }

  function blur(key: string) {
    if (readValue(key, values).trim() !== "") setFieldError(key, validateField(key, values));
  }

  function block(found: FormErrors, at: Step) {
    setErrors((current) => ({
      ...Object.fromEntries(Object.entries(current).filter(([key]) => stepOf(key) !== at)),
      ...found,
    }));
    setSummaryStep(at);
    setBlockedAttempts((n) => n + 1);
  }

  function continueFrom(current: Step) {
    const found = errorsForStep(validateForm(knowledgeBase, values), current);
    if (Object.keys(found).length > 0) {
      block(found, current);
      return;
    }
    goTo(STEPS[STEPS.indexOf(current) + 1] ?? "review");
  }

  async function run(event: FormEvent) {
    event.preventDefault();
    if (step !== "review") {
      continueFrom(step);
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const created = await api.createAssessment(toPayload(knowledgeBase, values));
      saveDraft(null);
      navigate(`/assessments/${created.id}`, { state: { created: true } });
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError(0, "unexpected_error", "The assessment could not be saved.");
      setSubmitting(false);
      const fieldKeys = Object.keys(apiError.fields);
      if (fieldKeys.length > 0) {
        const at = stepOf(fieldKeys[0] ?? "");
        goTo(at);
        block(apiError.fields, at);
      } else {
        setSubmitError(apiError);
      }
    }
  }

  function reset() {
    setValues(emptyForm(knowledgeBase));
    setErrors({});
    setSummaryStep(null);
    setSubmitError(null);
    setConfirmingReset(false);
    goTo("community");
  }

  const stepErrors = summaryStep === step ? errorsForStep(errors, step) : {};
  const summaryEntries = Object.entries(stepErrors);

  return (
    <div className="workflow">
      <header className="workflow__header">
        <p className="t-label">New assessment</p>
        <h1 className="t-title">Assess a community</h1>
        <p className="t-lead">
          Record {knowledgeBase.indicators.length} field readings. The rules rate{" "}
          {knowledgeBase.factors.length} risk factors from them, and the highest rating becomes the
          community's overall risk.
        </p>
      </header>

      <ProgressRail
        step={step}
        reachable={reachable}
        values={values}
        knowledgeBase={knowledgeBase}
        onGo={(next, hash) => goTo(next, hash)}
        onReset={isDirty(values) ? () => setConfirmingReset(true) : undefined}
      />

      <form className="workflow__body" onSubmit={run} noValidate aria-labelledby="step-title">
        <div className="step" key={step}>
          <p className="t-label step__count">
            Step {STEPS.indexOf(step) + 1} of {STEPS.length}
          </p>
          <h2 className="t-heading step__title" id="step-title" tabIndex={-1} ref={headingRef}>
            {step === "community" && "Which community are you assessing?"}
            {step === "readings" && "Record the field readings"}
            {step === "review" && "Review before running"}
          </h2>

          {summaryEntries.length > 0 && (
            <div
              className="notice notice--error step__summary"
              tabIndex={-1}
              ref={summaryRef}
              role="alert"
            >
              <div>
                <p className="notice__title">
                  {summaryEntries.length === 1
                    ? "1 value needs attention"
                    : `${summaryEntries.length} values need attention`}
                </p>
                <ul>
                  {summaryEntries.map(([key, message]) => (
                    <li key={key}>
                      <a
                        href={`#${fieldId(key)}`}
                        onClick={(event) => {
                          event.preventDefault();
                          document.getElementById(fieldId(key))?.focus();
                        }}
                      >
                        {labelFor(key)}
                      </a>{" "}
                      — {message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {step === "community" && (
            <CommunityStep
              values={values}
              errors={errors}
              communities={communities.data ?? []}
              onChange={update}
              onBlur={blur}
            />
          )}
          {step === "readings" && (
            <ReadingsStep
              knowledgeBase={knowledgeBase}
              values={values}
              errors={errors}
              onChange={update}
              onBlur={blur}
            />
          )}
          {step === "review" && (
            <ReviewStep
              knowledgeBase={knowledgeBase}
              values={values}
              onEdit={(target, hash) => goTo(target, hash)}
            />
          )}

          {step === "review" && submitError && (
            <div className="notice notice--error" role="alert">
              <div>
                <p className="notice__title">The assessment was not saved</p>
                <p className="t-muted">{submitError.message} Your readings are still here.</p>
              </div>
            </div>
          )}

          <div className="step__actions">
            {step !== "community" && (
              <Button
                variant="quiet"
                disabled={submitting}
                onClick={() => goTo(STEPS[STEPS.indexOf(step) - 1] ?? "community")}
              >
                ← Back
              </Button>
            )}
            <Button type="submit" variant="primary" size="lg" loading={submitting}>
              {step === "community" && "Continue to readings"}
              {step === "readings" && "Review readings"}
              {step === "review" && (submitting ? "Running assessment…" : "Run assessment")}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmingReset}
        title="Start over?"
        confirmLabel="Clear everything"
        cancelLabel="Keep my readings"
        onConfirm={reset}
        onCancel={() => setConfirmingReset(false)}
      >
        <p>This clears the community, notes and every reading in this draft.</p>
      </ConfirmDialog>
    </div>
  );
}

interface ProgressRailProps {
  step: Step;
  reachable: Step;
  values: FormValues;
  knowledgeBase: KnowledgeBase;
  onGo: (step: Step, hash?: string) => void;
  onReset?: () => void;
}

function ProgressRail({
  step,
  reachable,
  values,
  knowledgeBase,
  onGo,
  onReset,
}: ProgressRailProps) {
  const indicators = indicatorMap(knowledgeBase);
  const isValid = (key: string) => {
    const indicator = indicators.get(key);
    return !!indicator && !validateIndicator(indicator, values.observations[key] ?? "");
  };
  const recorded = knowledgeBase.indicators.filter((i) => isValid(i.key)).length;
  const total = knowledgeBase.indicators.length;

  const status: Record<Step, string> = {
    community: values.community.trim() || "Not started",
    readings: `${recorded} of ${total} recorded`,
    review: reachable === "review" ? "Ready to run" : "After the readings",
  };

  return (
    <nav className="rail" aria-label="Assessment steps">
      <div
        className="rail__bar"
        aria-hidden="true"
        style={{ "--progress": (STEPS.indexOf(step) + 1) / STEPS.length } as CSSProperties}
      />
      <ol className="rail__steps">
        {STEPS.map((id, index) => {
          const current = id === step;
          const done = STEPS.indexOf(id) < STEPS.indexOf(step);
          const canVisit = STEPS.indexOf(id) <= STEPS.indexOf(reachable) && !current;
          return (
            <li
              key={id}
              className={`rail__step${current ? " is-current" : ""}${done ? " is-done" : ""}`}
              aria-current={current ? "step" : undefined}
            >
              <span className="rail__index" aria-hidden="true">
                {done ? "✓" : index + 1}
              </span>
              <span className="rail__text">
                {canVisit ? (
                  <button type="button" className="rail__link" onClick={() => onGo(id)}>
                    {STEP_LABELS[id]}
                  </button>
                ) : (
                  <span className="rail__name">{STEP_LABELS[id]}</span>
                )}
                <span className="rail__status">{status[id]}</span>
              </span>
              {id === "readings" && current && (
                <ul className="rail__groups">
                  {knowledgeBase.factors.map((factor) => {
                    const complete = factor.indicators.filter(isValid).length;
                    return (
                      <li key={factor.id}>
                        <a href={`#factor-${factor.id}`}>{factor.name}</a>
                        <span
                          className={`rail__count${complete === factor.indicators.length ? " is-complete" : ""}`}
                        >
                          {complete}/{factor.indicators.length}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      {onReset && (
        <button type="button" className="rail__reset" onClick={onReset}>
          Start over
        </button>
      )}
    </nav>
  );
}

interface StepProps {
  values: FormValues;
  errors: FormErrors;
  onChange: (key: string, value: string) => void;
  onBlur: (key: string) => void;
}

function CommunityStep({
  values,
  errors,
  communities,
  onChange,
  onBlur,
}: StepProps & { communities: string[] }) {
  return (
    <div className="step__fields">
      <p className="t-muted step__intro">
        Use the name people will search for later. Earlier assessments of the same community are
        suggested as you type.
      </p>
      <Field id={fieldId("community")} label="Community name" error={errors.community}>
        {(control) => (
          <>
            <input
              {...control}
              className="input"
              list="known-communities"
              autoComplete="off"
              maxLength={COMMUNITY_MAX_LENGTH + 20}
              value={values.community}
              onChange={(event) => onChange("community", event.target.value)}
              onBlur={() => onBlur("community")}
            />
            <datalist id="known-communities">
              {communities.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <Field
        id={fieldId("notes")}
        label="Notes"
        optional
        hint="Sampling location, conditions, or anything a reviewer should know."
        error={errors.notes}
      >
        {(control) => (
          <textarea
            {...control}
            className="input"
            rows={4}
            value={values.notes}
            onChange={(event) => onChange("notes", event.target.value)}
            onBlur={() => onBlur("notes")}
          />
        )}
      </Field>
    </div>
  );
}

function ReadingsStep({
  knowledgeBase,
  values,
  errors,
  onChange,
  onBlur,
}: StepProps & { knowledgeBase: KnowledgeBase }) {
  const indicators = indicatorMap(knowledgeBase);
  return (
    <div className="readings-step">
      <p className="t-muted step__intro">
        Enter each reading as measured. Selecting a field shows what it measures and the thresholds
        the rules compare it against.
      </p>
      {knowledgeBase.factors.map((factor, index) => (
        <section
          key={factor.id}
          id={`factor-${factor.id}`}
          className="reading-group"
          aria-labelledby={`factor-${factor.id}-title`}
        >
          <div className="reading-group__head">
            <span className="reading-group__index mono" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="t-subheading" id={`factor-${factor.id}-title`}>
                {factor.name}
              </h3>
              <p className="t-meta">{factor.description}</p>
            </div>
          </div>
          <div className="reading-group__fields">
            {factor.indicators.map((key) => {
              const indicator = indicators.get(key);
              if (!indicator) return null;
              const errorKey = `observations.${key}`;
              return (
                <IndicatorField
                  key={key}
                  indicator={indicator}
                  thresholds={thresholdsFor(knowledgeBase, key)}
                  value={values.observations[key] ?? ""}
                  error={errors[errorKey]}
                  onChange={(value) => onChange(errorKey, value)}
                  onBlur={() => onBlur(errorKey)}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

interface IndicatorFieldProps {
  indicator: Indicator;
  thresholds: number[];
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function IndicatorField({
  indicator,
  thresholds,
  value,
  error,
  onChange,
  onBlur,
}: IndicatorFieldProps) {
  const limits = joinNames(thresholds.map((t) => formatQuantity(t, indicator.unit)));
  return (
    <Field
      id={fieldId(`observations.${indicator.key}`)}
      label={indicator.label}
      error={error}
      hintOnFocus
      hint={
        <>
          {indicator.description} Rules use {limits}.{" "}
          <span className="visually-hidden">Unit: {indicator.unit}.</span>
        </>
      }
    >
      {(control) => (
        <div className="input-affix">
          <input
            {...control}
            className="input"
            inputMode={indicator.kind === "integer" ? "numeric" : "decimal"}
            autoComplete="off"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
          />
          <span className="input-affix__unit" aria-hidden="true">
            {indicator.unit}
          </span>
        </div>
      )}
    </Field>
  );
}

function ReviewStep({
  knowledgeBase,
  values,
  onEdit,
}: {
  knowledgeBase: KnowledgeBase;
  values: FormValues;
  onEdit: (step: Step, hash?: string) => void;
}) {
  const indicators = indicatorMap(knowledgeBase);
  return (
    <div className="review">
      <p className="t-muted step__intro">
        The readings will be checked against {ruleCount(knowledgeBase)} rules. The result and the
        reasoning behind it are saved to the assessment history.
      </p>

      <section className="review__group" aria-labelledby="review-community">
        <div className="review__head">
          <h3 className="t-subheading" id="review-community">
            Community
          </h3>
          <button type="button" className="review__edit" onClick={() => onEdit("community")}>
            Edit <span className="visually-hidden">community</span>
          </button>
        </div>
        <dl className="review__list review__list--single">
          <div>
            <dt>Name</dt>
            <dd>{values.community.trim()}</dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd className={values.notes.trim() ? "review__notes" : "t-meta"}>
              {values.notes.trim() || "None"}
            </dd>
          </div>
        </dl>
      </section>

      {knowledgeBase.factors.map((factor) => (
        <section key={factor.id} className="review__group" aria-labelledby={`review-${factor.id}`}>
          <div className="review__head">
            <h3 className="t-subheading" id={`review-${factor.id}`}>
              {factor.name}
            </h3>
            <button
              type="button"
              className="review__edit"
              onClick={() => onEdit("readings", `#factor-${factor.id}`)}
            >
              Edit <span className="visually-hidden">{factor.name}</span>
            </button>
          </div>
          <dl className="review__list">
            {factor.indicators.map((key) => {
              const indicator = indicators.get(key);
              return (
                <div key={key}>
                  <dt>{indicator?.label ?? key}</dt>
                  <dd className="num">
                    {formatQuantity(Number(values.observations[key]), indicator?.unit ?? "")}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
