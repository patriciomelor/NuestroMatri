"use client";

import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, Modal, Segmented } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { downloadCSV } from "@/lib/csv";
import { createClient } from "@/lib/supabase/client";
import { rows, useLive } from "@/lib/useLive";
import type { Guest, GuestGroup, Rsvp, WeddingSettings } from "@/lib/types";

type ConfirmationGuest = Guest & { rsvps: Rsvp[] | Rsvp | null };
type ResponseFilter = "todos" | "pendiente" | "si" | "no";
const menu = [["/", "Resumen", "home"], ["/presupuesto", "Presupuesto", "wallet"], ["/tareas", "Tareas", "checkSquare"], ["/acuerdos", "Acuerdos", "handshake"], ["/invitados", "Invitados", "users"], ["/confirmaciones", "Confirmaciones", "mail"], ["/mesas", "Mesas", "table"], ["/regalos", "Regalos", "gift"], ["/cronograma", "Cronograma", "calendar"]] as const;
const dietaryLabels: Record<Rsvp["dietary"], string> = { ninguna: "Sin restricciones", vegetariano: "Vegetariana", vegano: "Vegana", celiaco: "Celíaca", sin_lactosa: "Sin lactosa", alergia: "Alergia", otra: "Otra" };

export default function ConfirmationsPage() {
  const supabase = createClient();
  const guestsQ = useLive<ConfirmationGuest[]>(() => rows<ConfirmationGuest>(supabase.from("guests").select("*, rsvps(*)").order("first_name")), ["guests", "rsvps"], []);
  const groupsQ = useLive<GuestGroup[]>(() => rows<GuestGroup>(supabase.from("guest_groups").select("*").order("name")), ["guest_groups"], []);
  const settingsQ = useLive<WeddingSettings | null>(async () => {
    const { data } = await supabase.from("wedding_settings").select("*").eq("id", 1).maybeSingle();
    return data as WeddingSettings | null;
  }, ["wedding_settings"], null);
  const [filter, setFilter] = useState<ResponseFilter>("todos");
  const [query, setQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<GuestGroup | null>(null);
  const [qr, setQr] = useState("");
  const [qrTitle, setQrTitle] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [error, setError] = useState("");
  const notificationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const channel = supabase.channel("rsvp-push-notifications").on("postgres_changes", { event: "*", schema: "public", table: "rsvps" }, (payload) => {
      if ((payload.new as Rsvp | undefined)?.source !== "formulario") return;
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
      notificationTimer.current = setTimeout(() => {
        void fetch("/api/push/notify", { method: "POST" });
      }, 900);
    }).subscribe();
    return () => {
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  const responseOf = (guest: ConfirmationGuest) => Array.isArray(guest.rsvps) ? guest.rsvps[0] ?? null : guest.rsvps;
  const people = guestsQ.data;
  const confirmed = people.filter((guest) => responseOf(guest)?.attending).length;
  const declined = people.filter((guest) => responseOf(guest) && !responseOf(guest)?.attending).length;
  const pending = people.length - confirmed - declined;
  const filtered = useMemo(() => people.filter((guest) => {
    const response = responseOf(guest);
    const fullName = `${guest.first_name} ${guest.last_name}`.toLocaleLowerCase("es");
    const matchesFilter = filter === "todos" || (filter === "pendiente" ? !response : filter === "si" ? response?.attending : response && !response.attending);
    return matchesFilter && fullName.includes(query.trim().toLocaleLowerCase("es"));
  }), [people, filter, query]);
  const dietarySummary = people.filter((guest) => responseOf(guest)?.attending).reduce<Record<string, number>>((summary, guest) => {
    const response = responseOf(guest);
    if (response && response.dietary !== "ninguna") summary[response.dietary] = (summary[response.dietary] ?? 0) + 1;
    return summary;
  }, {});

  async function createQr(group?: GuestGroup) {
    setQrLoading(true);
    setError("");
    const path = group ? `/confirmar/${group.invite_code}` : "/confirmar";
    try {
      const dataUrl = await QRCode.toDataURL(`${window.location.origin}${path}`, { width: 720, margin: 2, color: { dark: "#54234F", light: "#FFF6EA" }, errorCorrectionLevel: "H" });
      setQr(dataUrl);
      setQrTitle(group ? `Invitación · ${group.name}` : "Invitación general");
      setSelectedGroup(group ?? null);
    } catch {
      setError("No pudimos generar el código QR.");
    }
    setQrLoading(false);
  }

  async function updateResponse(guest: ConfirmationGuest, value: string) {
    setError("");
    if (value === "pendiente") {
      const { error: deleteError } = await supabase.from("rsvps").delete().eq("guest_id", guest.id);
      if (deleteError) setError(deleteError.message);
      else await guestsQ.reload();
      return;
    }
    const existing = responseOf(guest);
    const { error: upsertError } = await supabase.from("rsvps").upsert({
      guest_id: guest.id,
      attending: value === "si",
      dietary: existing?.dietary ?? "ninguna",
      dietary_notes: existing?.dietary_notes ?? null,
      song: existing?.song ?? null,
      message: existing?.message ?? null,
      source: "manual",
      responded_at: new Date().toISOString(),
    }, { onConflict: "guest_id" });
    if (upsertError) setError(upsertError.message);
    else await guestsQ.reload();
  }

  function exportGuests() {
    downloadCSV("invitados-rsvp", ["Nombre", "Apellido", "Grupo", "Lado", "Tipo", "Teléfono", "Correo", "Asistencia", "Restricción", "Detalle alimentario", "Canción", "Mensaje"], people.map((guest) => {
      const response = responseOf(guest);
      return [guest.first_name, guest.last_name, groupsQ.data.find((group) => group.id === guest.group_id)?.name, guest.side, guest.guest_type, guest.phone, guest.email, response ? response.attending ? "Asiste" : "No asiste" : "Pendiente", response ? dietaryLabels[response.dietary] : "", response?.dietary_notes, response?.song, response?.message];
    }));
  }

  function exportMenu() {
    downloadCSV("resumen-alimentario", ["Nombre", "Grupo", "Restricción", "Detalle"], people.filter((guest) => responseOf(guest)?.attending).map((guest) => {
      const response = responseOf(guest);
      return [`${guest.first_name} ${guest.last_name}`, groupsQ.data.find((group) => group.id === guest.group_id)?.name, response ? dietaryLabels[response.dietary] : "", response?.dietary_notes];
    }));
  }

  const deadline = settingsQ.data?.rsvp_deadline;

  return <div className="app-shell">
    <aside className="sidebar"><Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={44} height={44} priority /><span><span className="brand-title">NuestroMatri</span><span className="brand-sub">Pato &amp; Andrea</span></span></Link><div className="nav-section">Planificación</div>{menu.map(([href, label, icon]) => <Link className={`nav-link ${href === "/confirmaciones" ? "active" : ""}`} href={href} key={href}><Icon name={icon} /><span>{label}</span></Link>)}<div className="nav-section">Cuenta</div><Link className="nav-link" href="/ajustes"><Icon name="settings" /><span>Ajustes</span></Link></aside>
    <main className="main"><div className="mobile-top"><Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={36} height={36} priority /><span className="brand-title">NuestroMatri</span></Link></div><div className="page">
      <header className="page-header"><div><div className="page-eyebrow">Respuestas en tiempo real</div><h1 className="page-title">Confirmaciones</h1><p className="page-subtitle">{deadline ? `Fecha límite: ${new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${deadline}T00:00:00Z`))}` : "Sin fecha límite configurada"}</p></div><div className="row wrap"><button className="btn btn-secondary no-print" onClick={() => window.print()}><Icon name="printer" />Imprimir / PDF</button><button className="btn btn-secondary" onClick={exportGuests}><Icon name="download" />Exportar invitados</button><button className="btn btn-primary" onClick={() => void createQr()} disabled={qrLoading}><Icon name="qr" />{qrLoading ? "Generando…" : "QR general"}</button></div></header>
      {error && <p className="error-box mb-2" role="alert">{error}</p>}
      <section className="grid grid-3 mb-2"><article className="card stat"><div className="stat-icon sage"><Icon name="check" /></div><div className="stat-label">Asistirán</div><div className="stat-value">{confirmed}</div><div className="stat-hint">Personas confirmadas</div></article><article className="card stat"><div className="stat-icon mauve"><Icon name="x" /></div><div className="stat-label">No asistirán</div><div className="stat-value">{declined}</div><div className="stat-hint">Respuestas negativas</div></article><article className="card stat"><div className="stat-icon gold"><Icon name="clock" /></div><div className="stat-label">Pendientes</div><div className="stat-value">{pending}</div><div className="stat-hint">De {people.length} invitados</div></article></section>
      <section className="grid grid-2 mb-2"><article className="card"><div className="card-title"><h2>Restricciones alimentarias</h2><button className="btn btn-secondary btn-sm" onClick={exportMenu}><Icon name="download" />Exportar menú</button></div>{Object.keys(dietarySummary).length ? <div className="list">{Object.entries(dietarySummary).map(([dietary, count]) => <div className="list-item" key={dietary}><Icon name="utensils" /><strong className="grow">{dietaryLabels[dietary as Rsvp["dietary"]]}</strong><span className="badge sage">{count}</span></div>)}{people.filter((guest) => responseOf(guest)?.attending && responseOf(guest)?.dietary_notes).map((guest) => <div className="small muted" key={guest.id}>{guest.first_name} {guest.last_name}: {responseOf(guest)?.dietary_notes}</div>)}</div> : <p className="muted small">No hay restricciones alimentarias informadas.</p>}</article><article className="card"><div className="card-title"><h2>Enlaces por grupo</h2><small>{groupsQ.data.length} invitaciones</small></div>{groupsQ.data.length ? <div className="list">{groupsQ.data.map((group) => <div className="list-item" key={group.id}><div className="grow"><strong>{group.name}</strong><div className="tiny muted">Código: {group.invite_code}</div></div><button className="btn btn-ghost btn-icon" title={`Generar QR para ${group.name}`} aria-label={`Generar QR para ${group.name}`} onClick={() => void createQr(group)} disabled={qrLoading}><Icon name="qr" /></button><Link className="btn btn-ghost btn-icon" href={`/confirmar/${group.invite_code}`} target="_blank" title={`Abrir invitación de ${group.name}`}><Icon name="link" /></Link></div>)}</div> : <p className="muted small">Crea grupos familiares en Invitados para generar enlaces personalizados.</p>}</article></section>
      <section className="card"><div className="row-between wrap mb-2"><Segmented value={filter} onChange={setFilter} options={[{ value: "todos", label: "Todos", count: people.length }, { value: "pendiente", label: "Pendientes", count: pending }, { value: "si", label: "Asisten", count: confirmed }, { value: "no", label: "No asisten", count: declined }]} /><label className="field"><span className="label">Buscar</span><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre o apellido" /></label></div>{filtered.length ? <div style={{ overflowX: "auto" }}><table className="table"><thead><tr><th>Invitado</th><th>Grupo</th><th>Respuesta</th><th>Alimentación</th><th>Fuente</th></tr></thead><tbody>{filtered.map((guest) => { const response = responseOf(guest); return <tr key={guest.id}><td><strong>{guest.first_name} {guest.last_name}</strong>{guest.is_plus_one && <div className="tiny muted">Acompañante</div>}</td><td>{groupsQ.data.find((group) => group.id === guest.group_id)?.name ?? "Sin grupo"}</td><td><select className="select" aria-label={`Respuesta de ${guest.first_name} ${guest.last_name}`} value={!response ? "pendiente" : response.attending ? "si" : "no"} onChange={(event) => void updateResponse(guest, event.target.value)}><option value="pendiente">Pendiente</option><option value="si">Asiste</option><option value="no">No asiste</option></select></td><td>{response?.attending ? <>{dietaryLabels[response.dietary]}{response.dietary_notes ? <div className="tiny muted">{response.dietary_notes}</div> : null}</> : "—"}</td><td>{response?.source === "manual" ? "Manual" : response ? "Formulario" : "—"}</td></tr>; })}</tbody></table></div> : <EmptyState icon="mail" title="No hay respuestas en este filtro" text="Las respuestas del formulario aparecerán aquí automáticamente." />}</section>
    </div></main>
    <Modal open={Boolean(qr)} onClose={() => { setQr(""); setSelectedGroup(null); }} title={qrTitle} footer={<><button className="btn btn-secondary" onClick={() => { setQr(""); setSelectedGroup(null); }}>Cerrar</button><a className="btn btn-primary" href={qr} download={`${selectedGroup?.name ?? "invitacion"}-qr.png`}><Icon name="download" />Descargar QR</a></>}><div className="stack"><div className="qr-box"><Image src={qr} alt={`Código QR: ${qrTitle}`} width={220} height={220} unoptimized /></div><p className="small muted" style={{ textAlign: "center" }}>{selectedGroup ? `Este QR abre la invitación personalizada de ${selectedGroup.name}.` : "Este QR abre la búsqueda general de invitados."}</p></div></Modal>
  </div>;
}