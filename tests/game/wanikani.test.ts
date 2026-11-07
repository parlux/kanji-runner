import { describe, expect, it } from "vitest";
import { maskToken } from "../../src/game/wanikani";

describe("maskToken", () => {
  it("shows only the last 4 characters", () => {
    const t = "12345678-aaaa-bbbb-cccc-0000000f3a9c";
    const m = maskToken(` ${t} `);
    expect(m).toBe("••••3a9c");
    expect(m).not.toContain("12345678");
  });
  it("hides short tokens entirely", () => {
    expect(maskToken("abcd")).toBe("••••");
  });
});
