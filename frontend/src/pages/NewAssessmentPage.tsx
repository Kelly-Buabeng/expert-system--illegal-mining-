import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError, api } from "../api/client";
import type { Indicator, KnowledgeBase } from "../api/types";
import { PageHeader } from "../components/PageHeader";
import { indicatorMap, useKnowledgeBase } from "../lib/knowledgeBase";
import { useResource } from "../lib/useResource";
import {
  COMMUNITY_MAX_LENGTH,
  emptyForm,
  fieldId,
  toPayload,
  validateCommunity,
  validateForm,
  validateIndicator,
  validateNotes,
  type FormErrors,
  type FormValues,
} from "./assessmentForm";

const DRAFT_KEY = "assessment-draft";

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
  const [searchParams] = useSearchParams();
  const [values, setValues] = useState(() =>
    loadDraft(knowledgeBase, searchParams.get("community")),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [showSummary, setShowSummary] = useState(false);
  // Incremented on each failed submit so the error summary receives focus once per attempt.
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const communities = useResource("communities", api.communities);

  useEffect(() => saveDraft(values), [values]);

  useEffect(() => {
    if (failedSubmits > 0) summaryRef.current?.focus();
  }, [failedSubmits]);

  const labelFor = (key: string): string => {
    if (key === "community") return "Community";
    if (key === "notes") return "Notes";
    return indicators.get(key.replace("observations.", ""))?.label ?? key;
  };

  function setFieldError(key: string, error: string | undefined) {
    setErrors((current) => {
      if (current[key] === error) return current;
      const next = { ...current };
      if (error) next[key] = error;
      else delete next[key];
      return next;
    });
  }

  function validateField(key: string, next: FormValues) {
    if (key === "community") return validateCommunity(next.community);
    if (key === "notes") return validateNotes(next.notes);
    const indicator = indicators.get(key.replace("observations.", ""));
    return indicator && validateIndicator(indicator, next.observations[indicator.key] ?? "");
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
    const value =
      key === "community" || key === "notes"
        ? values[key]
        : (values.observations[key.replace("observations.", "")] ?? "");
    if (value.trim() !== "") setFieldError(key, validateField(key, values));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    const found = validateForm(knowledgeBase, values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setShowSummary(true);
      setFailedSubmits((n) => n + 1);
      return;
    }
    setShowSummary(false);
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
      if (Object.keys(apiError.fields).length > 0) {
        setErrors(apiError.fields);
        setShowSummary(true);
        setFailedSubmits((n) => n + 1);
      } else {
        setSubmitError(apiError);
      }
      setSubmitting(false);
    }
  }

  function clearForm() {
    setValues(emptyForm(knowledgeBase));
    setErrors({});
    setShowSummary(false);
    setSubmitError(null);
    setConfirmingClear(false);
  }

  const errorEntries = Object.entries(errors);

  return (
    <div className="page page--narrow">
      <PageHeader
        title="New assessment"
        description="Record field readings for a community. Each group of readings is rated by the rules for that risk factor, and the highest factor rating becomes the overall risk."
      />

      {showSummary && errorEntries.length > 0 && (
        <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
          <h2>
            {errorEntries.length === 1
              ? "1 value needs attention"
              : `${errorEntries.length} values need attention`}
          </h2>
          <ul>
            {errorEntries.map(([key, message]) => (
              <li key={key}>
                <a
                  href={`#${fieldId(key)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById(fieldId(key))?.focus();
                  }}
                >
                  {labelFor(key)}: {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form className="assessment-form" onSubmit={submit} noValidate>
        <fieldset className="form-section">
          <legend className="form-section__title">Community</legend>
          <div className="field">
            <label htmlFor={fieldId("community")}>Community name</label>
            <input
              id={fieldId("community")}
              className="input"
              list="known-communities"
              autoComplete="off"
              maxLength={COMMUNITY_MAX_LENGTH + 20}
              value={values.community}
              aria-invalid={errors.community ? true : undefined}
              aria-describedby={errors.community ? `${fieldId("community")}-error` : undefined}
              onChange={(event) => update("community", event.target.value)}
              onBlur={() => blur("community")}
            />
            <datalist id="known-communities">
              {communities.data?.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <FieldError id={`${fieldId("community")}-error`} message={errors.community} />
          </div>
          <div className="field">
            <label htmlFor={fieldId("notes")}>
              Notes <span className="optional">optional</span>
            </label>
            <textarea
              id={fieldId("notes")}
              className="input"
              rows={3}
              value={values.notes}
              aria-invalid={errors.notes ? true : undefined}
              aria-describedby={`${fieldId("notes")}-hint${errors.notes ? ` ${fieldId("notes")}-error` : ""}`}
              onChange={(event) => update("notes", event.target.value)}
              onBlur={() => blur("notes")}
            />
            <p className="field__hint" id={`${fieldId("notes")}-hint`}>
              Sampling location, conditions or anything a reviewer should know.
            </p>
            <FieldError id={`${fieldId("notes")}-error`} message={errors.notes} />
          </div>
        </fieldset>

        {knowledgeBase.factors.map((factor) => (
          <fieldset className="form-section" key={factor.id}>
            <legend className="form-section__title">{factor.name}</legend>
            <p className="form-section__description">{factor.description}</p>
            <div className="field-grid">
              {factor.indicators.map((key) => {
                const indicator = indicators.get(key);
                if (!indicator) return null;
                const errorKey = `observations.${key}`;
                return (
                  <IndicatorField
                    key={key}
                    indicator={indicator}
                    value={values.observations[key] ?? ""}
                    error={errors[errorKey]}
                    onChange={(value) => update(errorKey, value)}
                    onBlur={() => blur(errorKey)}
                  />
                );
              })}
            </div>
          </fieldset>
        ))}

        {submitError && (
          <div className="alert alert--error" role="alert">
            <strong>The assessment was not saved.</strong> {submitError.message}
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="button button--primary" disabled={submitting}>
            {submitting ? "Running assessment…" : "Run assessment"}
          </button>
          {confirmingClear ? (
            <span className="inline-confirm" role="group" aria-label="Confirm clearing the form">
              <span>Clear every value?</span>
              <button type="button" className="button button--danger" onClick={clearForm}>
                Clear form
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setConfirmingClear(false)}
              >
                Keep values
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="button button--ghost"
              disabled={!isDirty(values) || submitting}
              onClick={() => setConfirmingClear(true)}
            >
              Clear form
            </button>
          )}
          <p className="form-actions__note">
            The result is saved to the <Link to="/assessments">assessment history</Link>.
          </p>
        </div>
      </form>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="field__error" id={id}>
      {message}
    </p>
  );
}

interface IndicatorFieldProps {
  indicator: Indicator;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur: () => void;
}

function IndicatorField({ indicator, value, error, onChange, onBlur }: IndicatorFieldProps) {
  const id = fieldId(`observations.${indicator.key}`);
  const describedBy = [`${id}-hint`, error ? `${id}-error` : ""].filter(Boolean).join(" ");
  return (
    <div className="field">
      <label htmlFor={id}>{indicator.label}</label>
      <div className="input-group">
        <input
          id={id}
          className="input input--numeric"
          inputMode={indicator.kind === "integer" ? "numeric" : "decimal"}
          autoComplete="off"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
        <span className="input-group__unit" aria-hidden="true">
          {indicator.unit}
        </span>
      </div>
      <p className="field__hint" id={`${id}-hint`}>
        {indicator.description} <span className="visually-hidden">Unit: {indicator.unit}.</span>
      </p>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
