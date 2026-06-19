import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SeriesPage } from "./SeriesPage";
import * as api from "../api";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    fetchPublicSeries: vi.fn(),
    fetchPublicSeriesDetail: vi.fn()
  };
});

describe("SeriesPage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchPublicSeries).mockResolvedValue({
      items: [{ name: "Star Line", workCount: 2 }]
    });
    vi.mocked(api.fetchPublicSeriesDetail).mockResolvedValue({
      name: "Star Line",
      works: [
        { id: "work-a", title: "第一部", year: "2024", summaryShort: "开端" },
        { id: "work-b", title: "第二部", year: "2026", summaryShort: "延续" }
      ]
    });
  });

  it("opens a series timeline and navigates to a work", async () => {
    const onOpenWork = vi.fn();
    render(<SeriesPage onOpenWork={onOpenWork} />);

    await userEvent.click(await screen.findByRole("button", { name: "Star Line 2 部作品" }));
    const timeline = await screen.findByRole("list", { name: "Star Line 时间线" });
    expect(within(timeline).getByText("第一部")).toBeInTheDocument();
    expect(within(timeline).getByText("第二部")).toBeInTheDocument();

    await userEvent.click(within(timeline).getByRole("button", { name: "2026 第二部 延续" }));
    expect(onOpenWork).toHaveBeenCalledWith("work-b");
  });
});
