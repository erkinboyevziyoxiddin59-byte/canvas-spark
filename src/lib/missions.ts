// Missions (tasks) — admin creates them, users complete them for Star Points.
// Client-side mock store, same as the rest of this Mini App.

const MISSIONS_KEY = "starbbot.missions.v1";
const DONE_KEY = "starbbot.missions.done.v1";

export interface Mission {
  id: string;
  title: string;
  description: string;
  url: string;
  points: number;
  active: boolean;
  createdAt: number;
}

export interface MissionCompletion {
  id: string;
  completedAt: number;
  points: number;
  title: string;
}

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("orders:changed"));
}

export function getMissions(): Mission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MISSIONS_KEY);
    const list = raw ? (JSON.parse(raw) as Mission[]) : [];
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function saveMissions(list: Mission[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MISSIONS_KEY, JSON.stringify(list));
  emit();
}

export function addMission(m: Omit<Mission, "id" | "createdAt">): Mission {
  const mission: Mission = { ...m, id: `m${Date.now()}`, createdAt: Date.now() };
  saveMissions([mission, ...getMissions()]);
  return mission;
}

export function updateMission(id: string, patch: Partial<Mission>) {
  saveMissions(getMissions().map((m) => (m.id === id ? { ...m, ...patch } : m)));
}

export function removeMission(id: string) {
  saveMissions(getMissions().filter((m) => m.id !== id));
}

/* ---------------- completions ---------------- */

export function getCompletions(): MissionCompletion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DONE_KEY);
    return raw ? (JSON.parse(raw) as MissionCompletion[]) : [];
  } catch {
    return [];
  }
}

export function isCompleted(id: string): boolean {
  return getCompletions().some((c) => c.id === id);
}

export function completeMission(id: string): boolean {
  const mission = getMissions().find((m) => m.id === id);
  if (!mission || !mission.active || isCompleted(id)) return false;
  const next: MissionCompletion[] = [
    ...getCompletions(),
    { id, completedAt: Date.now(), points: mission.points, title: mission.title },
  ];
  if (typeof window !== "undefined") window.localStorage.setItem(DONE_KEY, JSON.stringify(next));
  emit();
  return true;
}

export interface MissionLedgerEntry {
  id: string;
  createdAt: number;
  points: number;
  note: string;
}

export function missionLedgerEntries(): MissionLedgerEntry[] {
  return getCompletions()
    .filter((c) => c.points > 0)
    .map((c) => ({
      id: `mission-${c.id}`,
      createdAt: c.completedAt,
      points: c.points,
      note: `Vazifa — ${c.title}`,
    }));
}

/** Opens a mission link inside Telegram when possible. */
export function openMissionLink(url: string) {
  if (typeof window === "undefined" || !url) return;
  const wa = (window as any)?.Telegram?.WebApp;
  if (/^https?:\/\/(t\.me|telegram\.me)\//i.test(url) && wa?.openTelegramLink) {
    wa.openTelegramLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
