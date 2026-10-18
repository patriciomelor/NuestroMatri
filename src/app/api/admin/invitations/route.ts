import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/lib/types";

const invitationRoles: ProfileRole[] = ["wedding_planner", "bridesmaid"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Inicia sesión para continuar." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "couple") return Response.json({ error: "Solo la pareja puede invitar usuarios." }, { status: 403 });

  const body = await request.json().catch(() => null) as { email?: string; role?: string } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const role = body?.role;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !role || !invitationRoles.includes(role as ProfileRole)) {
    return Response.json({ error: "Correo o rol inválido." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return Response.json({ error: "Configura SUPABASE_SECRET_KEY o SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor." }, { status: 503 });

  const redirectTo = new URL("/auth/set-password", request.url).toString();
  const { data: invitation, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { display_name: email.split("@")[0] },
    redirectTo,
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  if (!invitation.user) return Response.json({ error: "No pudimos asignar el rol a la cuenta invitada." }, { status: 500 });
  const { error: roleError } = await admin.from("profiles").update({ role }).eq("id", invitation.user.id);
  if (roleError) {
    await admin.auth.admin.deleteUser(invitation.user.id);
    return Response.json({ error: "No pudimos asignar el rol. La invitación fue cancelada." }, { status: 500 });
  }
  return Response.json({ ok: true });
}