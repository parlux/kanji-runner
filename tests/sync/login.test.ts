import { describe, expect, it } from "vitest";
import { loginError } from "../../src/sync/login";

describe("login errors", () => {
  it("says what went wrong for each failure", () => {
    expect(loginError("credentials")).toMatch(/wrong email or password/i);
    expect(loginError("offline")).toMatch(/play offline/i);
    expect(loginError("disabled")).toMatch(/not set up/i);
  });
});
