import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../lib/api";
import { BookingSummaryService, Icon, fmtEUR, paymentStatusLabel } from "../lib/adminShared";

export default function AdminStatsPage() {
  const { openSidebar } = useOutletContext<{ openSidebar: () => void }>();

  const [summaryServices, setSummaryServices] = useState<BookingSummaryService[]>([]);
  const [summaryPeriod, setSummaryPeriod] = useState<"all" | "month" | "last_30_days">("month");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const r = await api<{ services: BookingSummaryService[] }>(
        `/admin/bookings/summary?period=${summaryPeriod}`,
      );
      setSummaryServices(r.services);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }, [summaryPeriod]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const total = useMemo(
    () => summaryServices.reduce((s, x) => s + x.revenueCents, 0),
    [summaryServices],
  );
  const totalCount = useMemo(
    () => summaryServices.reduce((s, x) => s + x.bookingsCount, 0),
    [summaryServices],
  );

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-white/10 bg-[#050507]/90 px-4 backdrop-blur md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={openSidebar}
            className="lg:hidden text-white/70 shrink-0"
          >
            <Icon name="menu" />
          </button>
          <h1 className="truncate font-display text-base uppercase tracking-[0.14em] sm:text-lg">
            Statistiques
          </h1>
        </div>
      </header>

      <main className="px-3 py-6 sm:px-4 md:px-8 md:py-8">
        {err && (
          <div className="mb-6 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/55">
              {totalCount} prestation(s) · {fmtEUR(total)}
            </p>
            <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.02] p-1">
              {(["month", "last_30_days", "all"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSummaryPeriod(p)}
                  className={`rounded-lg px-3 py-1.5 text-xs uppercase tracking-[0.14em] transition ${
                    summaryPeriod === p
                      ? "bg-pss-pink/15 text-pss-pink"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {p === "month" ? "Ce mois" : p === "last_30_days" ? "30 jours" : "Tout"}
                </button>
              ))}
            </div>
          </div>

          {summaryServices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-white/55">
              Aucune donnée sur cette période.
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {summaryServices
                .slice()
                .sort((a, b) => b.bookingsCount - a.bookingsCount)
                .map((s) => {
                  const expanded = expandedId === s.serviceTypeId;
                  return (
                    <li
                      key={s.serviceTypeId}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : s.serviceTypeId)}
                        className="w-full p-5 text-left transition hover:bg-white/[0.04]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-white">{s.serviceTypeName}</p>
                          <span className="font-display text-xl text-pss-pink">
                            {fmtEUR(s.revenueCents)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-white/55">
                          {s.peopleCount} pers. · {s.bookingsCount} prestation(s)
                        </p>
                      </button>
                      {expanded && (
                        <ul className="border-t border-white/10 bg-black/20 p-3 space-y-1">
                          {s.details.map((d) => (
                            <li
                              key={d.bookingId}
                              className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-white/75"
                            >
                              <p>
                                {d.date} · {d.time}
                                {d.endTime ? ` → ${d.endTime}` : ""} · {fmtEUR(d.priceCents)}
                              </p>
                              <p className="mt-0.5 text-white/50">
                                {d.clientName} · {paymentStatusLabel(d.paymentStatus)} ·{" "}
                                {d.visitLabelFR || "—"}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
