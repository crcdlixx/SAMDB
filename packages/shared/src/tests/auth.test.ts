import { describe, expect, it } from "vitest";
import { canRole, roles } from "../auth";

describe("auth roles", () => {
  it("allows owners to manage users and viewers only to read admin data", () => {
    expect(roles).toContain("owner");
    expect(canRole("owner", "manage_users")).toBe(true);
    expect(canRole("viewer", "read_admin")).toBe(true);
    expect(canRole("viewer", "write_work")).toBe(false);
    expect(canRole("public", "read_admin")).toBe(false);
  });
});
