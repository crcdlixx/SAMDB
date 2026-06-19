import { describe, expect, it } from "vitest";
import { filterPublicAccessEntry } from "../visibility";

describe("filterPublicAccessEntry", () => {
  it("removes restricted and internal access fields", () => {
    const filtered = filterPublicAccessEntry({
      accessId: "acc-1",
      accessType: "official_streaming",
      platform: "Example",
      url: "https://example.test",
      mirrorNote: "mirror detail",
      accessRisk: "risk detail",
      checksum: "abc",
      extractCode: "1234",
      internalPath: "D:/secret",
      sensitiveSource: "private"
    });

    expect(filtered).toEqual({
      accessId: "acc-1",
      accessType: "official_streaming",
      platform: "Example",
      url: "https://example.test"
    });
  });
});
