import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { assessment, knowledgeBase } from "../test/fixtures";
import { renderApp } from "../test/render";
import { mockApi } from "../test/server";

const kb = { "GET /api/knowledge-base": { body: knowledgeBase } };

describe("Assessment result", () => {
  it("leads with the conclusion and its interpretation", async () => {
    mockApi({ ...kb, "GET /api/assessments/1": { body: assessment } });
    renderApp("/assessments/1");

    const conclusion = await screen.findByRole("heading", { level: 1 });
    expect(conclusion).toHaveTextContent("Tarkwa is at high risk from illegal-mining pollution.");
    expect(
      screen.getByText(
        "Noise pollution is rated High. Of the other factors, 4 are Medium and 1 is Low. The overall risk takes the highest factor rating, so this one factor sets it.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Saved to the assessment history")).not.toBeInTheDocument();
  });

  it("places every factor on the rating scale", async () => {
    mockApi({ ...kb, "GET /api/assessments/1": { body: assessment } });
    renderApp("/assessments/1");

    const scale = await screen.findByRole("table", { name: "Rating of each factor" });
    const noise = within(scale).getByRole("row", { name: /Noise pollution/ });
    expect(noise).toHaveTextContent("Rated High");
    expect(within(scale).getAllByText(/^Rated /)).toHaveLength(6);
  });

  it("explains which rule decided each factor and reveals the full trace", async () => {
    mockApi({ ...kb, "GET /api/assessments/1": { body: assessment } });
    const { user } = renderApp("/assessments/1");

    const reasoning = await screen.findByRole("region", { name: "Reasoning" });
    // Range conditions on one reading are stated once.
    expect(reasoning).toHaveTextContent(
      "R3.2 matched: Biodiversity loss was 33% (rule: > 20% and ≤ 50%).",
    );

    const toggle = within(reasoning).getByRole("button", { name: "Show the 4 rules checked" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("Hide the rules checked");

    const trace = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(within(trace).getAllByText("Did not match")).toHaveLength(3);
    expect(within(trace).getByText("Matched")).toBeInTheDocument();
    expect(reasoning).toHaveTextContent("there is no confidence score");
  });

  it("marks the readings that decided a factor and lists next steps by severity", async () => {
    mockApi({ ...kb, "GET /api/assessments/1": { body: assessment } });
    renderApp("/assessments/1");

    const evidence = await screen.findByRole("region", { name: "Evidence" });
    expect(within(evidence).getAllByText("Decisive")).toHaveLength(6);
    expect(within(evidence).getByText("Heavy metal concentration").parentElement).not.toHaveClass(
      "is-decisive",
    );

    const steps = screen.getByRole("region", { name: "Next steps" });
    const items = within(steps).getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent("Noise pollution");
    expect(within(steps).getByRole("link", { name: "Reassess Tarkwa" })).toHaveAttribute(
      "href",
      "/assessments/new?community=Tarkwa",
    );
  });

  it("shows a not-found state for a missing assessment", async () => {
    mockApi({
      ...kb,
      "GET /api/assessments/42": {
        status: 404,
        body: { error: { code: "not_found", message: "Assessment 42 does not exist." } },
      },
    });
    renderApp("/assessments/42");
    expect(await screen.findByText("Assessment not found")).toBeInTheDocument();
  });

  it("offers a retry when loading fails", async () => {
    let calls = 0;
    mockApi({
      ...kb,
      "GET /api/assessments/1": () =>
        ++calls === 1
          ? { status: 500, body: { error: { code: "internal_error", message: "Boom." } } }
          : { body: assessment },
    });
    const { user } = renderApp("/assessments/1");
    expect(await screen.findByText("This assessment could not be loaded")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Tarkwa");
  });
});
