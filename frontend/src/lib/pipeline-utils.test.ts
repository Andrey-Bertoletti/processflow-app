import { getDefaultStageId, groupLeadsByStage } from "./pipeline-utils";
import type { Lead, Stage } from "@/types/database.types";

describe("pipeline-utils", () => {
  const stages = [
    { id: "stage-2", name: "Negociacao", order: 2, workspace_id: "ws-1" },
    { id: "stage-1", name: "Base", order: 1, workspace_id: "ws-1" },
  ] as Stage[];

  const leads = [
    { id: "lead-1", name: "A", workspace_id: "ws-1", stage_id: "stage-1" },
    { id: "lead-2", name: "B", workspace_id: "ws-1", stage_id: "stage-1" },
    { id: "lead-3", name: "C", workspace_id: "ws-1", stage_id: "stage-2" },
  ] as Lead[];

  it("groups leads by stage", () => {
    const result = groupLeadsByStage(stages, leads);

    expect(result[0]?.leads).toHaveLength(1);
    expect(result[1]?.leads).toHaveLength(2);
  });

  it("returns the first stage by order", () => {
    expect(getDefaultStageId(stages)).toBe("stage-1");
  });
});
