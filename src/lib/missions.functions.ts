import { createServerFn } from "@tanstack/react-start";

export interface ApiMission {
  id: string;
  title: string;
  description: string;
  url: string;
  points: number;
  completed: boolean;
  completedAt: string | null;
}

export const listMissions = createServerFn({ method: "GET" }).handler(async (): Promise<ApiMission[]> => {
  const core = await import("./server/core.server");
  const user = await core.requireUser();

  const [{ data: missions }, { data: done }] = await Promise.all([
    core.db.from("missions").select("*").eq("active", true).order("created_at"),
    core.db.from("mission_completions").select("mission_id, completed_at").eq("user_id", user.id),
  ]);

  const map = new Map((done ?? []).map((d) => [d.mission_id, d.completed_at]));
  return (missions ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    url: m.url,
    points: m.points,
    completed: map.has(m.id),
    completedAt: map.get(m.id) ?? null,
  }));
});

/** Atomic: one completion per mission per user, points written to the ledger. */
export const completeMission = createServerFn({ method: "POST" })
  .inputValidator((input: { missionId: string }) => ({ missionId: String(input.missionId) }))
  .handler(async ({ data }) => {
    const core = await import("./server/core.server");
    const user = await core.requireUser();
    const { error } = await core.db.rpc("complete_mission", {
      _user_id: user.id,
      _mission_id: data.missionId,
    });
    if (error) {
      const msg = error.message || "";
      if (msg.includes("already_completed")) return { ok: true, already: true };
      throw new core.AppError(msg.includes("unknown_mission") ? "unknown_mission" : "mission_failed");
    }
    return { ok: true, already: false };
  });
