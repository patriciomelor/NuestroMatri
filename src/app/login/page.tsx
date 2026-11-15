"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRole } from "@/lib/types";

type AuthMode = "login" | "signup" | "recovery";
type SignupRole = Exclude<ProfileRole, "couple">;

function isSignupRole(value: string): value is SignupRole {
  return value === "bridesmaid" || value === "wedding_planner";
}

function authCallbackUrl(next: string) {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", next);
  return url.toString();
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [role, setRole] = useState<SignupRole>("bridesmaid");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash;
      if (hash.includes("type=invite") || hash.includes("type=recovery")) {
        router.replace(`/auth/set-password${hash}`);
      }
    }
  }, [router]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const { error: signInError } = await createClient().auth.signInWithPassword({
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

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setNotice("");

    const formData = new FormData(event.currentTarget);
    const displayName = String(formData.get("display_name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const confirmation = String(formData.get("confirmation") ?? "");

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      setPending(false);
      return;
    }
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      setPending(false);
      return;
    }

    const { data, error: signupError } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, role },
        emailRedirectTo: authCallbackUrl("/login"),
      },
    });

    if (signupError) {
      setError(signupError.message);
      setPending(false);
      return;
    }

    if (data.session) {
      router.replace(role === "wedding_planner" ? "/invitados" : "/tareas");
      router.refresh();
      return;
    }

    setNotice("Cuenta creada. Revisa tu correo para confirmar la dirección e ingresar.");
    setPending(false);
  }

  async function sendPasswordRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setNotice("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const { error: recoveryError } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: authCallbackUrl("/auth/set-password"),
    });

    if (recoveryError) {
      setError("No pudimos enviar el enlace. Comprueba el correo e inténtalo nuevamente.");
    } else {
      setNotice("Si existe una cuenta con ese correo, recibirás un enlace para crear una contraseña nueva.");
    }
    setPending(false);
  }

  const isSignup = mode === "signup";
  const isRecovery = mode === "recovery";

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
          <h2>{isSignup ? "Crea tu cuenta" : isRecovery ? "Recupera tu acceso" : "Qué bueno verlos"}</h2>
          <p className="page-subtitle">
            {isSignup
              ? "Únete al equipo que está organizando la boda."
              : isRecovery
                ? "Te enviaremos un enlace para elegir una contraseña nueva."
                : "Entren para continuar organizando su boda."}
          </p>
          {isSignup ? (
            <form className="stack mt-2" onSubmit={signUp}>
              <label className="field">
                <span className="label">Nombre</span>
                <input className="input" name="display_name" autoComplete="name" required />
              </label>
              <label className="field">
                <span className="label">Correo electrónico</span>
                <input className="input" name="email" type="email" autoComplete="email" required />
              </label>
              <label className="field">
                <span className="label">Perfil</span>
                <select className="select" value={role} onChange={(event) => {
                  if (isSignupRole(event.target.value)) setRole(event.target.value);
                }}>
                  <option value="bridesmaid">Dama de honor</option>
                  <option value="wedding_planner">Wedding planner</option>
                </select>
              </label>
              <label className="field">
                <span className="label">Contraseña</span>
                <input className="input" name="password" type="password" autoComplete="new-password" minLength={8} required />
              </label>
              <label className="field">
                <span className="label">Repite la contraseña</span>
                <input className="input" name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
              </label>
              {error && <p className="error-box" role="alert">{error}</p>}
              {notice && <p className="success-box" role="status">{notice}</p>}
              <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={pending}>
                {pending ? "Creando cuenta…" : "Crear cuenta"}
              </button>
              <button className="btn btn-ghost btn-block" type="button" onClick={() => changeMode("login")}>
                Ya tengo una cuenta
              </button>
            </form>
          ) : isRecovery ? (
            <form className="stack mt-2" onSubmit={sendPasswordRecovery}>
              <label className="field">
                <span className="label">Correo electrónico</span>
                <input className="input" name="email" type="email" autoComplete="email" required />
              </label>
              {error && <p className="error-box" role="alert">{error}</p>}
              {notice && <p className="success-box" role="status">{notice}</p>}
              <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={pending}>
                {pending ? "Enviando…" : "Enviar enlace"}
              </button>
              <button className="btn btn-ghost btn-block" type="button" onClick={() => changeMode("login")}>
                Volver a iniciar sesión
              </button>
            </form>
          ) : (
            <form className="stack mt-2" onSubmit={signIn}>
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
              <button className="btn btn-ghost btn-block" type="button" onClick={() => changeMode("recovery")}>
                ¿Olvidaste tu contraseña?
              </button>
              <button className="btn btn-secondary btn-block" type="button" onClick={() => changeMode("signup")}>
                Crear usuario
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
