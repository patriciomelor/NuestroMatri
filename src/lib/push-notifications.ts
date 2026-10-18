export type PushEvent =
  | "test"
  | "rsvp_received"
  | "group_added"
  | "guest_added"
  | "guest_removed"
  | "rsvp_changed"
  | "task_added"
  | "task_updated"
  | "task_removed"
  | "timeline_added"
  | "timeline_removed"
  | "table_added"
  | "table_updated"
  | "table_removed"
  | "agreement_added"
  | "agreement_updated"
  | "expense_added"
  | "expense_removed"
  | "vendor_added"
  | "vendor_updated"
  | "payment_added"
  | "payment_updated"
  | "category_added"
  | "category_updated"
  | "gift_added"
  | "gift_updated"
  | "collaborator_invited"
  | "settings_updated";

export async function notifyCollaborators(event: PushEvent, subject?: string) {
  try {
    await fetch("/api/push/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, subject }),
    });
  } catch {
    // La notificación no debe invalidar una operación ya guardada.
  }
}