import { describe, expect, it } from "vitest";
import { t } from "./i18n";

describe("i18n dict", () => {
  it("resolves Bangla and English strings", () => {
    expect(t("bn", "nav.dashboard")).toBe("ড্যাশবোর্ড");
    expect(t("en", "nav.dashboard")).toBe("Dashboard");
  });

  it("Bangla strings actually contain Bangla script", () => {
    expect(t("bn", "auth.signIn")).toMatch(/[ঀ-৿]/);
  });
});
