"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { createClient } from "@/lib/supabase/client";
import type { Dietary } from "@/lib/types";

interface RsvpSettings {
  couple_names: string;
  wedding_date: string;
  venue: string | null;
  venue_address: string | null;
  rsvp_deadline: string | null;
  rsvp_open: boolean;
  rsvp_message: string | null;
}

interface Person {
  guest_id: string;
  full_name: string;
  guest_type?: string;
  plus_one_allowed: boolean;
  responded: boolean;
  attending: boolean | null;
  group_name?: string | null;
}

interface ResponseForm {
  attending: boolean;
  dietary: Dietary;
  dietary_notes: string;
  song: string;
  message: string;
  plus_one_name: string;
  plus_one_dietary: Dietary;
  plus_one_dietary_notes: string;
}

interface SearchResult {
  guest_id: string;
  full_name: string;
  group_id: string | null;
  group_name: string | null;
  responded: boolean;
}

const blankResponse = (): ResponseForm => ({ attending: true, dietary: "ninguna", dietary_notes: "", song: "", message: "", plus_one_name: "", plus_one_dietary: "ninguna", plus_one_dietary_notes: "" });
const dietOptions: { value: Dietary; label: string }[] = [{ value: "ninguna", label: "Sin restricciones" }, { value: "vegetariano", label: "Vegetariana" }, { value: "vegano", label: "Vegana" }, { value: "celiaco", label: "Celíaca" }, { value: "sin_lactosa", label: "Sin lactosa" }, { value: "alergia", label: "Alergia" }, { value: "otra", label: "Otra" }];

export function RsvpForm({ code }: { code?: string }) {
  const supabase = createClient();
  const [settings, setSettings] = useState<RsvpSettings | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [responses, setResponses] = useState<Record<string, ResponseForm>>({});
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error: infoError } = await supabase.rpc("rsvp_info");
      if (!active) return;
      if (infoError) setError("Las confirmaciones todavía no están disponibles. Intenta más tarde.");
      else setSettings((data?.[0] as RsvpSettings | undefined) ?? null);

      if (code) {
        const { data: codeData, error: codeError } = await supabase.rpc("rsvp_by_code", { p_code: code });
        if (!active) return;
        if (codeError) setError("No pudimos abrir este enlace. Revisa que el código sea correcto.");
        else if (codeData?.length) {
          const guests = (codeData as (Person & { group_name: string })[]).map((person) => ({ ...person, attending: person.attending ?? false }));
          setPeople(guests);
          setSelected(new Set(guests.map((person) => person.guest_id)));
          setResponses(Object.fromEntries(guests.map((person) => [person.guest_id, { ...blankResponse(), attending: person.attending ?? true }])));
        } else setError("No encontramos un grupo asociado a este enlace.");
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [code, supabase]);

  const weddingDate = useMemo(() => settings ? new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "America/Santiago" }).format(new Date(settings.wedding_date)) : "", [settings]);

  async function searchGuests(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim().length < 3) {
      setError("Escribe al menos 3 letras para buscar.");
      return;
    }
    setSearching(true);
    setError("");
    const { data, error: searchError } = await supabase.rpc("rsvp_search", { p_query: query.trim() });
    setResults((data as SearchResult[] | null) ?? []);
    if (searchError) setError("No pudimos realizar la búsqueda. Intenta de nuevo.");
    else if (!data?.length) setError("No encontramos coincidencias. Prueba con otro nombre o apellido.");
    setSearching(false);
  }

  async function loadFamily(result: SearchResult) {
    setError("");
    const { data, error: groupError } = await supabase.rpc("rsvp_group_members", { p_guest_id: result.guest_id });
    if (groupError) {
      setError("No pudimos cargar el grupo familiar.");
      return;
    }
    const family = (data as Person[] | null) ?? [];
    setPeople((current) => [...current.filter((person) => !family.some((member) => member.guest_id === person.guest_id)), ...family]);
    setSelected((current) => new Set([...current, result.guest_id]));
    setResponses((current) => ({ ...current, ...Object.fromEntries(family.map((person) => [person.guest_id, { ...blankResponse(), attending: person.attending ?? true }])) }));
  }

  function updateResponse(id: string, patch: Partial<ResponseForm>) {
    setResponses((current) => ({ ...current, [id]: { ...blankResponse(), ...current[id], ...patch } }));
  }

  async function submitRsvp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosen = people.filter((person) => selected.has(person.guest_id));
    if (!chosen.length) {
      setError("Selecciona al menos una persona para responder.");
      return;
    }
    setSubmitting(true);
    setError("");
    const payload = chosen.map((person) => {
      const response = responses[person.guest_id] ?? blankResponse();
      return {
        guest_id: person.guest_id,
        attending: response.attending,
        dietary: response.dietary,
        dietary_notes: response.dietary_notes,
        song: response.song,
        message: response.message,
        plus_one_name: person.plus_one_allowed && response.attending ? response.plus_one_name : null,
        plus_one_dietary: response.plus_one_dietary,
        plus_one_dietary_notes: response.plus_one_dietary_notes,
      };
    });
    const { error: submitError } = await supabase.rpc("rsvp_submit", { p_responses: payload });
    if (submitError) setError(submitError.message.includes("cerrado") ? "El plazo para responder ya terminó." : "No pudimos guardar tus respuestas. Intenta nuevamente.");
    else setSubmitted(true);
    setSubmitting(false);
  }

  const open = settings?.rsvp_open ?? true;

  return <main className="rsvp-page">
    <Image className="rsvp-floral" src="/img/floral-corner.jpg" alt="" width={520} height={520} priority />
    <Image className="rsvp-floral right" src="/img/floral-corner.jpg" alt="" width={520} height={520} />
    <div className="rsvp-container">
      <header className="rsvp-header"><div className="eyebrow">Con mucho cariño</div><h1>{settings?.couple_names ?? "Pato & Andrea"}</h1><div className="date">{weddingDate || "22 de marzo de 2027"}</div>{settings?.venue && <p className="small muted mt-1">{settings.venue}{settings.venue_address ? ` · ${settings.venue_address}` : ""}</p>}<div className="ornament"><Icon name="ring" /></div><p>{settings?.rsvp_message ?? "Nos encantaría que nos acompañes en este día tan especial."}</p></header>
      {loading ? <div className="person-form"><p className="muted">Cargando invitación…</p></div> : submitted ? <section className="person-form" role="status"><div className="success-burst"><Icon name="check" /></div><h2 className="serif" style={{ textAlign: "center" }}>¡Gracias por responder!</h2><p className="muted mt-2" style={{ textAlign: "center" }}>Guardamos tus respuestas. Nos vemos pronto.</p></section> : !open ? <section className="person-form"><h2 className="serif">Confirmaciones cerradas</h2><p className="muted mt-1">El plazo para confirmar asistencia ya terminó. Gracias por acompañarnos.</p></section> : <>
        {!code && <section className="person-form"><h2 className="serif">Confirma tu asistencia</h2><p className="small muted mt-1">Busca tu nombre para abrir tu invitación.</p><form className="row mt-2" onSubmit={searchGuests}><label className="field grow"><span className="label">Nombre o apellido</span><input className="input" minLength={3} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Escribe al menos 3 letras" /></label><button className="btn btn-primary" type="submit" disabled={searching}><Icon name="search" />{searching ? "Buscando…" : "Buscar"}</button></form>{results.length > 0 && <div className="search-results">{results.map((result) => <button className="search-result" key={result.guest_id} onClick={() => void loadFamily(result)}><span className="grow"><strong>{result.full_name}</strong>{result.group_name && <span className="small muted" style={{ display: "block" }}>{result.group_name}</span>}</span><span className="small">Elegir <Icon name="chevronRight" /></span></button>)}</div>}</section>}
        {people.length > 0 && <form className="stack mt-2" onSubmit={submitRsvp}><div className="row-between wrap"><h2 className="serif">Personas de la invitación</h2><span className="small muted">Selecciona a quienes responderás</span></div>{people.map((person) => {
          const response = responses[person.guest_id] ?? blankResponse();
          const isSelected = selected.has(person.guest_id);
          return <section className={`person-form ${isSelected ? "selected" : ""}`} key={person.guest_id}><label className="check"><input type="checkbox" checked={isSelected} onChange={(event) => setSelected((current) => { const next = new Set(current); if (event.target.checked) next.add(person.guest_id); else next.delete(person.guest_id); return next; })} /><strong>{person.full_name}</strong></label>{person.responded && <span className="badge sage">Respuesta anterior</span>}{isSelected && <div className="stack mt-2"><label className="check"><input type="checkbox" checked={response.attending} onChange={(event) => updateResponse(person.guest_id, { attending: event.target.checked })} /><span>{response.attending ? "Sí, asistiré" : "No podré asistir"}</span></label>{response.attending && <><div className="form-grid"><label className="field"><span className="label">Restricción alimentaria</span><select className="select" value={response.dietary} onChange={(event) => updateResponse(person.guest_id, { dietary: event.target.value as Dietary })}>{dietOptions.map((diet) => <option key={diet.value} value={diet.value}>{diet.label}</option>)}</select></label><label className="field"><span className="label">Detalle / alergia</span><input className="input" value={response.dietary_notes} onChange={(event) => updateResponse(person.guest_id, { dietary_notes: event.target.value })} maxLength={300} /></label><label className="field"><span className="label">Canción sugerida</span><input className="input" value={response.song} onChange={(event) => updateResponse(person.guest_id, { song: event.target.value })} maxLength={200} placeholder="Una canción para bailar" /></label></div>{person.plus_one_allowed && <div className="info-box"><label className="field"><span className="label">Nombre de tu acompañante (+1, opcional)</span><input className="input" value={response.plus_one_name} onChange={(event) => updateResponse(person.guest_id, { plus_one_name: event.target.value })} maxLength={120} /></label></div>}</>}<label className="field"><span className="label">Mensaje para los novios</span><textarea className="textarea" value={response.message} onChange={(event) => updateResponse(person.guest_id, { message: event.target.value })} maxLength={1000} /></label></div>}</section>;
        })}<button className="btn btn-primary btn-block btn-lg" type="submit" disabled={submitting}><Icon name="check" />{submitting ? "Enviando…" : "Enviar confirmación"}</button></form>}
      </>}
      {error && <p className="error-box mt-2" role="alert">{error}</p>}
      {settings?.rsvp_deadline && <p className="small muted mt-2" style={{ textAlign: "center" }}>Responde antes del {new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${settings.rsvp_deadline}T00:00:00Z`))}.</p>}
    </div>
  </main>;
}