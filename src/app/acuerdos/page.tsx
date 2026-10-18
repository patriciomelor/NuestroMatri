"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { EmptyState, Modal, Segmented } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase/client";
import { rows, useLive } from "@/lib/useLive";
import type { Agreement, Profile } from "@/lib/types";

const menu = [["/", "Resumen", "home"], ["/presupuesto", "Presupuesto", "wallet"], ["/tareas", "Tareas", "checkSquare"], ["/acuerdos", "Acuerdos", "handshake"], ["/invitados", "Invitados", "users"], ["/confirmaciones", "Confirmaciones", "mail"], ["/mesas", "Mesas", "table"], ["/regalos", "Regalos", "gift"], ["/cronograma", "Cronograma", "calendar"]] as const;

export default function AgreementsPage() {
  const supabase = createClient();
  const agreementsQ = useLive<Agreement[]>(() => rows<Agreement>(supabase.from("agreements").select("*").order("created_at", { ascending: false })), ["agreements"], []);
  const profilesQ = useLive<Profile[]>(() => rows<Profile>(supabase.from("profiles").select("id,display_name,side,role")), ["profiles"], []);
  const [userId, setUserId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState<"todos" | "propuesto" | "aprobado">("todos");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ""));
  }, [supabase]);

  const me = profilesQ.data.find((profile) => profile.id === userId);
  const visibleAgreements = agreementsQ.data.filter((agreement) => filter === "todos" || agreement.status === filter);

  async function addAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const { error: insertError } = await supabase.from("agreements").insert({
      title: String(data.get("title") ?? "").trim(),
      topic: String(data.get("topic") ?? "").trim() || null,
      description: String(data.get("description") ?? "").trim() || null,
    });
    if (insertError) setError(insertError.message);
    else {
      form.reset();
      setModalOpen(false);
      setNotice("Acuerdo registrado.");
      await agreementsQ.reload();
    }
    setSaving(false);
  }

  async function approve(agreement: Agreement) {
    if (!me?.side) {
      setError("Tu perfil todavía no tiene asignado el lado de la pareja.");
      return;
    }
    const approved_novio = me.side === "novio" ? !agreement.approved_novio : agreement.approved_novio;
    const approved_novia = me.side === "novia" ? !agreement.approved_novia : agreement.approved_novia;
    const approved = approved_novio && approved_novia;
    const { error: updateError } = await supabase.from("agreements").update({
      approved_novio,
      approved_novia,
      status: approved ? "aprobado" : "propuesto",
      decided_at: approved ? new Date().toISOString() : null,
    }).eq("id", agreement.id);
    if (updateError) setError(updateError.message);
    else await agreementsQ.reload();
  }

  async function discard(agreement: Agreement) {
    const { error: updateError } = await supabase.from("agreements").update({ status: "descartado" }).eq("id", agreement.id);
    if (updateError) setError(updateError.message);
    else await agreementsQ.reload();
  }

  return <div className="app-shell">
    <aside className="sidebar"><Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={44} height={44} priority /><span><span className="brand-title">NuestroMatri</span><span className="brand-sub">Pato &amp; Andrea</span></span></Link><div className="nav-section">Planificación</div>{menu.map(([href, label, icon]) => <Link className={`nav-link ${href === "/acuerdos" ? "active" : ""}`} href={href} key={href}><Icon name={icon} /><span>{label}</span></Link>)}<div className="nav-section">Cuenta</div><Link className="nav-link" href="/ajustes"><Icon name="settings" /><span>Ajustes</span></Link></aside>
    <main className="main"><div className="mobile-top"><Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={36} height={36} priority /><span className="brand-title">NuestroMatri</span></Link></div><div className="page">
      <header className="page-header"><div><div className="page-eyebrow">Decisiones compartidas</div><h1 className="page-title">Acuerdos</h1><p className="page-subtitle">Un registro común para que las decisiones no se pierdan entre mensajes.</p></div><button className="btn btn-primary" onClick={() => { setError(""); setModalOpen(true); }}><Icon name="plus" />Nuevo acuerdo</button></header>
      {error && <p className="error-box" role="alert">{error}</p>}{notice && <p className="success-box" role="status">{notice}</p>}
      <section className="card"><div className="row-between wrap mb-2"><Segmented value={filter} onChange={setFilter} options={[{ value: "todos", label: "Todos", count: agreementsQ.data.length }, { value: "propuesto", label: "Por aprobar", count: agreementsQ.data.filter((item) => item.status === "propuesto").length }, { value: "aprobado", label: "Aprobados", count: agreementsQ.data.filter((item) => item.status === "aprobado").length }]} /><p className="small muted">{me?.side ? `Estás confirmando como ${me.display_name || (me.side === "novio" ? "Pato" : "Andrea")}.` : "Asigna tu lado en tu perfil para aprobar acuerdos."}</p></div>
        {visibleAgreements.length ? <div className="list">{visibleAgreements.map((agreement) => <article className="list-item" key={agreement.id}><div className={`stat-icon ${agreement.status === "aprobado" ? "sage" : "mauve"}`}><Icon name={agreement.status === "aprobado" ? "check" : "handshake"} /></div><div className="grow"><div className="row wrap"><strong>{agreement.title}</strong><span className={`badge ${agreement.status === "aprobado" ? "sage" : agreement.status === "descartado" ? "muted" : "mauve"}`}>{agreement.status === "aprobado" ? "Aprobado por ambos" : agreement.status === "descartado" ? "Descartado" : "Propuesto"}</span></div>{agreement.topic && <div className="small muted">{agreement.topic}</div>}{agreement.description && <p className="small mt-1">{agreement.description}</p>}<div className="row wrap small muted mt-1"><span>{agreement.approved_novio ? "✓ Pato aprobó" : "○ Pato pendiente"}</span><span>{agreement.approved_novia ? "✓ Andrea aprobó" : "○ Andrea pendiente"}</span></div></div>{agreement.status !== "descartado" && <div className="row wrap"><button className={`btn ${(me?.side === "novio" ? agreement.approved_novio : agreement.approved_novia) ? "btn-primary" : "btn-secondary"}`} onClick={() => void approve(agreement)} disabled={!me?.side}>{(me?.side === "novio" ? agreement.approved_novio : agreement.approved_novia) ? "Quitar aprobación" : "Aprobar"}</button>{agreement.status !== "aprobado" && <button className="btn btn-ghost btn-icon" title="Descartar acuerdo" aria-label={`Descartar ${agreement.title}`} onClick={() => void discard(agreement)}><Icon name="x" /></button>}</div>}</article>)}</div> : <EmptyState icon="handshake" title="Aún no hay acuerdos" text="Registren decisiones importantes y cada uno podrá dejar constancia de su aprobación." action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Icon name="plus" />Registrar primer acuerdo</button>} />}
      </section>
    </div></main>
    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo acuerdo" footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button className="btn btn-primary" type="submit" form="agreement-form" disabled={saving}><Icon name="check" />{saving ? "Guardando…" : "Guardar acuerdo"}</button></>}><form id="agreement-form" className="form-grid" onSubmit={addAgreement}><label className="field full"><span className="label">Decisión</span><input className="input" name="title" required maxLength={180} placeholder="Ej. Máximo 120 invitados" /></label><label className="field full"><span className="label">Tema</span><input className="input" name="topic" maxLength={80} placeholder="Invitados, presupuesto, ceremonia…" /></label><label className="field full"><span className="label">Contexto o detalles</span><textarea className="textarea" name="description" maxLength={1000} /></label></form></Modal>
  </div>;
}