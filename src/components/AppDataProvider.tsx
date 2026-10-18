"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { rows, useLive } from "@/lib/useLive";
import { formatMoney } from "@/lib/format";
import type { Category, GuestSide, Profile, WeddingSettings, Who } from "@/lib/types";

interface AppData {
  userId: string;
  me: Profile | null;
  profiles: Profile[];
  settings: WeddingSettings | null;
  categories: Category[];
  loading: boolean;
  /** Etiqueta legible: novio → "Pato", novia → "Andrea", comun → "Comunes", ambos → "Ambos". */
  sideLabel: (side: GuestSide | Who | null | undefined) => string;
  money: (n: number | null | undefined) => string;
  reloadCategories: () => Promise<void>;
  reloadProfiles: () => Promise<void>;
  reloadSettings: () => Promise<void>;
}

const Ctx = createContext<AppData | null>(null);

const DEFAULT_SETTINGS: WeddingSettings = {
  id: 1,
  couple_names: "Pato & Andrea",
  wedding_date: "2027-03-22T18:00:00-03:00",
  venue: null,
  venue_address: null,
  total_budget: 0,
  currency: "CLP",
  rsvp_deadline: null,
  rsvp_open: true,
  rsvp_message: null,
};

export function AppDataProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const supabase = createClient();

  const profilesQ = useLive<Profile[]>(
    () => rows<Profile>(supabase.from("profiles").select("id, display_name, side, role")),
    ["profiles"],
    []
  );
  const settingsQ = useLive<WeddingSettings | null>(
    async () => {
      const { data } = await supabase.from("wedding_settings").select("*").eq("id", 1).maybeSingle();
      return (data as WeddingSettings | null) ?? DEFAULT_SETTINGS;
    },
    ["wedding_settings"],
    null
  );
  const categoriesQ = useLive<Category[]>(
    () => rows<Category>(supabase.from("categories").select("*").order("name")),
    ["categories"],
    []
  );

  const me = profilesQ.data.find((p) => p.id === userId) ?? null;
  const settings = settingsQ.data;

  const sideLabel = useCallback(
    (side: GuestSide | Who | null | undefined) => {
      if (side === "comun") return "Comunes";
      if (side === "ambos") return "Ambos";
      if (side === "novio" || side === "novia") {
        const p = profilesQ.data.find((x) => x.side === side);
        return p?.display_name || (side === "novio" ? "Novio" : "Novia");
      }
      return "—";
    },
    [profilesQ.data]
  );

  const money = useCallback((n: number | null | undefined) => formatMoney(n, settings?.currency ?? "CLP"), [settings?.currency]);

  const value = useMemo<AppData>(
    () => ({
      userId,
      me,
      profiles: profilesQ.data,
      settings,
      categories: categoriesQ.data,
      loading: profilesQ.loading || settingsQ.loading,
      sideLabel,
      money,
      reloadCategories: categoriesQ.reload,
      reloadProfiles: profilesQ.reload,
      reloadSettings: settingsQ.reload,
    }),
    [userId, me, profilesQ, settings, categoriesQ, settingsQ, sideLabel, money]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp debe usarse dentro de AppDataProvider");
  return ctx;
}
