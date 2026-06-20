import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminImportWorkbenchPage } from "./AdminImportWorkbenchPage";
import * as api from "../api";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    previewImportJob: vi.fn(),
    fetchAdminImportJobs: vi.fn(),
    fetchAdminImportJob: vi.fn(),
    updateImportCandidate: vi.fn(),
    executeImportJob: vi.fn(),
    fetchAdminBackups: vi.fn()
  };
});

const editor: api.AuthUser = {
  id: "editor-id",
  username: "editor",
  displayName: null,
  role: "editor",
  isActive: true
};

const sampleJob: api.ImportJob = {
  id: "job-1",
  sourceType: "markdown",
  status: "ready",
  actor: "editor",
  summary: {
    totalCandidates: 2,
    validCount: 1,
    warningCount: 1,
    invalidCount: 0,
    errorCount: 0,
    matchCount: 1,
    createCount: 1,
    skipCount: 0,
    overwriteCount: 0,
    mergeCount: 0,
    needsReviewCount: 1
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  executedAt: null,
  candidates: [
    {
      id: "cand-1",
      jobId: "job-1",
      sourceIndex: 0,
      proposedWorkId: "new-work",
      proposedTitle: "新作品",
      parsed: { id: "new-work", title: "新作品" },
      status: "valid",
      action: "create",
      targetWorkId: null,
      resultWorkId: null,
      errorMessage: null,
      issues: [],
      matches: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "cand-2",
      jobId: "job-1",
      sourceIndex: 1,
      proposedWorkId: "dup-work",
      proposedTitle: "重复作品",
      parsed: { id: "dup-work", title: "重复作品" },
      status: "warning",
      action: "needs_review",
      targetWorkId: "existing",
      resultWorkId: null,
      errorMessage: null,
      issues: [{ id: 1, severity: "warning", issueType: "duplicate", fieldPath: null, message: "强重复", createdAt: new Date().toISOString() }],
      matches: [{ id: 1, existingWorkId: "existing", existingTitle: "已有", matchType: "id_exact", score: 1, evidence: {}, createdAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
};

describe("AdminImportWorkbenchPage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchAdminImportJobs).mockResolvedValue({ items: [sampleJob] });
    vi.mocked(api.fetchAdminImportJob).mockResolvedValue(sampleJob);
    vi.mocked(api.fetchAdminBackups).mockResolvedValue({ items: [] });
    vi.mocked(api.previewImportJob).mockResolvedValue(sampleJob);
    vi.mocked(api.updateImportCandidate).mockImplementation(async (id, patch) => {
      const candidate = sampleJob.candidates!.find((c) => c.id === id)!;
      return { ...candidate, ...patch };
    });
  });

  it("creates preview job and shows candidates", async () => {
    render(<AdminImportWorkbenchPage user={editor} />);

    await userEvent.click(screen.getByRole("button", { name: "创建预览任务" }));

    await waitFor(() => {
      expect(api.previewImportJob).toHaveBeenCalled();
    });
    expect((await screen.findAllByText("新作品")).length).toBeGreaterThan(0);
    expect(screen.getByText("重复作品")).toBeInTheDocument();
  });

  it("allows changing candidate action", async () => {
    render(<AdminImportWorkbenchPage user={editor} />);
    await screen.findByText("重复作品");
    await userEvent.click(screen.getByText("重复作品"));

    const actionSelect = screen.getByLabelText("选择动作");
    await userEvent.selectOptions(actionSelect, "skip");

    await waitFor(() => {
      expect(api.updateImportCandidate).toHaveBeenCalledWith("cand-2", { action: "skip" });
    });
  });

  it("blocks execute when needs_review remains", async () => {
    render(<AdminImportWorkbenchPage user={editor} />);
    await screen.findByRole("heading", { name: "候选项" });

    const executeButton = screen.getByRole("button", { name: "执行导入" });
    expect(executeButton).toBeDisabled();
  });

  it("blocks execute when every candidate is skipped", async () => {
    const skipOnlyJob: api.ImportJob = {
      ...sampleJob,
      status: "ready",
      summary: {
        ...sampleJob.summary!,
        needsReviewCount: 0,
        createCount: 0,
        skipCount: sampleJob.candidates!.length
      },
      candidates: sampleJob.candidates!.map((candidate) => ({
        ...candidate,
        action: "skip" as const,
        issues: []
      }))
    };
    vi.mocked(api.fetchAdminImportJobs).mockResolvedValue({ items: [skipOnlyJob] });
    vi.mocked(api.fetchAdminImportJob).mockResolvedValue(skipOnlyJob);

    render(<AdminImportWorkbenchPage user={editor} />);
    await screen.findByRole("heading", { name: "候选项" });

    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "执行导入" })).toBeDisabled();
  });

  it("executes import after confirmation when job is ready", async () => {
    const readyJob: api.ImportJob = {
      ...sampleJob,
      status: "ready",
      summary: { ...sampleJob.summary!, needsReviewCount: 0, createCount: 2 },
      candidates: sampleJob.candidates!.map((c) => ({ ...c, action: "create" as const, issues: [] }))
    };
    vi.mocked(api.fetchAdminImportJobs).mockResolvedValue({ items: [readyJob] });
    vi.mocked(api.fetchAdminImportJob).mockResolvedValue(readyJob);
    vi.mocked(api.executeImportJob).mockResolvedValue({
      ...readyJob,
      status: "completed",
      summary: { ...readyJob.summary!, backupFile: "/tmp/backup.sqlite", successCount: 2 }
    });

    render(<AdminImportWorkbenchPage user={editor} />);
    await screen.findByRole("heading", { name: "候选项" });

    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "执行导入" }));

    await waitFor(() => {
      expect(api.executeImportJob).toHaveBeenCalledWith("job-1");
    });
  });

  it("disables preview for viewer role", () => {
    render(<AdminImportWorkbenchPage user={{ ...editor, role: "viewer" }} />);
    expect(screen.getByRole("button", { name: "创建预览任务" })).toBeDisabled();
  });
});
