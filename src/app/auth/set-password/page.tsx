"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setReady(Boolean(session)));
    return () => subscription.unsubscribe();
  }, []);

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) {
      setError("No pudimos guardar la contraseña. Abre nuevamente el enlace de invitación.");
      setSaving(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return <main className="auth-page">
    <section className="auth-art" aria-label="NuestroMatri"><Image src="/img/floral-corner.jpg" alt="Flores para una celebración especial" fill priority /><div className="auth-art-text"><h1>Nuestro<br />gran día</h1><p>Pato &amp; Andrea</p></div></section>
    <section className="auth-panel"><div className="auth-card"><h2>Activa tu cuenta</h2><p className="page-subtitle">Define una contraseña para entrar al panel de organización.</p>{ready ? <form className="stack mt-2" onSubmit={savePassword}><label className="field"><span className="label">Contraseña nueva</span><input className="input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label className="field"><span className="label">Repite la contraseña</span><input className="input" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>{error && <p className="error-box" role="alert">{error}</p>}<button className="btn btn-primary btn-block btn-lg" disabled={saving}>{saving ? "Guardando…" : "Guardar contraseña"}</button></form> : <p className="info-box mt-2">Validando invitación… Si el enlace expiró, pide que te envíen una nueva invitación.</p>}</div></section>
  </main>;
}