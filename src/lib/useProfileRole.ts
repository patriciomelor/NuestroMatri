"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRole } from "@/lib/types";

export function useProfileRole() {
  const [role, setRole] = useState<ProfileRole | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      if (active && profile?.role) setRole(profile.role as ProfileRole);
    });
    return () => { active = false; };
  }, []);

  return role;
}