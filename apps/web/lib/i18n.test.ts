import { describe, expect, it } from "vitest";
import { t } from "./i18n";

describe("i18n dict", () => {
  it("resolves UI strings", () => {
    expect(t("nav.dashboard")).toBe("Dashboard");
    expect(t("auth.signOut")).toBe("Sign out");
  });
});
