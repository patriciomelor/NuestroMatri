"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    });

    if (signInError) {
      setError("No pudimos iniciar sesión. Revisa tu correo y contraseña.");
      setPending(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <section className="auth-art" aria-label="NuestroMatri">
        <Image src="/img/floral-corner.jpg" alt="Flores para una celebración especial" fill priority />
        <div className="auth-art-text">
          <h1>Nuestro<br />gran día</h1>
          <p>Pato &amp; Andrea</p>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <h2>Qué bueno verlos</h2>
          <p className="page-subtitle">Entren para continuar organizando su boda.</p>
          <form className="stack" onSubmit={signIn}>
            <label className="field">
              <span className="label">Correo electrónico</span>
              <input className="input" name="email" type="email" autoComplete="email" required />
            </label>
            <label className="field">
              <span className="label">Contraseña</span>
              <input className="input" name="password" type="password" autoComplete="current-password" required />
            </label>
            {error && <p className="error-box" role="alert">{error}</p>}
            <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={pending}>
              {pending ? "Ingresando…" : "Iniciar sesión"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}