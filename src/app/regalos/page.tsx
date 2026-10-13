"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { EmptyState, Modal } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { downloadCSV } from "@/lib/csv";
import { createClient } from "@/lib/supabase/client";
import { rows, useLive } from "@/lib/useLive";
import type { Gift, Guest } from "@/lib/types";

const menu = [["/", "Resumen", "home"], ["/presupuesto", "Presupuesto", "wallet"], ["/tareas", "Tareas", "checkSquare"], ["/acuerdos", "Acuerdos", "handshake"], ["/invitados", "Invitados", "users"], ["/confirmaciones", "Confirmaciones", "mail"], ["/mesas", "Mesas", "table"], ["/regalos", "Regalos", "gift"], ["/cronograma", "Cronograma", "calendar"]] as const;
const giftLabels: Record<Gift["gift_type"], string> = { dinero: "Dinero", objeto: "Objeto", experiencia: "Experiencia", otro: "Otro" };

export default function GiftsPage() {
  const supabase = createClient();
  const giftsQ = useLive<Gift[]>(() => rows<Gift>(supabase.from("gifts").select("*").order("received_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })), ["gifts"], []);
  const guestsQ = useLive<Guest[]>(() => rows<Guest>(supabase.from("guests").select("id,first_name,last_name,group_id,side,guest_type,phone,email,notes,plus_one_allowed,is_plus_one,plus_one_of,table_id,added_by,created_at").order("first_name")), ["guests"], []);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const thanked = giftsQ.data.filter((gift) => gift.thanked).length;

  async function addGift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const { error: insertError } = await supabase.from("gifts").insert({
      giver_name: String(data.get("giver_name") ?? "").trim(),
      guest_id: String(data.get("guest_id") ?? "") || null,
      gift_type: String(data.get("gift_type") ?? "otro"),
      description: String(data.get("description") ?? "").trim() || null,
      amount: String(data.get("amount") ?? "") ? Number(data.get("amount")) : null,
      received_at: String(data.get("received_at") ?? "") || null,
      notes: String(data.get("notes") ?? "").trim() || null,
    });
    if (insertError) setError(insertError.message);
    else { form.reset(); setModalOpen(false); await giftsQ.reload(); }
    setSaving(false);
  }

  async function toggleThanked(gift: Gift) {
    const { error: updateError } = await supabase.from("gifts").update({ thanked: !gift.thanked }).eq("id", gift.id);
    if (updateError) setError(updateError.message);
    else await giftsQ.reload();
  }

  function exportGifts() {
    downloadCSV("regalos-recibidos", ["Quién regaló", "Tipo", "Descripción", "Monto", "Fecha", "Agradecimiento enviado", "Notas"], giftsQ.data.map((gift) => [gift.giver_name, giftLabels[gift.gift_type], gift.description, gift.amount, gift.received_at, gift.thanked ? "Sí" : "No", gift.notes]));
  }

  return <div className="app-shell"><aside className="sidebar"><Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={44} height={44} priority /><span><span className="brand-title">NuestroMatri</span><span className="brand-sub">Pato &amp; Andrea</span></span></Link><div className="nav-section">Planificación</div>{menu.map(([href, label, icon]) => <Link className={`nav-link ${href === "/regalos" ? "active" : ""}`} href={href} key={href}><Icon name={icon} /><span>{label}</span></Link>)}<div className="nav-section">Cuenta</div><Link className="nav-link" href="/ajustes"><Icon name="settings" /><span>Ajustes</span></Link></aside><main className="main"><div className="mobile-top"><Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={36} height={36} priority /><span className="brand-title">NuestroMatri</span></Link></div><div className="page">
    <header className="page-header"><div><div className="page-eyebrow">Después del gran día</div><h1 className="page-title">Regalos</h1><p className="page-subtitle">Un registro para recordar cada detalle y agradecerlo.</p></div><div className="row wrap"><button className="btn btn-secondary" onClick={exportGifts}><Icon name="download" />Exportar</button><button className="btn btn-primary" onClick={() => setModalOpen(true)}><Icon name="plus" />Registrar regalo</button></div></header>
    {error && <p className="error-box mb-2" role="alert">{error}</p>}<section className="grid grid-3 mb-2"><article className="card stat"><div className="stat-label">Regalos registrados</div><div className="stat-value">{giftsQ.data.length}</div></article><article className="card stat"><div className="stat-label">Agradecimientos enviados</div><div className="stat-value">{thanked}</div></article><article className="card stat"><div className="stat-label">Pendientes de agradecer</div><div className="stat-value">{giftsQ.data.length - thanked}</div></article></section>
    <section className="card">{giftsQ.data.length ? <div className="list">{giftsQ.data.map((gift) => <article className="list-item" key={gift.id}><div className="stat-icon mauve"><Icon name="gift" /></div><div className="grow"><strong>{gift.giver_name}</strong><div className="small muted">{giftLabels[gift.gift_type]}{gift.description ? ` · ${gift.description}` : ""}</div><div className="tiny muted">{gift.received_at ?? "Sin fecha"}{gift.amount ? ` · ${new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(gift.amount)}` : ""}</div>{gift.notes && <div className="small mt-1">{gift.notes}</div>}</div><label className="check"><input type="checkbox" checked={gift.thanked} onChange={() => void toggleThanked(gift)} /><span>Agradecido</span></label></article>)}</div> : <EmptyState icon="gift" title="Aún no hay regalos registrados" text="Después de la boda, podrán anotar regalos y llevar el seguimiento de los agradecimientos." action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Icon name="plus" />Registrar primero</button>} />}</section>
    </div></main>
    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Registrar regalo" footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button className="btn btn-primary" type="submit" form="gift-form" disabled={saving}><Icon name="check" />{saving ? "Guardando…" : "Guardar regalo"}</button></>}><form id="gift-form" className="form-grid" onSubmit={addGift}><label className="field"><span className="label">Quién regaló</span><input className="input" name="giver_name" required maxLength={160} /></label><label className="field"><span className="label">Invitado (opcional)</span><select className="select" name="guest_id" defaultValue=""><option value="">Sin asociar</option>{guestsQ.data.filter((guest) => !guest.is_plus_one).map((guest) => <option key={guest.id} value={guest.id}>{guest.first_name} {guest.last_name}</option>)}</select></label><label className="field"><span className="label">Tipo</span><select className="select" name="gift_type"><option value="dinero">Dinero</option><option value="objeto">Objeto</option><option value="experiencia">Experiencia</option><option value="otro">Otro</option></select></label><label className="field"><span className="label">Monto (opcional)</span><input className="input" name="amount" type="number" min="0" step="1" /></label><label className="field"><span className="label">Fecha de recepción</span><input className="input" name="received_at" type="date" /></label><label className="field"><span className="label">Descripción</span><input className="input" name="description" maxLength={300} /></label><label className="field full"><span className="label">Notas</span><textarea className="textarea" name="notes" maxLength={1000} /></label></form></Modal>
  </div>;
}