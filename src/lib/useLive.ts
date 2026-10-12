"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

let channelSeq = 0;

/**
 * Carga datos con `fetcher` y los recarga automáticamente cuando cambian
 * las tablas indicadas (Supabase Realtime). Así ambos novios ven
 * los cambios del otro al instante.
 */
export function useLive<T>(fetcher: () => PromiseLike<T>, tables: string[], initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tablesKey = tables.join(",");

  const reload = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const supabase = createClient();
    const channel = supabase.channel(`live-${tablesKey}-${++channelSeq}`);
    tablesKey.split(",").forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(reload, 150);
      });
    });
    channel.subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [tablesKey, reload]);

  return { data, loading, reload, setData };
}

/** Helper: ejecuta un select y devuelve `data ?? []`. */
export async function rows<T>(query: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) console.error(error);
  return data ?? [];
}
