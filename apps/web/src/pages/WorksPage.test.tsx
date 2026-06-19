import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorksPage } from "./WorksPage";
import * as api from "../api";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    fetchWorks: vi.fn()
  };
});

describe("WorksPage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchWorks).mockResolvedValue({
      items: [{
        id: "work-one",
        title: "星图作品",
        titleOriginal: "Star Atlas",
        aliases: ["SA"],
        year: "2026",
        language: "zh",
        summaryShort: "作品简介",
        summaryFull: null,
        tags: ["同人", "短篇"],
        sourcePrimary: "local",
        recordStatus: "published",
        visibility: "public"
      }]
    });
  });

  it("toggles between card and compact list density", async () => {
    const onOpenWork = vi.fn();
    render(<WorksPage onOpenWork={onOpenWork} />);

    expect(await screen.findByRole("button", { name: "星图作品" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "作品列表" })).toHaveClass("work-grid");

    await userEvent.click(screen.getByRole("button", { name: "列表" }));
    const list = screen.getByRole("list", { name: "作品列表" });
    expect(list).toHaveClass("work-compact-list");
    expect(within(list).getByText("Star Atlas")).toBeInTheDocument();

    await userEvent.click(within(list).getByRole("button", { name: "星图作品" }));
    expect(onOpenWork).toHaveBeenCalledWith("work-one");
  });
});
