"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { EmptyState, Modal, Progress, Segmented } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { downloadCSV } from "@/lib/csv";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { notifyCollaborators } from "@/lib/push-notifications";
import { rows, useLive } from "@/lib/useLive";
import type { Category, Expense, ExpenseStatus, Payment, Vendor, WeddingSettings } from "@/lib/types";

type ExpenseRow = Expense & {
  categories: Pick<Category, "name" | "color" | "icon"> | null;
  vendors: Pick<Vendor, "name"> | null;
};

const menu = [
  ["/", "Resumen", "home"], ["/presupuesto", "Presupuesto", "wallet"],
  ["/tareas", "Tareas", "checkSquare"], ["/acuerdos", "Acuerdos", "handshake"],
  ["/invitados", "Invitados", "users"], ["/confirmaciones", "Confirmaciones", "mail"],
  ["/mesas", "Mesas", "table"], ["/regalos", "Regalos", "gift"], ["/cronograma", "Cronograma", "calendar"],
] as const;

const expenseStatuses: { value: ExpenseStatus; label: string }[] = [
  { value: "cotizado", label: "Cotizado" },
  { value: "reservado", label: "Reservado" },
  { value: "pagado", label: "Pagado" },
];

const today = new Date().toISOString().slice(0, 10);

function cash(amount: number, currency: string) {
  return formatMoney(amount, currency);
}

async function uploadDocument(file: File, folder: string) {
  if (file.size > 10 * 1024 * 1024) throw new Error("El archivo supera el límite de 10 MB.");
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${authData.user.id}/${folder}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("documentos").upload(path, file);
  if (error) throw new Error(error.message);
  return path;
}

export default function BudgetPage() {
  const supabase = createClient();
  const settingsQ = useLive<WeddingSettings | null>(async () => {
    const { data } = await supabase.from("wedding_settings").select("*").eq("id", 1).maybeSingle();
    return data as WeddingSettings | null;
  }, ["wedding_settings"], null);
  const settings = settingsQ.data;

  const categoriesQ = useLive<Category[]>(
    () => rows<Category>(supabase.from("categories").select("*").order("name")), ["categories"], []
  );
  const expensesQ = useLive<ExpenseRow[]>(
    () => rows<ExpenseRow>(supabase.from("expenses").select("*, categories(name,color,icon), vendors(name)").order("created_at", { ascending: false })),
    ["expenses", "categories", "vendors"], []
  );
  const vendorsQ = useLive<Vendor[]>(
    () => rows<Vendor>(supabase.from("vendors").select("*").order("name")), ["vendors"], []
  );
  const paymentsQ = useLive<Payment[]>(
    () => rows<Payment>(supabase.from("payments").select("*").order("due_date", { ascending: true, nullsFirst: false })), ["payments"], []
  );

  const [tab, setTab] = useState<"gastos" | "proveedores">("gastos");
  const [expenseModal, setExpenseModal] = useState(false);
  const [vendorModal, setVendorModal] = useState(false);
  const [paymentExpense, setPaymentExpense] = useState<ExpenseRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const currency = settings?.currency ?? "CLP";
  const budget = Number(settings?.total_budget ?? 0);
  const projected = expensesQ.data.reduce((sum, expense) => sum + Number(expense.estimated || 0), 0);
  const spent = expensesQ.data.reduce((sum, expense) => sum + Number(expense.actual || 0), 0);
  const nextPayments = paymentsQ.data.filter((payment) => !payment.paid_at && payment.due_date && payment.due_date >= today);

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const categoryName = String(formData.get("category_name") ?? "").trim();
    let attachmentWarning = "";
    let category = categoriesQ.data.find((item) => item.name.toLocaleLowerCase("es") === categoryName.toLocaleLowerCase("es"));

    if (categoryName && !category) {
      const { data, error: categoryError } = await supabase.from("categories").insert({
        name: categoryName,
        color: String(formData.get("category_color") ?? "#809684"),
        icon: "sparkles",
        budget: Number(formData.get("category_budget") ?? 0),
      }).select("*").single();
      if (categoryError) {
        setError(categoryError.message);
        setSaving(false);
        return;
      }
      category = data as Category;
      void notifyCollaborators("category_added", category.name);
    }

    const { data: expense, error: insertError } = await supabase.from("expenses").insert({
      description: String(formData.get("description") ?? "").trim(),
      category_id: category?.id ?? null,
      vendor_id: String(formData.get("vendor_id") ?? "") || null,
      estimated: Number(formData.get("estimated") ?? 0),
      actual: Number(formData.get("actual") ?? 0),
      status: String(formData.get("status") ?? "cotizado"),
      paid_by: String(formData.get("paid_by") ?? "ambos"),
      expense_date: String(formData.get("expense_date") ?? "") || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
    }).select("id").single();

    if (insertError) setError(insertError.message);
    else {
      const receipt = formData.get("receipt");
      if (receipt instanceof File && receipt.size > 0 && expense) {
        try {
          const receiptPath = await uploadDocument(receipt, "comprobantes");
          const { error: attachmentError } = await supabase.from("expenses").update({ receipt_path: receiptPath }).eq("id", expense.id);
          if (attachmentError) attachmentWarning = "El gasto se guardó, pero no pudimos asociar el comprobante.";
        } catch (uploadError) {
          attachmentWarning = uploadError instanceof Error ? `El gasto se guardó sin comprobante: ${uploadError.message}` : "El gasto se guardó sin comprobante.";
        }
      }
      form.reset();
      setExpenseModal(false);
      if (attachmentWarning) setError(attachmentWarning);
      else setNotice("Gasto agregado.");
      await Promise.all([expensesQ.reload(), categoriesQ.reload()]);
      void notifyCollaborators("expense_added", String(formData.get("description") ?? "").trim());
    }
    setSaving(false);
  }

  async function addVendor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    let attachmentWarning = "";
    const { data: vendor, error: insertError } = await supabase.from("vendors").insert({
      name: String(data.get("name") ?? "").trim(),
      service: String(data.get("service") ?? "").trim() || null,
      contact_name: String(data.get("contact_name") ?? "").trim() || null,
      phone: String(data.get("phone") ?? "").trim() || null,
      email: String(data.get("email") ?? "").trim() || null,
      website: String(data.get("website") ?? "").trim() || null,
      status: "cotizando",
    }).select("id").single();
    if (insertError) setError(insertError.message);
    else {
      const contract = data.get("contract");
      if (contract instanceof File && contract.size > 0 && vendor) {
        try {
          const contractPath = await uploadDocument(contract, "contratos");
          const { error: attachmentError } = await supabase.from("vendors").update({ contract_path: contractPath }).eq("id", vendor.id);
          if (attachmentError) attachmentWarning = "El proveedor se guardó, pero no pudimos asociar el contrato.";
        } catch (uploadError) {
          attachmentWarning = uploadError instanceof Error ? `El proveedor se guardó sin contrato: ${uploadError.message}` : "El proveedor se guardó sin contrato.";
        }
      }
      form.reset();
      setVendorModal(false);
      if (attachmentWarning) setError(attachmentWarning);
      else setNotice("Proveedor agregado.");
      await vendorsQ.reload();
      void notifyCollaborators("vendor_added", String(data.get("name") ?? "").trim());
    }
    setSaving(false);
  }

  async function addPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentExpense) return;
    setSaving(true);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const { error: insertError } = await supabase.from("payments").insert({
      expense_id: paymentExpense.id,
      label: String(data.get("label") ?? "Cuota").trim() || "Cuota",
      amount: Number(data.get("amount") ?? 0),
      due_date: String(data.get("due_date") ?? "") || null,
      paid_by: String(data.get("paid_by") ?? paymentExpense.paid_by),
    });
    if (insertError) setError(insertError.message);
    else {
      form.reset();
      await paymentsQ.reload();
      setNotice("Cuota programada.");
      void notifyCollaborators("payment_added", String(data.get("label") ?? "Cuota").trim());
    }
    setSaving(false);
  }

  async function togglePayment(payment: Payment) {
    const paid_at = payment.paid_at ? null : new Date().toISOString().slice(0, 10);
    const { error: updateError } = await supabase.from("payments").update({ paid_at }).eq("id", payment.id);
    if (updateError) setError("No pudimos actualizar el estado de la cuota.");
    else {
      await paymentsQ.reload();
      void notifyCollaborators("payment_updated", payment.label);
    }
  }

  function exportExpenses() {
    downloadCSV("presupuesto-gastos", ["Descripción", "Categoría", "Proveedor", "Estado", "Estimado", "Real", "Responsable de pago", "Fecha", "Notas"], expensesQ.data.map((expense) => [expense.description, expense.categories?.name, expense.vendors?.name, expense.status, expense.estimated, expense.actual, expense.paid_by, expense.expense_date, expense.notes]));
  }

  async function deleteExpense(expense: ExpenseRow) {
    if (!window.confirm(`¿Eliminar el gasto “${expense.description}” y sus cuotas?`)) return;
    const { error: deleteError } = await supabase.from("expenses").delete().eq("id", expense.id);
    if (deleteError) setError(deleteError.message);
    else {
      setNotice("Gasto eliminado.");
      await Promise.all([expensesQ.reload(), paymentsQ.reload()]);
      void notifyCollaborators("expense_removed", expense.description);
    }
  }

  async function updateVendorStatus(vendor: Vendor, status: Vendor["status"]) {
    const { error: updateError } = await supabase.from("vendors").update({ status }).eq("id", vendor.id);
    if (updateError) setError(updateError.message);
    else {
      await vendorsQ.reload();
      void notifyCollaborators("vendor_updated", vendor.name);
    }
  }

  async function updateCategoryBudget(categoryId: string, value: string) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return;
    const { error: updateError } = await supabase.from("categories").update({ budget: amount }).eq("id", categoryId);
    if (updateError) setError("No pudimos actualizar el presupuesto de la categoría.");
    else {
      await categoriesQ.reload();
      void notifyCollaborators("category_updated");
    }
  }

  async function openDocument(path: string) {
    const { data, error: signedUrlError } = await supabase.storage.from("documentos").createSignedUrl(path, 60);
    if (signedUrlError) setError("No pudimos abrir el archivo. Revisa los permisos del bucket privado.");
    else if (data?.signedUrl) window.location.assign(data.signedUrl);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={44} height={44} priority /><span><span className="brand-title">NuestroMatri</span><span className="brand-sub">Pato &amp; Andrea</span></span></Link>
        <div className="nav-section">Planificación</div>
        {menu.map(([href, label, icon]) => <Link className={`nav-link ${href === "/presupuesto" ? "active" : ""}`} href={href} key={href}><Icon name={icon} /><span>{label}</span></Link>)}
        <div className="nav-section">Cuenta</div>
        <Link className="nav-link" href="/ajustes"><Icon name="settings" /><span>Ajustes</span></Link>
      </aside>
      <main className="main">
        <div className="mobile-top"><Link className="brand" href="/"><Image src="/icons/icon-192.png" alt="" width={36} height={36} priority /><span className="brand-title">NuestroMatri</span></Link></div>
        <div className="page">
          <header className="page-header">
            <div><div className="page-eyebrow">Planificación financiera</div><h1 className="page-title">Presupuesto</h1><p className="page-subtitle">Gastos, cuotas y proveedores, todo en una sola vista.</p></div>
            <div className="row wrap"><button className="btn btn-secondary no-print" onClick={() => window.print()}><Icon name="printer" />Imprimir / PDF</button><button className="btn btn-secondary" onClick={exportExpenses}><Icon name="download" />Exportar CSV</button><button className="btn btn-primary" onClick={() => { setError(""); setExpenseModal(true); }}><Icon name="plus" />Nuevo gasto</button></div>
          </header>
          {notice && <p className="success-box" role="status">{notice}</p>}
          {error && <p className="error-box" role="alert">{error}</p>}
          <section className="grid grid-4 mb-2" aria-label="Resumen del presupuesto">
            <article className="card stat"><div className="stat-icon sage"><Icon name="wallet" /></div><div className="stat-label">Presupuesto total</div><div className="stat-value">{cash(budget, currency)}</div><div className="stat-hint">Monto definido para la boda</div></article>
            <article className="card stat"><div className="stat-icon mauve"><Icon name="sparkles" /></div><div className="stat-label">Gastos estimados</div><div className="stat-value">{cash(projected, currency)}</div><div className="stat-hint">{budget ? `${Math.round((projected / budget) * 100)}% del presupuesto` : "Define un presupuesto total"}</div></article>
            <article className="card stat"><div className="stat-icon gold"><Icon name="check" /></div><div className="stat-label">Gasto real</div><div className="stat-value">{cash(spent, currency)}</div><div className="stat-hint">Registrado como pagado</div></article>
            <article className="card stat"><div className="stat-icon sage"><Icon name="calendar" /></div><div className="stat-label">Cuotas por vencer</div><div className="stat-value">{nextPayments.length}</div><div className="stat-hint">Pagos pendientes con fecha</div></article>
          </section>
          <section className="grid grid-2 mb-2">
            <article className="card"><div className="card-title"><h2>Distribución estimada</h2></div>{categoriesQ.data.length ? <div className="bars">{categoriesQ.data.map((category) => {
              const total = expensesQ.data.filter((expense) => expense.category_id === category.id).reduce((sum, expense) => sum + Number(expense.estimated || 0), 0);
              return <div className="bar-row" key={category.id}><span className="truncate">{category.name}</span><div className="bar-track"><span className="bar-budget" style={{ width: `${category.budget && budget ? Math.min(100, (category.budget / budget) * 100) : 0}%` }} /><span className="bar-fill" style={{ width: `${Math.min(100, projected ? (total / projected) * 100 : 0)}%`, background: category.color }} /></div><strong>{cash(total, currency)}</strong></div>;
            })}</div> : <EmptyState icon="grid" title="Aún no hay categorías" text="Al agregar un gasto podrán crear su categoría en el mismo formulario." />}</article>
            <article className="card stack"><div className="card-title"><h2>Control del presupuesto</h2></div><div className="row-between"><span className="muted">Estimado utilizado</span><strong>{cash(projected, currency)}</strong></div><Progress value={projected} max={budget} className="thick" /><div className="row-between"><span className="muted">Presupuesto disponible</span><strong>{cash(budget - spent, currency)}</strong></div><div className="divider" /><div className="row-between"><span className="muted">Cuotas próximas</span><strong>{cash(nextPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0), currency)}</strong></div></article>
          </section>
          {paymentsQ.data.length > 0 && <section className="card mb-2"><div className="card-title"><h2>Pagos programados</h2><small>{paymentsQ.data.filter((payment) => !payment.paid_at).length} pendientes</small></div><div className="list">{paymentsQ.data.map((payment) => { const expense = expensesQ.data.find((item) => item.id === payment.expense_id); return <div className="list-item" key={payment.id}><Icon name={payment.paid_at ? "check" : "calendar"} /><div className="grow"><strong>{payment.label}{expense ? ` · ${expense.description}` : ""}</strong><div className="tiny muted">{payment.due_date ?? "Sin vencimiento"}{payment.paid_at ? ` · Pagado ${payment.paid_at}` : " · Pendiente"}</div></div><strong>{cash(Number(payment.amount), currency)}</strong><button className={`btn btn-sm ${payment.paid_at ? "btn-secondary" : "btn-primary"}`} onClick={() => void togglePayment(payment)}>{payment.paid_at ? "Reabrir" : "Marcar pagada"}</button></div>; })}</div></section>}
          <section className="card mb-2"><div className="card-title"><h2>Presupuesto por categoría</h2><small>Se refleja en la distribución estimada</small></div>{categoriesQ.data.length ? <div className="list">{categoriesQ.data.map((category) => <label className="list-item category-budget-row" key={category.id}><span className="cat-icon" style={{ background: `${category.color}24`, color: category.color }}>{category.icon}</span><strong>{category.name}</strong><input className="input" type="number" min="0" step="1000" aria-label={`Presupuesto de ${category.name}`} defaultValue={category.budget} onBlur={(event) => void updateCategoryBudget(category.id, event.currentTarget.value)} /></label>)}</div> : <p className="small muted">Las categorías aparecerán cuando agregues el primer gasto.</p>}</section>
          <section className="card">
            <div className="row-between wrap mb-2"><Segmented value={tab} onChange={setTab} options={[{ value: "gastos", label: "Gastos", count: expensesQ.data.length }, { value: "proveedores", label: "Proveedores", count: vendorsQ.data.length }]} /><button className="btn btn-secondary btn-sm" onClick={() => { setError(""); setVendorModal(true); }}><Icon name="plus" />Agregar proveedor</button></div>
            {tab === "gastos" ? expensesQ.data.length ? <div style={{ overflowX: "auto" }}><table className="table"><thead><tr><th>Gasto</th><th>Categoría</th><th>Proveedor</th><th>Estado</th><th className="num">Estimado</th><th className="num">Real</th><th aria-label="Acciones" /></tr></thead><tbody>{expensesQ.data.map((expense) => <tr key={expense.id}><td><strong>{expense.description}</strong><div className="tiny muted">{expense.expense_date ? new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${expense.expense_date}T00:00:00Z`)) : "Sin fecha"}</div></td><td>{expense.categories?.name ?? "Sin categoría"}</td><td>{expense.vendors?.name ?? "—"}</td><td><span className={`badge ${expense.status === "pagado" ? "sage" : expense.status === "reservado" ? "mauve" : "muted"}`}>{expenseStatuses.find((item) => item.value === expense.status)?.label}</span></td><td className="num">{cash(Number(expense.estimated), currency)}</td><td className="num">{cash(Number(expense.actual), currency)}</td><td><div className="row"><button className="btn btn-ghost btn-icon" title="Administrar cuotas" aria-label={`Administrar cuotas de ${expense.description}`} onClick={() => { setPaymentExpense(expense); setError(""); }}><Icon name="calendar" /></button><button className="btn btn-ghost btn-icon danger-text" title="Eliminar gasto" aria-label={`Eliminar ${expense.description}`} onClick={() => void deleteExpense(expense)}><Icon name="trash" /></button></div></td></tr>)}</tbody></table></div> : <EmptyState icon="wallet" title="Todavía no hay gastos" text="Agreguen cotizaciones, reservas y pagos para ver cómo evoluciona el presupuesto." action={<button className="btn btn-primary" onClick={() => setExpenseModal(true)}><Icon name="plus" />Agregar primer gasto</button>} /> : vendorsQ.data.length ? <div className="list">{vendorsQ.data.map((vendor) => <article className="list-item" key={vendor.id}><div className="stat-icon sage"><Icon name="store" /></div><div className="grow"><strong>{vendor.name}</strong><div className="small muted">{vendor.service ?? "Servicio por definir"}{vendor.contact_name ? ` · ${vendor.contact_name}` : ""}</div><div className="tiny muted">{vendor.phone ?? vendor.email ?? "Sin datos de contacto"}</div></div><select className="select" aria-label={`Estado de ${vendor.name}`} value={vendor.status} onChange={(event) => void updateVendorStatus(vendor, event.target.value as Vendor["status"])}><option value="cotizando">Cotizando</option><option value="contratado">Contratado</option><option value="descartado">Descartado</option></select></article>)}</div> : <EmptyState icon="store" title="Aún no hay proveedores" text="Guarden contactos de banquetera, fotografía, música y otros servicios." action={<button className="btn btn-primary" onClick={() => setVendorModal(true)}><Icon name="plus" />Agregar proveedor</button>} />}
          </section>
          {tab === "gastos" && expensesQ.data.some((expense) => expense.receipt_path) && <section className="card mt-2"><div className="card-title"><h2>Comprobantes</h2></div><div className="list">{expensesQ.data.filter((expense) => expense.receipt_path).map((expense) => <div className="list-item" key={expense.id}><Icon name="file" /><strong className="grow">{expense.description}</strong><button className="btn btn-secondary btn-sm" onClick={() => void openDocument(expense.receipt_path!)}>Abrir comprobante</button></div>)}</div></section>}
          {tab === "proveedores" && vendorsQ.data.some((vendor) => vendor.contract_path) && <section className="card mt-2"><div className="card-title"><h2>Contratos</h2></div><div className="list">{vendorsQ.data.filter((vendor) => vendor.contract_path).map((vendor) => <div className="list-item" key={vendor.id}><Icon name="file" /><strong className="grow">{vendor.name}</strong><button className="btn btn-secondary btn-sm" onClick={() => void openDocument(vendor.contract_path!)}>Abrir contrato</button></div>)}</div></section>}
        </div>
      </main>

      <Modal open={expenseModal} onClose={() => setExpenseModal(false)} title="Agregar gasto" footer={<><button className="btn btn-secondary" onClick={() => setExpenseModal(false)}>Cancelar</button><button className="btn btn-primary" type="submit" form="expense-form" disabled={saving}><Icon name="check" />{saving ? "Guardando…" : "Guardar gasto"}</button></>}>
        <form id="expense-form" className="form-grid" onSubmit={addExpense}>
          <label className="field full"><span className="label">Descripción</span><input className="input" name="description" required maxLength={160} placeholder="Ej. Banquete para 100 personas" /></label>
          <label className="field"><span className="label">Categoría (puedes crear una)</span><input className="input" name="category_name" list="budget-categories" placeholder="Escribe o elige una" /><datalist id="budget-categories">{categoriesQ.data.map((category) => <option key={category.id} value={category.name} />)}</datalist></label>
          <label className="field"><span className="label">Color de categoría nueva</span><input className="input" name="category_color" type="color" defaultValue="#809684" /></label>
          <label className="field"><span className="label">Presupuesto de categoría nueva</span><input className="input" name="category_budget" type="number" min="0" step="1000" defaultValue="0" /></label>
          <label className="field"><span className="label">Proveedor</span><select className="select" name="vendor_id" defaultValue=""><option value="">Sin proveedor</option>{vendorsQ.data.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
          <label className="field"><span className="label">Estado</span><select className="select" name="status" defaultValue="cotizado">{expenseStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
          <label className="field"><span className="label">Monto estimado</span><input className="input" name="estimated" type="number" min="0" step="1" defaultValue="0" /></label>
          <label className="field"><span className="label">Monto real</span><input className="input" name="actual" type="number" min="0" step="1" defaultValue="0" /></label>
          <label className="field"><span className="label">¿Quién paga?</span><select className="select" name="paid_by" defaultValue="ambos"><option value="novio">Pato</option><option value="novia">Andrea</option><option value="ambos">Ambos</option></select></label>
          <label className="field"><span className="label">Fecha</span><input className="input" name="expense_date" type="date" /></label>
          <label className="field full"><span className="label">Comprobante (PDF o imagen, máx. 10 MB)</span><input className="input" name="receipt" type="file" accept="image/*,application/pdf" /></label>
          <label className="field full"><span className="label">Notas</span><textarea className="textarea" name="notes" maxLength={1000} /></label>
        </form>
      </Modal>

      <Modal open={vendorModal} onClose={() => setVendorModal(false)} title="Agregar proveedor" footer={<><button className="btn btn-secondary" onClick={() => setVendorModal(false)}>Cancelar</button><button className="btn btn-primary" type="submit" form="vendor-form" disabled={saving}><Icon name="check" />{saving ? "Guardando…" : "Guardar proveedor"}</button></>}>
        <form id="vendor-form" className="form-grid" onSubmit={addVendor}>
          <label className="field"><span className="label">Nombre del proveedor</span><input className="input" name="name" required maxLength={160} /></label>
          <label className="field"><span className="label">Servicio</span><input className="input" name="service" placeholder="Fotografía, música…" /></label>
          <label className="field"><span className="label">Contacto</span><input className="input" name="contact_name" /></label>
          <label className="field"><span className="label">Teléfono</span><input className="input" name="phone" type="tel" /></label>
          <label className="field"><span className="label">Correo</span><input className="input" name="email" type="email" /></label>
          <label className="field"><span className="label">Sitio web</span><input className="input" name="website" type="url" /></label>
          <label className="field full"><span className="label">Contrato (PDF o imagen, máx. 10 MB)</span><input className="input" name="contract" type="file" accept="image/*,application/pdf" /></label>
        </form>
      </Modal>

      <Modal open={Boolean(paymentExpense)} onClose={() => setPaymentExpense(null)} title={paymentExpense ? `Cuotas · ${paymentExpense.description}` : "Cuotas"}>
        {paymentExpense && <div className="stack"><div className="list">{paymentsQ.data.filter((payment) => payment.expense_id === paymentExpense.id).map((payment) => <div className="list-item" key={payment.id}><Icon name={payment.paid_at ? "check" : "calendar"} /><div className="grow"><strong>{payment.label}</strong><div className="tiny muted">{payment.due_date ?? "Sin fecha"}{payment.paid_at ? ` · Pagado ${payment.paid_at}` : " · Pendiente"}</div></div><strong>{cash(Number(payment.amount), currency)}</strong></div>)}</div>{!paymentsQ.data.some((payment) => payment.expense_id === paymentExpense.id) && <p className="muted small">Este gasto aún no tiene cuotas programadas.</p>}<div className="divider" /><h3>Programar cuota</h3><form id="payment-form" className="form-grid" onSubmit={addPayment}><label className="field"><span className="label">Descripción</span><input className="input" name="label" defaultValue="Cuota" required /></label><label className="field"><span className="label">Monto</span><input className="input" name="amount" type="number" min="1" step="1" required /></label><label className="field"><span className="label">Vencimiento</span><input className="input" name="due_date" type="date" /></label><label className="field"><span className="label">Paga</span><select className="select" name="paid_by" defaultValue={paymentExpense.paid_by}><option value="novio">Pato</option><option value="novia">Andrea</option><option value="ambos">Ambos</option></select></label><div className="full"><button className="btn btn-primary" type="submit" disabled={saving}><Icon name="plus" />{saving ? "Guardando…" : "Agregar cuota"}</button></div></form></div>}
      </Modal>
    </div>
  );
}