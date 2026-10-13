"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { EmptyState, Modal, Segmented } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase/client";
import { rows, useLive } from "@/lib/useLive";
import type { Category, Task, TaskStatus, WeddingSettings, Who } from "@/lib/types";

const menu = [["/", "Resumen", "home"], ["/presupuesto", "Presupuesto", "wallet"], ["/tareas", "Tareas", "checkSquare"], ["/acuerdos", "Acuerdos", "handshake"], ["/invitados", "Invitados", "users"], ["/confirmaciones", "Confirmaciones", "mail"], ["/mesas", "Mesas", "table"], ["/regalos", "Regalos", "gift"], ["/cronograma", "Cronograma", "calendar"]] as const;
const statusOptions: { value: TaskStatus; label: string }[] = [{ value: "pendiente", label: "Pendiente" }, { value: "en_curso", label: "En curso" }, { value: "lista", label: "Lista" }];
const priorityOptions = [{ value: "baja", label: "Baja" }, { value: "media", label: "Media" }, { value: "alta", label: "Alta" }] as const;
type CategoryOption = Pick<Category, "id" | "name">;

export default function TasksPage() {
  const supabase = createClient();
  const tasksQ = useLive<Task[]>(() => rows<Task>(supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false })), ["tasks"], []);
  const categoriesQ = useLive<CategoryOption[]>(() => rows<CategoryOption>(supabase.from("categories").select("id,name").order("name")), ["categories"], []);
  const settingsQ = useLive<WeddingSettings | null>(async () => {
    const { data } = await supabase.from("wedding_settings").select("wedding_date").eq("id", 1).maybeSingle();
    return data as WeddingSettings | null;
  }, ["wedding_settings"], null);
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const { error: insertError } = await supabase.from("tasks").insert({
      title: String(data.get("title") ?? "").trim(),
      description: String(data.get("description") ?? "").trim() || null,
      assignee: String(data.get("assignee") ?? "ambos"),
      due_date: String(data.get("due_date") ?? "") || null,
      priority: String(data.get("priority") ?? "media"),
      category_id: String(data.get("category_id") ?? "") || null,
    });
    if (insertError) setError(insertError.message);
    else {
      form.reset();
      setModalOpen(false);
      setNotice("Tarea agregada.");
      await tasksQ.reload();
    }
    setSaving(false);
  }

  async function updateTask(task: Task, update: Partial<Task>) {
    const values = { ...update, ...(update.status === "lista" ? { completed_at: new Date().toISOString() } : update.status ? { completed_at: null } : {}) };
    const { error: updateError } = await supabase.from("tasks").update(values).eq("id", task.id);
    if (updateError) setError(updateError.message);
    else await tasksQ.reload();
  }

  async function removeTask(task: Task) {
    if (!window.confirm(`¿Eliminar la tarea “${task.title}”?`)) return;
    const { error: deleteError } = await supabase.from("tasks").delete().eq("id", task.id);
    if (deleteError) setError(deleteError.message);
    else await tasksQ.reload();
  }

  async function addChecklist() {
    setChecklistLoading(true);
    setError("");
    const milestones = [
      { months: 12, title: "Definir presupuesto y prioridades" },
      { months: 12, title: "Elegir y reservar el lugar" },
      { months: 6, title: "Contratar fotografía y música" },
      { months: 6, title: "Definir lista inicial de invitados" },
      { months: 3, title: "Confirmar menú y restricciones alimentarias" },
      { months: 3, title: "Enviar invitaciones y abrir RSVP" },
      { months: 1, title: "Cerrar confirmaciones y revisar cantidades" },
      { months: 1, title: "Revisar mesas y cronograma del día" },
    ];
    const weddingDate = new Date(settingsQ.data?.wedding_date ?? "2027-03-22T18:00:00-03:00");
    const existing = new Set(tasksQ.data.map((task) => task.title));
    const tasks = milestones.map((item) => ({
      title: `${item.months} ${item.months === 1 ? "mes" : "meses"} antes · ${item.title}`,
      assignee: "ambos",
      status: "pendiente",
      priority: item.months === 1 ? "alta" : "media",
      due_date: new Date(Date.UTC(weddingDate.getUTCFullYear(), weddingDate.getUTCMonth() - item.months, weddingDate.getUTCDate())).toISOString().slice(0, 10),
    })).filter((task) => !existing.has(task.title));
    if (!tasks.length) setNotice("La checklist ya está cargada.");
    else {
      const { error: insertError } = await supabase.from("tasks").insert(tasks);
      if (insertError) setError(insertError.message);
      else { setNotice("Checklist agregada. Ajusten responsables y fechas según sus planes."); await tasksQ.reload(); }
    }
    setChecklistLoading(false);
  }

  const dateLabel = (date: string | null) => date ? new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)) : "Sin fecha";
  const assigneeLabel: Record<Who, string> = { novio: "Pato", novia: "Andrea", ambos: "Ambos" };

  return <div className="app-shell">
    <aside className="sidebar"><Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={44} height={44} priority /><span><span className="brand-title">NuestroMatri</span><span className="brand-sub">Pato &amp; Andrea</span></span></Link><div className="nav-section">Planificación</div>{menu.map(([href, label, icon]) => <Link className={`nav-link ${href === "/tareas" ? "active" : ""}`} href={href} key={href}><Icon name={icon} /><span>{label}</span></Link>)}<div className="nav-section">Cuenta</div><Link className="nav-link" href="/ajustes"><Icon name="settings" /><span>Ajustes</span></Link></aside>
    <main className="main"><div className="mobile-top"><Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={36} height={36} priority /><span className="brand-title">NuestroMatri</span></Link></div><div className="page">
      <header className="page-header"><div><div className="page-eyebrow">Pendientes y próximos hitos</div><h1 className="page-title">Tareas</h1><p className="page-subtitle">Coordinen qué falta, quién lo lleva y para cuándo.</p></div><div className="row wrap"><button className="btn btn-secondary" onClick={() => void addChecklist()} disabled={checklistLoading}><Icon name="download" />{checklistLoading ? "Cargando…" : "Checklist base"}</button><button className="btn btn-primary" onClick={() => { setError(""); setModalOpen(true); }}><Icon name="plus" />Nueva tarea</button></div></header>
      {error && <p className="error-box" role="alert">{error}</p>}{notice && <p className="success-box" role="status">{notice}</p>}
      <section className="card"><div className="row-between wrap mb-2"><Segmented value={view} onChange={setView} options={[{ value: "lista", label: "Lista", count: tasksQ.data.length }, { value: "kanban", label: "Kanban" }]} /><div className="row small muted">{tasksQ.data.filter((task) => task.status !== "lista").length} pendientes · {tasksQ.data.filter((task) => task.status === "lista").length} listas</div></div>
        {!tasksQ.data.length ? <EmptyState icon="checkSquare" title="La lista está despejada" text="Agreguen su primera tarea para empezar a organizar el camino al gran día." action={<button className="btn btn-primary" onClick={() => setModalOpen(true)}><Icon name="plus" />Agregar tarea</button>} /> : view === "lista" ? <div style={{ overflowX: "auto" }}><table className="table"><thead><tr><th>Tarea</th><th>Responsable</th><th>Prioridad</th><th>Fecha límite</th><th>Estado</th><th aria-label="Acciones" /></tr></thead><tbody>{tasksQ.data.map((task) => <tr key={task.id}><td><strong>{task.title}</strong>{task.description && <div className="tiny muted">{task.description}</div>}</td><td><select className="select" aria-label={`Responsable de ${task.title}`} value={task.assignee} onChange={(event) => void updateTask(task, { assignee: event.target.value as Who })}><option value="novio">Pato</option><option value="novia">Andrea</option><option value="ambos">Ambos</option></select></td><td><select className="select" aria-label={`Prioridad de ${task.title}`} value={task.priority} onChange={(event) => void updateTask(task, { priority: event.target.value as Task["priority"] })}>{priorityOptions.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}</select></td><td>{dateLabel(task.due_date)}</td><td><select className="select" aria-label={`Estado de ${task.title}`} value={task.status} onChange={(event) => void updateTask(task, { status: event.target.value as TaskStatus })}>{statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></td><td><button className="btn btn-ghost btn-icon danger-text" title="Eliminar tarea" aria-label={`Eliminar ${task.title}`} onClick={() => void removeTask(task)}><Icon name="trash" /></button></td></tr>)}</tbody></table></div> : <div className="grid grid-3">{statusOptions.map((status) => <section className="stack" key={status.value}><div className="row-between"><h2 className="serif">{status.label}</h2><span className="badge muted">{tasksQ.data.filter((task) => task.status === status.value).length}</span></div>{tasksQ.data.filter((task) => task.status === status.value).map((task) => <article className="card" key={task.id}><div className="row-between"><span className={`badge ${task.priority === "alta" ? "danger" : task.priority === "baja" ? "sage" : "mauve"}`}>{task.priority}</span><button className="btn btn-ghost btn-icon danger-text" aria-label={`Eliminar ${task.title}`} onClick={() => void removeTask(task)}><Icon name="trash" /></button></div><h3 className="mt-1">{task.title}</h3>{task.description && <p className="small muted mt-1">{task.description}</p>}<div className="row-between small muted mt-2"><span>{assigneeLabel[task.assignee]}</span><span>{dateLabel(task.due_date)}</span></div><select className="select mt-2" aria-label={`Cambiar estado de ${task.title}`} value={task.status} onChange={(event) => void updateTask(task, { status: event.target.value as TaskStatus })}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></article>)}</section>)}</div>}
      </section>
    </div></main>
    <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva tarea" footer={<><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button className="btn btn-primary" type="submit" form="task-form" disabled={saving}><Icon name="check" />{saving ? "Guardando…" : "Guardar tarea"}</button></>}><form id="task-form" className="form-grid" onSubmit={addTask}><label className="field full"><span className="label">Tarea</span><input className="input" name="title" required maxLength={160} placeholder="Ej. Cotizar fotógrafo" /></label><label className="field"><span className="label">Responsable</span><select className="select" name="assignee" defaultValue="ambos"><option value="novio">Pato</option><option value="novia">Andrea</option><option value="ambos">Ambos</option></select></label><label className="field"><span className="label">Prioridad</span><select className="select" name="priority" defaultValue="media">{priorityOptions.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}</select></label><label className="field"><span className="label">Fecha límite</span><input className="input" name="due_date" type="date" /></label><label className="field"><span className="label">Categoría</span><select className="select" name="category_id" defaultValue=""><option value="">Sin categoría</option>{categoriesQ.data.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className="field full"><span className="label">Notas</span><textarea className="textarea" name="description" maxLength={1000} /></label></form></Modal>
  </div>;
}