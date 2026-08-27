import { createContext, useContext, useState, ReactNode } from "react";

// ── Chronology store ──────────────────────────────────────────────────────────
// Lives above both the Case Workspace and the AI Assistant so either can write
// to the same timeline. Nothing here is applied without the attorney: the
// assistant only ever proposes, and these setters run on approval.

export type Provenance = "system" | "user" | "ai-generated" | "ai-modified" | "user-edited";

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  system: "System Generated",
  user: "User Added",
  "ai-generated": "AI Generated",
  "ai-modified": "AI Modified",
  "user-edited": "User Edited",
};

// One entry in an event's audit trail. Previous wording is kept, never replaced.
export interface ChronVersion {
  version: number;
  label: string;          // "System Generated" | "AI Modified" | "Attorney Edited"
  at: string;
  by: string;             // "AI Assistant" | attorney name
  approvedBy?: string;
  reason?: string;
  sources?: string[];
  snapshot: { title: string; description: string; date: string; time?: string };
}

// An event the attorney or the assistant added. Shaped to drop straight into a
// chronology card.
export interface ChronAddition {
  id: string;
  kind: "medical" | "event";
  date: string;
  time?: string;
  title: string;
  description: string;
  insight: string;
  evidence: string[];
  evidencePage?: string;
  category?: string;
  taxonomy?: { eventType: "medical" | "case"; category: string; subcategory?: string; tags: string[] };
  details?: { label: string; value: string }[];
  provenance: Provenance;
  addedBy: string;
  addedAt: string;
  history: ChronVersion[];
}

// A change applied on top of a seeded event. The original stays in history.
export interface ChronOverride {
  key: string;            // the seeded event title
  kind: "medical" | "event";
  patch: { title?: string; description?: string; date?: string; time?: string };
  provenance: Provenance;
  history: ChronVersion[];
}

interface Value {
  additions: ChronAddition[];
  overrides: Record<string, ChronOverride>;
  addEvent: (e: ChronAddition) => void;
  applyOverride: (o: ChronOverride) => void;
  reset: () => void;
}

const Ctx = createContext<Value | null>(null);

export function ChronologyProvider({ children }: { children: ReactNode }) {
  const [additions, setAdditions] = useState<ChronAddition[]>([]);
  const [overrides, setOverrides] = useState<Record<string, ChronOverride>>({});

  const value: Value = {
    additions,
    overrides,
    addEvent: (e) => setAdditions((prev) => [...prev, e]),
    // A second change to the same event appends to the existing trail rather
    // than starting a new one, so the full lineage survives.
    applyOverride: (o) =>
      setOverrides((prev) => {
        const existing = prev[o.key];
        return {
          ...prev,
          [o.key]: existing
            ? { ...o, patch: { ...existing.patch, ...o.patch }, history: [...existing.history, ...o.history.slice(-1)] }
            : o,
        };
      }),
    reset: () => { setAdditions([]); setOverrides({}); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useChronology(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useChronology must be used inside ChronologyProvider");
  return v;
}

// Safe outside the provider, for components that may render without it.
export function useChronologyOptional(): Value | null {
  return useContext(Ctx);
}

const now = () =>
  new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export const versionStamp = now;
