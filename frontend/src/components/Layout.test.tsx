import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { knowledgeBase } from "../test/fixtures";
import { renderApp } from "../test/render";
import { mockApi } from "../test/server";

describe("Layout", () => {
  it("explains when the server cannot be reached and recovers on retry", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(new Response(JSON.stringify(knowledgeBase)));
    const { user } = renderApp("/rules");

    expect(await screen.findByText("Can't reach the assessment service")).toBeInTheDocument();
    expect(screen.getByText(/Could not reach the server/)).toBeInTheDocument();
    expect(screen.getByText(/Your readings and past assessments are safe/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Rules" })).toBeInTheDocument();
    expect(screen.getByText("R1.4")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("hides the new-assessment shortcut while the user is already in the workflow", async () => {
    mockApi({
      "GET /api/knowledge-base": { body: knowledgeBase },
      "GET /api/communities": { body: { items: [] } },
    });
    renderApp("/assessments/new");
    expect(await screen.findByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "New assessment" })).not.toBeInTheDocument();
  });
});
