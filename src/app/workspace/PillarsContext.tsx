import { createContext, useContext, useState, ReactNode } from "react";

// ── Negligence pillars ────────────────────────────────────────────────────────
// The legal elements of the negligence case, and the operations that change
// them. Lives above the Negligence stage so a rename reaches every place the
// pillar is referenced — the cards, the evidence workspace, the insight panels —
// from one edit rather than several.
//
// The AI's own analysis is never overwritten. `insight` and `confidence` are what
// the AI produced against the wording it was given; when an attorney rewrites
// that wording the analysis is marked stale rather than silently re-presented as
// though it still described the text on screen.

export type PillarProvenance = "ai-generated" | "ai-modified" | "user-created" | "user-modified";

export const PILLAR_PROVENANCE_LABEL: Record<PillarProvenance, string> = {
  "ai-generated": "AI Generated",
  "ai-modified": "AI Modified",
  "user-created": "Attorney Created",
  "user-modified": "Attorney Modified",
};

export interface PillarItem {
  id: string;
  /** The displayed pillar number — "01", "02" … Renumbered on delete. */
  no: string;
  title: string;
  /** The question the pillar answers — "What was expected?" */
  subtitle: string;
  /** The legal analysis. */
  body: string;
  /** The AI's summary of the supporting documents. Attorney-editable content
   *  does not rewrite it; editing the analysis marks it stale instead. */
  insight: string;
  confidence: number;
  docCount: number;
  docs: string[];
  iconKey: string;
  provenance: PillarProvenance;
  /** True once the wording the AI analysed has been changed by hand. */
  aiStale: boolean;
  addedBy?: string;
  addedAt?: string;
}

export type PillarAction =
  | "created" | "renamed" | "question" | "analysis"
  | "evidence-added" | "evidence-removed" | "deleted";

export const PILLAR_ACTION_LABEL: Record<PillarAction, string> = {
  created: "Pillar created",
  renamed: "Pillar renamed",
  question: "Question changed",
  analysis: "Analysis changed",
  "evidence-added": "Supporting document added",
  "evidence-removed": "Supporting document removed",
  deleted: "Pillar deleted",
};

export interface PillarAudit {
  id: string;
  pillarId: string;
  action: PillarAction;
  pillar: string;             // the title as it read at the time
  previous?: string;
  next?: string;
  changedBy: string;
  at: string;
  reason?: string;
}

export interface PillarActor { name: string; kind: "attorney" | "ai" }
export const attorneyPillarActor = (name: string): PillarActor => ({ name, kind: "attorney" });

// Provenance follows the actor and remembers where the pillar came from: an AI
// pillar an attorney edits becomes Attorney Modified, not Attorney Created.
const provenanceAfterEdit = (before: PillarProvenance, actor: PillarActor): PillarProvenance => {
  if (actor.kind === "ai") return before === "user-created" ? "user-created" : "ai-modified";
  return before === "user-created" ? "user-created" : "user-modified";
};

/** A pillar being created. The store fills in numbering, provenance and authorship. */
export type NewPillar = Omit<PillarItem, "no" | "provenance" | "aiStale" | "addedBy" | "addedAt">;

const numbered = (i: number) => String(i + 1).padStart(2, "0");

// ── Seed ──────────────────────────────────────────────────────────────────────
// The four elements the AI put on the case. Exported so module-level consumers
// (stage citations) can read the documents without the store.

export const PILLAR_SEED: PillarItem[] = [
  {
    id: "duty-of-care", no: "01", title: "Duty of Care", subtitle: "What was expected?",
    iconKey: "shield", confidence: 97, provenance: "ai-generated", aiStale: false,
    body: "Under Texas Nursing Standards and the facility's custodial care agreement, staff were required to administer physician-prescribed Plavix continuously, monitor neurological symptoms, and initiate emergency stroke protocols without delay.",
    insight: "Physician orders, the custodial care agreement, and Texas nursing standards together establish a clear, non-discretionary duty to medicate and monitor the resident.",
    docCount: 5,
    docs: ["Physician_Prescription_Orders.pdf", "Custodial_Care_Agreement.pdf", "Texas_Nursing_Standards.pdf"],
  },
  {
    id: "breach-of-duty", no: "02", title: "Breach of Duty", subtitle: "What failed?",
    iconKey: "alert", confidence: 98, provenance: "ai-generated", aiStale: false,
    body: "The facility failed to administer prescribed medication for five consecutive days and delayed emergency stroke response, violating accepted nursing standards and physician instructions.",
    insight: "The medication record and pharmacy log show five consecutive missed Plavix doses, and the stroke-protocol checklist was never initiated — a documented departure from the required standard of care.",
    docCount: 18,
    docs: ["Medication_Administration_Record.pdf", "Pharmacy_Dispensing_Log.pdf", "Nursing_Shift_Notes.pdf", "Stroke_Protocol_Checklist.pdf"],
  },
  {
    id: "causation", no: "03", title: "Causation", subtitle: "How did the breach lead to the injury?",
    iconKey: "activity", confidence: 96, provenance: "ai-generated", aiStale: false,
    body: "The prolonged medication omission and delayed emergency response directly contributed to arterial thrombosis, irreversible neurological damage, and the plaintiff's catastrophic injuries.",
    insight: "Neurology and admission records tie the medication omission and the 2.5-hour dispatch delay directly to the ischemic stroke and its irreversible progression.",
    docCount: 9,
    docs: ["Neurology_Consultation_Report.pdf", "Hospital_Admission_Records.pdf", "EMS_Dispatch_Report.pdf"],
  },
  {
    id: "damages", no: "04", title: "Damages", subtitle: "What harm resulted?",
    iconKey: "heart", confidence: 99, provenance: "ai-generated", aiStale: false,
    body: "The negligence resulted in permanent neurological impairment, loss of independence, extensive medical treatment, significant emotional suffering, and ultimately wrongful death.",
    insight: "Admission records, the neurology report, and the death certificate document permanent neurological impairment and the ultimate wrongful death resulting from the negligence.",
    docCount: 7,
    docs: ["Hospital_Admission_Records.pdf", "Neurology_Consultation_Report.pdf", "Death_Certificate.pdf"],
  },
];

// ── The operations ────────────────────────────────────────────────────────────
// Three operations, and nothing else writes to a pillar. Deleting one never
// touches its documents: a pillar cites evidence, and dropping the pillar
// releases the citation while the files stay on the case.

interface Value {
  pillars: PillarItem[];
  audit: PillarAudit[];
  /** The trail for one pillar, oldest first. */
  historyFor: (id: string) => PillarAudit[];
  /** True where any pillar's AI analysis no longer matches its wording. */
  anyStale: boolean;

  createPillar: (draft: NewPillar, actor: PillarActor, reason?: string) => void;
  updatePillar: (id: string, patch: Partial<PillarItem>, actor: PillarActor, reason?: string) => void;
  deletePillar: (id: string, actor: PillarActor, reason?: string) => void;

  reset: () => void;
}

const Ctx = createContext<Value | null>(null);

const now = () =>
  new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export const pillarStamp = now;

// Numbering stays sequential and gap-free after a delete, so the cards read
// 01–04 rather than 01, 02, 04.
const renumber = (list: PillarItem[]): PillarItem[] =>
  list.map((p, i) => (p.no === numbered(i) ? p : { ...p, no: numbered(i) }));

export function PillarsProvider({ children }: { children: ReactNode }) {
  const [pillars, setPillars] = useState<PillarItem[]>(PILLAR_SEED);
  const [audit, setAudit] = useState<PillarAudit[]>([]);

  const record = (entries: Omit<PillarAudit, "id" | "at">[]) =>
    setAudit((prev) => [
      ...prev,
      ...entries.map((e, i) => ({
        ...e,
        at: now(),
        id: `pa-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      })),
    ]);

  const value: Value = {
    pillars,
    audit,
    historyFor: (id) => audit.filter((a) => a.pillarId === id),
    anyStale: pillars.some((p) => p.aiStale),

    createPillar: (draft, actor, reason) => {
      setPillars((prev) => renumber([
        ...prev,
        {
          ...draft,
          no: numbered(prev.length),
          provenance: actor.kind === "ai" ? "ai-generated" : "user-created",
          // Attorney wording has never been AI-analysed, so there is no AI
          // analysis to be stale — the card simply shows none.
          aiStale: false,
          addedBy: actor.name,
          addedAt: now(),
        },
      ]));
      record([{
        pillarId: draft.id, action: "created", pillar: draft.title,
        next: draft.title, changedBy: actor.name, reason,
      }]);
    },

    // One entry per field that actually moved, so the trail says what changed
    // rather than that something did.
    updatePillar: (id, patch, actor, reason) => {
      const before = pillars.find((p) => p.id === id);
      if (!before) return;
      const entries: Omit<PillarAudit, "id" | "at">[] = [];
      const note = (action: PillarAction, previous: string, next: string) => {
        if (previous !== next) {
          entries.push({ pillarId: id, action, pillar: before.title, previous, next, changedBy: actor.name, reason });
        }
      };
      if (patch.title !== undefined) note("renamed", before.title, patch.title);
      if (patch.subtitle !== undefined) note("question", before.subtitle, patch.subtitle);
      if (patch.body !== undefined) note("analysis", before.body, patch.body);
      if (patch.docs !== undefined) {
        const had = new Set(before.docs);
        const has = new Set(patch.docs);
        for (const d of patch.docs) {
          if (!had.has(d)) entries.push({ pillarId: id, action: "evidence-added", pillar: before.title, next: d, changedBy: actor.name, reason });
        }
        for (const d of before.docs) {
          if (!has.has(d)) entries.push({ pillarId: id, action: "evidence-removed", pillar: before.title, previous: d, changedBy: actor.name, reason });
        }
      }
      if (entries.length === 0) return;

      // The AI's summary and confidence describe the wording it was given. Once
      // that wording changes by hand they are stale, and the card says so rather
      // than presenting them as current.
      const wordingChanged = entries.some((e) => e.action === "renamed" || e.action === "question" || e.action === "analysis");

      setPillars((prev) => renumber(prev.map((p) =>
        p.id === id
          ? {
              ...p,
              ...patch,
              provenance: provenanceAfterEdit(p.provenance, actor),
              aiStale: p.aiStale || (wordingChanged && actor.kind === "attorney"),
            }
          : p,
      )));
      record(entries);
    },

    deletePillar: (id, actor, reason) => {
      const before = pillars.find((p) => p.id === id);
      if (!before) return;
      setPillars((prev) => renumber(prev.filter((p) => p.id !== id)));
      record([{
        pillarId: id, action: "deleted", pillar: before.title,
        previous: before.title, changedBy: actor.name, reason,
      }]);
    },

    reset: () => { setPillars(PILLAR_SEED); setAudit([]); },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePillars(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePillars must be used inside PillarsProvider");
  return v;
}

// Safe outside the provider, for components that may render without it.
export function usePillarsOptional(): Value | null {
  return useContext(Ctx);
}
