import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../lib/api";
import { Icon, LoyaltyCode, Modal } from "../lib/adminShared";

export default function AdminLoyaltyPage() {
  const { openSidebar } = useOutletContext<{ openSidebar: () => void }>();

  const [loyaltyCodes, setLoyaltyCodes] = useState<LoyaltyCode[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newPoints, setNewPoints] = useState("");
  const [newMaxUses, setNewMaxUses] = useState("");
  const [editLoyaltyCode, setEditLoyaltyCode] = useState<LoyaltyCode | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadCodes = useCallback(async () => {
    try {
      const r = await api<{ loyaltyCodes: LoyaltyCode[] }>("/admin/loyalty-codes");
      setLoyaltyCodes(r.loyaltyCodes);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }, []);

  useEffect(() => {
    void loadCodes();
  }, [loadCodes]);

  async function addCode(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/admin/loyalty-codes", {
        method: "POST",
        body: JSON.stringify({
          code: newCode,
          points: Number(newPoints),
          maxUses: Number(newMaxUses),
        }),
      });
      setNewCode("");
      setNewPoints("");
      setNewMaxUses("");
      void loadCodes();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function saveCode() {
    if (!editLoyaltyCode) return;
    try {
      await api(`/admin/loyalty-codes/${editLoyaltyCode.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          code: editLoyaltyCode.code,
          points: editLoyaltyCode.points,
          maxUses: editLoyaltyCode.maxUses,
          isActive: editLoyaltyCode.isActive,
        }),
      });
      setEditLoyaltyCode(null);
      void loadCodes();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function deleteCode(id: string) {
    if (!confirm("Supprimer ce code fidélité ?")) return;
    try {
      await api(`/admin/loyalty-codes/${id}`, { method: "DELETE" });
      void loadCodes();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }

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
            Fidélité
          </h1>
        </div>
      </header>

      <main className="px-3 py-6 sm:px-4 md:px-8 md:py-8">
        {err && (
          <div className="mb-6 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        <div className="max-w-3xl space-y-5">
          <form
            onSubmit={addCode}
            className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3 md:grid-cols-[1fr_auto_auto_auto]"
          >
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              className="input"
              required
            />
            <input
              type="number"
              min={1}
              value={newPoints}
              onChange={(e) => setNewPoints(e.target.value)}
              placeholder="Points"
              className="input md:w-32"
              required
            />
            <input
              type="number"
              min={1}
              value={newMaxUses}
              onChange={(e) => setNewMaxUses(e.target.value)}
              placeholder="Max usages"
              className="input md:w-32"
              required
            />
            <button type="submit" className="btn-pink">
              Créer
            </button>
          </form>

          {loyaltyCodes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/55">
              Aucun code fidélité.
            </div>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {loyaltyCodes.map((lc) => (
                <li
                  key={lc.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div>
                    <p className="font-display text-base tracking-[0.1em] text-pss-pink">
                      {lc.code}
                    </p>
                    <p className="mt-1 text-xs text-white/55">
                      {lc.points} pts · {lc.usageCount}/{lc.maxUses} ·{" "}
                      <span className={lc.isActive ? "text-emerald-300" : "text-white/40"}>
                        {lc.isActive ? "Actif" : "Inactif"}
                      </span>
                    </p>
                  </div>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-pss-pink"
                      onClick={() => setEditLoyaltyCode({ ...lc })}
                    >
                      <Icon name="edit" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-white/60 hover:bg-red-500/10 hover:text-red-300"
                      onClick={() => void deleteCode(lc.id)}
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {editLoyaltyCode && (
        <Modal title="Modifier code fidélité" onClose={() => setEditLoyaltyCode(null)}>
          <div className="space-y-3">
            <input
              value={editLoyaltyCode.code}
              onChange={(e) =>
                setEditLoyaltyCode({ ...editLoyaltyCode, code: e.target.value.toUpperCase() })
              }
              className="input"
              placeholder="Code"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                value={editLoyaltyCode.points}
                onChange={(e) =>
                  setEditLoyaltyCode({ ...editLoyaltyCode, points: Number(e.target.value) })
                }
                className="input"
                placeholder="Points"
              />
              <input
                type="number"
                min={1}
                value={editLoyaltyCode.maxUses}
                onChange={(e) =>
                  setEditLoyaltyCode({ ...editLoyaltyCode, maxUses: Number(e.target.value) })
                }
                className="input"
                placeholder="Utilisations max"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={editLoyaltyCode.isActive}
                onChange={(e) =>
                  setEditLoyaltyCode({ ...editLoyaltyCode, isActive: e.target.checked })
                }
              />
              Code actif
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditLoyaltyCode(null)}
              className="rounded-lg px-3 py-2 text-sm text-white/60"
            >
              Annuler
            </button>
            <button type="button" onClick={() => void saveCode()} className="btn-pink">
              Enregistrer
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
