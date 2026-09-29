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
  await page.getByRole("button", { name: "Continue to readings" }).click();
  await expect(page.getByText("1 value needs attention")).toBeVisible();

  await page.getByRole("combobox", { name: "Community name" }).fill(community);
  await page.getByRole("button", { name: "Continue to readings" }).click();
  await expect(page.getByRole("heading", { name: "Record the field readings" })).toBeVisible();

  for (const [label, value] of Object.entries(READINGS)) {
    await page.getByRole("textbox", { name: label, exact: true }).fill(value);
  }

  // A reload keeps both the step (in the URL) and the draft.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Record the field readings" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "PM2.5" })).toHaveValue("180");

  await page.getByRole("button", { name: "Review readings" }).click();
  await expect(page.getByRole("heading", { name: "Review before running" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Air quality" })).toContainText("180 µg/m³");

  // The browser back button returns to the previous step.
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Record the field readings" })).toBeVisible();
  await page.goForward();

  await page.getByRole("button", { name: "Run assessment" }).click();
  await expect(page.getByText("Saved to the assessment history")).toBeVisible();
  await expect(page).toHaveURL(/\/assessments\/\d+$/);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    `${community} is at high risk from illegal-mining pollution.`,
  );
  await expect(
    page.getByText("R4.1 matched: PM2.5 was 180 µg/m³ (rule: > 150 µg/m³)."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show the 1 rule checked" }).click();
  await expect(page.getByRole("button", { name: "Hide the rules checked" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );

  // The result survives a reload because it comes from the database.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(community);

  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link").click();
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
