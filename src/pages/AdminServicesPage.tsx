import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../lib/api";
import { Field, Icon, Modal, ServiceType } from "../lib/adminShared";

export default function AdminServicesPage() {
  const { openSidebar } = useOutletContext<{ openSidebar: () => void }>();

  const [services, setServices] = useState<ServiceType[]>([]);
  const [newServiceName, setNewServiceName] = useState("");
  const [editService, setEditService] = useState<ServiceType | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    try {
      const r = await api<{ serviceTypes: ServiceType[] }>("/admin/service-types");
      setServices(r.serviceTypes);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/admin/service-types", {
        method: "POST",
        body: JSON.stringify({ name: newServiceName }),
      });
      setNewServiceName("");
      void loadServices();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function saveService() {
    if (!editService) return;
    try {
      await api(`/admin/service-types/${editService.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editService.name }),
      });
      setEditService(null);
      void loadServices();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function deleteService(id: string) {
    if (!confirm("Supprimer ce type de prestation ?")) return;
    try {
      await api(`/admin/service-types/${id}`, { method: "DELETE" });
      void loadServices();
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
            Prestations
          </h1>
        </div>
      </header>

      <main className="px-3 py-6 sm:px-4 md:px-8 md:py-8">
        {err && (
          <div className="mb-6 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        <div className="max-w-2xl space-y-5">
          <form
            onSubmit={addService}
            className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-2"
          >
            <input
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              placeholder="Nom de la prestation"
              className="flex-1 rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm focus:outline-none"
              required
            />
            <button type="submit" className="btn-pink">
              <Icon name="plus" className="h-4 w-4" /> Ajouter
            </button>
          </form>

          {services.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/55">
              Aucune prestation.
            </div>
          ) : (
            <ul className="space-y-2">
              {services.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <span className="text-white">{s.name}</span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-pss-pink"
                      onClick={() => setEditService({ ...s })}
                    >
                      <Icon name="edit" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-white/60 hover:bg-red-500/10 hover:text-red-300"
                      onClick={() => void deleteService(s.id)}
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

      {editService && (
        <Modal title="Modifier prestation" onClose={() => setEditService(null)}>
          <Field label="Nom">
            <input
              value={editService.name}
              onChange={(e) => setEditService({ ...editService, name: e.target.value })}
              className="input"
            />
          </Field>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditService(null)}
              className="rounded-lg px-3 py-2 text-sm text-white/60"
            >
              Annuler
            </button>
            <button type="button" onClick={() => void saveService()} className="btn-pink">
              Enregistrer
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
