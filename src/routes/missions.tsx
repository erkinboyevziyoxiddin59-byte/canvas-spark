import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Target } from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { MiniStat } from "../components/StatBits";
import { formatAmount } from "../lib/format";
import { useT } from "../lib/language";
import { completeMission, listMissions, type ApiMission } from "../lib/missions.functions";

export const Route = createFileRoute("/missions")({
  head: () => ({
    meta: [
      { title: "Vazifalar — Star Points ishlang | Starbbot" },
      {
        name: "description",
        content: "Kanalga obuna bo‘ling, giveaway’da qatnashing va vazifalar uchun Star Points oling.",
      },
      { property: "og:title", content: "Vazifalar — Star Points ishlang" },
      {
        property: "og:description",
        content: "Kanalga obuna bo‘ling, giveaway’da qatnashing va vazifalar uchun Star Points oling.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MissionsPage,
});

function openMissionLink(url: string) {
  if (!url) return;
  const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void; openLink?: (u: string) => void } } })
    .Telegram?.WebApp;
  if (url.includes("t.me") && tg?.openTelegramLink) tg.openTelegramLink(url);
  else if (tg?.openLink) tg.openLink(url);
  else window.open(url, "_blank", "noopener");
}

function MissionsPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  const missionsQuery = useQuery<ApiMission[]>({
    queryKey: ["missions"],
    queryFn: () => listMissions(),
  });

  const complete = useMutation({
    mutationFn: (missionId: string) => completeMission({ data: { missionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["ledger"] });
    },
  });

  const missions = missionsQuery.data ?? null;
  const done = (missions ?? []).filter((m) => m.completed);
  const earned = done.reduce((s, m) => s + m.points, 0);

  return (
    <>
      <AppHeader title={t.missions} />
      <main className="px-4 pb-8 pt-4">
        <p className="text-xs text-muted-foreground">{t.missionsIntro}</p>

        <section className="mt-3 grid grid-cols-3 gap-2 text-center">
          <MiniStat label={t.missionsAvailable} value={String(missions?.length ?? 0)} />
          <MiniStat label={t.missionsDone} value={String(done.length)} />
          <MiniStat label={t.earned} value={formatAmount(earned)} />
        </section>

        <section className="mt-5 space-y-3">
          {missionsQuery.isLoading ? (
            <div className="h-40 animate-pulse rounded-2xl bg-card" />
          ) : missionsQuery.error ? (
            <div className="rounded-2xl border border-border bg-card px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">{(missionsQuery.error as Error).message}</p>
              <button
                onClick={() => missionsQuery.refetch()}
                className="mt-3 rounded-full px-5 py-2 text-xs font-semibold btn-primary-glow no-tap-highlight"
              >
                {t.retry}
              </button>
            </div>
          ) : !missions || missions.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-xs text-muted-foreground">
              {t.missionsEmpty}
            </p>
          ) : (
            missions.map((m) => (
              <article key={m.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-sm font-semibold">
                      <Target className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate">{m.title}</span>
                    </h2>
                    {m.description && <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>}
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2 py-1 text-[11px] font-semibold">
                    +{formatAmount(m.points)} {t.points}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      openMissionLink(m.url);
                      setOpened((o) => ({ ...o, [m.id]: true }));
                    }}
                    disabled={!m.url}
                    className="no-tap-highlight flex items-center justify-center gap-2 rounded-full border border-border py-2.5 text-xs font-semibold disabled:opacity-40"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t.missionOpen}
                  </button>
                  <button
                    onClick={() => complete.mutate(m.id)}
                    disabled={m.completed || complete.isPending || (!!m.url && !opened[m.id])}
                    className="no-tap-highlight flex items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold btn-primary-glow disabled:opacity-40"
                  >
                    {m.completed ? <Check className="h-4 w-4" /> : null}
                    {m.completed ? t.missionDone : t.missionCheck}
                  </button>
                </div>
              </article>
            ))
          )}
          {complete.error && (
            <p className="text-center text-[11px] text-destructive">{(complete.error as Error).message}</p>
          )}
        </section>
      </main>
    </>
  );
}
