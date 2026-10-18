import webpush from "web-push";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { PushEvent } from "@/lib/push-notifications";

export const runtime = "nodejs";

const eventMessages: Record<Exclude<PushEvent, "test">, { title: string; message: string; url: string }> = {
  rsvp_received: { title: "Nueva confirmación", message: "Un invitado respondió la invitación.", url: "/confirmaciones" },
  group_added: { title: "Nuevo grupo", message: "Se agregó un grupo de invitados.", url: "/invitados" },
  guest_added: { title: "Nuevo invitado", message: "Se agregó una persona a la lista.", url: "/invitados" },
  guest_removed: { title: "Invitado eliminado", message: "Se quitó una persona de la lista.", url: "/invitados" },
  rsvp_changed: { title: "Confirmación actualizada", message: "Se actualizó una respuesta RSVP.", url: "/confirmaciones" },
  task_added: { title: "Nueva tarea", message: "Se agregó una tarea.", url: "/tareas" },
  task_updated: { title: "Tarea actualizada", message: "Se actualizó una tarea.", url: "/tareas" },
  task_removed: { title: "Tarea eliminada", message: "Se quitó una tarea.", url: "/tareas" },
  timeline_added: { title: "Nuevo momento", message: "Se agregó un momento al cronograma.", url: "/cronograma" },
  timeline_removed: { title: "Cronograma actualizado", message: "Se quitó un momento del cronograma.", url: "/cronograma" },
  table_added: { title: "Nueva mesa", message: "Se agregó una mesa.", url: "/mesas" },
  table_updated: { title: "Mesa actualizada", message: "Se cambió la asignación de una mesa.", url: "/mesas" },
  table_removed: { title: "Mesa eliminada", message: "Se quitó una mesa.", url: "/mesas" },
  agreement_added: { title: "Nuevo acuerdo", message: "Se registró una decisión.", url: "/acuerdos" },
  agreement_updated: { title: "Acuerdo actualizado", message: "Se actualizó una decisión compartida.", url: "/acuerdos" },
  expense_added: { title: "Nuevo gasto", message: "Se registró un gasto en el presupuesto.", url: "/presupuesto" },
  expense_removed: { title: "Gasto eliminado", message: "Se quitó un gasto del presupuesto.", url: "/presupuesto" },
  vendor_added: { title: "Nuevo proveedor", message: "Se agregó un proveedor.", url: "/presupuesto" },
  vendor_updated: { title: "Proveedor actualizado", message: "Se actualizó un proveedor.", url: "/presupuesto" },
  payment_added: { title: "Nueva cuota", message: "Se programó un pago.", url: "/presupuesto" },
  payment_updated: { title: "Pago actualizado", message: "Se cambió el estado de un pago.", url: "/presupuesto" },
  category_added: { title: "Nueva categoría", message: "Se agregó una categoría de presupuesto.", url: "/presupuesto" },
  category_updated: { title: "Categoría actualizada", message: "Se actualizó el presupuesto de una categoría.", url: "/presupuesto" },
  gift_added: { title: "Nuevo regalo", message: "Se registró un regalo recibido.", url: "/regalos" },
  gift_updated: { title: "Regalo actualizado", message: "Se actualizó el agradecimiento de un regalo.", url: "/regalos" },
  collaborator_invited: { title: "Nuevo colaborador", message: "Se invitó a una persona a colaborar.", url: "/ajustes" },
  settings_updated: { title: "Ajustes actualizados", message: "Se actualizaron los detalles de la boda.", url: "/ajustes" },
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "No autorizado." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile) return Response.json({ error: "No autorizado." }, { status: 403 });

  const parsedBody = await request.json().catch(() => ({}));
  const body = parsedBody && typeof parsedBody === "object" ? parsedBody as { event?: PushEvent; subject?: string } : {};
  const event = body.event ?? "test";
  if (typeof event !== "string" || (event !== "test" && !Object.hasOwn(eventMessages, event))) {
    return Response.json({ error: "Evento de notificación inválido." }, { status: 400 });
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return Response.json({ error: "Configura NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT." }, { status: 503 });
  }

  const admin = createAdminClient();
  if (!admin) return Response.json({ error: "Falta configurar SUPABASE_SECRET_KEY en el servidor." }, { status: 503 });

  const query = admin.from("push_subscriptions").select("endpoint,p256dh,auth,user_id");
  const { data: subscriptions, error: queryError } = event === "test"
    ? await query.eq("user_id", user.id)
    : await query.neq("user_id", user.id);
  if (queryError) return Response.json({ error: "No pudimos leer los dispositivos registrados." }, { status: 500 });
  if (!subscriptions?.length && event === "test") return Response.json({ error: "Activa las notificaciones en este dispositivo antes de probar." }, { status: 409 });

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const message = event === "test"
    ? { title: "NuestroMatri", message: "Las notificaciones están activas en este dispositivo.", url: "/tareas" }
    : eventMessages[event];
  const subjectLabel = body.subject?.replace(/[\r\n<>]/g, " ").trim().slice(0, 80);
  const payload = JSON.stringify({ title: message.title, body: subjectLabel ? `${message.message} ${subjectLabel}` : message.message, url: message.url });
  const results = await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload);
      return true;
    } catch (cause) {
      const statusCode = (cause as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
      }
      return false;
    }
  }));

  const sent = results.filter(Boolean).length;
  if (event === "test" && sent === 0) return Response.json({ error: "No pudimos entregar la notificación de prueba." }, { status: 502 });
  return Response.json({ sent });
}