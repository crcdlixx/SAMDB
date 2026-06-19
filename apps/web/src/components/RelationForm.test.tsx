import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelationForm } from "./RelationForm";
import * as api from "../api";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    createAdminWorkRelation: vi.fn(),
    deleteAdminWorkRelation: vi.fn(),
    fetchAdminWorkRelations: vi.fn(),
    updateAdminWorkRelation: vi.fn()
  };
});

const works: api.Work[] = [{
  id: "source-work",
  title: "Source Work",
  titleOriginal: null,
  aliases: [],
  year: null,
  language: null,
  summaryShort: "Source",
  summaryFull: null,
  tags: [],
  sourcePrimary: "source",
  recordStatus: "published",
  visibility: "public"
}, {
  id: "target-work",
  title: "Target Work",
  titleOriginal: null,
  aliases: [],
  year: null,
  language: null,
  summaryShort: "Target",
  summaryFull: null,
  tags: [],
  sourcePrimary: "target",
  recordStatus: "published",
  visibility: "public"
}];

describe("RelationForm", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchAdminWorkRelations).mockResolvedValue({
      items: [{
        id: 7,
        source_work_id: "source-work",
        target_work_id: "target-work",
        relation_type: "related",
        direction: "bidirectional",
        note: "Existing note",
        target_title: "Target Work"
      }]
    });
    vi.mocked(api.createAdminWorkRelation).mockResolvedValue({ ok: true });
    vi.mocked(api.updateAdminWorkRelation).mockResolvedValue({} as api.WorkRelation);
    vi.mocked(api.deleteAdminWorkRelation).mockResolvedValue(undefined);
  });

  it("creates, hides, and deletes work relations", async () => {
    render(<RelationForm workId="source-work" works={works} />);

    expect(await screen.findByText("Target Work")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("目标作品"), "target-work");
    await userEvent.selectOptions(screen.getByLabelText("关系类型"), "same_series");
    await userEvent.type(screen.getByLabelText("备注"), "New note");
    await userEvent.click(screen.getByRole("button", { name: "添加关系" }));
    await userEvent.click(screen.getByRole("button", { name: "隐藏关系：Target Work" }));
    await userEvent.click(screen.getByRole("button", { name: "删除关系：Target Work" }));

    await waitFor(() => {
      expect(api.createAdminWorkRelation).toHaveBeenCalledWith("source-work", expect.objectContaining({
        targetWorkId: "target-work",
        relationType: "same_series",
        note: "New note"
      }));
      expect(api.updateAdminWorkRelation).toHaveBeenCalledWith(7, expect.objectContaining({
        visibility: "internal"
      }));
      expect(api.deleteAdminWorkRelation).toHaveBeenCalledWith(7);
    });
  });
});
