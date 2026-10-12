export type Side = "novio" | "novia";
export type GuestSide = Side | "comun";
export type Who = Side | "ambos";

export interface Profile {
  id: string;
  display_name: string;
  side: Side | null;
}

export interface WeddingSettings {
  id: number;
  couple_names: string;
  wedding_date: string;
  venue: string | null;
  venue_address: string | null;
  total_budget: number;
  currency: string;
  rsvp_deadline: string | null;
  rsvp_open: boolean;
  rsvp_message: string | null;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  budget: number;
}

export type VendorStatus = "cotizando" | "contratado" | "descartado";

export interface Vendor {
  id: string;
  name: string;
  service: string | null;
  category_id: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  contract_path: string | null;
  rating: number | null;
  status: VendorStatus;
  notes: string | null;
  created_at: string;
}

export type ExpenseStatus = "cotizado" | "reservado" | "pagado";

export interface Expense {
  id: string;
  description: string;
  category_id: string | null;
  vendor_id: string | null;
  estimated: number;
  actual: number;
  status: ExpenseStatus;
  paid_by: Who;
  expense_date: string | null;
  receipt_path: string | null;
  notes: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  expense_id: string;
  label: string;
  amount: number;
  due_date: string | null;
  paid_at: string | null;
  paid_by: Who;
}

export type TaskStatus = "pendiente" | "en_curso" | "lista";
export type Priority = "baja" | "media" | "alta";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assignee: Who;
  due_date: string | null;
  status: TaskStatus;
  priority: Priority;
  category_id: string | null;
  completed_at: string | null;
  created_at: string;
}

export type AgreementStatus = "propuesto" | "aprobado" | "descartado";

export interface Agreement {
  id: string;
  title: string;
  description: string | null;
  topic: string | null;
  proposed_by: string | null;
  approved_novio: boolean;
  approved_novia: boolean;
  status: AgreementStatus;
  created_at: string;
  decided_at: string | null;
}

export interface GuestGroup {
  id: string;
  name: string;
  side: GuestSide;
  invite_code: string;
  notes: string | null;
}

export interface Guest {
  id: string;
  group_id: string | null;
  first_name: string;
  last_name: string;
  side: GuestSide;
  guest_type: "adulto" | "nino";
  phone: string | null;
  email: string | null;
  notes: string | null;
  plus_one_allowed: boolean;
  is_plus_one: boolean;
  plus_one_of: string | null;
  table_id: string | null;
  added_by: string | null;
  created_at: string;
}

export type Dietary =
  | "ninguna"
  | "vegetariano"
  | "vegano"
  | "celiaco"
  | "sin_lactosa"
  | "alergia"
  | "otra";

export interface Rsvp {
  guest_id: string;
  attending: boolean;
  dietary: Dietary;
  dietary_notes: string | null;
  song: string | null;
  message: string | null;
  source: "formulario" | "manual";
  responded_at: string;
}

export interface SeatingTable {
  id: string;
  name: string;
  capacity: number;
  shape: "redonda" | "rectangular";
  sort: number;
  notes: string | null;
}

export interface Gift {
  id: string;
  giver_name: string;
  guest_id: string | null;
  description: string | null;
  gift_type: "dinero" | "objeto" | "experiencia" | "otro";
  amount: number | null;
  received_at: string | null;
  thanked: boolean;
  notes: string | null;
}

export interface TimelineItem {
  id: string;
  start_time: string;
  end_time: string | null;
  title: string;
  description: string | null;
  location: string | null;
  responsible: string | null;
}
