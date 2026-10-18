"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type DragEvent, type FormEvent } from "react";
import { EmptyState, Modal } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase/client";
import { notifyCollaborators } from "@/lib/push-notifications";
import { roleCanAccessPath } from "@/lib/roles";
import { useProfileRole } from "@/lib/useProfileRole";
import { rows, useLive } from "@/lib/useLive";
import type { Guest, Rsvp, SeatingTable } from "@/lib/types";

type SeatedGuest = Guest & { rsvps: Pick<Rsvp, "attending">[] | Pick<Rsvp, "attending"> | null };
const menu = [["/", "Resumen", "home"], ["/presupuesto", "Presupuesto", "wallet"], ["/tareas", "Tareas", "checkSquare"], ["/acuerdos", "Acuerdos", "handshake"], ["/invitados", "Invitados", "users"], ["/confirmaciones", "Confirmaciones", "mail"], ["/mesas", "Mesas", "table"], ["/regalos", "Regalos", "gift"], ["/cronograma", "Cronograma", "calendar"]] as const;

export default function SeatingPage() {
  const supabase = createClient();
  const role = useProfileRole();
  const tablesQ = useLive<SeatingTable[]>(() => rows<SeatingTable>(supabase.from("seating_tables").select("*").order("sort").order("name")), ["seating_tables"], []);
  const guestsQ = useLive<SeatedGuest[]>(() => rows<SeatedGuest>(supabase.from("guests").select("*, rsvps(attending)").order("first_name")), ["guests", "rsvps"], []);
  const [modalOpen, setModalOpen] = useState(false);
  const [draggingId, setDraggingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const confirmed = guestsQ.data.filter((guest) => Array.isArray(guest.rsvps) ? guest.rsvps.some((rsvp) => rsvp.attending) : guest.rsvps?.attending);
  const unassigned = confirmed.filter((guest) => !guest.table_id);

  async function addTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const { error: insertError } = await supabase.from("seating_tables").insert({
      name: String(data.get("name") ?? "").trim(),
      capacity: Number(data.get("capacity") ?? 10),
      shape: String(data.get("shape") ?? "redonda"),
      sort: tablesQ.data.length,
    });
    if (insertError) setError(insertError.message);
    else { form.reset(); setModalOpen(false); await tablesQ.reload(); void notifyCollaborators("table_added", String(data.get("name") ?? "").trim()); }
    setSaving(false);
  }

  async function assignGuest(guestId: string, tableId: string | null) {
    setError("");
    const { error: updateError } = await supabase.from("guests").update({ table_id: tableId }).eq("id", guestId);
    if (updateError) setError(updateError.message);
    else {
      await guestsQ.reload();
      void notifyCollaborators("table_updated", "Asignación de invitados");
    }
  }

  function dropGuest(event: DragEvent<HTMLElement>, tableId: string | null) {
    event.preventDefault();
    const guestId = event.dataTransfer.getData("text/plain");
    if (guestId) void assignGuest(guestId, tableId);
    setDraggingId("");
  }

  async function deleteTable(table: SeatingTable) {
    if (!window.confirm(`¿Eliminar ${table.name}? Los invitados quedarán sin mesa.`)) return;
    const { error: deleteError } = await supabase.from("seating_tables").delete().eq("id", table.id);
    if (deleteError) setError(deleteError.message);
    else {
      await Promise.all([tablesQ.reload(), guestsQ.reload()]);
      void notifyCollaborators("table_removed", table.name);
    }
  }

  return <div className="app-shell">
    <aside className="sidebar"><Link className="brand" href={role === "couple" ? "/" : role === "wedding_planner" ? "/invitados" : "/tareas"}><Image src="/icons/icon-192.png" alt="" width={44} height={44} priority /><span><span className="brand-title">NuestroMatri</span><span className="brand-sub">Pato &amp; Andrea</span></span></Link><div className="nav-section">Planificación</div>{menu.filter(([href]) => role ? roleCanAccessPath(role, href) : href === "/mesas").map(([href, label, icon]) => <Link className={`nav-link ${href === "/mesas" ? "active" : ""}`} href={href} key={href}><Icon name={icon} /><span>{label}</span></Link>)}{role === "couple" && <><div className="nav-section">Cuenta</div><Link className="nav-link" href="/ajustes"><Icon name="settings" /><span>Ajustes</span></Link></>}</aside>
    <main className="main"><div className="mobile-top"><Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={36} height={36} priority /><span className="brand-title">NuestroMatri</span></Link></div><div className="page">
      <header className="page-header"><div><div className="page-eyebrow">Distribución de invitados</div><h1 className="page-title">Mesas</h1><p className="page-subtitle">Arrastra invitados confirmados a una mesa o asígnalos desde el selector.</p></div><button className="btn btn-primary" onClick={() => setModalOpen(true)}><Icon name="plus" />Nueva mesa</button></header>
      {error && <p className="error-box mb-2" role="alert">{error}</p>}
      <section className="card mb-2" onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropGuest(event, null)}><div className="card-title"><h2>Sin mesa</h2><small>{unassigned.length} confirmados</small></div>{unassigned.length ? <div className="row wrap">{unassigned.map((guest) => <GuestChip key={guest.id} guest={guest} tables={tablesQ.data} draggingId={draggingId} onDragStart={setDraggingId} onAssign={assignGuest} />)}</div> : <p className="small muted">Todos los confirmados tienen una mesa asignada.</p>}</section>
      {tablesQ.data.length ? <section className="grid grid-3">{tablesQ.data.map((table) => { const seated = confirmed.filter((guest) => guest.table_id === table.id); const over = seated.length > table.capacity; return <article className="card stack" key={table.id} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropGuest(event, table.id)}><div className="row-between"><div><div className="row"><Icon name="table" /><h2 className="serif">{table.name}</h2></div><span className={`small ${over ? "danger-text" : "muted"}`}>{seated.length} / {table.capacity} personas{over ? " · excedida" : ""}</span></div><button className="btn btn-ghost btn-icon danger-text" title={`Eliminar ${table.name}`} aria-label={`Eliminar ${table.name}`} onClick={() => void deleteTable(table)}><Icon name="trash" /></button></div><div className="divider" />{seated.length ? <div className="stack">{seated.map((guest) => <GuestChip key={guest.id} guest={guest} tables={tablesQ.data} draggingId={draggingId} onDragStart={setDraggingId} onAssign={assignGuest} />)}</div> : <div className="empty small">Suelta aquí a tus invitados confirmados</div>}</article>; })}</section> : <section className="card"><EmptyState icon="table" title="Aún no hay mesas" text="Crea mesas y distribuye a las personas que ya confirmaron." action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Icon name="plus" />Crear primera mesa</button>} /></section>}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva mesa" footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button className="btn btn-primary" type="submit" form="table-form" disabled={saving}><Icon name="check" />{saving ? "Guardando…" : "Crear mesa"}</button></>}><form id="table-form" className="form-grid" onSubmit={addTable}><label className="field"><span className="label">Nombre</span><input className="input" name="name" required maxLength={60} placeholder="Mesa 1" /></label><label className="field"><span className="label">Capacidad</span><input className="input" name="capacity" type="number" min="1" max="30" defaultValue="10" required /></label><label className="field"><span className="label">Forma</span><select className="select" name="shape"><option value="redonda">Redonda</option><option value="rectangular">Rectangular</option></select></label></form></Modal>
    </div></main>
  </div>;
}

function GuestChip({ guest, tables, draggingId, onDragStart, onAssign }: { guest: SeatedGuest; tables: SeatingTable[]; draggingId: string; onDragStart: (id: string) => void; onAssign: (guestId: string, tableId: string | null) => void }) {
  const current = tables.find((table) => table.id === guest.table_id);
  return <div className="list-item" draggable onDragStart={(event) => { onDragStart(guest.id); event.dataTransfer.setData("text/plain", guest.id); }} onDragEnd={() => onDragStart("")} style={{ opacity: draggingId === guest.id ? 0.45 : 1, cursor: "grab" }}><Icon name="users" /><strong className="grow">{guest.first_name} {guest.last_name}</strong>{guest.is_plus_one && <span className="tiny muted">+1</span>}<select className="select" aria-label={`Mesa de ${guest.first_name} ${guest.last_name}`} value={current?.id ?? ""} onChange={(event) => onAssign(guest.id, event.target.value || null)}><option value="">Sin mesa</option>{tables.map((table) => <option key={table.id} value={table.id}>{table.name}</option>)}</select></div>;
}