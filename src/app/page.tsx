import Image from "next/image";
import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { Icon } from "@/components/Icon";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const [settingsResult, tasksResult, guestsResult, rsvpsResult, expensesResult] = await Promise.all([
    supabase.from("wedding_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("tasks").select("id, title, due_date", { count: "exact" })
      .neq("status", "lista").order("due_date", { ascending: true, nullsFirst: false }).limit(5),
    supabase.from("guests").select("id", { count: "exact", head: true }),
    supabase.from("rsvps").select("guest_id", { count: "exact", head: true }).eq("attending", true),
    supabase.from("expenses").select("actual"),
  ]);
  const settings = settingsResult.data;
  const tasks = tasksResult.data ?? [];
  const totalGuests = guestsResult.count ?? 0;
  const confirmedGuests = rsvpsResult.count ?? 0;
  const spent = (expensesResult.data ?? []).reduce((sum, expense) => sum + Number(expense.actual || 0), 0);
  const budget = Number(settings?.total_budget ?? 0);
  const eventDate = settings?.wedding_date ?? "2027-03-22T18:00:00-03:00";
  const dateLabel = new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "America/Santiago" }).format(new Date(eventDate));
  const menu = [
    ["/", "Resumen", "home"], ["/presupuesto", "Presupuesto", "wallet"],
    ["/tareas", "Tareas", "checkSquare"], ["/acuerdos", "Acuerdos", "handshake"],
    ["/invitados", "Invitados", "users"], ["/confirmaciones", "Confirmaciones", "mail"],
    ["/mesas", "Mesas", "table"], ["/regalos", "Regalos", "gift"], ["/cronograma", "Cronograma", "calendar"],
  ] as const;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={44} height={44} priority /><span><span className="brand-title">NuestroMatri</span><span className="brand-sub">Pato &amp; Andrea</span></span></Link>
        <div className="nav-section">Planificación</div>
        {menu.map(([href, label, icon]) => <Link className={`nav-link ${href === "/" ? "active" : ""}`} href={href} key={href}><Icon name={icon} /><span>{label}</span></Link>)}
        <div className="sidebar-footer"><Icon name="calendar" /><span>{dateLabel}</span></div>
      </aside>
      <main className="main">
        <div className="mobile-top"><Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={36} height={36} priority /><span className="brand-title">NuestroMatri</span></Link><span className="mobile-days">{dateLabel}</span></div>
        <div className="page">
          <header className="page-header"><div><div className="page-eyebrow">Nuestro gran día</div><h1 className="page-title">Hola, Pato y Andrea</h1><p className="page-subtitle">Todo lo importante para llegar tranquilos al sí.</p></div><Link className="btn btn-primary" href="/ajustes"><Icon name="settings" />Ajustes</Link></header>
          <section className="hero" aria-label="Cuenta regresiva"><div className="hero-eyebrow">La cuenta regresiva ya empezó</div><h2>{settings?.couple_names ?? "Pato & Andrea"}</h2><div className="hero-meta"><span><Icon name="calendar" />{dateLabel}</span>{settings?.venue && <span><Icon name="pin" />{settings.venue}</span>}</div><Countdown target={eventDate} /></section>
          <section className="grid-4" aria-label="Resumen de planificación">
            <article className="card stat"><div className="stat-icon sage"><Icon name="wallet" /></div><div className="stat-label">Presupuesto usado</div><div className="stat-value">{budget > 0 ? `${Math.min(100, Math.round((spent / budget) * 100))}%` : "0%"}</div><div className="stat-hint">{formatMoney(spent, settings?.currency ?? "CLP")} de {formatMoney(budget, settings?.currency ?? "CLP")}</div></article>
            <article className="card stat"><div className="stat-icon mauve"><Icon name="checkSquare" /></div><div className="stat-label">Tareas pendientes</div><div className="stat-value">{tasksResult.count ?? tasks.length}</div><div className="stat-hint">Por organizar y completar</div></article>
            <article className="card stat"><div className="stat-icon gold"><Icon name="users" /></div><div className="stat-label">Invitados confirmados</div><div className="stat-value">{confirmedGuests}<small> / {totalGuests}</small></div><div className="stat-hint">Personas que asistirán</div></article>
            <article className="card stat"><div className="stat-icon sage"><Icon name="clock" /></div><div className="stat-label">Próximo hito</div><div className="stat-value">{tasks[0]?.due_date ? new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${tasks[0].due_date}T00:00:00Z`)) : "A definir"}</div><div className="stat-hint">{tasks[0]?.title ?? "Agreguen su primera tarea"}</div></article>
          </section>
          <section className="grid-2 dashboard-lower">
            <div className="card"><div className="card-title"><h2>Próximas tareas</h2><Link href="/tareas">Ver todas <Icon name="chevronRight" /></Link></div>{tasks.length ? <div className="dashboard-task-list">{tasks.map((task) => <div className="dashboard-task" key={task.id}><Icon name="check" /><span>{task.title}</span><time>{task.due_date ? new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${task.due_date}T00:00:00Z`)) : "Sin fecha"}</time></div>)}</div> : <p className="dashboard-empty">Todavía no hay tareas. La lista empieza con una buena idea.</p>}</div>
            <div className="card dashboard-shortcuts"><div className="card-title"><h2>Seguir planificando</h2></div><Link href="/presupuesto"><Icon name="wallet" /><span><strong>Organizar presupuesto</strong><small>Gastos, pagos y proveedores</small></span><Icon name="chevronRight" /></Link><Link href="/invitados"><Icon name="users" /><span><strong>Preparar la lista de invitados</strong><small>Grupos y confirmaciones</small></span><Icon name="chevronRight" /></Link></div>
          </section>
        </div>
      </main>
    </div>
  );
}
