import type { ProfileRole } from "@/lib/types";

const plannerPaths = ["/invitados", "/confirmaciones", "/tareas", "/cronograma", "/mesas"];
const bridesmaidPaths = ["/tareas", "/cronograma"];

export function homeForRole(role: ProfileRole) {
  if (role === "wedding_planner") return "/invitados";
  if (role === "bridesmaid") return "/tareas";
  return "/";
}

export function roleCanAccessPath(role: ProfileRole, path: string) {
  if (role === "couple") return true;
  const allowedPaths = role === "wedding_planner" ? plannerPaths : bridesmaidPaths;
  return allowedPaths.includes(path);
}