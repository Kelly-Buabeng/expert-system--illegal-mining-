import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { knowledgeBase } from "../test/fixtures";
import { renderApp } from "../test/render";

describe("Layout", () => {
  it("explains when the server cannot be reached and recovers on retry", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue(new Response(JSON.stringify(knowledgeBase)));
    const { user } = renderApp("/rules");

    expect(await screen.findByText("The assessment service is unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Could not reach the server/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Rules" })).toBeInTheDocument();
    expect(screen.getByText("R1.4")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
