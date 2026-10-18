import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/** Cliente de Supabase para Server Components / Server Actions con la sesión del usuario. */
export const createClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Llamado desde un Server Component: el proxy se encarga de refrescar la sesión.
        }
      },
    },
  });
};

/** Cliente anónimo sin cookies (formulario público de confirmación). */
export const createAnonClient = () =>
  createPlainClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

/** Cliente con la secret key (solo servidor). Devuelve null si no está configurada. */
export const createAdminClient = () => {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  return createPlainClient(supabaseUrl, secret, { auth: { persistSession: false } });
};
