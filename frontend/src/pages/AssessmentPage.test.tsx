import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { assessment, knowledgeBase } from "../test/fixtures";
import { renderApp } from "../test/render";
import { mockApi } from "../test/server";

const kb = { "GET /api/knowledge-base": { body: knowledgeBase } };

describe("Assessment result", () => {
  it("explains the overall rating and each factor", async () => {
    mockApi({ ...kb, "GET /api/assessments/1": { body: assessment } });
    const { user } = renderApp("/assessments/1");

    const verdict = await screen.findByRole("region", { name: "Overall risk" });
    expect(within(verdict).getByText("High")).toBeInTheDocument();
    expect(verdict).toHaveTextContent("Rated High because Noise pollution is rated High.");

    const factors = screen.getAllByRole("listitem").filter((li) => li.className === "factor");
    expect(factors).toHaveLength(6);
    const biodiversity = factors[2]!;
    // Range conditions on one reading are stated once.
    expect(biodiversity).toHaveTextContent(
      "R3.2 matched: Biodiversity loss was 33% (rule: > 20% and ≤ 50%).",
    );
    expect(biodiversity).toHaveTextContent("Repeat species surveys to confirm the trend.");

    const land = factors[0]!;
    await user.click(within(land).getByText(/Show reasoning \(4 rules checked\)/));
    const rules = within(land).getAllByRole("table");
    expect(rules).toHaveLength(4);
    expect(within(land).getAllByText("Did not match")).toHaveLength(3);
    expect(within(land).getByText("Matched")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Reassess community" })).toHaveAttribute(
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
    expect(await screen.findByRole("heading", { level: 1, name: "Tarkwa" })).toBeInTheDocument();
  });
});
