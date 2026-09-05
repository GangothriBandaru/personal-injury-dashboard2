import { createContext, useContext, useMemo, useState, ReactNode } from "react";

// ── Non-economic damage factors ───────────────────────────────────────────────
// The factors behind the non-economic multiplier, and the operations that change
// them. Lives above the Damages Analysis stage so the recommended multiplier,
// the estimated non-economic damages and the settlement all recalculate from one
// place when a factor is edited, added or removed.
//
// The AI's own recommendation is never overwritten: `aiMultiplier` and `aiRange`
// stay put while `multiplier` and `range` carry the attorney's position, so
// "Restore AI Recommendation" always has something to restore to.

export type Severity = "Critical" | "High" | "Moderate" | "Low";

// The allowable per-severity multiplier band. A factor starts on the band its
// severity implies and can be given its own afterwards.
export const SEVERITY_RANGE: Record<Severity, [number, number]> = {
  Critical: [2, 3],
  High: [1, 1.5],
  Moderate: [0.5, 1],
  Low: [0.25, 0.5],
};

// Who a factor came from, and whether it has been changed since. Kept distinct
// from the multiplier override: a factor can be renamed without being re-valued.
export type FactorProvenance = "ai-generated" | "ai-modified" | "user-created" | "user-modified";

export const FACTOR_PROVENANCE_LABEL: Record<FactorProvenance, string> = {
  "ai-generated": "AI Generated",
  "ai-modified": "AI Modified",
  "user-created": "User Created",
  "user-modified": "User Modified",
};

export interface FactorItem {
  id: string;
  /** The factor's name. Called `category` because that is what it has always
   *  been called in the demand-package builder that reads this same shape. */
  category: string;
  /** The editable description of what this factor covers. */
  rationale: string;
  severity: Severity;
  /** The AI's recommendation, never overwritten by an attorney's change. */
  aiMultiplier: number;
  aiRange: [number, number];
  /** The position and band actually in force. */
  multiplier: number;
  range: [number, number];
  confidence: number;
  docCount: number;
  drivers: string[];
  aiReasoning: string;
  evidence: {
    strength: "Strong" | "Moderate" | "Limited";
    primaryRecords: number;
    expertOpinions: number;
    witnessStatements: number;
    medicalQuality: "Excellent" | "Strong" | "Adequate" | "Limited";
  };
  defense: { argument: string; strength: "Strong" | "Moderate" | "Weak"; rebuttal: string };
  suggestion: { evidence: string; why: string; multiplierGain: number };
  provenance: FactorProvenance;
  addedBy?: string;
  addedAt?: string;
}

export type FactorAction =
  | "created" | "renamed" | "described" | "multiplier" | "range" | "severity" | "deleted" | "restored";

export const FACTOR_ACTION_LABEL: Record<FactorAction, string> = {
  created: "Factor created",
  renamed: "Factor renamed",
  described: "Description changed",
  multiplier: "Multiplier changed",
  range: "Multiplier range changed",
  severity: "Severity changed",
  deleted: "Factor deleted",
  restored: "Restored to AI recommendation",
};

export interface FactorAudit {
  id: string;
  factorId: string;
  action: FactorAction;
  factor: string;             // the name as it read at the time
  previous?: string;
  next?: string;
  changedBy: string;
  at: string;
  /** The attorney's optional note against the change. */
  reason?: string;
}

export interface FactorActor { name: string; kind: "attorney" | "ai" }
export const attorneyFactorActor = (name: string): FactorActor => ({ name, kind: "attorney" });

// Provenance follows the actor, and remembers where the factor came from: an
// AI factor an attorney edits becomes User Modified, not User Created.
const provenanceAfterEdit = (before: FactorProvenance, actor: FactorActor): FactorProvenance => {
  if (actor.kind === "ai") return before === "user-created" ? "user-created" : "ai-modified";
  return before === "user-created" ? "user-created" : "user-modified";
};

/** A factor being created. The store fills in provenance and authorship. */
export type NewFactor = Omit<FactorItem, "provenance" | "addedBy" | "addedAt">;

const fmtMultiplier = (m: number) => `${Number(m.toFixed(2))}\u00d7`;
const fmtRange = ([lo, hi]: [number, number]) => `${fmtMultiplier(lo)}\u2013${fmtMultiplier(hi)}`;

// ── Seed ──────────────────────────────────────────────────────────────────────
// The factors the AI put on the case. Exported so module-level consumers (the
// demand-package builder) can read them without the store.

export const FACTOR_SEED: FactorItem[] = [
  {
    id: "pain-suffering", multiplier: 2, range: [2, 3], aiRange: [2, 3], provenance: "ai-generated",
    category: "Pain & Suffering", severity: "Critical", aiMultiplier: 2, confidence: 94, docCount: 18,
    drivers: ["Permanent Injury", "Surgical Intervention", "Chronic Pain", "MRI Verified"],
    aiReasoning: "Two-level cervical herniation with nerve-root compression, a completed surgical course, and treating-physician records showing persistent chronic pain place this factor at the top of the Critical band.",
    rationale: "Treating-physician records document persistent, chronic pain requiring ongoing pain-management intervention.",
    evidence: { strength: "Strong", primaryRecords: 11, expertOpinions: 3, witnessStatements: 4, medicalQuality: "Excellent" },
    defense: { argument: "Insurer will likely argue pre-existing degenerative changes contributed to the cervical findings, discounting causation.", strength: "Weak", rebuttal: "Cite the pre-incident baseline MRI and the treating surgeon's causation opinion tying the herniation to the collision." },
    suggestion: { evidence: "Pain-management specialist narrative report", why: "A dedicated specialist narrative would corroborate the permanence of chronic pain and anchor the top of the Critical band.", multiplierGain: 0.25 },
  },
  {
    id: "emotional-distress", multiplier: 1.25, range: [1, 1.5], aiRange: [1, 1.5], provenance: "ai-generated",
    category: "Emotional Distress", severity: "High", aiMultiplier: 1.25, confidence: 86, docCount: 7,
    drivers: ["Diagnosed Anxiety", "Post-Traumatic Symptoms", "Sleep Disturbance"],
    aiReasoning: "Primary-care and counseling notes corroborate diagnosed anxiety and post-traumatic symptoms; a formal mental-health evaluation would further anchor the higher end of the band.",
    rationale: "Mental-health evaluations corroborate diagnosed anxiety and post-traumatic symptoms tied to the incident.",
    evidence: { strength: "Moderate", primaryRecords: 4, expertOpinions: 1, witnessStatements: 2, medicalQuality: "Adequate" },
    defense: { argument: "Insurer will argue emotional symptoms are unquantified and lack a dedicated psychological evaluation.", strength: "Moderate", rebuttal: "Obtain a licensed psychologist's evaluation with standardized testing to convert lay complaints into diagnostic findings." },
    suggestion: { evidence: "Mental Health Evaluation", why: "A formal psychological evaluation would quantify the distress diagnostically and strengthen Emotional Distress.", multiplierGain: 0.5 },
  },
  {
    id: "quality-of-life", multiplier: 1.25, range: [1, 1.5], aiRange: [1, 1.5], provenance: "ai-generated",
    category: "Quality of Life", severity: "High", aiMultiplier: 1.25, confidence: 88, docCount: 9,
    drivers: ["Loss of Independence", "Abandoned Hobbies", "Reduced Activity"],
    aiReasoning: "Functional-capacity assessments show a durable loss of independence in daily activities and recreation attributable to the injuries.",
    rationale: "Functional-capacity assessments show a sustained loss of independence in daily activities and prior hobbies.",
    evidence: { strength: "Strong", primaryRecords: 5, expertOpinions: 2, witnessStatements: 2, medicalQuality: "Strong" },
    defense: { argument: "Insurer will contend the plaintiff has partially resumed activities, limiting the loss claimed.", strength: "Weak", rebuttal: "Present the functional-capacity evaluation and before/after activity logs documenting the sustained limitations." },
    suggestion: { evidence: "Day-in-the-life video", why: "A day-in-the-life record vividly documents the ongoing functional loss for a jury.", multiplierGain: 0.25 },
  },
  {
    id: "cognitive-impairment", multiplier: 2, range: [2, 3], aiRange: [2, 3], provenance: "ai-generated",
    category: "Cognitive Impairment", severity: "Critical", aiMultiplier: 2, confidence: 92, docCount: 11,
    drivers: ["Neuropsych Testing", "Memory Deficit", "Slowed Processing", "Employment Impact"],
    aiReasoning: "Neuropsychological testing confirms measurable deficits in memory, attention, and processing speed, objectively supporting a Critical placement.",
    rationale: "Neuropsychological testing confirms measurable deficits in memory, attention, and processing speed.",
    evidence: { strength: "Strong", primaryRecords: 6, expertOpinions: 3, witnessStatements: 2, medicalQuality: "Excellent" },
    defense: { argument: "Insurer will argue cognitive testing is subject to effort validity and attribute deficits to unrelated factors.", strength: "Moderate", rebuttal: "Rely on embedded validity indicators in the neuropsych battery and the neurologist's causation opinion." },
    suggestion: { evidence: "Vocational expert assessment", why: "A vocational assessment would translate the cognitive deficits into concrete earning-capacity loss.", multiplierGain: 0.25 },
  },
  {
    id: "physical-impairment", multiplier: 1.25, range: [1, 1.5], aiRange: [1, 1.5], provenance: "ai-generated",
    category: "Physical Impairment", severity: "High", aiMultiplier: 1.25, confidence: 90, docCount: 14,
    drivers: ["Mobility Restriction", "Reduced Range of Motion", "Orthopedic Findings"],
    aiReasoning: "Imaging and orthopedic findings verify permanent mobility restrictions and reduced range of motion consistent with the injury mechanism.",
    rationale: "Imaging and orthopedic findings verify permanent mobility restrictions and reduced range of motion.",
    evidence: { strength: "Strong", primaryRecords: 8, expertOpinions: 2, witnessStatements: 4, medicalQuality: "Strong" },
    defense: { argument: "Insurer will argue impairment ratings fall within functional ranges permitting most activities.", strength: "Weak", rebuttal: "Present the AMA impairment rating and the treating orthopedist's permanency opinion." },
    suggestion: { evidence: "Independent medical exam rebuttal", why: "A retained-expert IME rebuttal would neutralize a low defense impairment rating.", multiplierGain: 0.25 },
  },
  {
    id: "dignity-independence", multiplier: 0.75, range: [0.5, 1], aiRange: [0.5, 1], provenance: "ai-generated",
    category: "Dignity & Independence", severity: "Moderate", aiMultiplier: 0.75, confidence: 79, docCount: 5,
    drivers: ["Assistive Care", "Lost Self-Care Autonomy"],
    aiReasoning: "Care records show reliance on assistive help for routine self-care tasks, meaningfully reducing personal autonomy.",
    rationale: "Reliance on assistive care for routine self-care tasks meaningfully reduces personal autonomy.",
    evidence: { strength: "Moderate", primaryRecords: 2, expertOpinions: 1, witnessStatements: 2, medicalQuality: "Adequate" },
    defense: { argument: "Insurer will argue assistive-care needs are temporary and expected to resolve with recovery.", strength: "Moderate", rebuttal: "Present the life-care plan projecting long-term assistive-care needs beyond the recovery window." },
    suggestion: { evidence: "Occupational therapy assessment", why: "An OT assessment documents the durable loss of self-care independence.", multiplierGain: 0.25 },
  },
  {
    id: "family-relationship-impact", multiplier: 0.5, range: [0.5, 1], aiRange: [0.5, 1], provenance: "ai-generated",
    category: "Family Relationship Impact", severity: "Moderate", aiMultiplier: 0.5, confidence: 76, docCount: 4,
    drivers: ["Caregiving Burden", "Loss of Consortium"],
    aiReasoning: "Family statements document a caregiving burden and loss of consortium; corroboration is primarily lay testimony.",
    rationale: "Family statements document caregiving burden and loss of consortium within the household.",
    evidence: { strength: "Limited", primaryRecords: 1, expertOpinions: 0, witnessStatements: 3, medicalQuality: "Limited" },
    defense: { argument: "Insurer will argue consortium claims rest largely on lay testimony without independent corroboration.", strength: "Strong", rebuttal: "Corroborate with a family-therapist evaluation and contemporaneous caregiving records." },
    suggestion: { evidence: "Spousal/family declarations", why: "Sworn declarations from household members would independently corroborate the consortium loss.", multiplierGain: 0.25 },
  },
];

interface Value {
  factors: FactorItem[];
  audit: FactorAudit[];
  /** The sum of every factor's multiplier — the recommended multiplier. */
  overallMultiplier: number;
  /** What the AI recommended, for comparison. */
  aiOverallMultiplier: number;
  historyFor: (id: string) => FactorAudit[];

  createFactor: (draft: NewFactor, actor: FactorActor, reason?: string) => void;
  /** Only the fields present in `patch` change; each one is recorded. */
  updateFactor: (id: string, patch: Partial<FactorItem>, actor: FactorActor, reason?: string) => void;
  deleteFactor: (id: string, actor: FactorActor, reason?: string) => void;
  restoreFactor: (id: string, actor: FactorActor) => void;
  reset: () => void;
}

const Ctx = createContext<Value | null>(null);

const now = () =>
  new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export const factorStamp = now;

export function FactorsProvider({ children }: { children: ReactNode }) {
  const [factors, setFactors] = useState<FactorItem[]>(FACTOR_SEED);
  const [audit, setAudit] = useState<FactorAudit[]>([]);

  const record = (entries: Omit<FactorAudit, "id" | "at">[]) =>
    setAudit((prev) => [
      ...prev,
      ...entries.map((e, i) => ({
        ...e,
        at: now(),
        id: `fa-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      })),
    ]);

  const overallMultiplier = useMemo(
    () => factors.reduce((s, f) => s + f.multiplier, 0),
    [factors],
  );
  const aiOverallMultiplier = useMemo(
    () => factors.reduce((s, f) => s + f.aiMultiplier, 0),
    [factors],
  );

  const value: Value = {
    factors,
    audit,
    overallMultiplier,
    aiOverallMultiplier,
    historyFor: (id) => audit.filter((a) => a.factorId === id),

    createFactor: (draft, actor, reason) => {
      const item: FactorItem = {
        ...draft,
        provenance: actor.kind === "ai" ? "ai-generated" : "user-created",
        addedBy: actor.name,
        addedAt: now(),
      };
      setFactors((prev) => [...prev, item]);
      record([{
        factorId: item.id, action: "created", factor: item.category,
        next: `${fmtMultiplier(item.multiplier)} within ${fmtRange(item.range)}`,
        changedBy: actor.name, reason,
      }]);
    },

    // One entry per field that actually moved, so the trail says what changed
    // rather than that something did.
    updateFactor: (id, patch, actor, reason) => {
      const before = factors.find((f) => f.id === id);
      if (!before) return;
      const entries: Omit<FactorAudit, "id" | "at">[] = [];
      const note = (action: FactorAction, previous: string, next: string) => {
        if (previous !== next) {
          entries.push({ factorId: id, action, factor: before.category, previous, next, changedBy: actor.name, reason });
        }
      };
      if (patch.category !== undefined) note("renamed", before.category, patch.category);
      if (patch.rationale !== undefined) note("described", before.rationale, patch.rationale);
      if (patch.severity !== undefined) note("severity", before.severity, patch.severity);
      if (patch.multiplier !== undefined) note("multiplier", fmtMultiplier(before.multiplier), fmtMultiplier(patch.multiplier));
      if (patch.range !== undefined) note("range", fmtRange(before.range), fmtRange(patch.range));
      if (entries.length === 0) return;
      setFactors((prev) => prev.map((f) =>
        f.id === id ? { ...f, ...patch, provenance: provenanceAfterEdit(f.provenance, actor) } : f,
      ));
      record(entries);
    },

    deleteFactor: (id, actor, reason) => {
      const before = factors.find((f) => f.id === id);
      if (!before) return;
      setFactors((prev) => prev.filter((f) => f.id !== id));
      record([{
        factorId: id, action: "deleted", factor: before.category,
        previous: `${fmtMultiplier(before.multiplier)} within ${fmtRange(before.range)}`,
        changedBy: actor.name, reason,
      }]);
    },

    // Back to the AI's position and band. The record keeps every step that got
    // it here — restoring is another entry, not an erasure.
    restoreFactor: (id, actor) => {
      const before = factors.find((f) => f.id === id);
      if (!before) return;
      if (before.multiplier === before.aiMultiplier && before.range[0] === before.aiRange[0] && before.range[1] === before.aiRange[1]) return;
      setFactors((prev) => prev.map((f) =>
        f.id === id ? { ...f, multiplier: f.aiMultiplier, range: [...f.aiRange] as [number, number] } : f,
      ));
      record([{
        factorId: id, action: "restored", factor: before.category,
        previous: fmtMultiplier(before.multiplier), next: fmtMultiplier(before.aiMultiplier),
        changedBy: actor.name,
      }]);
    },

    reset: () => { setFactors(FACTOR_SEED); setAudit([]); },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFactors(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFactors must be used inside FactorsProvider");
  return v;
}

// Safe outside the provider, for components that may render without it.
export function useFactorsOptional(): Value | null {
  return useContext(Ctx);
}
