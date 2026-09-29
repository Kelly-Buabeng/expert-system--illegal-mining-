import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AssessmentSummary } from "../api/types";
import { knowledgeBase } from "../test/fixtures";
import { renderApp } from "../test/render";
import { mockApi } from "../test/server";

const kb = { "GET /api/knowledge-base": { body: knowledgeBase } };

const summary: AssessmentSummary = {
  id: 7,
  community: "Obuasi",
  overall_risk: "Medium",
  factor_levels: {
    land_water: "Low",
    water_chemistry: "Medium",
    biodiversity: "Low",
    air_quality: "Low",
    noise: "Low",
    community_health: "Low",
  },
  ruleset_version: "2",
  created_at: "2026-09-01T10:00:00+00:00",
};

const page = (items: AssessmentSummary[], total = items.length) => ({
  body: { items, total, limit: 20, offset: 0 },
});

describe("Assessment history", () => {
  it("invites the first assessment when there are none", async () => {
    mockApi({ ...kb, "GET /api/assessments": page([]) });
    renderApp("/assessments");
    expect(await screen.findByText("No assessments yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start the first assessment" })).toHaveAttribute(
      "href",
      "/assessments/new",
    );
  });

  it("lists assessments with their factor ratings", async () => {
    mockApi({ ...kb, "GET /api/assessments": page([summary]) });
    renderApp("/assessments");
    expect(await screen.findByRole("link", { name: "Obuasi" })).toHaveAttribute(
      "href",
      "/assessments/7",
    );
    expect(screen.getByText("pH and dissolved oxygen: Medium")).toBeInTheDocument();
    expect(screen.getByText("1–1 of 1")).toBeInTheDocument();
  });

  it("sends search and risk filters to the API", async () => {
    const requests = mockApi({
      ...kb,
      "GET /api/assessments": ({ url }) =>
        url.searchParams.get("risk") === "High" ? page([]) : page([summary]),
    });
    const { user } = renderApp("/assessments");
    await screen.findByRole("link", { name: "Obuasi" });

    await user.type(screen.getByRole("searchbox", { name: "Community" }), "obu");
    await waitFor(() => expect(requests.at(-1)?.url.searchParams.get("q")).toBe("obu"));

    await user.click(screen.getByRole("radio", { name: "High" }));
    expect(await screen.findByText("No matching assessments")).toBeInTheDocument();
    const last = requests.at(-1)!.url.searchParams;
    expect(last.get("risk")).toBe("High");
    expect(last.get("q")).toBe("obu");
  });

  it("shows an error when the list cannot be loaded", async () => {
    mockApi({
      ...kb,
      "GET /api/assessments": {
        status: 503,
        body: { error: { code: "unavailable", message: "Database is busy." } },
      },
    });
    renderApp("/assessments");
    expect(await screen.findByText("Assessments could not be loaded")).toBeInTheDocument();
    expect(screen.getByText("Database is busy.")).toBeInTheDocument();
  });
});
