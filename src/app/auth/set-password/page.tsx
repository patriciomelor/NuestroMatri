"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type LinkStatus = "validating" | "ready" | "invalid";

export default function SetPasswordPage() {
  const router = useRouter();
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("validating");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setLinkStatus("ready");
    });

    async function validateLink() {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "link") {
        if (active) setLinkStatus("invalid");
        return;
      }

      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        const code = params.get("code");
        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          session = data.session;
        }
      }

      if (!session) {
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          session = data.session;
          window.history.replaceState(null, "", window.location.pathname);
        }
      }

      if (!session) {
        const tokenHash = params.get("token_hash");
        const type = params.get("type");
        if (tokenHash && type) {
          const { data, error: otpError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          });
          if (otpError) throw otpError;
          session = data.session;
        }
      }

      if (active) setLinkStatus(session ? "ready" : "invalid");
    }

    void validateLink().catch(() => {
      if (active) setLinkStatus("invalid");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
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
      setError("No pudimos guardar la contraseña. Solicita un enlace nuevo e inténtalo otra vez.");
      setSaving(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return <main className="auth-page">
    <section className="auth-art" aria-label="NuestroMatri"><Image src="/img/floral-corner.jpg" alt="Flores para una celebración especial" fill priority /><div className="auth-art-text"><h1>Nuestro<br />gran día</h1><p>Pato &amp; Andrea</p></div></section>
    <section className="auth-panel"><div className="auth-card"><h2>Activa tu cuenta</h2><p className="page-subtitle">Define una contraseña para entrar al panel de organización.</p>{linkStatus === "ready" ? <form className="stack mt-2" onSubmit={savePassword}><label className="field"><span className="label">Contraseña nueva</span><input className="input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label className="field"><span className="label">Repite la contraseña</span><input className="input" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>{error && <p className="error-box" role="alert">{error}</p>}<button className="btn btn-primary btn-block btn-lg" disabled={saving}>{saving ? "Guardando…" : "Guardar contraseña"}</button></form> : linkStatus === "invalid" ? <div className="stack mt-2"><p className="error-box" role="alert">El enlace no es válido o ya expiró. Solicita uno nuevo para continuar.</p><Link className="btn btn-primary btn-block" href="/login">Volver al inicio de sesión</Link></div> : <p className="info-box mt-2" role="status">Validando enlace seguro…</p>}</div></section>
  </main>;
}
