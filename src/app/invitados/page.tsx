"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { EmptyState, Modal, Segmented } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase/client";
import { rows, useLive } from "@/lib/useLive";
import type { Guest, GuestGroup, GuestSide, Profile, Rsvp } from "@/lib/types";

type GuestRow = Guest & { rsvps: Pick<Rsvp, "attending">[] | Pick<Rsvp, "attending"> | null };
const menu = [["/", "Resumen", "home"], ["/presupuesto", "Presupuesto", "wallet"], ["/tareas", "Tareas", "checkSquare"], ["/acuerdos", "Acuerdos", "handshake"], ["/invitados", "Invitados", "users"], ["/confirmaciones", "Confirmaciones", "mail"], ["/mesas", "Mesas", "table"], ["/regalos", "Regalos", "gift"], ["/cronograma", "Cronograma", "calendar"]] as const;
const sides: { value: GuestSide; label: string }[] = [{ value: "novio", label: "Pato" }, { value: "novia", label: "Andrea" }, { value: "comun", label: "Comunes" }];

export default function GuestsPage() {
  const supabase = createClient();
  const guestsQ = useLive<GuestRow[]>(() => rows<GuestRow>(supabase.from("guests").select("*, rsvps(attending)").order("first_name")), ["guests", "rsvps"], []);
  const groupsQ = useLive<GuestGroup[]>(() => rows<GuestGroup>(supabase.from("guest_groups").select("*").order("name")), ["guest_groups"], []);
  const profilesQ = useLive<Profile[]>(() => rows<Profile>(supabase.from("profiles").select("id,display_name,side")), ["profiles"], []);
  const [userId, setUserId] = useState("");
  const [groupModal, setGroupModal] = useState(false);
  const [guestModal, setGuestModal] = useState(false);
  const [sideFilter, setSideFilter] = useState<"todos" | GuestSide>("todos");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const me = profilesQ.data.find((profile) => profile.id === userId);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ""));
  }, [supabase]);

  const visibleGuests = useMemo(() => guestsQ.data.filter((guest) => {
    const fullName = `${guest.first_name} ${guest.last_name}`.toLocaleLowerCase("es");
    return !guest.is_plus_one && (sideFilter === "todos" || guest.side === sideFilter) && fullName.includes(query.trim().toLocaleLowerCase("es"));
  }), [guestsQ.data, sideFilter, query]);
  const confirmed = guestsQ.data.filter((guest) => responseOf(guest)?.attending).length;
  const declined = guestsQ.data.filter((guest) => responseOf(guest) && !responseOf(guest)?.attending).length;
  const pending = guestsQ.data.filter((guest) => !responseOf(guest)).length;

  async function addGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const { error: insertError } = await supabase.from("guest_groups").insert({ name: String(data.get("name") ?? "").trim(), side: String(data.get("side") ?? me?.side ?? "comun") });
    if (insertError) setError(insertError.message);
    else {
      form.reset();
      setGroupModal(false);
      setNotice("Grupo familiar agregado.");
      await groupsQ.reload();
    }
    setSaving(false);
  }

  async function addGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const { error: insertError } = await supabase.from("guests").insert({
      group_id: String(data.get("group_id") ?? "") || null,
      first_name: String(data.get("first_name") ?? "").trim(),
      last_name: String(data.get("last_name") ?? "").trim(),
      side: String(data.get("side") ?? me?.side ?? "comun"),
      guest_type: String(data.get("guest_type") ?? "adulto"),
      phone: String(data.get("phone") ?? "").trim() || null,
      email: String(data.get("email") ?? "").trim() || null,
      notes: String(data.get("notes") ?? "").trim() || null,
      plus_one_allowed: data.get("plus_one_allowed") === "on",
    });
    if (insertError) setError(insertError.message);
    else {
      form.reset();
      setGuestModal(false);
      setNotice("Invitado agregado.");
      await guestsQ.reload();
    }
    setSaving(false);
  }

  async function copyInvite(group: GuestGroup) {
    const url = `${window.location.origin}/confirmar/${group.invite_code}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice(`Enlace de ${group.name} copiado.`);
    } catch {
      setError("No pudimos copiar el enlace. Puedes abrirlo desde la lista de grupos.");
    }
  }

  async function deleteGuest(guest: Guest) {
    if (!window.confirm(`¿Eliminar a ${guest.first_name} ${guest.last_name}?`)) return;
    const { error: deleteError } = await supabase.from("guests").delete().eq("id", guest.id);
    if (deleteError) setError(deleteError.message);
    else await guestsQ.reload();
  }

  const groupName = (id: string | null) => groupsQ.data.find((group) => group.id === id)?.name ?? "Sin grupo";

  return <div className="app-shell">
    <aside className="sidebar"><Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={44} height={44} priority /><span><span className="brand-title">NuestroMatri</span><span className="brand-sub">Pato &amp; Andrea</span></span></Link><div className="nav-section">Planificación</div>{menu.map(([href, label, icon]) => <Link className={`nav-link ${href === "/invitados" ? "active" : ""}`} href={href} key={href}><Icon name={icon} /><span>{label}</span></Link>)}<div className="nav-section">Cuenta</div><Link className="nav-link" href="/ajustes"><Icon name="settings" /><span>Ajustes</span></Link></aside>
    <main className="main"><div className="mobile-top"><Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={36} height={36} priority /><span className="brand-title">NuestroMatri</span></Link></div><div className="page">
      <header className="page-header"><div><div className="page-eyebrow">Lista y confirmaciones</div><h1 className="page-title">Invitados</h1><p className="page-subtitle">Organicen por familia, lado y respuesta.</p></div><div className="row wrap"><button className="btn btn-secondary" onClick={() => setGroupModal(true)}><Icon name="users" />Nuevo grupo</button><button className="btn btn-primary" onClick={() => { setError(""); setGuestModal(true); }}><Icon name="userPlus" />Agregar invitado</button></div></header>
      {error && <p className="error-box" role="alert">{error}</p>}{notice && <p className="success-box" role="status">{notice}</p>}
      <section className="grid grid-4 mb-2"><article className="card stat"><div className="stat-label">Personas</div><div className="stat-value">{guestsQ.data.filter((guest) => !guest.is_plus_one).length}</div><div className="stat-hint">Invitados principales</div></article><article className="card stat"><div className="stat-label">Confirmados</div><div className="stat-value">{confirmed}</div><div className="stat-hint">Asistirán</div></article><article className="card stat"><div className="stat-label">No asistirán</div><div className="stat-value">{declined}</div><div className="stat-hint">Respuestas recibidas</div></article><article className="card stat"><div className="stat-label">Pendientes</div><div className="stat-value">{pending}</div><div className="stat-hint">Aún sin responder</div></article></section>
      <section className="card mb-2"><div className="card-title"><h2>Grupos e invitaciones</h2><small>{groupsQ.data.length} grupos</small></div>{groupsQ.data.length ? <div className="list">{groupsQ.data.map((group) => <article className="list-item" key={group.id}><div className="stat-icon mauve"><Icon name="users" /></div><div className="grow"><strong>{group.name}</strong><div className="small muted">{sides.find((side) => side.value === group.side)?.label} · {guestsQ.data.filter((guest) => guest.group_id === group.id && !guest.is_plus_one).length} personas</div><Link className="code" href={`/confirmar/${group.invite_code}`} target="_blank">/confirmar/{group.invite_code}</Link></div><button className="btn btn-secondary btn-sm" onClick={() => void copyInvite(group)}><Icon name="copy" />Copiar enlace</button></article>)}</div> : <EmptyState icon="users" title="Sin grupos familiares" text="Crea grupos para compartir un enlace de confirmación personalizado con cada invitación." action={<button className="btn btn-secondary" onClick={() => setGroupModal(true)}><Icon name="plus" />Crear grupo</button>} />}</section>
      <section className="card"><div className="row-between wrap mb-2"><Segmented value={sideFilter} onChange={setSideFilter} options={[{ value: "todos", label: "Todos", count: visibleCount(guestsQ.data) }, ...sides.map((side) => ({ ...side, count: guestsQ.data.filter((guest) => !guest.is_plus_one && guest.side === side.value).length }))]} /><label className="field"><span className="label">Buscar invitado</span><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre o apellido" /></label></div>
        {visibleGuests.length ? <div style={{ overflowX: "auto" }}><table className="table"><thead><tr><th>Invitado</th><th>Grupo</th><th>Lado</th><th>Tipo</th><th>RSVP</th><th>+1</th><th aria-label="Acciones" /></tr></thead><tbody>{visibleGuests.map((guest) => { const response = responseOf(guest); return <tr key={guest.id}><td><strong>{guest.first_name} {guest.last_name}</strong><div className="tiny muted">{guest.phone ?? guest.email ?? ""}</div></td><td>{groupName(guest.group_id)}</td><td>{sides.find((side) => side.value === guest.side)?.label}</td><td>{guest.guest_type === "nino" ? "Niño/a" : "Adulto"}</td><td><span className={`badge ${response ? response.attending ? "sage" : "muted" : "mauve"}`}>{response ? response.attending ? "Confirmado" : "No asiste" : "Pendiente"}</span></td><td>{guest.plus_one_allowed ? "Permitido" : "—"}</td><td><button className="btn btn-ghost btn-icon danger-text" title="Eliminar invitado" aria-label={`Eliminar ${guest.first_name} ${guest.last_name}`} onClick={() => void deleteGuest(guest)}><Icon name="trash" /></button></td></tr>; })}</tbody></table></div> : <EmptyState icon="users" title="No hay invitados en esta vista" text="Agrega personas individualmente o revisa el filtro seleccionado." action={<button className="btn btn-primary" onClick={() => setGuestModal(true)}><Icon name="userPlus" />Agregar invitado</button>} />}
      </section>
    </div></main>
    <Modal open={groupModal} onClose={() => setGroupModal(false)} title="Nuevo grupo familiar" footer={<><button className="btn btn-secondary" onClick={() => setGroupModal(false)}>Cancelar</button><button className="btn btn-primary" type="submit" form="group-form" disabled={saving}><Icon name="check" />{saving ? "Guardando…" : "Crear grupo"}</button></>}><form id="group-form" className="form-grid" onSubmit={addGroup}><label className="field full"><span className="label">Nombre del grupo</span><input className="input" name="name" required maxLength={120} placeholder="Familia Pérez" /></label><label className="field"><span className="label">Lado</span><select className="select" name="side" defaultValue={me?.side ?? "comun"}>{sides.map((side) => <option key={side.value} value={side.value}>{side.label}</option>)}</select></label></form></Modal>
    <Modal open={guestModal} onClose={() => setGuestModal(false)} title="Agregar invitado" footer={<><button className="btn btn-secondary" onClick={() => setGuestModal(false)}>Cancelar</button><button className="btn btn-primary" type="submit" form="guest-form" disabled={saving}><Icon name="check" />{saving ? "Guardando…" : "Guardar invitado"}</button></>}><form id="guest-form" className="form-grid" onSubmit={addGuest}><label className="field"><span className="label">Nombre</span><input className="input" name="first_name" required maxLength={120} /></label><label className="field"><span className="label">Apellido</span><input className="input" name="last_name" maxLength={120} /></label><label className="field"><span className="label">Grupo familiar</span><select className="select" name="group_id" defaultValue=""><option value="">Sin grupo</option>{groupsQ.data.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label className="field"><span className="label">Lado</span><select className="select" name="side" defaultValue={me?.side ?? "comun"}>{sides.map((side) => <option key={side.value} value={side.value}>{side.label}</option>)}</select></label><label className="field"><span className="label">Tipo</span><select className="select" name="guest_type" defaultValue="adulto"><option value="adulto">Adulto</option><option value="nino">Niño/a</option></select></label><label className="field"><span className="label">Teléfono</span><input className="input" name="phone" type="tel" /></label><label className="field"><span className="label">Correo</span><input className="input" name="email" type="email" /></label><label className="check full"><input name="plus_one_allowed" type="checkbox" /><span>Permitir acompañante (+1) a esta persona</span></label><label className="field full"><span className="label">Notas</span><textarea className="textarea" name="notes" maxLength={1000} /></label></form></Modal>
  </div>;
}

function responseOf(guest: GuestRow): Pick<Rsvp, "attending"> | null {
  return Array.isArray(guest.rsvps) ? guest.rsvps[0] ?? null : guest.rsvps;
}

function visibleCount(guests: GuestRow[]) {
  return guests.filter((guest) => !guest.is_plus_one).length;
}