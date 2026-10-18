"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function decodeApplicationKey(value: string) {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`;
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function PushNotifications() {
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function enable() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      if (!publicKey) throw new Error("Configura NEXT_PUBLIC_VAPID_PUBLIC_KEY para activar notificaciones.");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        throw new Error("Este navegador no admite notificaciones push.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Debes permitir las notificaciones en el navegador.");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeApplicationKey(publicKey),
      });
      const response = await fetch("/api/push/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      if (!response.ok) throw new Error("No pudimos guardar este dispositivo. Revisa tu sesión.");
      setSubscribed(true);
      setMessage("Este dispositivo recibirá avisos de cambios en la planificación.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos activar las notificaciones.");
    }
    setBusy(false);
  }

  async function sendTest() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/push/notify", { method: "POST" });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? "No se pudo enviar la notificación de prueba.");
      }
      setMessage("Notificación de prueba enviada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos enviar la notificación.");
    }
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await fetch("/api/push/subscription", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }
    setSubscribed(false);
    setMessage("Notificaciones desactivadas en este dispositivo.");
    setBusy(false);
  }

  return <div className="stack"><p className="small muted">Recibe avisos en este dispositivo cuando otros usuarios registren cambios. La entrega requiere claves VAPID en el entorno.</p><div className="row wrap">{subscribed ? <><button className="btn btn-primary" type="button" onClick={() => void sendTest()} disabled={busy}><Icon name="bell" />{busy ? "Enviando…" : "Enviar prueba"}</button><button className="btn btn-secondary" type="button" onClick={() => void disable()} disabled={busy}>Desactivar</button></> : <button className="btn btn-primary" type="button" onClick={() => void enable()} disabled={busy}><Icon name="bell" />{busy ? "Activando…" : "Activar en este dispositivo"}</button>}</div>{error && <p className="error-box" role="alert">{error}</p>}{message && <p className="info-box" role="status">{message}</p>}</div>;
}