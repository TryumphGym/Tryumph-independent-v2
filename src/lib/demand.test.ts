import { beforeEach, it, expect, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { trackDiscoveryDemand } from "./demand";
beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
});
it("normalizes an allowed fitness search without waiting for telemetry", () => {
  expect(
    trackDiscoveryDemand({
      source: "programs",
      query: "  GENERAL   Wellness  ",
      tags: ["wellness"],
    }),
  ).toBeUndefined();
  expect(rpc).toHaveBeenCalledWith(
    "record_discovery_demand",
    expect.objectContaining({
      p_query: "general wellness",
      p_tags: ["wellness"],
    }),
  );
});
it("never sends unrecognized contact/health searches or sensitive filter selections to optional analytics", () => {
  trackDiscoveryDemand({
    source: "programs",
    query: "myname@example.invalid prenatal diagnosis",
  });
  trackDiscoveryDemand({ source: "workouts", tags: ["postpartum", "core"] });
  expect(rpc).not.toHaveBeenCalled();
});
it("keeps discovery non-blocking when optional telemetry rejects", async () => {
  rpc.mockRejectedValue(new Error("Unavailable"));
  trackDiscoveryDemand({ source: "workouts", tags: ["strength"] });
  await Promise.resolve();
  expect(rpc).toHaveBeenCalledOnce();
});
