import { expect, test } from "@playwright/test";

const READINGS: Record<string, string> = {
  Deforestation: "40",
  "Water turbidity": "60",
  "Heavy metal concentration": "20",
  "Soil erosion": "10",
  "Community reports": "2",
  "Water pH": "7",
  "Dissolved oxygen": "6",
  "Biodiversity loss": "10",
  "PM2.5": "180",
  "Noise level": "50",
  "Health reports": "3",
};

test("record an assessment, review the reasoning and find it in the history", async ({
  page,
}, testInfo) => {
  const community = `Dunkwa ${testInfo.project.name}`;

  await page.goto("/assessments/new");
  await page.getByRole("button", { name: "Run assessment" }).click();
  await expect(page.getByText("12 values need attention")).toBeVisible();

  await page.getByLabel("Community name").fill(community);
  for (const [label, value] of Object.entries(READINGS)) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }

  // A reload keeps the draft.
  await page.reload();
  await expect(page.getByLabel("Community name")).toHaveValue(community);
  await expect(page.getByLabel("PM2.5")).toHaveValue("180");

  await page.getByRole("button", { name: "Run assessment" }).click();
  await expect(page.getByText(/Assessment saved/)).toBeVisible();
  await expect(page).toHaveURL(/\/assessments\/\d+$/);

  const verdict = page.getByRole("region", { name: "Overall risk" });
  await expect(verdict).toContainText("High");
  await expect(verdict).toContainText("Rated High because Air quality is rated High.");
  await expect(
    page.getByText("R4.1 matched: PM2.5 was 180 µg/m³ (rule: > 150 µg/m³)."),
  ).toBeVisible();

  // The result survives a reload because it comes from the database.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: community })).toBeVisible();

  await page.getByRole("link", { name: "All assessments" }).click();
  await page.getByRole("searchbox", { name: "Community" }).fill(community);
  await expect(page).toHaveURL(/q=Dunkwa/);
  await expect(page.getByRole("link", { name: community })).toBeVisible();

  // The filter lives in the URL, so the radio updates once navigation commits.
  await page.getByRole("radio", { name: "Low" }).click();
  await expect(page.getByRole("radio", { name: "Low" })).toBeChecked();
  await expect(page).toHaveURL(/risk=Low/);
  await expect(page.getByText("No matching assessments")).toBeVisible();
});

test("rules page lists the knowledge base", async ({ page }) => {
  await page.goto("/rules");
  await expect(page.getByRole("heading", { name: "Deforestation and pollution" })).toBeVisible();
  await expect(page.getByText("R1.4")).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
});
