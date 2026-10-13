import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "No autorizado." }, { status: 401 });

  const body = await request.json().catch(() => null) as { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } } | null;
  const endpoint = body?.subscription?.endpoint;
  const p256dh = body?.subscription?.keys?.p256dh;
  const auth = body?.subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth || !endpoint.startsWith("https://") || endpoint.length > 2048) {
    return Response.json({ error: "Suscripción inválida." }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert({ endpoint, p256dh, auth, user_id: user.id }, { onConflict: "endpoint" });
  if (error) return Response.json({ error: "No pudimos guardar la suscripción." }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "No autorizado." }, { status: 401 });

  const body = await request.json().catch(() => null) as { endpoint?: string } | null;
  if (!body?.endpoint) return Response.json({ error: "Endpoint inválido." }, { status: 400 });
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint).eq("user_id", user.id);
  if (error) return Response.json({ error: "No pudimos eliminar la suscripción." }, { status: 500 });
  return Response.json({ ok: true });
}