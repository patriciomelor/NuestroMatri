"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { EmptyState, Modal } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase/client";
import { notifyCollaborators } from "@/lib/push-notifications";
import { roleCanAccessPath } from "@/lib/roles";
import { useProfileRole } from "@/lib/useProfileRole";
import { rows, useLive } from "@/lib/useLive";
import type { TimelineItem } from "@/lib/types";

const menu = [["/", "Resumen", "home"], ["/presupuesto", "Presupuesto", "wallet"], ["/tareas", "Tareas", "checkSquare"], ["/acuerdos", "Acuerdos", "handshake"], ["/invitados", "Invitados", "users"], ["/confirmaciones", "Confirmaciones", "mail"], ["/mesas", "Mesas", "table"], ["/regalos", "Regalos", "gift"], ["/cronograma", "Cronograma", "calendar"]] as const;

export default function TimelinePage() {
  const supabase = createClient();
  const role = useProfileRole();
  const itemsQ = useLive<TimelineItem[]>(() => rows<TimelineItem>(supabase.from("timeline_items").select("*").order("start_time")), ["timeline_items"], []);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const { error: insertError } = await supabase.from("timeline_items").insert({
      title: String(data.get("title") ?? "").trim(),
      start_time: String(data.get("start_time") ?? ""),
      end_time: String(data.get("end_time") ?? "") || null,
      location: String(data.get("location") ?? "").trim() || null,
      responsible: String(data.get("responsible") ?? "").trim() || null,
      description: String(data.get("description") ?? "").trim() || null,
    });
    if (insertError) setError(insertError.message);
    else { form.reset(); setModalOpen(false); await itemsQ.reload(); void notifyCollaborators("timeline_added", String(data.get("title") ?? "").trim()); }
    setSaving(false);
  }

  async function removeItem(item: TimelineItem) {
    if (!window.confirm(`¿Eliminar “${item.title}” del cronograma?`)) return;
    const { error: deleteError } = await supabase.from("timeline_items").delete().eq("id", item.id);
    if (deleteError) setError(deleteError.message);
    else {
      await itemsQ.reload();
      void notifyCollaborators("timeline_removed", item.title);
    }
  }

  return <div className="app-shell"><aside className="sidebar"><Link className="brand" href={role === "couple" ? "/" : role === "wedding_planner" ? "/invitados" : "/tareas"}><Image src="/icons/icon-192.png" alt="" width={44} height={44} priority /><span><span className="brand-title">NuestroMatri</span><span className="brand-sub">Pato &amp; Andrea</span></span></Link><div className="nav-section">Planificación</div>{menu.filter(([href]) => role ? roleCanAccessPath(role, href) : href === "/cronograma").map(([href, label, icon]) => <Link className={`nav-link ${href === "/cronograma" ? "active" : ""}`} href={href} key={href}><Icon name={icon} /><span>{label}</span></Link>)}{role === "couple" && <><div className="nav-section">Cuenta</div><Link className="nav-link" href="/ajustes"><Icon name="settings" /><span>Ajustes</span></Link></>}</aside><main className="main"><div className="mobile-top"><Link className="brand" href={role === "couple" ? "/" : role === "wedding_planner" ? "/invitados" : "/tareas"}><Image src="/icons/icon-192.png" alt="" width={36} height={36} priority /><span className="brand-title">NuestroMatri</span></Link></div><div className="page">
    <header className="page-header"><div><div className="page-eyebrow">El día de la celebración</div><h1 className="page-title">Cronograma</h1><p className="page-subtitle">Ordenen los momentos del día y quién estará a cargo.</p></div><button className="btn btn-primary" onClick={() => setModalOpen(true)}><Icon name="plus" />Nuevo momento</button></header>
    {error && <p className="error-box mb-2" role="alert">{error}</p>}<section className="card">{itemsQ.data.length ? <div className="list">{itemsQ.data.map((item) => <article className="list-item" key={item.id}><time className="serif" style={{ fontSize: "1.35rem", minWidth: "84px" }}>{item.start_time.slice(0, 5)}</time><div className="grow"><strong>{item.title}</strong>{item.end_time && <span className="small muted"> · hasta {item.end_time.slice(0, 5)}</span>}{item.description && <p className="small mt-1">{item.description}</p>}<div className="row wrap tiny muted mt-1">{item.location && <span><Icon name="pin" /> {item.location}</span>}{item.responsible && <span><Icon name="users" /> {item.responsible}</span>}</div></div><button className="btn btn-ghost btn-icon danger-text" title={`Eliminar ${item.title}`} aria-label={`Eliminar ${item.title}`} onClick={() => void removeItem(item)}><Icon name="trash" /></button></article>)}</div> : <EmptyState icon="clock" title="El cronograma está vacío" text="Agreguen ceremonia, recepción, brindis, cena y los momentos que quieran recordar." action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Icon name="plus" />Agregar primer momento</button>} />}</section>
    </div></main><Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo momento" footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button className="btn btn-primary" type="submit" form="timeline-form" disabled={saving}><Icon name="check" />{saving ? "Guardando…" : "Guardar momento"}</button></>}><form id="timeline-form" className="form-grid" onSubmit={addItem}><label className="field full"><span className="label">Actividad</span><input className="input" name="title" required maxLength={160} placeholder="Ceremonia, cena, primer baile…" /></label><label className="field"><span className="label">Hora de inicio</span><input className="input" name="start_time" type="time" required /></label><label className="field"><span className="label">Hora de término</span><input className="input" name="end_time" type="time" /></label><label className="field"><span className="label">Lugar</span><input className="input" name="location" maxLength={160} /></label><label className="field"><span className="label">Responsable</span><input className="input" name="responsible" maxLength={120} /></label><label className="field full"><span className="label">Notas</span><textarea className="textarea" name="description" maxLength={1000} /></label></form></Modal>
  </div>;
}