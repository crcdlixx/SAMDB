import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WorkForm } from "./WorkForm";
import type { Work } from "../api";

const baseWork: Work = {
  id: "work-one",
  title: "First work",
  titleOriginal: null,
  aliases: [],
  year: null,
  language: null,
  summaryShort: "First summary",
  summaryFull: null,
  tags: [],
  sourcePrimary: "source-one",
  recordStatus: "draft",
  visibility: "public"
};

describe("WorkForm", () => {
  it("resets editable fields when the initial work changes", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<WorkForm initial={baseWork} onSubmit={onSubmit} />);

    await userEvent.clear(screen.getByLabelText(/标题/));
    await userEvent.type(screen.getByLabelText(/标题/), "Changed locally");

    rerender(<WorkForm initial={{ ...baseWork, id: "work-two", title: "Second work" }} onSubmit={onSubmit} />);

    expect(screen.getByLabelText(/标题/)).toHaveValue("Second work");
    await userEvent.click(screen.getByRole("button", { name: /保存/ }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      id: "work-two",
      title: "Second work"
    }));
  });
});
