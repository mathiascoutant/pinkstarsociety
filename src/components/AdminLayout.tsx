import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Icon } from "../lib/adminShared";

const NAV_ITEMS = [
  { to: "/admin", label: "Tableau de bord", icon: "dashboard", end: true },
  { to: "/admin/reservations", label: "Réservations", icon: "calendar" },
  { to: "/admin/statistiques", label: "Statistiques", icon: "chart" },
  { to: "/admin/prestations", label: "Prestations", icon: "scissors" },
  { to: "/admin/fidelite", label: "Fidélité", icon: "sparkles" },
  { to: "/admin/utilisateurs", label: "Utilisateurs", icon: "users" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#050507] text-white">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col transform border-r border-white/10 bg-[#0a0a0d]/95 backdrop-blur-xl transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
          <Link to="/" className="font-display text-lg uppercase tracking-[0.16em]">
            Pink<span className="text-pss-pink">Star</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/60 hover:text-white"
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive
                    ? "bg-pss-pink/15 text-white shadow-[inset_0_0_0_1px_rgba(244,63,155,0.3)]"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon name={item.icon} className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}

          <Link
            to="/admin/disponibilites"
            onClick={() => setSidebarOpen(false)}
            className="mt-2 flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5 text-sm text-white/70 transition hover:border-pss-pink/40 hover:text-white"
          >
            <Icon name="clock" className="h-4 w-4 shrink-0" />
            <span>Disponibilités</span>
          </Link>
        </nav>

        <div className="m-3 shrink-0 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-white/50">Connecté</p>
          <p className="mt-0.5 truncate text-sm text-white">{user?.email}</p>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white/70 transition hover:border-pss-pink/40 hover:text-white"
          >
            <Icon name="logout" className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Content area — each page renders its own header with the hamburger button */}
      <div className="min-w-0 lg:pl-60">
        <Outlet context={{ openSidebar: () => setSidebarOpen(true) }} />
      </div>
    </div>
  );
}
