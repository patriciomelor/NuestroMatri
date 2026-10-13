"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.error("No se pudo registrar el service worker", error);
      });
    }
  }, []);

  return null;
}