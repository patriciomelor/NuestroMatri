import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "No autorizado." }, { status: 401 });

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return Response.json({ error: "Configura NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT." }, { status: 503 });
  }

  const { data: subscriptions, error: queryError } = await supabase.from("push_subscriptions").select("endpoint,p256dh,auth");
  if (queryError) return Response.json({ error: "No pudimos leer los dispositivos registrados." }, { status: 500 });
  if (!subscriptions?.length) return Response.json({ error: "No hay dispositivos con notificaciones activadas." }, { status: 409 });

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const payload = JSON.stringify({ title: "NuestroMatri", body: "Llegó una nueva respuesta de confirmación.", url: "/confirmaciones" });
  const results = await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload);
      return true;
    } catch (cause) {
      const statusCode = (cause as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      }
      return false;
    }
  }));

  return Response.json({ sent: results.filter(Boolean).length });
}