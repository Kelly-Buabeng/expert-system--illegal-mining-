import { screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { assessment, knowledgeBase } from "../test/fixtures";
import { renderApp } from "../test/render";
import { mockApi } from "../test/server";

const READINGS: Record<string, string> = {
  Deforestation: "82",
  "Water turbidity": "240",
  "Heavy metal concentration": "35",
  "Soil erosion": "12",
  "Community reports": "8",
  "Water pH": "6.1",
  "Dissolved oxygen": "5.2",
  "Biodiversity loss": "33",
  "PM2.5": "95",
  "Noise level": "88",
  "Health reports": "4",
};

const baseRoutes = {
  "GET /api/knowledge-base": { body: knowledgeBase },
  "GET /api/communities": { body: { items: ["Tarkwa", "Obuasi"] } },
};

const field = (name: string) => screen.getByRole("textbox", { name });
const stepHeading = () => screen.getByRole("heading", { level: 2, name: /\?|readings|running/ });

async function completeCommunity(user: UserEvent, name = "Tarkwa") {
  await user.type(await screen.findByRole("combobox", { name: "Community name" }), name);
  await user.click(screen.getByRole("button", { name: "Continue to readings" }));
  await screen.findByRole("heading", { name: "Record the field readings" });
}

async function completeReadings(user: UserEvent) {
  for (const [label, value] of Object.entries(READINGS)) await user.type(field(label), value);
  await user.click(screen.getByRole("button", { name: "Review readings" }));
  await screen.findByRole("heading", { name: "Review before running" });
}

describe("New assessment workflow", () => {
  it("starts on the community step and will not continue without a name", async () => {
    const requests = mockApi(baseRoutes);
    const { user } = renderApp("/assessments/new");

    expect(await screen.findByText("Step 1 of 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue to readings" }));

    const summary = screen.getByRole("alert");
    expect(within(summary).getByText("1 value needs attention")).toBeInTheDocument();
    expect(summary).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Community name" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(stepHeading()).toHaveTextContent("Which community are you assessing?");
    expect(requests.some((r) => r.method === "POST")).toBe(false);
  });

  it("lists every missing reading before allowing review", async () => {
    mockApi(baseRoutes);
    const { user } = renderApp("/assessments/new");
    await completeCommunity(user);

    await user.click(screen.getByRole("button", { name: "Review readings" }));
    expect(screen.getByText("11 values need attention")).toBeInTheDocument();
    expect(field("Water pH")).toHaveAttribute("aria-invalid", "true");
    expect(stepHeading()).toHaveTextContent("Record the field readings");
  });

  it("does not let a URL skip ahead of incomplete steps", async () => {
    mockApi(baseRoutes);
    renderApp("/assessments/new?step=review");
    expect(
      await screen.findByRole("heading", { name: "Which community are you assessing?" }),
    ).toBeInTheDocument();
  });

  it("validates a reading when the field loses focus and clears the error once fixed", async () => {
    mockApi(baseRoutes);
    const { user } = renderApp("/assessments/new");
    await completeCommunity(user);

    await user.type(field("Water pH"), "15");
    await user.tab();
    expect(screen.getByText("Must be between 0 and 14.")).toBeInTheDocument();

    await user.clear(field("Water pH"));
    await user.type(field("Water pH"), "6");
    expect(screen.queryByText("Must be between 0 and 14.")).not.toBeInTheDocument();
  });

  it("shows the thresholds the rules use in each reading's hint", async () => {
    mockApi(baseRoutes);
    const { user } = renderApp("/assessments/new");
    await completeCommunity(user);
    expect(field("PM2.5")).toHaveAccessibleDescription(
      "Fine particulate matter in the air. Rules use 50 µg/m³ and 150 µg/m³. Unit: µg/m³.",
    );
  });

  it("reviews the readings, runs the assessment and opens the saved result", async () => {
    const requests = mockApi({
      ...baseRoutes,
      "POST /api/assessments": { status: 201, body: assessment },
      [`GET /api/assessments/${assessment.id}`]: { body: assessment },
    });
    const { user } = renderApp("/assessments/new");
    await completeCommunity(user);
    await completeReadings(user);

    const readings = screen.getByRole("region", { name: "Air quality" });
    expect(readings).toHaveTextContent("PM2.5");
    expect(readings).toHaveTextContent("95 µg/m³");
    expect(screen.getByText(/checked against 19 rules/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Run assessment" }));
    expect(await screen.findByText("Saved to the assessment history")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Tarkwa is at high risk from illegal-mining pollution.",
    );

    expect(requests.find((r) => r.method === "POST")?.body).toEqual({
      community: "Tarkwa",
      notes: "",
      observations: {
        deforestation: 82,
        turbidity: 240,
        heavy_metals: 35,
        soil_erosion: 12,
        reports: 8,
        ph: 6.1,
        dissolved_oxygen: 5.2,
        biodiversity_loss: 33,
        pm25: 95,
        noise_level: 88,
        health_reports: 4,
      },
    });
    expect(sessionStorage.getItem("assessment-draft")).toBeNull();
  });

  it("returns to the readings from the review step to edit a group", async () => {
    mockApi(baseRoutes);
    const { user } = renderApp("/assessments/new");
    await completeCommunity(user);
    await completeReadings(user);

    await user.click(screen.getByRole("button", { name: "Edit Noise pollution" }));
    expect(stepHeading()).toHaveTextContent("Record the field readings");
    expect(field("Noise level")).toHaveValue("88");
  });

  it("sends the user back to the reading the server rejected", async () => {
    mockApi({
      ...baseRoutes,
      "POST /api/assessments": {
        status: 400,
        body: {
          error: {
            code: "validation_error",
            message: "Some values are missing or invalid.",
            fields: { "observations.noise_level": "Must be between 0 and 200." },
          },
        },
      },
    });
    const { user } = renderApp("/assessments/new");
    await completeCommunity(user);
    await completeReadings(user);
    await user.click(screen.getByRole("button", { name: "Run assessment" }));

    expect(await screen.findByRole("heading", { name: "Record the field readings" })).toBeVisible();
    expect(screen.getByText("Must be between 0 and 200.")).toBeInTheDocument();
    expect(field("Noise level")).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps the readings when the server fails", async () => {
    mockApi({
      ...baseRoutes,
      "POST /api/assessments": {
        status: 500,
        body: { error: { code: "internal_error", message: "Something went wrong on the server." } },
      },
    });
    const { user } = renderApp("/assessments/new?community=Obuasi");
    await user.click(await screen.findByRole("button", { name: "Continue to readings" }));
    await completeReadings(user);
    await user.click(screen.getByRole("button", { name: "Run assessment" }));

    expect(await screen.findByText("The assessment was not saved")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run assessment" })).toBeEnabled();
    expect(screen.getByRole("region", { name: "Community" })).toHaveTextContent("Obuasi");
  });

  it("asks for confirmation before starting over", async () => {
    mockApi(baseRoutes);
    const { user } = renderApp("/assessments/new");
    await user.type(await screen.findByRole("combobox", { name: "Community name" }), "Tarkwa");

    await user.click(screen.getByRole("button", { name: "Start over" }));
    await user.click(screen.getByRole("button", { name: "Keep my readings" }));
    expect(screen.getByRole("combobox", { name: "Community name" })).toHaveValue("Tarkwa");

    await user.click(screen.getByRole("button", { name: "Start over" }));
    await user.click(screen.getByRole("button", { name: "Clear everything" }));
    expect(screen.getByRole("combobox", { name: "Community name" })).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Start over" })).not.toBeInTheDocument();
  });
});
