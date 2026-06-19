import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuditLogPanel } from "./AuditLogPanel";
import * as api from "../api";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    fetchAdminAuditLogs: vi.fn()
  };
});

describe("AuditLogPanel", () => {
  it("shows recent audit log entries", async () => {
    vi.mocked(api.fetchAdminAuditLogs).mockResolvedValue({
      items: [
        {
          id: 2,
          entityType: "work",
          entityId: "sample-work",
          action: "update",
          actor: "local",
          before: { title: "Old title" },
          after: { title: "New title" },
          createdAt: "2026-06-14T06:00:00.000Z"
        }
      ]
    });

    render(<AuditLogPanel />);

    expect(await screen.findByText("最近操作")).toBeInTheDocument();
    expect(await screen.findByText("update")).toBeInTheDocument();
    expect(await screen.findByText("work: sample-work")).toBeInTheDocument();
  });
});
