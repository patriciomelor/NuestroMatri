"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/Icon";
import { PushNotifications } from "@/components/PushNotifications";
import { createClient } from "@/lib/supabase/client";
import { notifyCollaborators } from "@/lib/push-notifications";
import type { GuestSide, ProfileRole, WeddingSettings } from "@/lib/types";

const fallbackSettings: WeddingSettings = {
  id: 1,
  couple_names: "Pato & Andrea",
  wedding_date: "2027-03-22T18:00:00-03:00",
  venue: null,
  venue_address: null,
  total_budget: 0,
  currency: "CLP",
  rsvp_deadline: null,
  rsvp_open: true,
  rsvp_message: "¡Nos casamos! Nos encantaría que nos acompañes en este día tan especial.",
};

function dateInSantiago(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<WeddingSettings>(fallbackSettings);
  const [profileId, setProfileId] = useState("");
  const [profileSide, setProfileSide] = useState<GuestSide | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Exclude<ProfileRole, "couple">>("bridesmaid");
  const [inviteSaving, setInviteSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    void Promise.all([
      supabase.from("wedding_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.auth.getUser(),
    ]).then(async ([{ data, error: queryError }, { data: authData }]) => {
      if (queryError) setError("No pudimos cargar los ajustes. Comprueba que ejecutaste la migración de Supabase.");
      else if (data) setSettings(data as WeddingSettings);
      if (authData.user) {
        const { data: profile } = await supabase.from("profiles").select("id,side").eq("id", authData.user.id).maybeSingle();
        if (profile) {
          setProfileId(profile.id);
          setProfileSide(profile.side as GuestSide | null);
        }
      }
      setLoading(false);
    });
  }, []);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setError("");

    const formData = new FormData(event.currentTarget);
    const weddingDate = String(formData.get("wedding_date") ?? "");
    const nextSide = String(formData.get("profile_side") ?? "") as GuestSide;
    const supabase = createClient();
    if (profileId) {
      const { error: profileError } = await supabase.from("profiles").update({ side: nextSide }).eq("id", profileId);
      if (profileError) {
        setError("No se pudo guardar el lado de tu perfil.");
        setSaving(false);
        return;
      }
    }
    const { error: saveError } = await supabase.from("wedding_settings").upsert({
      id: 1,
      couple_names: String(formData.get("couple_names") ?? "").trim(),
      wedding_date: `${weddingDate}T18:00:00-03:00`,
      venue: String(formData.get("venue") ?? "").trim() || null,
      venue_address: String(formData.get("venue_address") ?? "").trim() || null,
      total_budget: Number(formData.get("total_budget") ?? 0),
      currency: String(formData.get("currency") ?? "CLP"),
      rsvp_deadline: String(formData.get("rsvp_deadline") ?? "") || null,
      rsvp_open: formData.get("rsvp_open") === "on",
      rsvp_message: String(formData.get("rsvp_message") ?? "").trim() || null,
    });

    if (saveError) {
      setError("No se pudieron guardar los cambios. Revisa que tu sesión tenga permisos en Supabase.");
    } else {
      setSettings((current) => ({
        ...current,
        couple_names: String(formData.get("couple_names") ?? "").trim(),
        wedding_date: `${weddingDate}T18:00:00-03:00`,
        venue: String(formData.get("venue") ?? "").trim() || null,
        venue_address: String(formData.get("venue_address") ?? "").trim() || null,
        total_budget: Number(formData.get("total_budget") ?? 0),
        currency: String(formData.get("currency") ?? "CLP"),
        rsvp_deadline: String(formData.get("rsvp_deadline") ?? "") || null,
        rsvp_open: formData.get("rsvp_open") === "on",
        rsvp_message: String(formData.get("rsvp_message") ?? "").trim() || null,
      }));
      setProfileSide(nextSide);
      setNotice("Ajustes guardados.");
      void notifyCollaborators("settings_updated");
    }
    setSaving(false);
  }

  async function inviteUser() {
    setInviteSaving(true);
    setNotice("");
    setError("");
    const response = await fetch("/api/admin/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) setError(result.error ?? "No pudimos enviar la invitación.");
    else {
      setInviteEmail("");
      setNotice("Invitación enviada. La persona recibirá un enlace para activar su cuenta.");
      void notifyCollaborators("collaborator_invited", inviteRole === "wedding_planner" ? "Wedding planner" : "Dama de honor");
    }
    setInviteSaving(false);
  }

  const menu = [
    ["/", "Resumen", "home"], ["/presupuesto", "Presupuesto", "wallet"],
    ["/tareas", "Tareas", "checkSquare"], ["/acuerdos", "Acuerdos", "handshake"],
    ["/invitados", "Invitados", "users"], ["/confirmaciones", "Confirmaciones", "mail"],
    ["/mesas", "Mesas", "table"], ["/regalos", "Regalos", "gift"], ["/cronograma", "Cronograma", "calendar"],
  ] as const;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={44} height={44} priority /><span><span className="brand-title">NuestroMatri</span><span className="brand-sub">Pato &amp; Andrea</span></span></Link>
        <div className="nav-section">Planificación</div>
        {menu.map(([href, label, icon]) => <Link className="nav-link" href={href} key={href}><Icon name={icon} /><span>{label}</span></Link>)}
        <div className="nav-section">Cuenta</div>
        <Link className="nav-link active" href="/ajustes"><Icon name="settings" /><span>Ajustes</span></Link>
      </aside>
      <main className="main">
        <div className="mobile-top"><Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={36} height={36} priority /><span className="brand-title">NuestroMatri</span></Link></div>
        <div className="page">
          <header className="page-header"><div><div className="page-eyebrow">Configuración de la boda</div><h1 className="page-title">Ajustes</h1><p className="page-subtitle">La fecha es estimativa y podrán actualizarla cuando lo necesiten.</p></div><Link className="btn btn-secondary" href="/">Volver</Link></header>
          {loading ? <div className="card"><p>Cargando ajustes…</p></div> : <form className="stack" onSubmit={saveSettings}>
            <section className="card stack">
              <div className="card-title"><h2>El gran día</h2></div>
              <div className="form-grid">
                <label className="field"><span className="label">Nombres</span><input className="input" name="couple_names" defaultValue={settings.couple_names} required /></label>
                <label className="field"><span className="label">Fecha estimada</span><input className="input" name="wedding_date" type="date" defaultValue={dateInSantiago(settings.wedding_date)} required /></label>
                <label className="field"><span className="label">Lugar</span><input className="input" name="venue" defaultValue={settings.venue ?? ""} placeholder="Por confirmar" /></label>
                <label className="field"><span className="label">Dirección</span><input className="input" name="venue_address" defaultValue={settings.venue_address ?? ""} placeholder="Dirección del evento" /></label>
                <label className="field"><span className="label">Lado de esta cuenta</span><select className="select" name="profile_side" defaultValue={profileSide ?? ""} required><option value="" disabled>Seleccionar</option><option value="novio">Pato</option><option value="novia">Andrea</option></select></label>
              </div>
            </section>
            <section className="card stack">
              <div className="card-title"><h2>Presupuesto</h2></div>
              <div className="form-grid">
                <label className="field"><span className="label">Presupuesto total</span><input className="input" name="total_budget" type="number" min="0" step="1000" defaultValue={settings.total_budget} /></label>
                <label className="field"><span className="label">Moneda</span><select className="select" name="currency" defaultValue={settings.currency}><option value="CLP">Peso chileno (CLP)</option><option value="USD">Dólar estadounidense (USD)</option><option value="EUR">Euro (EUR)</option></select></label>
              </div>
            </section>
            <section className="card stack">
              <div className="card-title"><h2>Confirmaciones</h2></div>
              <div className="form-grid">
                <label className="field"><span className="label">Fecha límite para confirmar</span><input className="input" name="rsvp_deadline" type="date" defaultValue={settings.rsvp_deadline ?? ""} /></label>
                <label className="check"><input name="rsvp_open" type="checkbox" defaultChecked={settings.rsvp_open} /><span>Formulario de confirmación abierto</span></label>
                <label className="field full"><span className="label">Mensaje para los invitados</span><textarea className="textarea" name="rsvp_message" defaultValue={settings.rsvp_message ?? ""} maxLength={500} /></label>
              </div>
            </section>
            <section className="card stack"><div className="card-title"><h2>Notificaciones</h2></div><PushNotifications /></section>
            <section className="card stack">
              <div className="card-title"><h2>Acceso al panel</h2></div>
              <p className="small muted">Invita personas por correo y asigna qué módulos podrán administrar.</p>
              <div className="form-grid">
                <label className="field"><span className="label">Correo electrónico</span><input className="input" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="nombre@correo.com" /></label>
                <label className="field"><span className="label">Rol</span><select className="select" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Exclude<ProfileRole, "couple">)}><option value="wedding_planner">Wedding planner</option><option value="bridesmaid">Dama de honor</option></select></label>
              </div>
              <div><button className="btn btn-secondary" type="button" onClick={() => void inviteUser()} disabled={inviteSaving || !inviteEmail.trim()}><Icon name="userPlus" />{inviteSaving ? "Enviando…" : "Enviar invitación"}</button></div>
            </section>
            {error && <p className="error-box" role="alert">{error}</p>}
            {notice && <p className="success-box" role="status">{notice}</p>}
            <div className="form-actions"><button className="btn btn-primary" type="submit" disabled={saving}><Icon name="check" />{saving ? "Guardando…" : "Guardar ajustes"}</button></div>
          </form>}
        </div>
      </main>
    </div>
  );
}