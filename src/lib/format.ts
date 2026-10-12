import type { Dietary, Expense, Payment } from "./types";

export function formatMoney(value: number | null | undefined, currency = "CLP") {
  const n = Number(value ?? 0);
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "CLP" ? 0 : 2,
    }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString("es-CL")}`;
  }
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat("es-CL", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** Convierte "YYYY-MM-DD" a Date local (evita el desfase de zona horaria). */
export function parseDate(d: string) {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function formatDate(d: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!d) return "—";
  const date = d.length <= 10 ? parseDate(d) : new Date(d);
  return date.toLocaleDateString("es-CL", opts);
}

export function formatDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysUntil(d: string | null | undefined) {
  if (!d) return null;
  const target = parseDate(d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

export function relativeDays(d: string | null | undefined) {
  const n = daysUntil(d);
  if (n === null) return "";
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  if (n === -1) return "ayer";
  if (n < 0) return `hace ${Math.abs(n)} días`;
  return `en ${n} días`;
}

export function timeAgo(d: string) {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "hace un momento";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function parseAmount(v: string) {
  const n = Number(String(v).replace(/[^\d,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Costo efectivo de un gasto: real si existe, si no el estimado. */
export function expenseCost(e: Expense) {
  return Number(e.actual) > 0 ? Number(e.actual) : Number(e.estimated);
}

/** Monto pagado de un gasto según sus cuotas. */
export function expensePaid(e: Expense, payments: Payment[]) {
  const own = payments.filter((p) => p.expense_id === e.id);
  if (own.length === 0) return e.status === "pagado" ? expenseCost(e) : 0;
  return own.filter((p) => p.paid_at).reduce((s, p) => s + Number(p.amount), 0);
}

export const DIETARY_LABELS: Record<Dietary, string> = {
  ninguna: "Sin restricción",
  vegetariano: "Vegetariano",
  vegano: "Vegano",
  celiaco: "Celíaco (sin gluten)",
  sin_lactosa: "Sin lactosa",
  alergia: "Alergia",
  otra: "Otra",
};

export const EXPENSE_STATUS_LABELS = { cotizado: "Cotizado", reservado: "Reservado", pagado: "Pagado" } as const;
export const TASK_STATUS_LABELS = { pendiente: "Pendiente", en_curso: "En curso", lista: "Lista" } as const;
export const PRIORITY_LABELS = { baja: "Baja", media: "Media", alta: "Alta" } as const;
export const VENDOR_STATUS_LABELS = { cotizando: "Cotizando", contratado: "Contratado", descartado: "Descartado" } as const;
