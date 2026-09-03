import { createContext, useContext, useMemo, useState, ReactNode } from "react";

// ── Damages store ─────────────────────────────────────────────────────────────
// Lives above both the Damages Analysis stage and the AI Assistant so either can
// write to the same damage record. Nothing here is applied without the attorney:
// the assistant only ever proposes, and these setters run on confirmation.
//
// Every write also appends an audit entry, so how a figure came to be is always
// answerable from the record itself.

export const formatDamageUSD = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export type DamageBucket = "economic" | "noneconomic";

export const BUCKET_LABEL: Record<DamageBucket, string> = {
  economic: "Economic Damages",
  noneconomic: "Non-Economic Damages",
};

// How a record came to hold its current values. Deliberately separate from
// `verified`, which describes the evidence rather than the authorship — an
// AI-modified damage can still be a verified one.
export type DamageProvenance = "system" | "user" | "ai-created" | "ai-modified" | "user-edited";

export const DAMAGE_PROVENANCE_LABEL: Record<DamageProvenance, string> = {
  system: "System Generated",
  user: "Attorney Created",
  "ai-created": "AI Created",
  "ai-modified": "AI Modified",
  "user-edited": "Attorney Edited",
};

// One damage line item. These are the fields the stage already renders, so the
// assistant edits the real model rather than a parallel one.
export interface DamageItem {
  id: string;
  label: string;              // "Medical Expenses"
  bucket: DamageBucket;
  amount: number;
  description: string;        // one-line summary shown under the label
  category: string;           // damage type — "Medical Bills", "Lost Wages" …
  reasoning: string;          // supporting information behind the figure
  notes?: string;             // attorney/assistant notes, added on demand
  docs: string[];             // supporting evidence
  docCount: number;
  iconKey: string;
  provenance: DamageProvenance;
  verified: boolean;
  addedBy?: string;
  addedAt?: string;
}

// The fields the assistant is allowed to change, named as the attorney would
// name them. Anything not on this list is not editable through chat.
export type DamageField = "amount" | "description" | "category" | "reasoning" | "notes" | "docs";

export const DAMAGE_FIELD_LABEL: Record<DamageField, string> = {
  amount: "Amount",
  description: "Description",
  category: "Damage Type",
  reasoning: "Supporting Information",
  notes: "Notes",
  docs: "Supporting Evidence",
};

export type DamageAction = "created" | "edited" | "moved" | "deleted";

export const DAMAGE_ACTION_LABEL: Record<DamageAction, string> = {
  created: "Created",
  edited: "Edited",
  moved: "Moved",
  deleted: "Deleted",
};

// One entry in the damages audit trail. A move records from/to, a delete records
// the amount removed, an edit records the field and both values.
export interface DamageAudit {
  id: string;
  /** The damage this entry belongs to. Survives a rename, unlike the label. */
  damageId: string;
  action: DamageAction;
  damage: string;             // the label as it read at the time
  field?: string;
  previous?: string;
  next?: string;
  from?: string;
  to?: string;
  amount?: string;
  changedBy: string;          // "AI Assistant" | attorney name
  /** Only set when someone other than the actor asked for the change. */
  requestedBy?: string;
  at: string;
  reason: string;             // the instruction or note behind the change
}

// ── Who is making the change ──────────────────────────────────────────────────
// Both the stage's own controls and the AI Assistant call the same operations;
// the actor is what distinguishes them, in the provenance and in the trail.

export interface DamageActor {
  /** Shown as "Changed by". */
  name: string;
  kind: "attorney" | "ai";
  /** For an AI change, the attorney who asked for it. */
  requestedBy?: string;
}

export const attorneyActor = (name: string): DamageActor => ({ name, kind: "attorney" });
export const aiActor = (requestedBy: string): DamageActor => ({ name: "AI Assistant", kind: "ai", requestedBy });

// Provenance says how a record came to hold its current values, so it follows
// the actor. It never touches `verified`, which is about the evidence.
const provenanceFor = (actor: DamageActor, action: "create" | "modify"): DamageProvenance =>
  action === "create"
    ? (actor.kind === "ai" ? "ai-created" : "user")
    : (actor.kind === "ai" ? "ai-modified" : "user-edited");

// One field that changed, for the trail. The UI collects these by diffing the
// form against the record, so an edit records only what actually moved.
export interface FieldChange { field: string; previous: string; next: string }

/** A damage being created. The store fills in provenance and authorship. */
export type NewDamage = Omit<DamageItem, "provenance" | "addedBy" | "addedAt">;

// ── Seed ──────────────────────────────────────────────────────────────────────
// The damages already on file. Kept here rather than in the stage so the store
// and the stage cannot drift apart, and so module-level helpers that need the
// figures (document billing, stage citations) can read them without the store.

export const DAMAGE_SEED: DamageItem[] = [
  {
    id: "medical-expenses", label: "Medical Expenses", bucket: "economic", amount: 87500,
    description: "Emergency, hospital, imaging & physician bills",
    category: "Medical Bills",
    reasoning: "Every charge traces to an itemized billing document and reconciles to the verified total with no duplicates.",
    docs: ["Hospital_Bill.pdf", "hospital_medical_records.pdf", "ER_Bills.pdf", "MRI_Report_2026.pdf"],
    docCount: 18, iconKey: "stethoscope", provenance: "system", verified: true,
  },
  {
    id: "lost-wages", label: "Lost Wages", bucket: "economic", amount: 43200,
    description: "Documented income loss during treatment",
    category: "Lost Wages",
    reasoning: "Verified against employer payroll records and the plaintiff's pre-incident earnings history.",
    docs: ["Wage_Loss_Statement.pdf", "Employer_Payroll_Records.pdf"],
    docCount: 6, iconKey: "dollar", provenance: "system", verified: true,
  },
  {
    id: "future-medical-care", label: "Future Medical Care", bucket: "economic", amount: 18750,
    description: "Projected ongoing medical management",
    category: "Future Medical Care",
    reasoning: "Projected from the life-care plan and corroborating treating-physician cost estimates.",
    docs: ["Life_Care_Plan.pdf", "Treating_Physician_Estimate.pdf"],
    docCount: 9, iconKey: "heart", provenance: "system", verified: true,
  },
  {
    id: "physical-therapy", label: "Physical Therapy", bucket: "economic", amount: 6000,
    description: "Physical therapy & rehabilitation program",
    category: "Rehabilitation",
    reasoning: "Substantiated by the documented physical-therapy treatment record and invoices.",
    docs: ["PT_Treatment_Notes.pdf", "Therapy_Invoices.pdf"],
    docCount: 12, iconKey: "activity", provenance: "system", verified: true,
  },
  {
    id: "transportation", label: "Transportation", bucket: "economic", amount: 3850,
    description: "Mileage & medical travel costs",
    category: "Transportation",
    reasoning: "Mileage and medical-travel expenses tied to documented appointments at the standard reimbursement rate.",
    docs: ["Mileage_Log.pdf"],
    docCount: 5, iconKey: "pin", provenance: "system", verified: true,
  },
  {
    id: "other-expenses", label: "Other Expenses", bucket: "economic", amount: 2150,
    description: "Assistive devices & out-of-pocket costs",
    category: "Other Damages",
    reasoning: "Assistive devices and out-of-pocket costs, each backed by an itemized receipt.",
    docs: ["Out_of_Pocket_Receipts.pdf"],
    docCount: 4, iconKey: "clipboard", provenance: "system", verified: true,
  },
];

// ── The operations ────────────────────────────────────────────────────────────
// Four operations, and nothing else writes to the damage record. The stage's own
// controls and the AI Assistant both call these, which is what keeps provenance,
// the audit trail and the recalculated totals consistent between them.
//
// No operation touches the case's documents. A damage holds references to
// supporting evidence; deleting or moving the damage releases the reference and
// leaves the document itself on the case file.
interface Value {
  items: DamageItem[];
  audit: DamageAudit[];
  /** Live subtotals — every consumer recalculates from these, never from a constant. */
  economicTotal: number;
  nonEconomicItemsTotal: number;
  itemsIn: (bucket: DamageBucket) => DamageItem[];
  /** The trail for one damage, newest last. */
  historyFor: (id: string) => DamageAudit[];

  createDamage: (draft: NewDamage, actor: DamageActor, reason: string) => void;
  /** `changes` is what actually moved, already diffed by the caller. */
  updateDamage: (id: string, patch: Partial<DamageItem>, changes: FieldChange[], actor: DamageActor, reason: string) => void;
  moveDamage: (id: string, bucket: DamageBucket, actor: DamageActor, reason: string) => void;
  deleteDamage: (id: string, actor: DamageActor, reason: string) => void;

  reset: () => void;
}

const Ctx = createContext<Value | null>(null);

const now = () =>
  new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export const damageStamp = now;

export function DamagesProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<DamageItem[]>(DAMAGE_SEED);
  const [audit, setAudit] = useState<DamageAudit[]>([]);

  // Every write funnels through here, so no operation can change the record
  // without leaving a trail.
  const record = (entries: Omit<DamageAudit, "id" | "at">[]) =>
    setAudit((prev) => [
      ...prev,
      ...entries.map((e, i) => ({
        ...e,
        at: now(),
        id: `da-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      })),
    ]);

  // "Requested by" is only meaningful when it differs from who made the change.
  const stampOf = (actor: DamageActor) => ({
    changedBy: actor.name,
    requestedBy: actor.requestedBy && actor.requestedBy !== actor.name ? actor.requestedBy : undefined,
  });

  const economicTotal = useMemo(
    () => items.filter((i) => i.bucket === "economic").reduce((s, i) => s + i.amount, 0),
    [items],
  );
  const nonEconomicItemsTotal = useMemo(
    () => items.filter((i) => i.bucket === "noneconomic").reduce((s, i) => s + i.amount, 0),
    [items],
  );

  const value: Value = {
    items,
    audit,
    economicTotal,
    nonEconomicItemsTotal,
    itemsIn: (bucket) => items.filter((i) => i.bucket === bucket),
    historyFor: (id) => audit.filter((a) => a.damageId === id),

    createDamage: (draft, actor, reason) => {
      const item: DamageItem = {
        ...draft,
        provenance: provenanceFor(actor, "create"),
        addedBy: actor.requestedBy && actor.requestedBy !== actor.name
          ? `${actor.name}, for ${actor.requestedBy}`
          : actor.name,
        addedAt: now(),
      };
      setItems((prev) => [...prev, item]);
      record([{
        damageId: item.id, action: "created", damage: item.label,
        next: formatDamageUSD(item.amount), to: BUCKET_LABEL[item.bucket],
        ...stampOf(actor), reason,
      }]);
    },

    // An edit marks how the record changed and leaves its verification status
    // alone — provenance says how it changed, not whether the evidence still
    // stands behind it. Only the fields in `patch` move; nothing else is touched.
    updateDamage: (id, patch, changes, actor, reason) => {
      const before = items.find((i) => i.id === id);
      if (!before || changes.length === 0) return;
      setItems((prev) => prev.map((i) =>
        i.id === id ? { ...i, ...patch, provenance: provenanceFor(actor, "modify") } : i,
      ));
      record(changes.map((c) => ({
        damageId: id, action: "edited" as const, damage: patch.label ?? before.label,
        field: c.field, previous: c.previous, next: c.next,
        ...stampOf(actor), reason,
      })));
    },

    // The same record with a different bucket — never a delete and a re-create,
    // so the damage keeps its id, its evidence and its history.
    moveDamage: (id, bucket, actor, reason) => {
      const before = items.find((i) => i.id === id);
      if (!before || before.bucket === bucket) return;
      setItems((prev) => prev.map((i) =>
        i.id === id ? { ...i, bucket, provenance: provenanceFor(actor, "modify") } : i,
      ));
      record([{
        damageId: id, action: "moved", damage: before.label,
        from: BUCKET_LABEL[before.bucket], to: BUCKET_LABEL[bucket],
        ...stampOf(actor), reason,
      }]);
    },

    // Removes the damage and its claim on those documents. The documents stay
    // on the case file — they are evidence, not a property of this line item.
    deleteDamage: (id, actor, reason) => {
      const before = items.find((i) => i.id === id);
      if (!before) return;
      setItems((prev) => prev.filter((i) => i.id !== id));
      record([{
        damageId: id, action: "deleted", damage: before.label,
        amount: formatDamageUSD(before.amount), from: BUCKET_LABEL[before.bucket],
        ...stampOf(actor), reason,
      }]);
    },

    reset: () => { setItems(DAMAGE_SEED); setAudit([]); },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDamages(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDamages must be used inside DamagesProvider");
  return v;
}

// Safe outside the provider, for components that may render without it.
export function useDamagesOptional(): Value | null {
  return useContext(Ctx);
}

