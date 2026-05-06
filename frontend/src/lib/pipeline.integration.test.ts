import { createLeadInWorkspace } from "./leads";

const insertMock = vi.fn();
const selectMock = vi.fn();
const singleMock = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: insertMock,
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      select: selectMock,
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      single: singleMock,
    }),
    rpc: vi.fn(),
  },
}));

describe("pipeline integration", () => {
  beforeEach(() => {
    insertMock.mockReset();
    selectMock.mockReset();
    singleMock.mockReset();

    selectMock.mockReturnThis();

    singleMock.mockResolvedValue({
      data: {
        id: "lead-1",
        name: "Lead Demo",
        email: "demo@acme.com",
        phone: null,
        stage_id: "stage-1",
        assigned_to: null,
        workspace_id: "ws-1",
      },
      error: null,
    });

    insertMock.mockReturnValue({
      select: () => ({
        single: singleMock,
      }),
    });
  });

  it("sends workspace_id during lead creation and returns the created row", async () => {
    const result = await createLeadInWorkspace({
      workspaceId: "ws-1",
      payload: {
        name: "Lead Demo",
        email: "demo@acme.com",
        phone: null,
        stageId: "stage-1",
        assignedTo: null,
        campaignId: null,
      },
    });

    expect(result.id).toBe("lead-1");
    expect(insertMock).toHaveBeenCalledWith({
      workspace_id: "ws-1",
      name: "Lead Demo",
      email: "demo@acme.com",
      phone: null,
      stage_id: "stage-1",
      assigned_to: null,
      campaign_id: null,
      metadata: {},
    });
  });
});
