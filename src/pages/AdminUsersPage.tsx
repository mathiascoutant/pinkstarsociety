import { useCallback, useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import {
  AdminUser,
  EditUserState,
  Field,
  Icon,
  LOYALTY_CYCLE_POINTS,
  Modal,
  formatUserCreatedAt,
  formatUserLoyaltyDisplay,
  userEffectiveTotalCompleted,
} from "../lib/adminShared";

export default function AdminUsersPage() {
  const { openSidebar } = useOutletContext<{ openSidebar: () => void }>();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<EditUserState | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      const r = await api<{ users: AdminUser[] }>("/admin/users");
      setUsers(r.users);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }, [users, search]);

  async function deleteUser(id: string) {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    try {
      await api(`/admin/users/${id}`, { method: "DELETE" });
      void loadUsers();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function saveUser() {
    if (!editUser) return;
    try {
      await api(`/admin/users/${editUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          firstName: editUser.firstName,
          lastName: editUser.lastName,
          email: editUser.email,
          role: editUser.role,
          loyaltyPoints: editUser.loyaltyPoints ?? 0,
          totalCompletedServices: editUser.totalCompletedServices ?? 0,
        }),
      });
      setEditUser(null);
      void loadUsers();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }

  const RoleBadge = ({ role }: { role: string }) => (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
        role === "admin"
          ? "border-pss-pink/40 bg-pss-pink/10 text-pss-pink"
          : "border-white/15 bg-white/5 text-white/70"
      }`}
    >
      {role}
    </span>
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
            Utilisateurs
          </h1>
        </div>
      </header>

      <main className="px-3 py-6 sm:px-4 md:px-8 md:py-8">
        {err && (
          <div className="mb-6 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <Icon name="search" className="h-4 w-4 text-white/35" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, prénom ou email…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:border-pss-pink/40 focus:outline-none focus:ring-1 focus:ring-pss-pink/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute inset-y-0 right-3 flex items-center text-white/35 hover:text-white/70"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          )}
        </div>

        {filtered.length === 0 && search && (
          <p className="py-8 text-center text-sm text-white/40">
            Aucun utilisateur trouvé pour «&nbsp;{search}&nbsp;».
          </p>
        )}

        {/* Mobile card view */}
        <div className="flex flex-col gap-3 md:hidden">
          {filtered.map((u) => {
            const loyalty = formatUserLoyaltyDisplay(u);
            return (
              <div
                key={u.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-white/55">{u.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-pss-pink"
                      onClick={() =>
                        setEditUser({
                          ...u,
                          totalCompletedServices: userEffectiveTotalCompleted(u),
                        })
                      }
                    >
                      <Icon name="edit" className="h-4 w-4" />
                    </button>
                    {u.id !== currentUser?.id && (
                      <button
                        type="button"
                        className="rounded-lg p-2 text-white/60 hover:bg-red-500/10 hover:text-red-300"
                        onClick={() => void deleteUser(u.id)}
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/50">
                  <RoleBadge role={u.role} />
                  <span>{formatUserCreatedAt(u.createdAt)}</span>
                </div>

                {loyalty.progressLabel && (
                  <div className="mt-3 space-y-0.5 border-t border-white/5 pt-3">
                    {loyalty.serviceName && (
                      <p className="text-xs font-medium text-white">{loyalty.serviceName}</p>
                    )}
                    {loyalty.totalLabel && (
                      <p className="text-xs text-white/50">{loyalty.totalLabel}</p>
                    )}
                    <p className="text-xs font-medium text-pss-pink">{loyalty.progressLabel}</p>
                    {loyalty.pointsLabel && (
                      <p className="text-xs text-white/40">{loyalty.pointsLabel}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop table view */}
        <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02] md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/[0.02] text-xs uppercase tracking-[0.14em] text-white/45">
              <tr>
                <th className="px-4 py-3 font-normal">Nom</th>
                <th className="px-4 py-3 font-normal">Email</th>
                <th className="px-4 py-3 font-normal">Rôle</th>
                <th className="px-4 py-3 font-normal">Création</th>
                <th className="px-4 py-3 font-normal">Fidélité</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const loyalty = formatUserLoyaltyDisplay(u);
                return (
                  <tr
                    key={u.id}
                    className="border-t border-white/5 transition hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 text-white">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="px-4 py-3 text-white/70">{u.email}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-white/60">
                      {formatUserCreatedAt(u.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {loyalty.progressLabel ? (
                        <div className="space-y-0.5">
                          {loyalty.serviceName && (
                            <p className="font-medium text-white">{loyalty.serviceName}</p>
                          )}
                          {loyalty.totalLabel && (
                            <p className="text-xs text-white/50">{loyalty.totalLabel}</p>
                          )}
                          <p className="text-xs font-medium text-pss-pink">
                            {loyalty.progressLabel}
                          </p>
                          {loyalty.pointsLabel && (
                            <p className="text-xs text-white/40">{loyalty.pointsLabel}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-pss-pink"
                        onClick={() =>
                            setEditUser({
                              ...u,
                              totalCompletedServices: userEffectiveTotalCompleted(u),
                            })
                        }
                      >
                        <Icon name="edit" className="h-4 w-4" />
                      </button>
                      {u.id !== currentUser?.id && (
                        <button
                          type="button"
                          className="ml-1 rounded-lg p-2 text-white/60 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => void deleteUser(u.id)}
                        >
                          <Icon name="trash" className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      {/* Edit user modal */}
      {editUser && (
        <Modal title="Modifier utilisateur" onClose={() => setEditUser(null)}>
          <div className="space-y-3">
            <input
              value={editUser.firstName}
              onChange={(e) => setEditUser({ ...editUser, firstName: e.target.value })}
              className="input"
              placeholder="Prénom"
            />
            <input
              value={editUser.lastName}
              onChange={(e) => setEditUser({ ...editUser, lastName: e.target.value })}
              className="input"
              placeholder="Nom"
            />
            <input
              value={editUser.email}
              onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
              className="input"
              placeholder="Email"
            />
            <select
              value={editUser.role}
              onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
              className="input"
            >
              <option value="client">client</option>
              <option value="admin">admin</option>
            </select>
            <div className="border-t border-white/10 pt-3">
              <p className="mb-3 text-xs uppercase tracking-[0.14em] text-white/45">Fidélité</p>
              <div className="space-y-3">
                <Field label="Points (cycle / 1000)">
                  <input
                    type="number"
                    min={0}
                    max={LOYALTY_CYCLE_POINTS}
                    value={editUser.loyaltyPoints ?? 0}
                    onChange={(e) =>
                      setEditUser({
                        ...editUser,
                        loyaltyPoints: Math.min(
                          LOYALTY_CYCLE_POINTS,
                          Math.max(0, Number(e.target.value) || 0),
                        ),
                      })
                    }
                    className="input"
                  />
                </Field>
                <Field label="Prestations totales">
                  <input
                    type="number"
                    min={0}
                    value={editUser.totalCompletedServices ?? 0}
                    onChange={(e) =>
                      setEditUser({
                        ...editUser,
                        totalCompletedServices: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="input"
                  />
                </Field>
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditUser(null)}
              className="rounded-lg px-3 py-2 text-sm text-white/60"
            >
              Annuler
            </button>
            <button type="button" onClick={() => void saveUser()} className="btn-pink">
              Enregistrer
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
