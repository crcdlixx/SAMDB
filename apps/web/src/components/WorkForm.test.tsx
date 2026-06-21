import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkForm } from "./WorkForm";
import type { Work } from "../api";

const baseWork: Work = {
  id: "work-one",
  title: "First work",
  titleI18n: {},
  titleOriginal: null,
  aliases: [],
  year: null,
  language: null,
  sourceLanguage: "en",
  summaryShort: "First summary",
  summaryShortI18n: {},
  summaryFull: null,
  summaryFullI18n: {},
  tags: [],
  sourcePrimary: "source-one",
  recordStatus: "draft",
  visibility: "public"
};

describe("WorkForm", () => {
  afterEach(() => cleanup());

  it("resets editable fields when the initial work changes", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<WorkForm initial={baseWork} onSubmit={onSubmit} />);

    await userEvent.clear(screen.getByLabelText("标题 zh-CN"));
    await userEvent.type(screen.getByLabelText("标题 zh-CN"), "Changed locally");

    rerender(<WorkForm initial={{ ...baseWork, id: "work-two", title: "Second work" }} onSubmit={onSubmit} />);

    expect(screen.getByLabelText("标题 zh-CN")).toHaveValue("Second work");
    await userEvent.click(screen.getByRole("button", { name: /保存/ }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      id: "work-two",
      title: "Second work"
    }), []);
  });

  it("adds and removes aliases and tags without comma-separated input", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<WorkForm onSubmit={onSubmit} />);

    const aliasInput = screen.getByLabelText("添加别名");
    await userEvent.type(aliasInput, "银河记录{enter}");
    expect(screen.getByText("银河记录")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "删除别名：银河记录" }));
    expect(screen.queryByText("银河记录")).not.toBeInTheDocument();

    const tagInput = screen.getByLabelText("添加标签");
    await userEvent.type(tagInput, "科幻{enter}");
    await userEvent.click(screen.getByRole("button", { name: /保存|创建作品/ }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      tags: ["科幻"],
      aliases: []
    }), []);
  });

  it("submits multilingual title and summaries", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<WorkForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText("标题 zh-CN"), "中文标题");
    await userEvent.type(screen.getByLabelText("标题 ja"), "日本語タイトル");
    await userEvent.type(screen.getByLabelText("一句话简介 zh-CN"), "中文一句话");
    await userEvent.type(screen.getByLabelText("完整简介 ja"), "日本語の完全な説明");
    await userEvent.type(screen.getByLabelText("主来源"), "https://example.test/source");
    await userEvent.selectOptions(screen.getByLabelText("源语言"), "ja");
    await userEvent.click(screen.getByRole("button", { name: /保存|创建作品/ }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      title: "中文标题",
      titleI18n: expect.objectContaining({
        "zh-CN": "中文标题",
        ja: "日本語タイトル"
      }),
      sourceLanguage: "ja",
      summaryShort: "中文一句话",
      summaryShortI18n: expect.objectContaining({
        "zh-CN": "中文一句话"
      }),
      summaryFullI18n: expect.objectContaining({
        ja: "日本語の完全な説明"
      })
    }), []);
  });
});
