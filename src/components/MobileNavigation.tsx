"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { homeForRole, roleCanAccessPath } from "@/lib/roles";
import { useProfileRole } from "@/lib/useProfileRole";

const planningLinks = [
  ["/", "Resumen", "home"],
  ["/presupuesto", "Presupuesto", "wallet"],
  ["/tareas", "Tareas", "checkSquare"],
  ["/acuerdos", "Acuerdos", "handshake"],
  ["/invitados", "Invitados", "users"],
  ["/confirmaciones", "Confirmaciones", "mail"],
  ["/mesas", "Mesas", "table"],
  ["/regalos", "Regalos", "gift"],
  ["/cronograma", "Cronograma", "calendar"],
] as const;

export function MobileNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const role = useProfileRole();

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  if (pathname === "/login" || pathname === "/auth/set-password" || pathname === "/confirmar" || pathname.startsWith("/confirmar/")) return null;

  const links = planningLinks.filter(([href]) => role ? roleCanAccessPath(role, href) : false);
  const homeHref = role ? homeForRole(role) : "/";

  return <>
    <header className="mobile-appbar">
      <Link className="mobile-appbar-brand" href={homeHref} onClick={() => setOpen(false)}>
        <Image src="/icons/icon-192.png" alt="" width={36} height={36} priority />
        <span>NuestroMatri</span>
      </Link>
      <button className="mobile-menu-toggle" type="button" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen((value) => !value)}>
        <Icon name={open ? "x" : "menu"} />
        <span>{open ? "Cerrar" : "Menú"}</span>
      </button>
    </header>
    {open && <button className="mobile-menu-backdrop" type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} />}
    <nav className="mobile-menu-panel" id="mobile-navigation" aria-label="Navegación principal" hidden={!open}>
      <div className="mobile-menu-section">Planificación</div>
      {links.map(([href, label, icon]) => <Link className={`mobile-menu-link ${pathname === href ? "active" : ""}`} href={href} key={href} onClick={() => setOpen(false)}><Icon name={icon} /><span>{label}</span>{pathname === href && <span className="mobile-menu-current">Actual</span>}</Link>)}
      {role === "couple" && <><div className="mobile-menu-section">Cuenta</div><Link className={`mobile-menu-link ${pathname === "/ajustes" ? "active" : ""}`} href="/ajustes" onClick={() => setOpen(false)}><Icon name="settings" /><span>Ajustes</span></Link></>}
    </nav>
  </>;
}