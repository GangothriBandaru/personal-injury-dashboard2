import { createContext, useContext, useState, ReactNode } from "react";

// ── Violations ────────────────────────────────────────────────────────────────
// The statutory violations cited on the case, and the operations that change
// them. Shaped like the negligence pillars beside it: three operations, an actor
// on each, provenance that remembers where a violation came from, and a trail
// that says what moved.
//
// Lives above the Violations stage so the total, the severity summary and the
// legal framework all recalculate from one list when a violation is edited,
// added or removed.

export type ViolationProvenance = "ai-generated" | "ai-modified" | "user-created" | "user-modified";

export const VIOLATION_PROVENANCE_LABEL: Record<ViolationProvenance, string> = {
  "ai-generated": "AI Generated",
  "ai-modified": "AI Modified",
  "user-created": "Attorney Created",
  "user-modified": "Attorney Modified",
};

export type ViolationSeverity = ViolationCard["severity"];

export const VIOLATION_SEVERITIES: ViolationSeverity[] = ["Critical", "High", "Medium", "Low"];

// A violation as the stage holds it: the card's own fields, plus how it came to
// read the way it does.
export interface ViolationItem extends ViolationCard {
  provenance: ViolationProvenance;
  /** True once the wording the AI analysed has been changed by hand. */
  aiStale: boolean;
  addedBy?: string;
  addedAt?: string;
}

export type ViolationAction =
  | "created" | "renamed" | "description" | "severity" | "statute" | "jurisdiction"
  | "evidence-added" | "evidence-removed" | "deleted";

export const VIOLATION_ACTION_LABEL: Record<ViolationAction, string> = {
  created: "Violation created",
  renamed: "Violation renamed",
  description: "Description changed",
  severity: "Severity changed",
  statute: "Statute changed",
  jurisdiction: "Jurisdiction changed",
  "evidence-added": "Supporting document added",
  "evidence-removed": "Supporting document removed",
  deleted: "Violation deleted",
};

export interface ViolationAudit {
  id: string;
  violationId: string;
  action: ViolationAction;
  violation: string;          // the title as it read at the time
  previous?: string;
  next?: string;
  changedBy: string;
  at: string;
  reason?: string;
}

export interface ViolationActor { name: string; kind: "attorney" | "ai" }
export const attorneyViolationActor = (name: string): ViolationActor => ({ name, kind: "attorney" });

// Provenance follows the actor and remembers the origin: an AI violation an
// attorney edits becomes Attorney Modified, not Attorney Created.
const provenanceAfterEdit = (before: ViolationProvenance, actor: ViolationActor): ViolationProvenance => {
  if (actor.kind === "ai") return before === "user-created" ? "user-created" : "ai-modified";
  return before === "user-created" ? "user-created" : "user-modified";
};

/** A violation being created. The store fills in provenance and authorship. */
export type NewViolation = Omit<ViolationItem, "provenance" | "aiStale" | "addedBy" | "addedAt">;

// ── Seed ──────────────────────────────────────────────────────────────────────
// The violations the AI cited. They live here rather than on the stage so the
// store owns the record and the stage reads it, with no cycle between them.

export type ViolationCard = {
  id: string;
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  description: string;
  jurisdiction: string;
  statute: string;
  aiSummary: string;
  whyApplied: string;
  confidence: number;
  evidenceStrength: "Strong" | "Moderate" | "Limited";
  similar: { name: string; reasonConsidered: string; whyNot: string }[];
  evidence: string[];
};

const SEEDED: ViolationCard[] = [
  {
    id: "failure-to-yield",
    title: "Failure to Yield Right-of-Way",
    severity: "Critical",
    description: "The defendant's commercial vehicle failed to yield to the plaintiff, who lawfully held the right-of-way at the intersection.",
    jurisdiction: "Cook County, Illinois",
    statute: "625 ILCS 5/11-901 — Vehicle Approaching or Entering Intersection",
    aiSummary: "LECO matched the verified intersection-collision facts to Illinois' right-of-way statute, finding the defendant entered against the plaintiff's established right-of-way.",
    whyApplied: "The responding officer's narrative and the scene reconstruction place the defendant entering the intersection while the plaintiff held the right-of-way — the core element of an 11-901 violation.",
    confidence: 98,
    evidenceStrength: "Strong",
    similar: [
      { name: "625 ILCS 5/11-902 — Left Turns", reasonConsidered: "Also governs intersection right-of-way duties.", whyNot: "No turning maneuver was involved; the collision occurred on a straight-through path." },
      { name: "625 ILCS 5/11-1201 — Yielding at Stop Signs", reasonConsidered: "Imposes a comparable yield duty at intersections.", whyNot: "The intersection was signal-controlled, not sign-controlled, so the stop-sign statute does not apply." },
    ],
    evidence: ["Police_Report.pdf", "Scene_Reconstruction.pdf", "Witness_Statement_A.pdf", "Traffic_Camera_Still.png", "Officer_Narrative.pdf"],
  },
  {
    id: "red-light",
    title: "Red-Light Signal Violation",
    severity: "Critical",
    description: "The commercial vehicle entered the intersection against a red signal at the moment of impact.",
    jurisdiction: "Cook County, Illinois",
    statute: "625 ILCS 5/11-306 — Obedience to Traffic-Control Signals",
    aiSummary: "Signal-timing evidence and witness corroboration align with Illinois' traffic-control-signal statute, supporting a red-light entry.",
    whyApplied: "Signal-timing data and a corroborating witness confirm the light was red against the defendant when the vehicle entered the intersection.",
    confidence: 96,
    evidenceStrength: "Strong",
    similar: [
      { name: "625 ILCS 5/11-305 — Authority to Place Signals", reasonConsidered: "Part of the same signal-control article.", whyNot: "Addresses an agency's authority to install signals, not a driver's duty to obey them." },
      { name: "625 ILCS 5/11-1301 — Stopping Prohibited", reasonConsidered: "Also regulates conduct at intersections.", whyNot: "Concerns standing and parking, not signal compliance." },
    ],
    evidence: ["Signal_Timing_Log.pdf", "Dashcam_Footage.mp4", "Witness_Statement_B.pdf", "Intersection_Diagram.pdf"],
  },
  {
    id: "excessive-speed",
    title: "Excessive Speed",
    severity: "High",
    description: "Reconstruction places the vehicle above the posted speed limit at the moment of impact.",
    jurisdiction: "Cook County, Illinois",
    statute: "625 ILCS 5/11-601 — Speed Restrictions (Reasonable and Proper)",
    aiSummary: "Reconstruction metrics exceed the posted limit, mapping the facts to Illinois' reasonable-and-proper speed statute.",
    whyApplied: "Crush-depth and skid analysis yield an impact speed exceeding the posted limit, satisfying the unreasonable-speed element of 11-601.",
    confidence: 88,
    evidenceStrength: "Strong",
    similar: [
      { name: "625 ILCS 5/11-601.5 — Aggravated Speeding", reasonConsidered: "Directly addresses excessive speed.", whyNot: "The estimated speed did not reach the 26-mph-over threshold the aggravated charge requires." },
      { name: "625 ILCS 5/11-605 — School Zone Speed Limits", reasonConsidered: "Another speed-restriction statute.", whyNot: "The incident did not occur within a posted school zone." },
    ],
    evidence: ["Scene_Reconstruction.pdf", "Skid_Analysis.pdf", "EDR_Download.pdf"],
  },
  {
    id: "carrier-negligence",
    title: "Commercial Carrier Negligence",
    severity: "Medium",
    description: "The operating motor carrier failed to meet its federal safety-management duties for the driver and vehicle.",
    jurisdiction: "Federal — FMCSA / 49 CFR",
    statute: "49 CFR § 392 — Driving of Commercial Motor Vehicles",
    aiSummary: "Confirmed carrier control brings the operation under federal safe-driving duties, with the underlying moving violations evidencing a breach.",
    whyApplied: "Confirmed commercial coverage and carrier control bring the operation under FMCSA duties; the underlying moving violations evidence a breach of safe-operation obligations.",
    confidence: 79,
    evidenceStrength: "Moderate",
    similar: [
      { name: "49 CFR § 395 — Hours of Service", reasonConsidered: "A primary FMCSA driver-safety rule.", whyNot: "No logbook or fatigue evidence currently supports an hours-of-service theory." },
      { name: "49 CFR § 396 — Inspection & Maintenance", reasonConsidered: "Governs carrier vehicle-safety duties.", whyNot: "No mechanical-defect evidence has been identified to date." },
    ],
    evidence: ["Insurance_Policy.pdf", "Carrier_Records.pdf", "Police_Report.pdf", "FMCSA_Profile.pdf"],
  },
];

export const VIOLATION_SEED: ViolationItem[] = SEEDED.map((v) => ({
  ...v,
  provenance: "ai-generated",
  aiStale: false,
}));

// ── Statutes ──────────────────────────────────────────────────────────────────
// The statutes the case already references — each violation's own, plus the
// alternatives the AI considered and set aside on each card. That is the
// product's own legal-statute source; nothing is invented to fill a picker.

export function statuteCatalogue(violations: ViolationItem[]): string[] {
  const all = violations.flatMap((v) => [v.statute, ...v.similar.map((s) => s.name)]);
  return Array.from(new Set(all.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

// ── The operations ────────────────────────────────────────────────────────────
// Three operations, and nothing else writes to a violation. Deleting one never
// touches its documents: a violation cites evidence, and dropping the violation
// releases the citation while the files stay in the case repository.

interface Value {
  violations: ViolationItem[];
  audit: ViolationAudit[];
  /** The trail for one violation, oldest first. */
  historyFor: (id: string) => ViolationAudit[];
  /** Live counts the summary reads, so it can never fall behind the cards. */
  total: number;
  countsBySeverity: Record<ViolationSeverity, number>;
  /** Every statute the case references, for the picker. */
  statutes: string[];

  createViolation: (draft: NewViolation, actor: ViolationActor, reason?: string) => void;
  updateViolation: (id: string, patch: Partial<ViolationItem>, actor: ViolationActor, reason?: string) => void;
  deleteViolation: (id: string, actor: ViolationActor, reason?: string) => void;

  reset: () => void;
}

const Ctx = createContext<Value | null>(null);

const now = () =>
  new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export function ViolationsProvider({ children }: { children: ReactNode }) {
  const [violations, setViolations] = useState<ViolationItem[]>(VIOLATION_SEED);
  const [audit, setAudit] = useState<ViolationAudit[]>([]);

  const record = (entries: Omit<ViolationAudit, "id" | "at">[]) =>
    setAudit((prev) => [
      ...prev,
      ...entries.map((e, i) => ({
        ...e,
        at: now(),
        id: `va-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      })),
    ]);

  const value: Value = {
    violations,
    audit,
    historyFor: (id) => audit.filter((a) => a.violationId === id),
    total: violations.length,
    countsBySeverity: {
      Critical: violations.filter((v) => v.severity === "Critical").length,
      High: violations.filter((v) => v.severity === "High").length,
      Medium: violations.filter((v) => v.severity === "Medium").length,
      Low: violations.filter((v) => v.severity === "Low").length,
    },
    statutes: statuteCatalogue(violations),

    createViolation: (draft, actor, reason) => {
      setViolations((prev) => [
        ...prev,
        {
          ...draft,
          provenance: actor.kind === "ai" ? "ai-generated" : "user-created",
          // Attorney wording has never been AI-analysed, so there is no AI
          // analysis to be stale — the card simply shows none.
          aiStale: false,
          addedBy: actor.name,
          addedAt: now(),
        },
      ]);
      record([{
        violationId: draft.id, action: "created", violation: draft.title,
        next: `${draft.title} · ${draft.severity}`, changedBy: actor.name, reason,
      }]);
    },

    // One entry per field that actually moved, so the trail says what changed
    // rather than that something did.
    updateViolation: (id, patch, actor, reason) => {
      const before = violations.find((v) => v.id === id);
      if (!before) return;
      const entries: Omit<ViolationAudit, "id" | "at">[] = [];
      const note = (action: ViolationAction, previous: string, next: string) => {
        if (previous !== next) {
          entries.push({ violationId: id, action, violation: before.title, previous, next, changedBy: actor.name, reason });
        }
      };
      if (patch.title !== undefined) note("renamed", before.title, patch.title);
      if (patch.description !== undefined) note("description", before.description, patch.description);
      if (patch.severity !== undefined) note("severity", before.severity, patch.severity);
      if (patch.statute !== undefined) note("statute", before.statute, patch.statute);
      if (patch.jurisdiction !== undefined) note("jurisdiction", before.jurisdiction, patch.jurisdiction);
      if (patch.evidence !== undefined) {
        const had = new Set(before.evidence);
        const has = new Set(patch.evidence);
        for (const d of patch.evidence) {
          if (!had.has(d)) entries.push({ violationId: id, action: "evidence-added", violation: before.title, next: d, changedBy: actor.name, reason });
        }
        for (const d of before.evidence) {
          if (!has.has(d)) entries.push({ violationId: id, action: "evidence-removed", violation: before.title, previous: d, changedBy: actor.name, reason });
        }
      }
      if (entries.length === 0) return;

      // The AI's summary and confidence describe the wording it was given. Once
      // that wording changes by hand they are stale, and the card says so rather
      // than presenting them as current.
      const wordingChanged = entries.some((e) =>
        e.action === "renamed" || e.action === "description" || e.action === "statute");

      setViolations((prev) => prev.map((v) =>
        v.id === id
          ? {
              ...v,
              ...patch,
              provenance: provenanceAfterEdit(v.provenance, actor),
              aiStale: v.aiStale || (wordingChanged && actor.kind === "attorney"),
            }
          : v,
      ));
      record(entries);
    },

    deleteViolation: (id, actor, reason) => {
      const before = violations.find((v) => v.id === id);
      if (!before) return;
      setViolations((prev) => prev.filter((v) => v.id !== id));
      record([{
        violationId: id, action: "deleted", violation: before.title,
        previous: `${before.title} · ${before.severity}`, changedBy: actor.name, reason,
      }]);
    },

    reset: () => { setViolations(VIOLATION_SEED); setAudit([]); },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useViolations(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useViolations must be used inside ViolationsProvider");
  return v;
}

// Safe outside the provider, for components that may render without it.
export function useViolationsOptional(): Value | null {
  return useContext(Ctx);
}
