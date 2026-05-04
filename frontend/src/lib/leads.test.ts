import { describe, expect, it } from "vitest";
import { validateLeadPayload, normalizePhone } from "./lead-validation";

describe("leads validation", () => {
  it("rejects short names and invalid emails", () => {
    expect(
      validateLeadPayload({
        name: "ab",
        email: "invalid-email",
        phone: null,
        stageId: "stage-1",
        assignedTo: null,
      })
    ).toBe("Informe um nome com pelo menos 3 caracteres.");
  });

  it("normalizes phone values", () => {
    expect(normalizePhone("(11) 99999-0000")).toBe("11999990000");
  });
});
