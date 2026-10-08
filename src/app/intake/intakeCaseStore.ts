import { useSyncExternalStore } from "react";

// ── Cases created from Case Intake ───────────────────────────────────────────
// The Case Intake list is the sample cases followed by every case the
// attorney creates, in creation order. Created cases live here rather than in
// the page's own state, so they survive leaving Case Intake (which unmounts
// the page), and are saved to the browser so they survive a refresh.

export interface CreatedIntakeCase {
  caseName: string;
  caseId: string;
  plaintiff: string;
  plaintiffEmail?: string;
  plaintiffPhone?: string;
  jurisdiction: string;
  summary: string;
  dateOfIncident?: string;
  caseType?: string;
  stage: string;
  progress: number;
  isReady: boolean;
  /** ISO timestamp — the card's "Updated" label is derived from it. */
  createdAt: string;
}

const STORAGE_KEY = "leco.intake.createdCases.v1";

function load(): CreatedIntakeCase[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let cases: CreatedIntakeCase[] = typeof window === "undefined" ? [] : load();
const listeners = new Set<() => void>();

function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
  } catch {
    // Storage unavailable (private window, blocked site data) — the cases
    // still persist for the rest of this session.
  }
}

/** Appends a case after every existing one. */
export function addIntakeCase(c: CreatedIntakeCase) {
  cases = [...cases, c];
  save();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCreatedIntakeCases(): CreatedIntakeCase[] {
  return useSyncExternalStore(subscribe, () => cases, () => cases);
}

/** The next case ID in the existing PI-2024-### format that no case uses. */
export function nextCaseId(existingIds: string[]): string {
  const taken = new Set(existingIds);
  for (let n = 1; ; n++) {
    const id = `PI-2024-${String(n).padStart(3, "0")}`;
    if (!taken.has(id)) return id;
  }
}

/** "Just now", "5 mins ago", "3 hours ago", "2 days ago". */
export function updatedLabel(iso: string, now = Date.now()): string {
  const mins = Math.floor((now - Date.parse(iso)) / 60000);
  if (!Number.isFinite(mins) || mins < 1) return "Just now";
  if (mins < 60) return `${mins} ${mins === 1 ? "min" : "mins"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
