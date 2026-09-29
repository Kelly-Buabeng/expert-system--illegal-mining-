import { screen, within } from "@testing-library/react";
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

describe("New assessment", () => {
  it("blocks submission and lists every problem when the form is empty", async () => {
    const requests = mockApi(baseRoutes);
    const { user } = renderApp("/assessments/new");

    await user.click(await screen.findByRole("button", { name: "Run assessment" }));

    const summary = screen.getByRole("alert");
    expect(within(summary).getByText("12 values need attention")).toBeInTheDocument();
    expect(summary).toHaveFocus();
    expect(screen.getByLabelText("Water pH")).toHaveAttribute("aria-invalid", "true");
    expect(requests.some((r) => r.method === "POST")).toBe(false);
  });

  it("validates a reading on blur and clears the error once fixed", async () => {
    mockApi(baseRoutes);
    const { user } = renderApp("/assessments/new");
    const ph = await screen.findByLabelText("Water pH");

    await user.type(ph, "15");
    await user.tab();
    expect(screen.getByText("Must be between 0 and 14.")).toBeInTheDocument();

    await user.clear(ph);
    await user.type(ph, "6");
    expect(screen.queryByText("Must be between 0 and 14.")).not.toBeInTheDocument();
  });

  it("submits the readings and shows the saved result", async () => {
    const requests = mockApi({
      ...baseRoutes,
      "POST /api/assessments": { status: 201, body: assessment },
      [`GET /api/assessments/${assessment.id}`]: { body: assessment },
    });
    const { user } = renderApp("/assessments/new");

    await user.type(await screen.findByLabelText("Community name"), "Tarkwa");
    for (const [label, value] of Object.entries(READINGS)) {
      await user.type(screen.getByLabelText(label), value);
    }
    await user.click(screen.getByRole("button", { name: "Run assessment" }));

    expect(await screen.findByText(/Assessment saved/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Tarkwa" })).toBeInTheDocument();

    const post = requests.find((r) => r.method === "POST");
    expect(post?.body).toEqual({
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
    // The draft is discarded once saved.
    expect(sessionStorage.getItem("assessment-draft")).toBeNull();
  });

  it("shows server-side field errors next to the fields", async () => {
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
    await user.type(await screen.findByLabelText("Community name"), "Tarkwa");
    for (const [label, value] of Object.entries(READINGS)) {
      await user.type(screen.getByLabelText(label), value);
    }
    await user.click(screen.getByRole("button", { name: "Run assessment" }));

    expect(await screen.findByText("Noise level: Must be between 0 and 200.")).toBeInTheDocument();
    expect(screen.getByLabelText("Noise level")).toHaveAttribute("aria-invalid", "true");
  });

  it("reports a failure that is not about a field", async () => {
    mockApi({
      ...baseRoutes,
      "POST /api/assessments": {
        status: 500,
        body: { error: { code: "internal_error", message: "Something went wrong on the server." } },
      },
    });
    const { user } = renderApp("/assessments/new?community=Obuasi");
    expect(await screen.findByLabelText("Community name")).toHaveValue("Obuasi");
    for (const [label, value] of Object.entries(READINGS)) {
      await user.type(screen.getByLabelText(label), value);
    }
    await user.click(screen.getByRole("button", { name: "Run assessment" }));

    expect(await screen.findByText("The assessment was not saved.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run assessment" })).toBeEnabled();
  });

  it("asks for confirmation before clearing the form", async () => {
    mockApi(baseRoutes);
    const { user } = renderApp("/assessments/new");
    const community = await screen.findByLabelText("Community name");
    await user.type(community, "Tarkwa");

    await user.click(screen.getByRole("button", { name: "Clear form" }));
    await user.click(screen.getByRole("button", { name: "Keep values" }));
    expect(community).toHaveValue("Tarkwa");

    await user.click(screen.getByRole("button", { name: "Clear form" }));
    const confirm = screen.getByRole("group", { name: "Confirm clearing the form" });
    await user.click(within(confirm).getByRole("button", { name: "Clear form" }));
    expect(screen.getByLabelText("Community name")).toHaveValue("");
  });
});
