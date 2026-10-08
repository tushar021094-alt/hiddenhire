import { describe, expect, it } from "vitest";
import { canSubmitAppeal, resolveAppeal, validateAppealReason } from "@/lib/moderation-appeals";

describe("moderation appeals", () => {
  it("requires a substantive appeal reason", () => {
    expect(validateAppealReason("too strict").valid).toBe(false);
    expect(validateAppealReason("We have removed the flagged language and can provide verification evidence.").valid).toBe(true);
  });

  it("allows an appeal for an active restriction", () => {
    expect(canSubmitAppeal({ caseStatus: "open", decision: "restrict" })).toBe(true);
    expect(canSubmitAppeal({ caseStatus: "resolved", decision: "restrict" })).toBe(false);
  });

  it("prevents duplicate active appeals", () => {
    expect(canSubmitAppeal({ caseStatus: "appealed", decision: "escalate", existingAppealStatus: "submitted" })).toBe(false);
    expect(canSubmitAppeal({ caseStatus: "appealed", decision: "escalate", existingAppealStatus: "rejected" })).toBe(true);
  });

  it("accepting an appeal restores the job to allow", () => {
    expect(resolveAppeal("accepted", "Evidence verified.").caseDecision).toBe("allow");
    expect(resolveAppeal("accepted", "Evidence verified.").caseStatus).toBe("resolved");
  });
});
