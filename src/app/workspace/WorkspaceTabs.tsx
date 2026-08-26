import { useState, useRef, useEffect, ReactNode } from "react";
import {
  Scale, MapPin, CheckCircle, ShieldCheck, User, Building2, Hash, Calendar, AlertTriangle, X,
  FileText, Activity, Stethoscope, DollarSign, Sparkles,
  ArrowRight, ChevronDown, ChevronLeft, ChevronRight, Search, Eye, Lightbulb, Download,
  Gavel, MessageSquare, SlidersHorizontal,
  HeartPulse, ClipboardList, Image as ImageIcon, Video, FileSignature, Quote,
  Pencil, RotateCcw, History, TrendingUp, TrendingDown, Info, Shield, Circle, Loader2, Bot, Send,
  Plus, UserPlus,
} from "lucide-react";
import type { AnalysisFinding, CaseDocument } from "../types/case";
import { classifyDocuments } from "../types/case";
import { DocumentWorkspaceModal } from "../components/DocumentWorkspace";
import { EvidenceReviewModal } from "./EvidenceReviewModal";
import { AddChronologyDrawer, type CreatedChronology } from "./AddChronologyDrawer";
import { InjuryIntelligenceSection } from "../components/InjuryIntelligenceSection";

// ── Shared model & helpers ────────────────────────────────────────────────────

export interface WorkspaceModel {
  caseName: string;
  caseId: string;
  plaintiff: string;
  defendant: string;
  insuranceCarrier: string;
  caseType: string;
  jurisdiction: string;
  incidentDate: string;
  status: string;
  recommendedSettlement: number;
  confidence: number;
  multiplier: number;
  economicTotal: number;
  nonEconomicTotal: number;
  estimatedLow: number;
  estimatedHigh: number;
}

interface TabProps {
  model: WorkspaceModel;
  findings: AnalysisFinding[];
  documents: CaseDocument[];
  goTo: (tab: string) => void;
  goToValuation?: () => void;
  onGenerateDemand?: (strategyLabel: string, amount: number) => void;
}

function formatUSD(n: number) {
  return "$" + Math.round(n).toLocaleString("en-US");
}

function formatCompact(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString()}`;
}

// Show a value as a ±15% range (compact) instead of an exact figure.
function formatRange(n: number) {
  return `${formatCompact(n * 0.85)} – ${formatCompact(n * 1.15)}`;
}

// Show a multiplier as a ±1 range (e.g. 9 → "8× – 10×").
function multiplierRange(m: number) {
  return `${m - 1}× – ${m + 1}×`;
}

// Stable string hash → non-negative int, so per-document amounts/dates are
// deterministic across renders (no jitter when a drawer re-renders).
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

type DocLine = { name: string; amount: number; aiSummary: string; billingPeriod: string };

const BREAKDOWN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Build an itemized, evidence-backed breakdown for an economic damage category.
// Amounts are deterministic and reconcile EXACTLY to the verified category total.
function buildDocBreakdown(item: { value: number; category: string; docCount: number; docs: string[] }): DocLine[] {
  const files = padDocsToCount(item.docs, item.category, item.docCount);
  const weights = files.map((f) => 0.6 + (hashStr(f + item.category) % 1000) / 1000); // 0.6 – 1.6
  const wsum = weights.reduce((a, b) => a + b, 0);
  // Round each share to the nearest $50, then absorb the rounding drift into the
  // last line so the itemized amounts sum exactly to the category total.
  const amounts = weights.map((w) => Math.max(50, Math.round((item.value * w / wsum) / 50) * 50));
  amounts[amounts.length - 1] += item.value - amounts.reduce((a, b) => a + b, 0);

  return files.map((name, i) => {
    const h = hashStr(name + i);
    const m = h % 6;                     // billing window within Jan–Jun 2026
    const startDay = 1 + (h % 18);
    const endDay = Math.min(28, startDay + 4 + ((h >> 4) % 16));
    const summaries = [
      `Itemized ${item.category.toLowerCase()} charges verified against the provider ledger; line items reconcile with no duplicates.`,
      `${item.category} entry cross-checked to the source billing statement and confirmed attributable to this claim.`,
      `Verified ${item.category.toLowerCase()} amount — matches the provider invoice and is supported by treatment records.`,
    ];
    return {
      name,
      amount: amounts[i],
      aiSummary: summaries[h % summaries.length],
      billingPeriod: `${BREAKDOWN_MONTHS[m]} ${startDay} – ${BREAKDOWN_MONTHS[m]} ${endDay}, 2026`,
    };
  });
}

// Pad a list of named documents up to `count` with realistic placeholder names,
// so a category's preview reflects its full supporting-document count.
function padDocsToCount(names: string[], category: string, count: number): string[] {
  const slug = category.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
  const out = [...names];
  let n = out.length + 1;
  while (out.length < count) {
    out.push(`${slug}_${String(n).padStart(2, "0")}.pdf`);
    n++;
  }
  return out;
}

// Resolve a filename to a workspace-document shape (category/source/date) for the
// shared Document Workspace. Unknown files fall back to a generic attorney doc.
export function buildDocResolver(documents: CaseDocument[]) {
  const categories = classifyDocuments(documents);
  return (file: string) => {
    const d = documents.find((x) => x.name === file);
    const category = d ? categories.find((c) => c.docs.some((f) => f.id === d.id))?.name ?? "General Documents" : "General Documents";
    return d
      ? { ...d, category, source: d.source === "Plaintiff" ? "Plaintiff" : "Attorney Office" }
      : { id: file, name: file, source: "Attorney Office", date: "Jun 8, 2026", status: "Processed", category: "General Documents" };
  };
}

// A reading-first section: Onest heading, optional description, generous spacing.
function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="section-header">{title}</h2>
        {description && <p className="secondary-text mt-1 max-w-2xl">{description}</p>}
      </div>
      {children}
    </section>
  );
}

// Compact information tile: outline icon, uppercase muted label, bold value.
// `wide` spans the full grid width; `big` enlarges the value for emphasis.
function InfoTile({ icon: Icon, label, value, wide, big }: { icon: any; label: string; value: string; wide?: boolean; big?: boolean }) {
  return (
    <div className={`rounded-xl border border-line bg-offwhite p-3 ${wide ? "col-span-2" : ""}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
        <span className="eyebrow truncate">{label}</span>
      </div>
      <div className={`font-semibold text-ink leading-snug break-words ${big ? "text-xl tabular-nums" : "text-sm"}`}>{value}</div>
    </div>
  );
}

// ── Tab 1 — Case Overview ─────────────────────────────────────────────────────

// A single AI-summary card: icon + title aligned on one row, summary left-aligned below.
function SummaryCard({ icon: Icon, title, children }: { icon: any; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-[18px] h-[18px] text-deep shrink-0" strokeWidth={1.75} />
        <h3 className="card-title">{title}</h3>
      </div>
      {children}
    </div>
  );
}

const LIABILITY_POINTS = [
  "Failure to yield at a controlled intersection confirmed by police report.",
  "Commercial driver cited for a traffic violation.",
  "Witness statements corroborate the plaintiff's account.",
  "Crash reconstruction supports the impact sequence.",
  "Skid marks and scene evidence match the vehicle positions.",
];

// Evidence-backed litigation findings — each links to the verified documents
// behind it and opens the shared Document Workspace (Preview / Insights).
const KEY_FINDINGS: { title: string; kind: "strength" | "risk"; description: string; evidence: string[]; aiSummary: string }[] = [
  {
    title: "Liability Favors Plaintiff",
    kind: "strength",
    description: "Officer fault determination and a confirmed red-light violation establish a strong liability position under state negligence standards.",
    evidence: ["police_report_final.pdf", "witness_statement.pdf"],
    aiSummary: "The police report and a corroborating witness statement both place fault on the defendant, leaving little room to dispute liability.",
  },
  {
    title: "Severe Injuries Verified",
    kind: "strength",
    description: "MRI imaging confirms C5–C6 and C6–C7 disc herniations with nerve-root compression — objectively documented, severe cervical injuries.",
    evidence: ["MRI_Report_2026.pdf", "hospital_medical_records.pdf"],
    aiSummary: "Objective MRI imaging documents two-level cervical herniations with nerve compression — hard medical evidence the defense cannot easily contest.",
  },
  {
    title: "Strong Supporting Evidence",
    kind: "strength",
    description: "A continuous, well-documented treatment record corroborates causation and ties the injuries directly to the collision.",
    evidence: ["physical_therapy_notes.pdf", "ER_Bills.pdf"],
    aiSummary: "An unbroken treatment trail from the ER through physical therapy ties the injuries directly to the collision and reinforces causation.",
  },
  {
    title: "High Settlement Potential",
    kind: "strength",
    description: "Clear liability, severe verified injuries, and confirmed commercial coverage support a strong demand at the recommended multiplier.",
    evidence: ["insurance_policy_v2.pdf", "wage_loss_statement.pdf"],
    aiSummary: "Clear liability plus verified injuries and confirmed commercial coverage support a strong demand with adequate funds to recover against.",
  },
  {
    title: "Pre-Existing Condition Risk",
    kind: "risk",
    description: "The defense may attribute part of the cervical findings to prior degeneration; causation records should be marshaled to rebut this.",
    evidence: ["hospital_medical_records.pdf", "MRI_Report_2026.pdf"],
    aiSummary: "The defense may argue prior degeneration explains part of the cervical findings; line up causation records and a treating-physician opinion to rebut it.",
  },
  {
    title: "Treatment Gap Exposure",
    kind: "risk",
    description: "A brief gap in the physical therapy record could be used to question injury severity and continuity of care.",
    evidence: ["physical_therapy_notes.pdf"],
    aiSummary: "A short gap in the therapy record could be used to question injury severity; document the reason for the gap to neutralize the argument.",
  },
];

export function OverviewTab({ model, documents, goTo }: TabProps) {
  const [bioOpen, setBioOpen] = useState(false);

  // Shared Document Workspace state (reused from the Analysis stage). Each finding
  // contributes a set of supporting documents; Prev/Next pages between findings.
  const [wsOpen, setWsOpen] = useState(false);
  const [wsView, setWsView] = useState<"preview" | "insights">("preview");
  const [wsIndex, setWsIndex] = useState(0);
  const [findingTab, setFindingTab] = useState<"strengths" | "risks">("strengths");

  const docForFile = buildDocResolver(documents);

  // Split findings into Strengths (pros) and Risks (cons).
  const strengthCount = KEY_FINDINGS.filter((f) => f.kind === "strength").length;
  const riskCount = KEY_FINDINGS.filter((f) => f.kind === "risk").length;
  const visibleFindings = KEY_FINDINGS.filter((f) => (findingTab === "strengths" ? f.kind === "strength" : f.kind === "risk"));
  const findingDocSets = visibleFindings.map((f) => f.evidence.map(docForFile));
  const findingContexts = visibleFindings.map((f) => ({ contextType: "Finding", reference: f.title }));
  // AI Insights per finding — its aiSummary is the headline; the same text is
  // surfaced inline when the card's Evidence dropdown is expanded.
  const findingInsights = visibleFindings.map((f) => ({
    summary: f.aiSummary,
    keyPoints: [f.description],
    entities: [{ label: "Finding", value: f.title }, { label: "Type", value: f.kind === "strength" ? "Strength" : "Risk" }],
    supportingDocs: f.evidence,
    confidence: { level: f.kind === "strength" ? "High" : "Medium", score: f.kind === "strength" ? 92 : 74 },
  }));
  const openFinding = (i: number, view: "preview" | "insights") => { setWsIndex(i); setWsView(view); setWsOpen(true); };

  // Which finding cards have their Evidence dropdown expanded (by index within the visible tab).
  const [findingEvidenceOpen, setFindingEvidenceOpen] = useState<Set<number>>(new Set());
  const toggleFindingEvidence = (i: number) =>
    setFindingEvidenceOpen((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const plaintiffBio =
    `${model.plaintiff} is a 47-year-old resident of ${model.jurisdiction} and a full-time logistics coordinator. ` +
    `A parent of two with no prior history of cervical injury, she was in good health and actively employed at the time of the incident. ` +
    `Since the collision she has undergone a continuous course of treatment for cervical disc herniations, with documented impact on her ` +
    `ability to work and to carry out everyday activities.`;

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-20 gap-8 items-start">
      {/* LEFT — 30% */}
      <div className="lg:col-span-6 space-y-6 lg:sticky lg:top-[176px] self-start">
        {/* Case Snapshot */}
        <div className="lg-card p-6">
          <h3 className="card-title mb-4">Case Snapshot</h3>
          {/* Two-column grid of compact info tiles. Rows fill left→right:
              Plaintiff/Defendant · Carrier/Jurisdiction · Case ID/Case Type · Date/Status */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Plaintiff — expandable to reveal biography */}
            <div className="col-span-2 rounded-xl border border-line bg-offwhite p-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <User className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                  <span className="eyebrow truncate">Plaintiff</span>
                </div>
                <button
                  onClick={() => setBioOpen((o) => !o)}
                  className="flex items-center gap-1 text-xs font-medium text-deep hover:text-ink transition-colors shrink-0"
                >
                  {bioOpen ? "Hide biography" : "Check biography"}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${bioOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
                </button>
              </div>
              <div className="text-sm font-semibold text-ink leading-snug break-words">{model.plaintiff}</div>
              {bioOpen && (
                <p className="secondary-text leading-relaxed mt-2.5 pt-2.5 border-t border-line">{plaintiffBio}</p>
              )}
            </div>
            <InfoTile icon={Building2} label="Defendant" value={model.defendant} />
            <InfoTile icon={ShieldCheck} label="Insurance Carrier" value={model.insuranceCarrier} />
            <InfoTile icon={MapPin} label="Jurisdiction" value={model.jurisdiction} />
            <InfoTile icon={Hash} label="Case ID" value={model.caseId} />
            <InfoTile icon={Scale} label="Case Type" value={model.caseType} />
            <InfoTile icon={Calendar} label="Incident Date" value={model.incidentDate} />
            <InfoTile icon={DollarSign} label="Recommended Settlement" value={formatRange(model.recommendedSettlement)} wide big />
          </div>

          {/* View Chronology — jumps to the Medical Timeline */}
          <button onClick={() => goTo("medical")} className="btn btn-primary w-full gap-2 mt-4">
            <ClipboardList className="w-4 h-4" strokeWidth={1.75} /> View Chronology
          </button>
        </div>
      </div>

      {/* RIGHT — 70% */}
      <div className="lg:col-span-14 space-y-6">
        {/* AI Case Summary — structured, attorney-friendly breakdown */}
        <div className="rounded-2xl border border-line bg-offwhite p-8 shadow-sm">
          {/* Header */}
          <h2 className="section-header mb-4" style={{ fontSize: "22px" }}>AI Case Summary</h2>

          {/* Summary cards */}
          <div className="space-y-5">
            <SummaryCard icon={Calendar} title="Event Summary">
              <p className="body-text leading-relaxed">
                {model.plaintiff} was involved in a {model.caseType.toLowerCase()} on {model.incidentDate} in {model.jurisdiction} after a
                commercial vehicle operated by {model.defendant} failed to yield at a controlled intersection. The collision resulted in
                significant injuries and initiated the current personal injury claim.
              </p>
            </SummaryCard>

            <SummaryCard icon={HeartPulse} title="Injury Summary">
              <p className="body-text leading-relaxed">
                MRI confirms C5–C6 and C6–C7 disc herniations with nerve-root compression — a severe, objectively verified cervical
                injury. The plaintiff sought emergency care within 24 hours and remains in active treatment, with a guarded prognosis
                and permanent residual impairment expected to affect daily function long-term.
              </p>
            </SummaryCard>

            <SummaryCard icon={Scale} title="Facts & Liability">
              <p className="body-text leading-relaxed mb-4">
                Liability strongly favors the plaintiff based on verified evidence and documented negligence.
              </p>
              <div className="space-y-2.5">
                {LIABILITY_POINTS.map((p) => (
                  <div key={p} className="flex items-start gap-2.5 rounded-lg border border-line bg-offwhite px-3.5 py-2.5">
                    <CheckCircle className="w-4 h-4 text-deep mt-0.5 shrink-0" strokeWidth={1.75} />
                    <span className="text-sm text-ink leading-relaxed">{p}</span>
                  </div>
                ))}
              </div>
            </SummaryCard>

            <SummaryCard icon={Stethoscope} title="Treatment Summary">
              <p className="body-text leading-relaxed">
                Emergency department admission and cervical imaging on the date of incident, followed by a neurology consultation and a
                12-week multi-modal physical therapy program. No surgical intervention to date; care remains ongoing with documented
                range-of-motion deficits and continued pain management.
              </p>
            </SummaryCard>

            <SummaryCard icon={DollarSign} title="Estimated Settlement">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg border border-line bg-offwhite p-3">
                  <div className="eyebrow mb-1">Recommended Settlement</div>
                  <div className="text-xl font-bold text-ink tabular-nums">{formatRange(model.recommendedSettlement)}</div>
                </div>
                <div className="rounded-lg border border-line bg-offwhite p-3">
                  <div className="eyebrow mb-1">Recommended Multiplier</div>
                  <div className="text-xl font-bold text-deep tabular-nums">{model.multiplier}×</div>
                </div>
                <div className="rounded-lg border border-line bg-offwhite p-3">
                  <div className="eyebrow mb-1">Confidence</div>
                  <div className="text-xl font-bold text-deep tabular-nums">{model.confidence}%</div>
                </div>
              </div>
              <p className="body-text leading-relaxed">
                “Recommendation based on verified economic damages, severe injuries, strong liability, and supporting evidence.”
              </p>
            </SummaryCard>
          </div>
        </div>

        {/* Litigation Key Findings — evidence-backed & actionable, split into pros / cons */}
        <div className="lg-card p-6">
          <h3 className="card-title mb-4">Litigation Key Findings</h3>

          {/* Strengths / Risks tabs */}
          <div className="flex items-center gap-2 mb-5">
            {([
              { key: "strengths", label: "Strengths", count: strengthCount },
              { key: "risks", label: "Risks", count: riskCount },
            ] as const).map((tab) => {
              const active = findingTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFindingTab(tab.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    active ? "bg-tint border-brand text-deep" : "bg-white border-line text-[#5B6B78] hover:border-soft hover:text-ink"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              );
            })}
          </div>

          {visibleFindings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle className="w-8 h-8 text-green-700 mb-3" strokeWidth={1.75} />
              <p className="text-sm font-medium text-ink">No risks identified</p>
              <p className="secondary-text mt-1">No material weaknesses were flagged for this case.</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {visibleFindings.map((f, i) => (
              <div key={f.title} className="rounded-xl border border-line bg-white p-5 flex flex-col">
                {/* Status icon + title */}
                <div className="flex items-start gap-2.5 mb-2">
                  {f.kind === "strength"
                    ? <CheckCircle className="w-5 h-5 text-green-700 shrink-0 mt-0.5" strokeWidth={1.75} />
                    : <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0 mt-0.5" strokeWidth={1.75} />}
                  <h4 className="card-title leading-snug">{f.title}</h4>
                </div>

                {/* Description */}
                <p className="body-text leading-relaxed">{f.description}</p>

                {/* Evidence — expandable to reveal an AI summary */}
                <div className="mt-4 pt-4 border-t border-line">
                  <button
                    onClick={() => toggleFindingEvidence(i)}
                    className="w-full flex items-center justify-between gap-2 group"
                  >
                    <span className="eyebrow group-hover:text-ink transition-colors">Evidence</span>
                    <ChevronDown className={`w-4 h-4 text-deep transition-transform ${findingEvidenceOpen.has(i) ? "rotate-180" : ""}`} strokeWidth={1.75} />
                  </button>
                  <div className="flex items-center gap-1.5 secondary-text mt-1.5">
                    <FileText className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} />
                    {f.evidence.length} Supporting {f.evidence.length === 1 ? "Document" : "Documents"}
                  </div>
                  {findingEvidenceOpen.has(i) && (
                    <div className="mt-3 rounded-lg bg-tint border border-[#D6F2F7] p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                        <span className="eyebrow text-deep">AI Summary</span>
                      </div>
                      <p className="secondary-text leading-relaxed">{f.aiSummary}</p>
                    </div>
                  )}
                </div>

                {/* Actions — reuse the Analysis Preview / Insights workspace */}
                <div className="mt-auto pt-4 flex items-center gap-2">
                  <button
                    onClick={() => openFinding(i, "preview")}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-line text-ink rounded-lg text-sm font-medium hover:bg-wash transition-colors"
                  >
                    <Eye className="w-4 h-4" strokeWidth={1.75} /> Preview
                  </button>
                  <button
                    onClick={() => openFinding(i, "insights")}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-line text-deep rounded-lg text-sm font-medium hover:bg-tint transition-colors"
                  >
                    <Sparkles className="w-4 h-4" strokeWidth={1.75} /> Insights
                  </button>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

      </div>
    </div>

    {/* Shared Document Workspace — Preview / Insights for the selected finding */}
    <DocumentWorkspaceModal
      docs={wsOpen ? (findingDocSets[wsIndex] ?? []) : null}
      noteContext={findingContexts[wsIndex]}
      insights={findingInsights[wsIndex]}
      initialView={wsView}
      position={wsIndex + 1}
      total={findingDocSets.length}
      onPrev={() => setWsIndex((i) => Math.max(0, i - 1))}
      onNext={() => setWsIndex((i) => Math.min(findingDocSets.length - 1, i + 1))}
      onClose={() => setWsOpen(false)}
      onDownload={() => {}}
    />
    </>
  );
}

// ── Tab 2 — Chronology ────────────────────────────────────────────────────────

// Structured classification behind a chronology card's contextual tags.
// `tags` is what the card renders: primary category first, then specificity.
export interface ChronTaxonomy {
  eventType: "medical" | "case";
  category: string;
  subcategory?: string;
  tags: string[];
}

export interface ChronEvent {
  id?: string;
  date: string;
  time?: string;
  title: string;
  description: string;
  insight: string;
  evidence: string[];
  actions?: { text: string; time?: string; description?: string; evidence?: string[] }[]; // key actions (Event Chronology milestones)
  // ── Origin of the entry. Absent = system-generated from verified evidence.
  // "user" = created by hand in the Add Chronology drawer. The origin never
  // changes, even after AI tools are run on the event.
  source?: "system" | "user";
  category?: string;                              // set on user-added events; drives the event-type filter
  // Structured tag metadata. The contextual tags on a card are read from here,
  // never inferred from the title at render time.
  taxonomy?: ChronTaxonomy;
  addedBy?: string;
  addedAt?: string;
  details?: { label: string; value: string }[];   // provider / injury / severity / notes, shown on open
}

const MEDICAL_CHRONOLOGY: ChronEvent[] = [
  {
    date: "Feb 14, 2026", time: "9:42 AM", title: "Initial Emergency Admission",
    taxonomy: { eventType: "medical", category: "Emergency Care", subcategory: "Initial Assessment", tags: ["Emergency Care","Initial Assessment"] },
    description: "The plaintiff arrived by ambulance at Cook County Medical Center with acute neck pain and neurological symptoms. Trauma assessment and cervical immobilization were performed on arrival.",
    insight: "This event establishes the beginning of documented treatment within hours of the collision and supports causation.",
    evidence: ["ER_Bills.pdf", "hospital_medical_records.pdf"],
  },
  {
    date: "Feb 16, 2026", title: "MRI Completed",
    taxonomy: { eventType: "medical", category: "Diagnostic Imaging", subcategory: "MRI", tags: ["Diagnostic Imaging","MRI"] },
    description: "Diagnostic MRI of the cervical spine was performed, confirming C5–C6 and C6–C7 disc herniations with nerve-root compression.",
    insight: "Objective imaging links the collision to a confirmed, diagnosable injury — a cornerstone of the damages case.",
    evidence: ["MRI_Report_2026.pdf"],
  },
  {
    date: "Feb 23, 2026", title: "Neurology Consultation",
    taxonomy: { eventType: "medical", category: "Specialist Consultation", subcategory: "Neurology", tags: ["Specialist Consultation","Neurology"] },
    description: "A neurology specialist evaluated the plaintiff, confirmed traumatic causation, and recommended a course of conservative management with physical therapy.",
    insight: "Specialist confirmation of traumatic causation strengthens the link between the incident and the injury.",
    evidence: ["hospital_medical_records.pdf"],
  },
  {
    date: "Mar 2, 2026", title: "Physical Therapy Started",
    taxonomy: { eventType: "medical", category: "Rehabilitation", subcategory: "Physical Therapy", tags: ["Rehabilitation","Physical Therapy"] },
    description: "The plaintiff began a structured, multi-modal physical therapy program targeting cervical mobility and pain management.",
    insight: "Prompt, continuous treatment demonstrates the seriousness of the injury and supports ongoing-care damages.",
    evidence: ["physical_therapy_notes.pdf"],
  },
  {
    date: "Apr 20, 2026", title: "Mid-Treatment Re-Evaluation",
    taxonomy: { eventType: "medical", category: "Follow-Up", subcategory: "Treatment Progress", tags: ["Follow-Up","Treatment Progress"] },
    description: "A re-evaluation documented persistent range-of-motion deficits and chronic pain despite ongoing therapy.",
    insight: "Documented lack of full recovery supports the severity and permanence of the injury.",
    evidence: ["physical_therapy_notes.pdf"],
  },
  {
    date: "Jun 5, 2026", title: "Follow-Up Evaluation",
    taxonomy: { eventType: "medical", category: "Follow-Up Care", subcategory: "Prognosis", tags: ["Follow-Up Care","Prognosis"] },
    description: "A follow-up assessment recorded a guarded prognosis with permanent residual impairment anticipated, and recommended continued care.",
    insight: "A guarded prognosis substantiates future-care and non-economic damages.",
    evidence: ["hospital_medical_records.pdf"],
  },
];

// Event Chronology — each entry is a major case milestone grouping several
// underlying actions (the timeline shows only the most important ones).
const EVENT_CHRONOLOGY: ChronEvent[] = [
  {
    date: "Feb 14, 2026", time: "9:05 AM", title: "Collision Occurred",
    taxonomy: { eventType: "case", category: "Accident", subcategory: "Liability", tags: ["Accident","Liability"] },
    description: "A commercial vehicle operated by Midwest Logistics Co. failed to yield at a controlled intersection and struck the plaintiff's vehicle.",
    insight: "This is the originating event of the claim and the basis for the negligence theory against the defendant.",
    actions: [
      { text: "Commercial vehicle entered the intersection", time: "9:04 AM", description: "Officer reconstruction confirms the truck entered the intersection against a red signal.", evidence: ["Police Report", "Traffic Camera"] },
      { text: "Impact with plaintiff's vehicle", time: "9:05 AM", description: "Front-end collision caused significant cervical trauma.", evidence: ["Police Report", "Vehicle Photos"] },
      { text: "Emergency services notified", time: "9:07 AM", description: "Witnesses contacted 911 immediately after the collision.", evidence: ["Dispatch Log"] },
    ],
    evidence: ["police_report_final.pdf"],
  },
  {
    date: "Feb 14, 2026", title: "Initial Emergency Response",
    taxonomy: { eventType: "case", category: "Emergency Response", subcategory: "Accident Response", tags: ["Emergency Response","Accident Response"] },
    description: "Emergency services responded to the scene and transported the plaintiff to Cook County Medical Center for assessment.",
    insight: "Establishes an immediate, contemporaneous record of the incident and the plaintiff's injuries.",
    actions: [
      { text: "Ambulance dispatched", time: "9:11 AM", description: "EMS was dispatched to the scene within minutes of the 911 call.", evidence: ["Dispatch Log"] },
      { text: "Scene documented by first responders", time: "9:20 AM", description: "Responders photographed the scene and recorded initial observations.", evidence: ["Scene Photos"] },
      { text: "Plaintiff transported to Cook County Medical Center", time: "9:42 AM", description: "Plaintiff transported by ambulance for emergency assessment.", evidence: ["EMS Report"] },
      { text: "Vitals and injuries recorded on arrival", time: "9:55 AM", description: "Acute neck pain and neurological symptoms documented at intake.", evidence: ["ER Record"] },
    ],
    evidence: ["emergency_dispatch_record.pdf", "hospital_medical_records.pdf"],
  },
  {
    date: "Feb 14 – 15, 2026", title: "Police Investigation",
    taxonomy: { eventType: "case", category: "Police Investigation", subcategory: "Liability Evidence", tags: ["Police Investigation","Liability Evidence"] },
    description: "Responding officers investigated the scene, determined fault, and collected initial witness accounts.",
    insight: "The officer's fault determination and witness corroboration are strong, objective evidence of liability.",
    actions: [
      { text: "Officers arrived and secured the scene", time: "Feb 14 · 9:28 AM", description: "Responding officers established the scene and managed traffic.", evidence: ["Police Report"] },
      { text: "Skid marks and debris field documented", time: "Feb 14 · 9:45 AM", description: "Physical evidence consistent with the plaintiff's account of the collision.", evidence: ["Scene Photos"] },
      { text: "Initial witness statements collected", time: "Feb 14 · 10:10 AM", description: "An independent witness corroborated the signal violation.", evidence: ["Witness Statement"] },
      { text: "Commercial driver cited for failure to yield", time: "Feb 14 · 11:30 AM", description: "The officer attributed primary fault to the commercial driver.", evidence: ["Citation"] },
      { text: "Police report filed", time: "Feb 15", description: "The final report was completed and filed with the fault determination.", evidence: ["Police Report"] },
    ],
    evidence: ["police_report_final.pdf", "witness_statement.pdf"],
  },
  {
    date: "Feb 20, 2026", title: "Insurance Claim Filed",
    taxonomy: { eventType: "case", category: "Insurance", subcategory: "Claim", tags: ["Insurance","Claim"] },
    description: "A claim was filed against the defendant's commercial liability policy and acknowledged by the carrier.",
    insight: "Confirmed coverage ensures an adequate source of recovery for the projected demand.",
    actions: [
      { text: "Claim filed against the carrier", time: "Feb 20", description: "A liability claim was submitted to the defendant's commercial carrier.", evidence: ["Claim Form"] },
      { text: "Commercial coverage confirmed active", time: "Feb 24", description: "The policy was verified active on the date of loss.", evidence: ["Insurance Policy"] },
      { text: "Carrier acknowledged the claim", time: "Mar 6", description: "The carrier opened its investigation and requested documentation.", evidence: ["Correspondence"] },
    ],
    evidence: ["insurance_policy_v2.pdf"],
  },
  {
    date: "Mar – May, 2026", title: "Case Preparation",
    taxonomy: { eventType: "case", category: "Case Preparation", subcategory: "Evidence Collection", tags: ["Case Preparation","Evidence Collection"] },
    description: "Medical records and supporting documentation were assembled to substantiate liability and damages.",
    insight: "A complete, verified record base underpins both causation and the damages calculation.",
    actions: [
      { text: "Medical records requested and assembled", time: "Mar 24", description: "Complete treatment records were gathered to substantiate the injuries.", evidence: ["Medical Records"] },
      { text: "Wage-loss documentation obtained", time: "Apr 10", description: "Employer verification of lost income was collected.", evidence: ["Wage Loss Statement"] },
      { text: "Evidence index compiled", time: "May 2", description: "All exhibits were organized and indexed for the demand.", evidence: ["Evidence Index"] },
      { text: "Damages computed", time: "May 28", description: "Economic and non-economic damages were calculated.", evidence: ["Damages Summary"] },
    ],
    evidence: ["hospital_medical_records.pdf", "wage_loss_statement.pdf"],
  },
  {
    date: "Jun 9 – 11, 2026", title: "Settlement Negotiation",
    taxonomy: { eventType: "case", category: "Settlement", subcategory: "Negotiation", tags: ["Settlement","Negotiation"] },
    description: "An attorney-ready demand package was delivered to the carrier and the matter advanced to negotiation.",
    insight: "Anchors the negotiation above the projected settlement range with documented support.",
    actions: [
      { text: "Demand letter delivered", time: "Jun 9", description: "An attorney-ready demand package was delivered to the carrier.", evidence: ["Demand Letter"] },
      { text: "Recommended settlement value asserted", time: "Jun 9", description: "The recommended value was asserted with supporting documentation.", evidence: ["Damages Summary"] },
      { text: "Negotiation opened with the carrier", time: "Jun 11", description: "Negotiations commenced toward a resolution.", evidence: ["Correspondence"] },
    ],
    evidence: ["demand_letter_draft.pdf"],
  },
];

// The signed-in attorney — stamped on manually created chronology entries.
const CURRENT_USER = "Jennifer Davis";

// ── Chronology toolbar helpers ────────────────────────────────────────────────

// Event categories, keyed by title, drive the tab-aware filter dropdown.
const MEDICAL_CATEGORIES: Record<string, string> = {
  "Initial Emergency Admission": "Emergency",
  "MRI Completed": "Diagnostic",
  "Neurology Consultation": "Consultation",
  "Physical Therapy Started": "Therapy",
  "Mid-Treatment Re-Evaluation": "Evaluation",
  "Follow-Up Evaluation": "Evaluation",
};
const EVENT_CATEGORIES: Record<string, string> = {
  "Collision Occurred": "Incident",
  "Initial Emergency Response": "Medical Response",
  "Police Investigation": "Investigation",
  "Insurance Claim Filed": "Insurance",
  "Case Preparation": "Preparation",
  "Settlement Negotiation": "Negotiation",
};
const MEDICAL_FILTERS = ["Emergency", "Diagnostic", "Consultation", "Therapy", "Evaluation"];
const EVENT_FILTERS = ["Incident", "Medical Response", "Investigation", "Insurance", "Preparation", "Negotiation"];

const MONTHS_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Parse the starting month/day/year from a chronology date label. Handles single
// dates ("Feb 14, 2026") and ranges ("Feb 14 – 15, 2026", "Mar – May, 2026").
function parseChronStart(date: string): { month: number; day: number; year: number } | null {
  const mon = date.match(/([A-Z][a-z]{2,})/);
  const yr = date.match(/(\d{4})/);
  const dayMatch = date.match(/[A-Z][a-z]{2,}\s+(\d{1,2})/);
  if (!mon || !yr) return null;
  const month = MONTHS_ABBR.indexOf(mon[1].slice(0, 3));
  if (month < 0) return null;
  return { month, day: dayMatch ? parseInt(dayMatch[1], 10) : 1, year: parseInt(yr[1], 10) };
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fmtShort = (d: Date) => `${MONTHS_ABBR[d.getMonth()]} ${d.getDate()}`;

// "9:42 AM" → minutes past midnight; null when the event carries no time.
function parseChronTime(time?: string): number | null {
  const m = time?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  const h = parseInt(m[1], 10) % 12;
  return (m[3].toUpperCase() === "PM" ? h + 12 : h) * 60 + parseInt(m[2], 10);
}

// Merge manually added events into the generated timeline and keep the whole
// list in date order — a new Feb 20 event lands between Feb 16 and Feb 23, not
// at the bottom. Same-day entries keep their existing relative order unless
// both carry a time, so the generated sequence is never reshuffled.
function mergeChronologically(base: ChronEvent[], added: ChronEvent[]): ChronEvent[] {
  return [...base, ...added]
    .map((ev, i) => {
      const p = parseChronStart(ev.date);
      return { ev, i, day: p ? new Date(p.year, p.month, p.day).getTime() : 0, min: parseChronTime(ev.time) };
    })
    .sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      if (a.min !== null && b.min !== null && a.min !== b.min) return a.min - b.min;
      return a.i - b.i;
    })
    .map((x) => x.ev);
}

// A manually created entry, as the drawer hands it back.
function toChronEvent(c: CreatedChronology): ChronEvent {
  return {
    id: `user-${c.addedAt}-${c.title}`,
    date: c.date,
    time: c.time,
    title: c.title,
    description: c.description,
    insight:
      "Attorney-recorded event. It is part of the chronology and is supported by the documentation attached to it.",
    evidence: c.evidence,
    actions: c.actions && c.actions.length > 0 ? c.actions : undefined,
    source: "user",
    category: c.category,
    taxonomy: c.taxonomy.tags.length > 0 ? c.taxonomy : undefined,
    addedBy: c.addedBy,
    addedAt: c.addedAt,
    details: c.details,
  };
}

// Date-picker popup for the Chronology toolbar — pick a single date or a custom
// range. Selection filters the chronology; nothing selected = show everything.
function ChronologyDatePicker({
  mode, setMode, selDate, rangeFrom, rangeTo, onPick, onClear, onDone, setRangeFrom, setRangeTo,
}: {
  mode: "single" | "range";
  setMode: (m: "single" | "range") => void;
  selDate: Date | null;
  rangeFrom: Date | null;
  rangeTo: Date | null;
  onPick: (d: Date) => void;
  onClear: () => void;
  onDone: () => void;
  setRangeFrom: (d: Date | null) => void;
  setRangeTo: (d: Date | null) => void;
}) {
  // <input type="date"> uses yyyy-mm-dd; convert to/from local Date.
  const toInput = (d: Date | null) =>
    d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
  const fromInput = (v: string) => {
    if (!v) return null;
    const [y, m, dd] = v.split("-").map(Number);
    return new Date(y, m - 1, dd);
  };
  // The visible month defaults to the first selection, else the chronology start (Feb 2026).
  const initial = selDate ?? rangeFrom ?? new Date(2026, 1, 1);
  const [cal, setCal] = useState<{ year: number; month: number }>({ year: initial.getFullYear(), month: initial.getMonth() });
  const shift = (delta: number) =>
    setCal((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });

  const firstWeekday = new Date(cal.year, cal.month, 1).getDay();
  const daysInMonth = new Date(cal.year, cal.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, k) => k + 1),
  ];

  const rangeEnd = rangeTo ?? rangeFrom;
  const isSelected = (d: Date) =>
    mode === "single" ? !!selDate && sameDay(d, selDate) : (!!rangeFrom && sameDay(d, rangeFrom)) || (!!rangeEnd && sameDay(d, rangeEnd));
  const inRangeMiddle = (d: Date) =>
    mode === "range" && !!rangeFrom && !!rangeTo && d.getTime() > rangeFrom.getTime() && d.getTime() < rangeTo.getTime();

  const summary =
    mode === "single"
      ? (selDate ? fmtShort(selDate) : "No date selected")
      : rangeFrom
      ? `${fmtShort(rangeFrom)}${rangeTo ? ` – ${fmtShort(rangeTo)}` : " – …"}`
      : "No range selected";

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onDone} />
      <div className="absolute left-0 mt-1.5 z-20 w-[300px] rounded-xl border border-line bg-white shadow-lg p-3">
        {/* Mode toggle — Date | Range */}
        <div className="flex items-center rounded-lg border border-line bg-white p-0.5 mb-3">
          {([{ key: "single", label: "Date" }, { key: "range", label: "Custom Range" }] as const).map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                mode === m.key ? "bg-tint text-deep" : "text-[#5B6B78] hover:text-ink"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Custom range — type or pick the From / To dates directly */}
        {mode === "range" && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="eyebrow mb-1 block">From</label>
              <input
                type="date"
                value={toInput(rangeFrom)}
                onChange={(e) => setRangeFrom(fromInput(e.target.value))}
                className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-brand transition-colors"
              />
            </div>
            <div>
              <label className="eyebrow mb-1 block">To</label>
              <input
                type="date"
                value={toInput(rangeTo)}
                min={toInput(rangeFrom)}
                onChange={(e) => setRangeTo(fromInput(e.target.value))}
                className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-brand transition-colors"
              />
            </div>
          </div>
        )}

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => shift(-1)} aria-label="Previous month" className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5B6B78] hover:bg-wash hover:text-ink transition-colors">
            <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
          </button>
          <span className="card-title">{MONTHS_FULL[cal.month]} {cal.year}</span>
          <button onClick={() => shift(1)} aria-label="Next month" className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5B6B78] hover:bg-wash hover:text-ink transition-colors">
            <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, k) => (
            <div key={k} className="text-center eyebrow py-1">{d}</div>
          ))}
          {cells.map((day, k) => {
            if (day === null) return <div key={k} />;
            const date = new Date(cal.year, cal.month, day);
            const selected = isSelected(date);
            const middle = inRangeMiddle(date);
            return (
              <button
                key={k}
                onClick={() => onPick(date)}
                className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                  selected
                    ? "bg-brand text-white"
                    : middle
                    ? "bg-tint text-deep"
                    : "text-ink hover:bg-wash"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Selection summary + actions */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
          <span className="secondary-text">{summary}</span>
          <div className="flex items-center gap-2">
            <button onClick={onClear} className="text-sm font-medium text-[#5B6B78] hover:text-ink transition-colors">Clear</button>
            <button onClick={onDone} className="btn btn-primary px-3 py-1.5 text-sm">Done</button>
          </div>
        </div>
      </div>
    </>
  );
}

type PanelMode = "severity" | "forensic" | "expert";

// Close (X) button shown on the revealed panel.
function PanelClose({ onClose }: { onClose?: () => void }) {
  if (!onClose) return null;
  return (
    <button onClick={onClose} title="Close" className="p-1 -mr-1 rounded-md hover:bg-white/70 transition-colors shrink-0">
      <X className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} />
    </button>
  );
}

// 1 — Assess Severity (brand light theme)
function SeverityPanel({ onClose }: { onClose?: () => void }) {
  return (
    <div className="rounded-xl border border-[#D6F2F7] bg-[#F6FDFF] p-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className="card-title">Priority Assessment</h4>
          <span className="pill pill-neutral shrink-0"><AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} /> Moderate Priority</span>
        </div>
        <PanelClose onClose={onClose} />
      </div>
      <div className="eyebrow text-deep mb-2">Liability Priority Assessment</div>
      <p className="body-text leading-relaxed">
        Requires regulatory review. This event has moderate litigation importance and contributes supporting evidence toward liability.
      </p>
    </div>
  );
}

// 2 — Forensic Analysis (brand light theme)
function ForensicPanel({ ev, onClose }: { ev: ChronEvent; onClose?: () => void }) {
  const sections: [string, string][] = [
    ["Evidence Summary", ev.description],
    ["Medical Interpretation", "Findings are consistent with a traumatic cervical injury showing disc herniation and nerve-root involvement — a significant, objectively documented impairment."],
    ["Legal Significance", "Reinforces the negligence theory and ties the documented harm directly to the defendant's breach of duty."],
    ["Settlement Impact", "Reinforces causation and injury severity, supporting the recommended multiplier and overall settlement value."],
  ];
  return (
    <div className="rounded-xl border border-[#D6F2F7] bg-[#F6FDFF] p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-4 h-4 text-deep" strokeWidth={1.75} />
          <h4 className="card-title">Forensic Analysis</h4>
          <span className="pill pill-neutral shrink-0">AI Generated</span>
        </div>
        <PanelClose onClose={onClose} />
      </div>
      {/* AI Summary — moved off the timeline card */}
      <div className="rounded-lg border border-[#D6F2F7] bg-white p-3 mb-3">
        <div className="eyebrow text-deep mb-1">AI Summary</div>
        <p className="body-text leading-relaxed">{ev.insight}</p>
      </div>
      <div className="space-y-3">
        {sections.map(([t, b]) => (
          <div key={t}>
            <div className="eyebrow text-deep mb-1">{t}</div>
            <p className="body-text leading-relaxed">{b}</p>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <span className="eyebrow">Confidence</span>
          <span className="pill pill-complete">High (92%)</span>
        </div>
      </div>
    </div>
  );
}

// 3 — Ask Medical Expert (brand light theme)
function ExpertPanel({ onClose }: { ev?: ChronEvent; onClose?: () => void }) {
  const questions = ["Explain standard of care", "What is the medical causation?", "What future medical costs can we claim?"];
  return (
    <div className="rounded-xl border border-[#D6F2F7] bg-[#F6FDFF] p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-tint flex items-center justify-center shrink-0">
            <Stethoscope className="w-5 h-5 text-deep" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h4 className="card-title leading-tight">Dr. Sarah Lin, MD</h4>
            <div className="secondary-text">Forensic Medical Consultant</div>
          </div>
        </div>
        <PanelClose onClose={onClose} />
      </div>
      <p className="body-text leading-relaxed mb-3">Ask Dr. Lin about the clinical significance of this evidence.</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {questions.map((q) => (
          <button key={q} className="inline-flex items-center gap-1.5 rounded-full border border-[#D6F2F7] bg-white px-3 py-1.5 text-xs text-ink hover:bg-tint transition-colors">
            <MessageSquare className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> {q}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          placeholder="Ask Dr. Lin about this evidence..."
          className="flex-1 bg-white border border-[#D6F2F7] rounded-lg px-3 py-2 text-sm text-ink placeholder:text-[#5B6B78] focus:outline-none focus:border-brand transition-colors"
        />
        <button className="btn btn-primary shrink-0">Consult Expert</button>
      </div>
    </div>
  );
}

// Contextual tags shown under a chronology card's title. Reads the event's
// structured taxonomy — never inferred from the title at render time — and
// renders nothing for an event that has not been classified. Capped at three
// so the strip stays scannable.
function ChronologyTags({ taxonomy }: { taxonomy?: ChronTaxonomy }) {
  const tags = taxonomy?.tags?.filter(Boolean).slice(0, 3) ?? [];
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center rounded-md border border-[#DCEEF4] bg-tint px-2 py-0.5 text-[11px] font-medium text-deep leading-[1.5]"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

// Supporting-evidence chips: one document + an aggregated "+N More".
function EvidenceChips({ evidence, onOpen, align }: { evidence: string[]; onOpen: () => void; align?: "right" }) {
  return (
    <div className={`flex items-center gap-2 flex-wrap ${align === "right" ? "justify-end" : ""}`}>
      <button
        onClick={onOpen}
        title="Open evidence review"
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-offwhite px-3 py-2 text-sm text-ink cursor-pointer hover:border-brand hover:bg-tint hover:shadow-sm transition-all"
      >
        <FileText className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
        <span className="truncate max-w-[220px]">{evidence[0]}</span>
      </button>
      {evidence.length > 1 && (
        <button
          onClick={onOpen}
          title="Open evidence review"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-offwhite px-3 py-2 text-sm font-medium text-deep cursor-pointer hover:border-brand hover:bg-tint hover:shadow-sm transition-all"
        >
          <FileText className="w-4 h-4 shrink-0" strokeWidth={1.75} />
          +{evidence.length - 1} More
        </button>
      )}
    </div>
  );
}

// Manually added chronology lives above this component so it survives tab
// switches and so the Chronology stage's Evidence section can see the documents
// the attorney attached to those events.
export interface UserChronology { medical: ChronEvent[]; event: ChronEvent[] }
export const EMPTY_USER_CHRONOLOGY: UserChronology = { medical: [], event: [] };

export function MedicalTimelineTab({
  documents, goTo, userChronology = EMPTY_USER_CHRONOLOGY, onAddChronology,
}: TabProps & { userChronology?: UserChronology; onAddChronology?: (kind: "medical" | "event", ev: ChronEvent) => void }) {
  const [subTab, setSubTab] = useState<"medical" | "event">("medical");
  // Inline accordion: only one panel open across all medical cards at a time.
  const [openPanel, setOpenPanel] = useState<{ index: number; mode: PanelMode } | null>(null);
  const togglePanel = (index: number, mode: PanelMode) =>
    setOpenPanel((p) => (p && p.index === index && p.mode === mode ? null : { index, mode }));
  // Evidence Review Workspace — opened from a card's Supporting Evidence chips.
  const [evidenceEvent, setEvidenceEvent] = useState<ChronEvent | null>(null);
  const [evidenceAI, setEvidenceAI] = useState<"actions" | "insights" | "chat" | "severity" | "forensic" | "expert" | null>(null);
  const openEvidence = (
    ev: ChronEvent,
    opts: { ai?: "actions" | "insights" | "chat" | "severity" | "forensic" | "expert" } = {},
  ) => { setEvidenceEvent(ev); setEvidenceAI(opts.ai ?? null); };

  // ── Chronology toolbar state ──
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // "all" or a category name
  const [filterOpen, setFilterOpen] = useState(false);
  // Date filter (calendar popup): single date or a custom from–to range.
  const [calOpen, setCalOpen] = useState(false);
  const [dateMode, setDateMode] = useState<"single" | "range">("single");
  const [selDate, setSelDate] = useState<Date | null>(null);
  const [rangeFrom, setRangeFrom] = useState<Date | null>(null);
  const [rangeTo, setRangeTo] = useState<Date | null>(null);

  // ── Manually added chronology (Add Chronology drawer) ──
  const [addOpen, setAddOpen] = useState(false);
  const userMedical = userChronology.medical;
  const userEvent = userChronology.event;
  const [toast, setToast] = useState<string | null>(null);

  // Full timelines — generated events with the attorney's entries slotted in by date.
  const medicalAll = mergeChronologically(MEDICAL_CHRONOLOGY, userMedical);
  const eventAll = mergeChronologically(EVENT_CHRONOLOGY, userEvent);

  const addChronology = (c: CreatedChronology) => {
    onAddChronology?.(c.kind, toChronEvent(c));
    setAddOpen(false);
    setOpenPanel(null); // indices shift once the new card is slotted in
    setToast(c.kind === "medical" ? "Medical chronology added successfully." : "Event chronology added successfully.");
  };

  // Auto-dismiss the confirmation toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const clearDates = () => { setSelDate(null); setRangeFrom(null); setRangeTo(null); };
  // Click handling inside the calendar grid: single sets the date; range fills
  // from → to, then starts over on the next click.
  const pickDay = (d: Date) => {
    if (dateMode === "single") { setSelDate(d); return; }
    if (!rangeFrom || (rangeFrom && rangeTo)) { setRangeFrom(d); setRangeTo(null); return; }
    if (d.getTime() < rangeFrom.getTime()) { setRangeTo(rangeFrom); setRangeFrom(d); }
    else setRangeTo(d);
  };
  const hasDateFilter = dateMode === "single" ? !!selDate : !!rangeFrom;

  // Switching tabs resets the category + date filters (and any open dropdown).
  const selectSubTab = (key: "medical" | "event") => {
    setSubTab(key);
    setFilter("all");
    setFilterOpen(false);
    clearDates();
  };

  const categoryOf = (ev: ChronEvent) =>
    ev.category ?? (subTab === "medical" ? MEDICAL_CATEGORIES : EVENT_CATEGORIES)[ev.title] ?? "Other";
  // Base options, plus any category a manually added event introduced.
  const baseFilters = subTab === "medical" ? MEDICAL_FILTERS : EVENT_FILTERS;
  const filterOptions = [
    ...baseFilters,
    ...Array.from(new Set((subTab === "medical" ? userMedical : userEvent).map(categoryOf))).filter(
      (c) => !baseFilters.includes(c),
    ),
  ];
  const allLabel = subTab === "medical" ? "All Medical Events" : "All Case Events";
  const filterLabel = filter === "all" ? allLabel : filter;

  const eventDate = (ev: ChronEvent) => {
    const p = parseChronStart(ev.date);
    return p ? new Date(p.year, p.month, p.day) : null;
  };
  const matchesDate = (ev: ChronEvent) => {
    if (!hasDateFilter) return true;
    const d = eventDate(ev);
    if (!d) return false;
    if (dateMode === "single") return !!selDate && sameDay(d, selDate);
    const end = rangeTo ?? rangeFrom!;
    return d.getTime() >= rangeFrom!.getTime() && d.getTime() <= end.getTime();
  };
  const calLabel = !hasDateFilter
    ? "Calendar"
    : dateMode === "single"
    ? fmtShort(selDate!)
    : `${fmtShort(rangeFrom!)}${rangeTo ? ` – ${fmtShort(rangeTo)}` : ""}`;

  const docForFile = buildDocResolver(documents);
  // Documents the attorney can attach — the case file, plus anything already
  // cited by the generated chronology.
  const attachableDocs = Array.from(
    new Set([
      ...documents.map((d) => d.name),
      ...MEDICAL_CHRONOLOGY.flatMap((e) => e.evidence),
      ...EVENT_CHRONOLOGY.flatMap((e) => e.evidence),
    ]),
  );
  const q = search.trim().toLowerCase();
  const events = (subTab === "medical" ? medicalAll : eventAll).filter(
    (ev) =>
      (filter === "all" || categoryOf(ev) === filter) &&
      (q === "" || (ev.title + " " + ev.description).toLowerCase().includes(q)) &&
      matchesDate(ev),
  );
  const evidenceDocs = evidenceEvent ? evidenceEvent.evidence.map(docForFile) : [];

  return (
    <>
    <div className="w-full flex flex-col lg:flex-row gap-6 items-start">
      {/* Timeline content — placed on the left, widened to fill */}
      <div className="flex-1 min-w-0 lg:order-1 rounded-2xl border border-line bg-offwhite p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="section-header" style={{ fontSize: "22px" }}>Chronology</h2>
          <p className="secondary-text mt-1 max-w-2xl">
            Review the complete sequence of medical treatment and case events generated from verified evidence.
          </p>
        </div>
        <span className="pill pill-complete shrink-0"><CheckCircle className="w-3.5 h-3.5" strokeWidth={1.75} /> Timeline Generated</span>
      </div>

      {/* Toolbar (tabs + controls) with the active date-filter chip beneath it */}
      <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Left — chronology tabs */}
        <div className="flex items-center gap-2">
          {([
            { key: "medical", label: "Medical Chronology", count: medicalAll.length },
            { key: "event", label: "Event Chronology", count: eventAll.length },
          ] as const).map((t) => {
            const active = subTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => selectSubTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  active ? "bg-tint border-brand text-deep" : "bg-white border-line text-[#5B6B78] hover:border-soft hover:text-ink"
                }`}
              >
                {t.label}
                <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold ${
                  active ? "bg-brand text-white" : "bg-track text-[#5B6B78]"
                }`}>{t.count}</span>
              </button>
            );
          })}
        </div>

        {/* Right — Add Chronology + expandable search (date & event filters live in the Filters card) */}
        <div className="flex items-center gap-2">
          {/* Add Chronology — opens the form for whichever tab is active */}
          <button
            onClick={() => setAddOpen(true)}
            className="btn btn-primary gap-1.5 px-4 py-2"
            title={subTab === "medical" ? "Add a medical chronology event" : "Add a case chronology event"}
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} /> Add Chronology
          </button>

          {/* Expandable search — icon-only until clicked */}
          <div className={`flex items-center rounded-lg border transition-all duration-300 ease-out overflow-hidden ${
            searchOpen ? "w-[240px] border-line bg-white" : "w-9 border-transparent bg-transparent"
          }`}>
            <button
              onClick={() => (searchOpen && !search ? setSearchOpen(false) : setSearchOpen(true))}
              aria-label="Search chronology"
              className="w-9 h-9 shrink-0 flex items-center justify-center text-[#5B6B78] hover:text-ink transition-colors"
            >
              <Search className="w-4 h-4" strokeWidth={1.75} />
            </button>
            {searchOpen && (
              <>
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onBlur={() => { if (!search) setSearchOpen(false); }}
                  placeholder="Search chronology..."
                  className="flex-1 min-w-0 bg-transparent text-sm py-2 pr-1 placeholder:text-[#9BA8B4] focus:outline-none"
                />
                {search && (
                  <button
                    onClick={() => { setSearch(""); setSearchOpen(false); }}
                    aria-label="Clear search"
                    className="w-8 h-9 shrink-0 flex items-center justify-center text-[#9BA8B4] hover:text-ink transition-colors"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                )}
              </>
            )}
          </div>

        </div>
      </div>

      {/* Active date filter — small chip below the tabs; ✕ clears it */}
      {hasDateFilter && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tint border border-[#D6F2F7] pl-3 pr-1.5 py-1 text-deep text-xs font-medium">
            <Calendar className="w-3.5 h-3.5" strokeWidth={1.75} />
            {dateMode === "single"
              ? `Showing ${fmtShort(selDate!)}`
              : `Showing ${fmtShort(rangeFrom!)}${rangeTo ? ` – ${fmtShort(rangeTo)}` : ""}`}
            <button
              onClick={clearDates}
              aria-label="Clear date filter"
              className="ml-0.5 w-5 h-5 flex items-center justify-center rounded-full hover:bg-[#D7EEF5] transition-colors"
            >
              <X className="w-3 h-3" strokeWidth={2} />
            </button>
          </span>
          <span className="secondary-text">{events.length} {events.length === 1 ? "event" : "events"}</span>
        </div>
      )}
      </div>

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="text-center py-16 secondary-text">No events match the current filters.</div>
      ) : (
      <div className="relative">
        {events.map((ev, i) => {
          const isLast = i === events.length - 1;
          return (
            <div key={ev.id ?? ev.title} className="relative flex gap-5 pb-6 last:pb-0">
              {/* Marker + connector */}
              <div className="flex flex-col items-center shrink-0">
                <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-brand mt-6" />
                {!isLast && <div className="w-px flex-1 bg-line mt-1.5" />}
              </div>

              {/* Event card */}
              <div className="flex-1 min-w-0 lg-card p-6">
                {/* Top row */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-1.5 mono-ref">
                    <Calendar className="w-3.5 h-3.5 text-[#5B6B78]" strokeWidth={1.75} />
                    {ev.date}{ev.time && <span className="text-[#9BA8B4]"> · {ev.time}</span>}
                  </div>
                  {/* Origin — generated from verified evidence, or added by the attorney */}
                  {ev.source === "user" ? (
                    <span
                      className="pill pill-neutral shrink-0"
                      title={ev.addedBy ? `Added by ${ev.addedBy}${ev.addedAt ? ` · ${ev.addedAt}` : ""}` : undefined}
                    >
                      <UserPlus className="w-3.5 h-3.5" strokeWidth={1.75} /> User Added
                    </span>
                  ) : (
                    <span className="pill pill-complete shrink-0"><ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.75} /> Verified</span>
                  )}
                </div>

                {/* Title */}
                <h3 className="card-title mb-2 leading-snug" style={{ fontSize: "18px" }}>{ev.title}</h3>

                {/* Contextual tags — what the event is about, at a glance */}
                <ChronologyTags taxonomy={ev.taxonomy} />

                {/* Description */}
                <p className="body-text leading-relaxed">{ev.description}</p>

                {/* Event Chronology — Key Actions beside Supporting Evidence (+ actions under it) */}
                {subTab === "event" && ((ev.actions?.length ?? 0) > 0 || ev.evidence.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-line grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                    {/* Key Actions — the 2–3 most important; full list lives in the preview */}
                    {ev.actions && ev.actions.length > 0 && (
                      <div className="rounded-xl border border-line bg-offwhite p-4">
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                          <div className="eyebrow">Key Actions</div>
                          {/* The detail drawer is evidence-backed — only offered when documents are attached */}
                          {ev.evidence.length > 0 && (
                            <button onClick={() => openEvidence(ev, { ai: "actions" })} className="inline-flex items-center gap-1 text-xs font-semibold text-deep hover:text-ink transition-colors shrink-0">
                              View Details <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </button>
                          )}
                        </div>
                        <ul className="space-y-1.5">
                          {(ev.evidence.length > 0 ? ev.actions.slice(0, 3) : ev.actions).map((a) => (
                            <li key={a.text} className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-deep mt-[7px] shrink-0" />
                              <span className="body-text leading-relaxed">{a.text}</span>
                            </li>
                          ))}
                        </ul>
                        {ev.evidence.length > 0 && ev.actions.length > 3 && (
                          <button onClick={() => openEvidence(ev, { ai: "actions" })} className="mt-2.5 text-xs font-semibold text-deep hover:text-ink transition-colors">
                            +{ev.actions.length - 3} more actions
                          </button>
                        )}
                      </div>
                    )}

                    {/* Supporting Evidence card + actions directly under it */}
                    {ev.evidence.length > 0 && (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-line bg-offwhite p-4">
                          <div className="eyebrow mb-2.5">Supporting Evidence</div>
                          <EvidenceChips evidence={ev.evidence} onOpen={() => openEvidence(ev)} />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEvidence(ev)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-tint border border-[#D6F2F7] text-deep rounded-lg text-sm font-medium hover:bg-[#D7EEF5] transition-colors"
                          >
                            <Eye className="w-4 h-4" strokeWidth={1.75} /> Preview Evidences
                          </button>
                          <button
                            onClick={() => openEvidence(ev, { ai: "insights" })}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-tint border border-[#D6F2F7] text-deep rounded-lg text-sm font-medium hover:bg-[#D7EEF5] transition-colors"
                          >
                            <Sparkles className="w-4 h-4" strokeWidth={1.75} /> Insights
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Medical Chronology — divider, then AI tool buttons (left) aligned with Supporting Evidence pills (right) */}
                {subTab === "medical" && (
                  <div className="mt-4 pt-4 border-t border-line">
                    <div className="flex items-end justify-between gap-4 flex-wrap">
                      {/* Left — AI tool buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {([
                          { mode: "severity", label: "Assess Severity", icon: AlertTriangle, accent: "#0E3A47", tint: "#E6F6FB", line: "#D6F2F7" },
                          { mode: "forensic", label: "Forensic Analysis", icon: Sparkles, accent: "#0E3A47", tint: "#E6F6FB", line: "#D6F2F7" },
                          { mode: "expert", label: "Ask Medical Expert", icon: Stethoscope, accent: "#0E3A47", tint: "#E6F6FB", line: "#D6F2F7" },
                        ] as const).map((b) => {
                          const active = openPanel?.index === i && openPanel.mode === b.mode;
                          return (
                            <button
                              key={b.mode}
                              onClick={() => togglePanel(i, b.mode)}
                              aria-expanded={active}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all whitespace-nowrap"
                              style={{ background: active ? "#D7EEF5" : "#E6F6FB", borderColor: active ? "#1E7C99" : "#D6F2F7", color: "#0E3A47" }}
                            >
                              <b.icon className="w-4 h-4" style={{ color: "#0E3A47" }} strokeWidth={1.75} /> {b.label}
                              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${active ? "rotate-180" : ""}`} style={{ color: "#0E3A47" }} strokeWidth={1.75} />
                            </button>
                          );
                        })}
                      </div>

                      {/* Right — Supporting Evidence label above the pills; row bottom-aligns so buttons line up with the pills */}
                      {ev.evidence.length > 0 && (
                        <div className="shrink-0">
                          <div className="eyebrow mb-2 text-right">Supporting Evidence</div>
                          <EvidenceChips evidence={ev.evidence} onOpen={() => openEvidence(ev)} align="right" />
                        </div>
                      )}
                    </div>

                    {/* Expandable panel — animates open/closed via grid-rows */}
                    <div className={`grid transition-all duration-300 ease-out ${openPanel?.index === i ? "grid-rows-[1fr] mt-4 opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                      <div className="overflow-hidden">
                        {openPanel?.index === i && openPanel.mode === "severity" && <SeverityPanel onClose={() => setOpenPanel(null)} />}
                        {openPanel?.index === i && openPanel.mode === "forensic" && <ForensicPanel ev={ev} onClose={() => setOpenPanel(null)} />}
                        {openPanel?.index === i && openPanel.mode === "expert" && <ExpertPanel ev={ev} onClose={() => setOpenPanel(null)} />}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {subTab === "medical" && <InjuryIntelligenceSection />}

      </div>

      {/* RIGHT column — Filters card (top) + Timeline Navigator (below) */}
      <div className="w-full lg:w-[300px] shrink-0 lg:order-2 lg:sticky lg:top-[176px] self-start space-y-6">

        {/* Filters — date filter + event-type filter */}
        <div className="rounded-2xl border border-line bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-deep" strokeWidth={1.75} />
            <h3 className="card-title">Filters</h3>
          </div>

          {/* Date filter — opens the date-picker popup (single date or custom range) */}
          <div>
            <div className="eyebrow mb-2">Date</div>
            <div className="relative">
              <button
                onClick={() => setCalOpen((o) => !o)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  hasDateFilter ? "border-brand bg-tint text-deep" : "border-line bg-white text-ink hover:border-soft"
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-4 h-4 text-[#5B6B78] shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{calLabel}</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-[#5B6B78] shrink-0 transition-transform ${calOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
              </button>
              {calOpen && (
                <ChronologyDatePicker
                  mode={dateMode}
                  setMode={(m) => { setDateMode(m); clearDates(); }}
                  selDate={selDate}
                  rangeFrom={rangeFrom}
                  rangeTo={rangeTo}
                  onPick={pickDay}
                  onClear={clearDates}
                  onDone={() => setCalOpen(false)}
                  setRangeFrom={setRangeFrom}
                  setRangeTo={setRangeTo}
                />
              )}
            </div>
            {hasDateFilter && (
              <button onClick={clearDates} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#5B6B78] hover:text-ink transition-colors">
                <X className="w-3 h-3" strokeWidth={2} /> Clear date
              </button>
            )}
          </div>

          {/* Event-type filter — dropdown; options follow the active chronology tab */}
          <div>
            <div className="eyebrow mb-2">{subTab === "medical" ? "Medical Events" : "Case Events"}</div>
            <div className="relative">
              <button
                onClick={() => setFilterOpen((o) => !o)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  filter !== "all" ? "border-brand bg-tint text-deep" : "border-line bg-white text-ink hover:border-soft"
                }`}
              >
                <span className="truncate">{filterLabel}</span>
                <ChevronDown className={`w-4 h-4 text-[#5B6B78] shrink-0 transition-transform ${filterOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
              </button>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                  <div className="absolute left-0 right-0 mt-1.5 z-20 rounded-lg border border-line bg-white shadow-lg p-1">
                    {[{ value: "all", label: allLabel }, ...filterOptions.map((c) => ({ value: c, label: c }))].map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setFilter(opt.value); setFilterOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                          filter === opt.value ? "bg-tint text-deep font-medium" : "text-ink hover:bg-wash"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Timeline Navigator */}
        <div className="rounded-2xl border border-line bg-white p-5 flex flex-col gap-2.5">
          <h3 className="card-title">Timeline Navigator</h3>
          {([
            { key: "medical", num: medicalAll.length, label: "Medical Events", helper: "Verified treatment timeline" },
            { key: "event", num: eventAll.length, label: "Case Events", helper: "Incident & legal timeline" },
          ] as const).map((c) => {
            const active = subTab === c.key;
            return (
              <button
                key={c.key}
                onClick={() => selectSubTab(c.key)}
                className={`w-full rounded-xl border px-4 py-3 text-left cursor-pointer transition-all ${
                  active ? "border-brand bg-tint shadow-sm" : "border-line bg-offwhite hover:border-soft hover:bg-wash hover:shadow-sm"
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span className={`font-bold tabular-nums leading-none ${active ? "text-deep" : "text-ink"}`} style={{ fontSize: "22px", letterSpacing: "-0.01em", fontFamily: "var(--font-display)" }}>{c.num}</span>
                  <span className="card-title">{c.label}</span>
                </div>
                <div className="secondary-text mt-0.5">{c.helper}</div>
              </button>
            );
          })}

          <button onClick={() => goTo("economic")} className="btn btn-primary w-full gap-2 mt-1">
            Explore Damages Analysis <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>

    {/* Evidence Review Workspace — PDF viewer + AI analysis tools */}
    <EvidenceReviewModal
      open={!!evidenceEvent}
      title={evidenceEvent?.title ?? ""}
      date={evidenceEvent?.date}
      time={evidenceEvent?.time}
      insight={evidenceEvent?.insight ?? ""}
      description={evidenceEvent?.description ?? ""}
      actions={evidenceEvent?.actions}
      docs={evidenceDocs}
      initialAI={evidenceAI}
      source={evidenceEvent?.source}
      addedBy={evidenceEvent?.addedBy}
      addedAt={evidenceEvent?.addedAt}
      details={evidenceEvent?.details}
      onClose={() => setEvidenceEvent(null)}
    />

    {/* Add Chronology — the active tab decides which form opens */}
    <AddChronologyDrawer
      open={addOpen}
      kind={subTab}
      documents={attachableDocs}
      existing={(subTab === "medical" ? medicalAll : eventAll).map((e) => ({ date: e.date, title: e.title, description: e.description }))}
      addedBy={CURRENT_USER}
      onCancel={() => setAddOpen(false)}
      onSubmit={addChronology}
    />

    {/* Confirmation toast */}
    {toast && (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 rounded-xl border border-line bg-white shadow-lg px-4 py-3">
        <CheckCircle className="w-4 h-4 text-[#15803D] shrink-0" strokeWidth={1.75} />
        <span className="text-sm font-medium text-ink">{toast}</span>
        <button onClick={() => setToast(null)} aria-label="Dismiss" className="ml-1 p-1 rounded-md text-[#8A98A3] hover:bg-wash hover:text-ink transition-colors">
          <X className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>
    )}
    </>
  );
}

// ── Tab 3 — Damages Analysis ──────────────────────────────────────────────────
// Explains the financial impact of the case and the evidence supporting each
// damage figure. This is NOT the Valuation page: there are no interactive
// multiplier controls and no settlement-strategy scenarios here — those live on
// the Valuation stage, which this page links out to at the bottom.

const ECONOMIC = [
  { label: "Medical Expenses", desc: "Emergency, hospital, imaging & physician bills", value: 87500, icon: Stethoscope,
    category: "Medical Bills", docCount: 18,
    reasoning: "Every charge traces to an itemized billing document and reconciles to the verified total with no duplicates.",
    docs: ["Hospital_Bill.pdf", "hospital_medical_records.pdf", "ER_Bills.pdf", "MRI_Report_2026.pdf"] },
  { label: "Lost Wages", desc: "Documented income loss during treatment", value: 43200, icon: DollarSign,
    category: "Lost Wages", docCount: 6,
    reasoning: "Verified against employer payroll records and the plaintiff's pre-incident earnings history.",
    docs: ["Wage_Loss_Statement.pdf", "Employer_Payroll_Records.pdf"] },
  { label: "Future Medical Care", desc: "Projected ongoing medical management", value: 18750, icon: HeartPulse,
    category: "Future Medical Care", docCount: 9,
    reasoning: "Projected from the life-care plan and corroborating treating-physician cost estimates.",
    docs: ["Life_Care_Plan.pdf", "Treating_Physician_Estimate.pdf"] },
  { label: "Physical Therapy", desc: "Physical therapy & rehabilitation program", value: 6000, icon: Activity,
    category: "Rehabilitation", docCount: 12,
    reasoning: "Substantiated by the documented physical-therapy treatment record and invoices.",
    docs: ["PT_Treatment_Notes.pdf", "Therapy_Invoices.pdf"] },
  { label: "Transportation", desc: "Mileage & medical travel costs", value: 3850, icon: MapPin,
    category: "Transportation", docCount: 5,
    reasoning: "Mileage and medical-travel expenses tied to documented appointments at the standard reimbursement rate.",
    docs: ["Mileage_Log.pdf"] },
  { label: "Other Expenses", desc: "Assistive devices & out-of-pocket costs", value: 2150, icon: ClipboardList,
    category: "Other Damages", docCount: 4,
    reasoning: "Assistive devices and out-of-pocket costs, each backed by an itemized receipt.",
    docs: ["Out_of_Pocket_Receipts.pdf"] },
];

// Non-economic damage categories the recommended multiplier is applied to.
// Severity tag → pill class. Mirrors the LECO status-pill palette
// (risk = red, progress = amber, neutral = teal, complete = green).
const SEVERITY_PILL: Record<string, string> = {
  Critical: "pill pill-risk",
  High: "pill pill-progress",
  Moderate: "pill pill-neutral",
  Low: "pill pill-complete",
};

// How much each factor contributes to the recommended multiplier, by severity.
// These are multiplier ranges (not dollar amounts) — the factors justify the
// multiplier, which is then applied to the verified economic damages.
const SEVERITY_MULTIPLIER: Record<string, string> = {
  Critical: "2×–3×",
  High: "1×–1.5×",
  Moderate: "0.5×–1×",
  Low: "0.25×–0.5×",
};

// Opposing-argument strength → pill. A strong defense argument is a risk to us.
const DEFENSE_PILL: Record<string, string> = {
  Strong: "pill pill-risk",
  Moderate: "pill pill-progress",
  Weak: "pill pill-complete",
};

// The allowable per-severity multiplier band (min–max). Presets in the editor
// and the displayed range both derive from this.
const SEVERITY_RANGE: Record<string, [number, number]> = {
  Critical: [2, 3],
  High: [1, 1.5],
  Moderate: [0.5, 1],
  Low: [0.25, 0.5],
};

// Format a multiplier value cleanly (2 → "2×", 1.25 → "1.25×").
function fmtMult(m: number) {
  return `${Number(m.toFixed(2))}×`;
}

export type Severity = "Critical" | "High" | "Moderate" | "Low";
export type DamageFactor = {
  category: string;
  severity: Severity;
  aiMultiplier: number;   // AI-recommended contribution to the overall multiplier
  confidence: number;     // AI confidence %
  docCount: number;
  drivers: string[];      // 3–5 top contributing-evidence bullets
  aiReasoning: string;    // narrative behind the recommendation
  rationale: string;
  evidence: {
    strength: "Strong" | "Moderate" | "Limited";
    primaryRecords: number;
    expertOpinions: number;
    witnessStatements: number;
    medicalQuality: "Excellent" | "Strong" | "Adequate" | "Limited";
  };
  defense: { argument: string; strength: "Strong" | "Moderate" | "Weak"; rebuttal: string };
  suggestion: { evidence: string; why: string; multiplierGain: number };
};

// Non-economic damage factors the recommended multiplier is applied to. Each
// carries an AI-assigned severity, a recommended contribution, the evidence
// behind it, and the strongest opposing argument. AI contributions sum to 9×.
export const DA_DAMAGE_FACTORS: DamageFactor[] = [
  {
    category: "Pain & Suffering", severity: "Critical", aiMultiplier: 2, confidence: 94, docCount: 18,
    drivers: ["Permanent Injury", "Surgical Intervention", "Chronic Pain", "MRI Verified"],
    aiReasoning: "Two-level cervical herniation with nerve-root compression, a completed surgical course, and treating-physician records showing persistent chronic pain place this factor at the top of the Critical band.",
    rationale: "Treating-physician records document persistent, chronic pain requiring ongoing pain-management intervention.",
    evidence: { strength: "Strong", primaryRecords: 11, expertOpinions: 3, witnessStatements: 4, medicalQuality: "Excellent" },
    defense: { argument: "Insurer will likely argue pre-existing degenerative changes contributed to the cervical findings, discounting causation.", strength: "Weak", rebuttal: "Cite the pre-incident baseline MRI and the treating surgeon's causation opinion tying the herniation to the collision." },
    suggestion: { evidence: "Pain-management specialist narrative report", why: "A dedicated specialist narrative would corroborate the permanence of chronic pain and anchor the top of the Critical band.", multiplierGain: 0.25 },
  },
  {
    category: "Emotional Distress", severity: "High", aiMultiplier: 1.25, confidence: 86, docCount: 7,
    drivers: ["Diagnosed Anxiety", "Post-Traumatic Symptoms", "Sleep Disturbance"],
    aiReasoning: "Primary-care and counseling notes corroborate diagnosed anxiety and post-traumatic symptoms; a formal mental-health evaluation would further anchor the higher end of the band.",
    rationale: "Mental-health evaluations corroborate diagnosed anxiety and post-traumatic symptoms tied to the incident.",
    evidence: { strength: "Moderate", primaryRecords: 4, expertOpinions: 1, witnessStatements: 2, medicalQuality: "Adequate" },
    defense: { argument: "Insurer will argue emotional symptoms are unquantified and lack a dedicated psychological evaluation.", strength: "Moderate", rebuttal: "Obtain a licensed psychologist's evaluation with standardized testing to convert lay complaints into diagnostic findings." },
    suggestion: { evidence: "Mental Health Evaluation", why: "A formal psychological evaluation would quantify the distress diagnostically and strengthen Emotional Distress.", multiplierGain: 0.5 },
  },
  {
    category: "Quality of Life", severity: "High", aiMultiplier: 1.25, confidence: 88, docCount: 9,
    drivers: ["Loss of Independence", "Abandoned Hobbies", "Reduced Activity"],
    aiReasoning: "Functional-capacity assessments show a durable loss of independence in daily activities and recreation attributable to the injuries.",
    rationale: "Functional-capacity assessments show a sustained loss of independence in daily activities and prior hobbies.",
    evidence: { strength: "Strong", primaryRecords: 5, expertOpinions: 2, witnessStatements: 2, medicalQuality: "Strong" },
    defense: { argument: "Insurer will contend the plaintiff has partially resumed activities, limiting the loss claimed.", strength: "Weak", rebuttal: "Present the functional-capacity evaluation and before/after activity logs documenting the sustained limitations." },
    suggestion: { evidence: "Day-in-the-life video", why: "A day-in-the-life record vividly documents the ongoing functional loss for a jury.", multiplierGain: 0.25 },
  },
  {
    category: "Cognitive Impairment", severity: "Critical", aiMultiplier: 2, confidence: 92, docCount: 11,
    drivers: ["Neuropsych Testing", "Memory Deficit", "Slowed Processing", "Employment Impact"],
    aiReasoning: "Neuropsychological testing confirms measurable deficits in memory, attention, and processing speed, objectively supporting a Critical placement.",
    rationale: "Neuropsychological testing confirms measurable deficits in memory, attention, and processing speed.",
    evidence: { strength: "Strong", primaryRecords: 6, expertOpinions: 3, witnessStatements: 2, medicalQuality: "Excellent" },
    defense: { argument: "Insurer will argue cognitive testing is subject to effort validity and attribute deficits to unrelated factors.", strength: "Moderate", rebuttal: "Rely on embedded validity indicators in the neuropsych battery and the neurologist's causation opinion." },
    suggestion: { evidence: "Vocational expert assessment", why: "A vocational assessment would translate the cognitive deficits into concrete earning-capacity loss.", multiplierGain: 0.25 },
  },
  {
    category: "Physical Impairment", severity: "High", aiMultiplier: 1.25, confidence: 90, docCount: 14,
    drivers: ["Mobility Restriction", "Reduced Range of Motion", "Orthopedic Findings"],
    aiReasoning: "Imaging and orthopedic findings verify permanent mobility restrictions and reduced range of motion consistent with the injury mechanism.",
    rationale: "Imaging and orthopedic findings verify permanent mobility restrictions and reduced range of motion.",
    evidence: { strength: "Strong", primaryRecords: 8, expertOpinions: 2, witnessStatements: 4, medicalQuality: "Strong" },
    defense: { argument: "Insurer will argue impairment ratings fall within functional ranges permitting most activities.", strength: "Weak", rebuttal: "Present the AMA impairment rating and the treating orthopedist's permanency opinion." },
    suggestion: { evidence: "Independent medical exam rebuttal", why: "A retained-expert IME rebuttal would neutralize a low defense impairment rating.", multiplierGain: 0.25 },
  },
  {
    category: "Dignity & Independence", severity: "Moderate", aiMultiplier: 0.75, confidence: 79, docCount: 5,
    drivers: ["Assistive Care", "Lost Self-Care Autonomy"],
    aiReasoning: "Care records show reliance on assistive help for routine self-care tasks, meaningfully reducing personal autonomy.",
    rationale: "Reliance on assistive care for routine self-care tasks meaningfully reduces personal autonomy.",
    evidence: { strength: "Moderate", primaryRecords: 2, expertOpinions: 1, witnessStatements: 2, medicalQuality: "Adequate" },
    defense: { argument: "Insurer will argue assistive-care needs are temporary and expected to resolve with recovery.", strength: "Moderate", rebuttal: "Present the life-care plan projecting long-term assistive-care needs beyond the recovery window." },
    suggestion: { evidence: "Occupational therapy assessment", why: "An OT assessment documents the durable loss of self-care independence.", multiplierGain: 0.25 },
  },
  {
    category: "Family Relationship Impact", severity: "Moderate", aiMultiplier: 0.5, confidence: 76, docCount: 4,
    drivers: ["Caregiving Burden", "Loss of Consortium"],
    aiReasoning: "Family statements document a caregiving burden and loss of consortium; corroboration is primarily lay testimony.",
    rationale: "Family statements document caregiving burden and loss of consortium within the household.",
    evidence: { strength: "Limited", primaryRecords: 1, expertOpinions: 0, witnessStatements: 3, medicalQuality: "Limited" },
    defense: { argument: "Insurer will argue consortium claims rest largely on lay testimony without independent corroboration.", strength: "Strong", rebuttal: "Corroborate with a family-therapist evaluation and contemporaneous caregiving records." },
    suggestion: { evidence: "Spousal/family declarations", why: "Sworn declarations from household members would independently corroborate the consortium loss.", multiplierGain: 0.25 },
  },
];

// Why LECO recommends the 9× multiplier.
const DA_STRATEGY_FACTORS = ["Clear Liability", "Severe Injuries", "Strong Supporting Evidence", "Favorable Jurisdiction"];

// Each verified damage category, the amount it contributes (matches the Economic
// Damages table above), and the supporting documents behind it. `docs` resolves
// to real evidence files for the shared Document Workspace; `docCount` is the
// full count of supporting documents on file.
export const DAMAGE_EVIDENCE = [
  {
    category: "Medical Bills", amount: 87500, docCount: 18, primary: "Hospital_Bill.pdf",
    docs: ["hospital_medical_records.pdf", "ER_Bills.pdf", "MRI_Report_2026.pdf"],
    insight: {
      summary: "The $87,500 in medical expenses is fully substantiated. Every charge traces to an itemized billing document — emergency, hospital, imaging, and physician services — and reconciles to the verified total with no duplicate or unsupported line items.",
      keyPoints: [
        "18 itemized bills reconcile to the $87,500 total.",
        "All charges fall within the post-incident treatment window.",
        "No duplicate or out-of-scope line items detected.",
      ],
    },
  },
  {
    category: "Lost Wages", amount: 43200, docCount: 6, primary: "Wage_Loss_Statement.pdf",
    docs: ["wage_loss_statement.pdf", "physical_therapy_notes.pdf"],
    insight: {
      summary: "The $43,200 lost-wages figure reflects documented income loss during treatment, corroborated by employer payroll records and the plaintiff's pre-incident earnings history.",
      keyPoints: [
        "Wage loss verified against employer payroll records.",
        "Time out of work aligns with the treatment timeline.",
        "Calculated from pre-incident average earnings.",
      ],
    },
  },
  {
    category: "Future Medical Care", amount: 18750, docCount: 9, primary: "Life_Care_Plan.pdf",
    docs: ["hospital_medical_records.pdf", "MRI_Report_2026.pdf"],
    insight: {
      summary: "The $18,750 projection for future medical care is grounded in a physician-prepared treatment plan covering ongoing management of the cervical injuries, discounted to present value.",
      keyPoints: [
        "Based on a physician-prepared life-care projection.",
        "Covers anticipated follow-up and management costs.",
        "Discounted to present value.",
      ],
    },
  },
  {
    category: "Rehabilitation", amount: 6000, docCount: 12, primary: "PT_Treatment_Notes.pdf",
    docs: ["physical_therapy_notes.pdf"],
    insight: {
      summary: "The $6,000 rehabilitation total captures the completed physical-therapy program, supported session-by-session by the treating provider's notes.",
      keyPoints: [
        "12 documented therapy sessions support the total.",
        "Charges match the prescribed rehabilitation plan.",
        "Continuous course of care with no unexplained gaps.",
      ],
    },
  },
  {
    category: "Transportation", amount: 3850, docCount: 5, primary: "Mileage_Log.pdf",
    docs: ["ER_Bills.pdf"],
    insight: {
      summary: "The $3,850 in transportation costs reflects mileage and medical-travel expenses, each tied to a documented appointment and applied at the standard reimbursement rate.",
      keyPoints: [
        "Mileage logged against verified appointment dates.",
        "Standard medical-travel reimbursement rate applied.",
        "Every trip corresponds to a treatment record.",
      ],
    },
  },
  {
    category: "Other Damages", amount: 2150, docCount: 4, primary: "Out_of_Pocket_Receipts.pdf",
    docs: ["physical_therapy_notes.pdf"],
    insight: {
      summary: "The $2,150 in other damages covers assistive devices and out-of-pocket costs, each backed by an itemized receipt and limited to incident-related purchases.",
      keyPoints: [
        "Itemized receipts support each out-of-pocket cost.",
        "Limited to incident-related purchases.",
        "No speculative or unsupported amounts.",
      ],
    },
  },
];

// Inline "Chat with AI" panel — swaps into a precedent-case drawer's body so the
// same drawer (and header) can move between the case detail view and a chat view.
function PrecedentChatPanel({ caseName, onBack }: { caseName: string; onBack: () => void }) {
  const [messages, setMessages] = useState<{ from: "ai" | "user"; text: string }[]>([
    { from: "ai", text: `Ask me anything about ${caseName} — similarity drivers, settlement rationale, or how to use it in your strategy.` },
  ]);
  const [input, setInput] = useState("");
  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { from: "user", text },
      { from: "ai", text: `Reviewing ${caseName} — I'll factor this into the precedent analysis for your case strategy.` },
    ]);
    setInput("");
  };
  return (
    <>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-deep hover:text-ink transition-colors">
          <ChevronLeft className="w-4 h-4" strokeWidth={1.75} /> Back to Case Details
        </button>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${m.from === "user" ? "bg-brand text-white" : "bg-tint text-ink"}`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-line p-4 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Ask about this case..."
          className="flex-1 px-3.5 py-2.5 rounded-lg border border-line text-sm text-ink focus:outline-none focus:border-brand transition-colors"
        />
        <button onClick={send} className="btn btn-primary px-3.5 py-2.5"><Send className="w-4 h-4" strokeWidth={1.75} /></button>
      </div>
    </>
  );
}

export function EconomicDamagesTab({ model, documents, goTo, goToValuation }: TabProps) {
  const subtotal = ECONOMIC.reduce((s, e) => s + e.value, 0);

  // Shared Document Workspace (reused from Analysis/Overview). Each damage
  // category contributes a set of supporting documents; "View Evidence" opens
  // the existing Document Preview experience.
  // Damage Computation tabs (Economic · Non-Economic) — Total stays below both.
  const [compTab, setCompTab] = useState<"economic" | "noneconomic">("economic");
  // Damage Factors accordion — collapsed by default.
  const [damageFactorsOpen, setDamageFactorsOpen] = useState(false);
  const [wsOpen, setWsOpen] = useState(false);
  const [wsIndex, setWsIndex] = useState(0);
  const [wsView, setWsView] = useState<"preview" | "insights">("preview");
  const docForFile = buildDocResolver(documents);

  // ── Damage-factor review workspace: per-factor multiplier (attorney-editable),
  // override history, edit drawer, and expandable detail/defence sections. ──
  const [factorMult, setFactorMult] = useState<Record<string, number>>(() =>
    Object.fromEntries(DA_DAMAGE_FACTORS.map((f) => [f.category, f.aiMultiplier])));
  type FactorEdit = { from: number; to: number; note: string; at: string };
  const [factorHistory, setFactorHistory] = useState<Record<string, FactorEdit[]>>({});

  // Editing happens inline inside the View Details drawer.
  const [editMode, setEditMode] = useState(false);
  const [draftMult, setDraftMult] = useState(0);
  const [draftNote, setDraftNote] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  // When an override was last made, per factor (e.g. "Today • 3:42 PM").
  const [modifiedAt, setModifiedAt] = useState<Record<string, string>>({});
  const nowStamp = () => `Today • ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  // "View Details" drawer for a damage factor.
  const [detailFactor, setDetailFactor] = useState<string | null>(null);
  const [detailDocsOpen, setDetailDocsOpen] = useState(false);
  const [detailChatOpen, setDetailChatOpen] = useState(false);
  // Precedent case detail drawer from the Intelligence cards.
  const [selectedPrecedent, setSelectedPrecedent] = useState<(typeof COMPARABLE_VERDICTS)[number] | null>(null);
  const [precedentReasoningOpen, setPrecedentReasoningOpen] = useState(true);
  const [precedentSuggestionOpen, setPrecedentSuggestionOpen] = useState(false);
  // Factor-evidence Preview / Insights workspace.
  const [factorWsCat, setFactorWsCat] = useState<string | null>(null);
  const [factorWsView, setFactorWsView] = useState<"preview" | "insights">("preview");
  const [factorWsFocus, setFactorWsFocus] = useState<string | null>(null);
  const openFactorWs = (cat: string, view: "preview" | "insights") => { setFactorWsCat(cat); setFactorWsView(view); setFactorWsFocus(null); };
  const openFactorDoc = (cat: string, docName: string) => { setFactorWsCat(cat); setFactorWsView("preview"); setFactorWsFocus(docName); };
  const factorByCat = (cat: string) => DA_DAMAGE_FACTORS.find((f) => f.category === cat)!;
  const currentMult = (cat: string) => factorMult[cat] ?? factorByCat(cat).aiMultiplier;

  // Live recalculation — the overall multiplier is the sum of factor contributions.
  const economicTotal = model.economicTotal;
  const aiOverall = DA_DAMAGE_FACTORS.reduce((s, f) => s + f.aiMultiplier, 0);
  const overallMult = DA_DAMAGE_FACTORS.reduce((s, f) => s + currentMult(f.category), 0);
  const nonEconomicTotal = Math.round(economicTotal * overallMult);
  const recommendedSettlement = economicTotal + nonEconomicTotal;
  const aiRecommendedSettlement = economicTotal + Math.round(economicTotal * aiOverall);
  const settlementForOverall = (m: number) => economicTotal + Math.round(economicTotal * m);
  const hasOverride = (cat: string) => currentMult(cat) !== factorByCat(cat).aiMultiplier;
  const anyOverride = DA_DAMAGE_FACTORS.some((f) => hasOverride(f.category));

  // Open the View Details drawer (read mode); AI summary open, suggestions closed.
  const openDetail = (cat: string) => {
    setDetailFactor(cat); setEditMode(false); setDraftMult(currentMult(cat)); setDraftNote("");
    setDetailDocsOpen(false); setDetailChatOpen(false);
  };
  // Open the drawer straight into inline edit mode (from a card's Edit button).
  const openEditDrawer = (cat: string) => {
    setDetailFactor(cat); setEditMode(true); setDraftMult(currentMult(cat)); setDraftNote("");
    setDetailDocsOpen(false); setDetailChatOpen(false);
  };
  const startEdit = () => { if (detailFactor) { setDraftMult(currentMult(detailFactor)); setDraftNote(""); setEditMode(true); } };
  const cancelEdit = () => setEditMode(false);
  const saveFactorEdit = () => {
    if (!detailFactor) return;
    const cat = detailFactor;
    const from = currentMult(cat);
    const ai = factorByCat(cat).aiMultiplier;
    if (draftMult !== from) {
      setFactorHistory((prev) => ({ ...prev, [cat]: [...(prev[cat] ?? []), { from, to: draftMult, note: draftNote.trim(), at: nowStamp() }] }));
      setFactorMult((prev) => ({ ...prev, [cat]: draftMult }));
      setModifiedAt((prev) => {
        const next = { ...prev };
        if (draftMult === ai) delete next[cat]; else next[cat] = nowStamp();
        return next;
      });
    }
    setEditMode(false);
  };
  const restoreFactor = (cat: string) => {
    const from = currentMult(cat);
    const ai = factorByCat(cat).aiMultiplier;
    if (from !== ai) setFactorHistory((prev) => ({ ...prev, [cat]: [...(prev[cat] ?? []), { from, to: ai, note: "Restored AI recommendation", at: nowStamp() }] }));
    setFactorMult((prev) => ({ ...prev, [cat]: ai }));
    setModifiedAt((prev) => { const next = { ...prev }; delete next[cat]; return next; });
  };
  // Draft-aware live preview while editing in the drawer.
  const draftOverall = detailFactor ? overallMult - currentMult(detailFactor) + draftMult : overallMult;
  const draftSettlement = settlementForOverall(draftOverall);

  // ── Economic line-item detail drawer (mirrors the Valuation page) ──
  // Which Economic Damages rows are expanded (reasoning + View details).
  const [ecoRowsOpen, setEcoRowsOpen] = useState<Set<string>>(new Set());
  const toggleEcoRow = (label: string) =>
    setEcoRowsOpen((prev) => { const n = new Set(prev); if (n.has(label)) n.delete(label); else n.add(label); return n; });
  const [drawerItem, setDrawerItem] = useState<(typeof ECONOMIC)[number] | null>(null);
  const [drawerDocsOpen, setDrawerDocsOpen] = useState(false);
  // Which itemized document rows are expanded (keyed by file name).
  const [expandedDocRows, setExpandedDocRows] = useState<Set<string>>(new Set());
  const toggleDocRow = (name: string) =>
    setExpandedDocRows((prev) => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  const openDrawer = (item: (typeof ECONOMIC)[number]) => { setDrawerItem(item); setDrawerDocsOpen(false); setExpandedDocRows(new Set()); };

  // Lock background scroll while any right-side drawer is open, so the dimmed
  // backdrop always covers the full viewport regardless of scroll position.
  useEffect(() => {
    const anyDrawerOpen = !!detailFactor || !!selectedPrecedent || !!drawerItem;
    document.body.style.overflow = anyDrawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [detailFactor, selectedPrecedent, drawerItem]);
  // Preview/Insights workspace for the drawer's documents (separate from the
  // Verified Damage Evidence workspace below).
  const [ecoWsView, setEcoWsView] = useState<"preview" | "insights" | null>(null);
  const [ecoWsFocus, setEcoWsFocus] = useState<string | null>(null);
  const breakdown = drawerItem ? buildDocBreakdown(drawerItem) : [];
  const verifiedTotal = breakdown.reduce((a, d) => a + d.amount, 0);
  const drawerDocs = drawerItem
    ? padDocsToCount(drawerItem.docs, drawerItem.category, drawerItem.docCount).map((name) => docForFile(name))
    : [];
  const orderedDrawerDocs = ecoWsFocus
    ? [...drawerDocs.filter((d) => d.name === ecoWsFocus), ...drawerDocs.filter((d) => d.name !== ecoWsFocus)]
    : drawerDocs;
  // Each category lists a few named files plus a larger docCount. Pad the named
  // set up to docCount with realistic supporting-document names so the preview
  // shows the full set (and the "+N more docs" menu appears for large sets).
  const evidenceDocSets = DAMAGE_EVIDENCE.map((d) => padDocsToCount([d.primary, ...d.docs], d.category, d.docCount).map(docForFile));
  const evidenceContexts = DAMAGE_EVIDENCE.map((d) => ({ contextType: "Damage Category", reference: d.category }));
  // Amount-focused AI Insights — explains *why* each damage figure is what it is.
  const evidenceInsights = DAMAGE_EVIDENCE.map((d) => ({
    summary: d.insight.summary,
    keyPoints: d.insight.keyPoints,
    entities: [
      { label: "Category", value: d.category },
      { label: "Verified Amount", value: formatUSD(d.amount) },
    ],
    supportingDocs: [d.primary, ...d.docs],
    confidence: { level: "High", score: 96 },
  }));
  // Document Context Panel data for the preview rail (per damage category).
  const evidencePanels = DAMAGE_EVIDENCE.map((d) => ({
    summary: [
      { label: "Category", value: d.category },
      { label: "Verified Amount", value: formatUSD(d.amount) },
      { label: "Supporting Documents", value: String(d.docCount) },
    ],
  }));
  const openEvidence = (i: number, view: "preview" | "insights" = "preview") => { setWsIndex(i); setWsView(view); setWsOpen(true); };

  // Which evidence cards have their Evidence dropdown expanded (by index).
  const [evidenceExpand, setEvidenceExpand] = useState<Set<number>>(new Set());
  const toggleEvidenceExpand = (i: number) =>
    setEvidenceExpand((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  // Verified Damage Evidence tabs (Economic · Non-Economic) + non-economic expand.
  const [evidenceTab, setEvidenceTab] = useState<"economic" | "noneconomic">("economic");
  const [neEvidenceExpand, setNeEvidenceExpand] = useState<Set<string>>(new Set());
  const toggleNeEvidence = (cat: string) =>
    setNeEvidenceExpand((prev) => { const n = new Set(prev); if (n.has(cat)) n.delete(cat); else n.add(cat); return n; });

  // Sidebar: count of verified damage-evidence documents on file.
  const evidenceDocTotal = 42;

  // Quick-action targets — each sidebar card scrolls to its section on the right.
  const damagesSummaryRef = useRef<HTMLDivElement>(null);
  const economicRef = useRef<HTMLDivElement>(null);
  const nonEconomicRef = useRef<HTMLDivElement>(null);
  const evidenceRef = useRef<HTMLDivElement>(null);
  const scrollTo = (ref: React.RefObject<HTMLDivElement>) =>
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-20 gap-8 items-start">

      {/* RIGHT — narrow, tall Quick Actions sidebar (sticky) */}
      <div className="lg:col-span-5 lg:order-2 lg:sticky lg:top-[176px] self-start">
        <div className="lg-card p-5 flex flex-col gap-3 lg:min-h-[600px]">
          <h3 className="card-title">Quick Actions</h3>

          {/* card 1 — Damages Summary (scrolls to the summary) */}
          <button
            onClick={() => scrollTo(damagesSummaryRef)}
            className="rounded-xl border border-line bg-offwhite p-4 text-left transition-all hover:border-brand hover:bg-tint hover:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
              <span className="card-title">Damages Summary</span>
            </div>
          </button>

          {/* card 2 — Economic Damages */}
          <button
            onClick={() => { setCompTab("economic"); scrollTo(economicRef); }}
            className="rounded-xl border border-line bg-offwhite p-4 text-left transition-all hover:border-brand hover:bg-tint hover:shadow-sm"
          >
            <div className="text-xl font-bold text-ink tabular-nums">{formatUSD(model.economicTotal)}</div>
            <div className="eyebrow mt-1">Economic Damages</div>
          </button>

          {/* card 3 — Non-Economic Damages */}
          <button
            onClick={() => { setCompTab("noneconomic"); scrollTo(economicRef); }}
            className="rounded-xl border border-line bg-offwhite p-4 text-left transition-all hover:border-brand hover:bg-tint hover:shadow-sm"
          >
            <div className="text-xl font-bold text-ink tabular-nums">{formatCompact(nonEconomicTotal)}</div>
            <div className="eyebrow mt-1">Non-Economic Damages</div>
          </button>

          {/* card 4 — Damage Evidence count */}
          <button
            onClick={() => scrollTo(evidenceRef)}
            className="rounded-xl border border-line bg-offwhite p-4 text-left transition-all hover:border-brand hover:bg-tint hover:shadow-sm"
          >
            <div className="text-xl font-bold text-ink tabular-nums">{evidenceDocTotal}</div>
            <div className="eyebrow mt-1">Damage Evidence</div>
          </button>

          {/* Estimated value — emphasized, below the four cards */}
          <div className="mt-auto pt-4 border-t border-line">
            <div className="eyebrow mb-1">Estimated Value</div>
            <div className="text-2xl font-bold text-deep tabular-nums">{formatCompact(recommendedSettlement)}</div>
          </div>

          {/* CTA — jump to the Negligence (Non-Economic) tab */}
          <button onClick={() => goTo("noneconomic")} className="btn btn-primary w-full gap-2">
            Negligence <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* LEFT — all sections */}
      <div className="lg:col-span-15 lg:order-1 space-y-12">

      {/* Damages Summary — attorney-ready overview, one big card, top of page */}
      <div ref={damagesSummaryRef} className="lg-card bg-offwhite p-6 space-y-5 scroll-mt-[176px]">
        <h2 className="section-header">Damages Summary</h2>
        <div className="bg-tint border border-[#D6F2F7] rounded-xl p-5 space-y-4">
          <p className="body-text leading-relaxed">
            Verified economic damages total <strong className="font-semibold text-ink">{formatUSD(model.economicTotal)}</strong>, supported by
            medical records, billing statements, employment records, and rehabilitation documentation.
          </p>
          <p className="body-text leading-relaxed">
            Based on the severity of injuries, permanent impairment, and strong liability evidence, LECO estimates{" "}
            <strong className="font-semibold text-ink">{formatUSD(nonEconomicTotal)}</strong> in Non-Economic Damages using a{" "}
            <strong className="font-semibold text-ink">{fmtMult(overallMult)} multiplier</strong>.
          </p>
        </div>
        <div className="bg-ink rounded-xl px-6 py-5 flex items-center justify-between gap-4">
          <div className="eyebrow text-soft">Current Projected Settlement Impact</div>
          <div className="text-white font-bold tabular-nums shrink-0" style={{ fontSize: "24px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            {formatUSD(recommendedSettlement)}
          </div>
        </div>
      </div>

      {/* 1 + 2 — Damage Computation (single card: Economic · Non-Economic · Total).
          Adopts the Valuation page's "Damage Computation" design, minus the
          interactive multiplier controls — those stay on the Valuation page. */}
      <div ref={economicRef} className="lg-card bg-offwhite p-6 scroll-mt-[176px]">
        <div className="flex items-center gap-2 mb-5">
          <DollarSign className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} />
          <h2 className="section-header">Damage Computation</h2>
        </div>

        {/* Tabs — Economic · Non-Economic */}
        <div className="flex items-center gap-2 mb-5">
          {([
            { key: "economic", label: "Economic Damages", count: ECONOMIC.length },
            { key: "noneconomic", label: "Non-Economic Damages", count: DA_DAMAGE_FACTORS.length },
          ] as const).map((t) => {
            const active = compTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setCompTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  active ? "bg-tint border-brand text-deep" : "bg-white border-line text-[#5B6B78] hover:border-soft hover:text-ink"
                }`}
              >
                {t.label}
                <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold ${
                  active ? "bg-brand text-white" : "bg-track text-[#5B6B78]"
                }`}>{t.count}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-5">
          {/* Economic Damages — clean table, with a leading icon per line item */}
          {compTab === "economic" && (
          <div className="border border-line rounded-xl overflow-hidden">
            <div className="bg-tint px-5 py-3 border-b border-line flex items-center justify-between gap-3">
              <h3 className="card-title">Economic Damages</h3>
              <span className="pill pill-progress shrink-0">Verified</span>
            </div>
            <div className="p-5">
              <div className="divide-y divide-line">
                {ECONOMIC.map((e) => {
                  const open = ecoRowsOpen.has(e.label);
                  return (
                    <div key={e.label} className="py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <button onClick={() => toggleEcoRow(e.label)} aria-expanded={open} className="flex items-center gap-3 text-left min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-tint flex items-center justify-center shrink-0">
                            <e.icon className="w-4 h-4 text-deep" strokeWidth={1.75} />
                          </div>
                          <span className="body-text truncate">{e.label}</span>
                          <ChevronDown className={`w-4 h-4 text-[#5B6B78] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} />
                        </button>
                        <span className="text-sm font-medium text-ink tabular-nums shrink-0">{formatUSD(e.value)}</span>
                      </div>
                      {open && (
                        <div className="mt-2.5 ml-11 rounded-xl border border-line bg-white p-3.5 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="secondary-text">{e.reasoning}</p>
                            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-[#5B6B78]">
                              <FileText className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                              We considered {e.docs[0]} and {e.docCount - 1}+ more documents.
                            </div>
                          </div>
                          <button onClick={() => openDrawer(e)} className="shrink-0 text-sm font-semibold text-deep hover:text-ink transition-colors whitespace-nowrap">
                            View details →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t-2 border-line flex items-center justify-between">
                <span className="text-sm font-semibold text-ink">Economic Damages Subtotal</span>
                <span className="text-lg font-bold text-ink tabular-nums">{formatUSD(subtotal)}</span>
              </div>
            </div>
          </div>
          )}

          {/* Non-Economic Damages — interactive attorney review workspace */}
          {compTab === "noneconomic" && (
          <div ref={nonEconomicRef} className="border border-line rounded-xl overflow-hidden scroll-mt-[176px]">
            <div className="bg-tint px-5 py-3 border-b border-line flex items-center justify-between gap-3">
              <h3 className="card-title">Non-Economic Damages</h3>
              {anyOverride && <span className="pill pill-progress"><Pencil className="w-3.5 h-3.5" strokeWidth={1.75} /> Attorney-adjusted</span>}
            </div>
            <div className="p-5 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-tint border border-[#D6F2F7] rounded-xl p-4">
                  <div className="eyebrow mb-1">Recommended Multiplier</div>
                  <div className="text-2xl font-bold text-deep tabular-nums">{fmtMult(overallMult)}</div>
                  {anyOverride && <div className="text-xs text-[#8A98A3] mt-0.5">AI recommended {fmtMult(aiOverall)}</div>}
                </div>
                <div className="bg-tint border border-[#D6F2F7] rounded-xl p-4">
                  <div className="eyebrow mb-1">Estimated Non-Economic Damages</div>
                  <div className="text-2xl font-bold text-ink tabular-nums">{formatUSD(nonEconomicTotal)}</div>
                  {anyOverride && <div className="text-xs text-[#8A98A3] mt-0.5">AI estimate {formatCompact(economicTotal * aiOverall)}</div>}
                </div>
              </div>

              <div className="bg-[#F6FDFF] border border-[#D6F2F7] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2.5">
                  <Sparkles className="w-4 h-4 text-deep" strokeWidth={1.75} />
                  <span className="eyebrow text-deep">Recommended Valuation Strategy</span>
                </div>
                <p className="body-text">
                  LECO recommends applying a <strong className="font-semibold text-ink">{fmtMult(aiOverall)} multiplier</strong> to estimate{" "}
                  <strong className="font-semibold text-ink">Non-Economic Damages</strong>. Review, challenge, and adjust each factor below — the estimate recalculates instantly.
                </p>
              </div>

              {/* Damage Factors — interactive review & editing */}
              <div className="border border-line rounded-xl overflow-hidden">
                <button
                  onClick={() => setDamageFactorsOpen((v) => !v)}
                  aria-expanded={damageFactorsOpen}
                  className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-wash transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="card-title">Damage Factors</span>
                      <span className="text-xs font-semibold text-deep bg-tint border border-[#D6F2F7] rounded-full px-2 py-0.5 tabular-nums">
                        {DA_DAMAGE_FACTORS.length}
                      </span>
                    </div>
                    <p className="secondary-text mt-0.5">
                      Review and edit each factor contributing to the {fmtMult(overallMult)} multiplier.
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-[#5B6B78] shrink-0 transition-transform duration-200 ${damageFactorsOpen ? "" : "-rotate-90"}`}
                    strokeWidth={1.75}
                  />
                </button>

                {damageFactorsOpen && (
                  <div className="border-t border-line bg-offwhite p-4 space-y-4">
                    {DA_DAMAGE_FACTORS.map((f) => {
                      const cur = currentMult(f.category);
                      const [lo, hi] = SEVERITY_RANGE[f.severity];
                      const overridden = hasOverride(f.category);
                      const stamp = modifiedAt[f.category];
                      return (
                        <div key={f.category} className="lg-card p-5 space-y-3">
                          {/* Header — title, severity, modified badge · multiplier + Edit */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="card-title">{f.category}</h4>
                                <span className={SEVERITY_PILL[f.severity]}>{f.severity}</span>
                                {overridden && <span className="pill pill-progress"><Pencil className="w-3 h-3" strokeWidth={1.75} /> Attorney Modified</span>}
                              </div>
                              <div className="flex items-center gap-2.5 mt-1 text-xs text-[#5B6B78] flex-wrap">
                                <span>Range <span className="font-semibold text-ink tabular-nums">{fmtMult(lo)}–{fmtMult(hi)}</span></span>
                                <span className="text-[#CBD5DD]">·</span>
                                <span><span className="font-semibold text-ink tabular-nums">{f.docCount}</span> supporting evidence</span>
                                {overridden && stamp && (<><span className="text-[#CBD5DD]">·</span><span className="text-deep font-medium">{stamp}</span></>)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-right">
                                <div className="text-base font-bold text-ink tabular-nums">{fmtMult(cur)}</div>
                                <div className="text-[10px] uppercase tracking-wide text-[#8A98A3]">Multiplier</div>
                              </div>
                              <button onClick={() => openEditDrawer(f.category)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-line text-deep text-xs font-medium hover:bg-tint transition-colors">
                                <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} /> Edit
                              </button>
                            </div>
                          </div>

                          {/* Compact summary — 2-line AI blurb + View Details */}
                          <div className="flex items-stretch gap-3">
                            <div className="flex-1 min-w-0 rounded-xl border border-line bg-offwhite p-3.5">
                              <p className="secondary-text leading-relaxed line-clamp-2">{f.aiReasoning}</p>
                            </div>
                            <button onClick={() => openDetail(f.category)} className="shrink-0 inline-flex items-center gap-1.5 px-3.5 rounded-xl border border-line text-deep text-xs font-semibold hover:border-brand hover:bg-tint transition-colors">
                              View Details <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Summary + version history */}
                    <div className="rounded-xl border border-[#D6F2F7] bg-tint p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-[#5B6B78]">Recommended Multiplier</span>
                        <span className="text-sm font-bold text-ink tabular-nums">{fmtMult(overallMult)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-[#5B6B78]">Estimated Non-Economic Damages</span>
                        <span className="text-sm font-bold text-ink tabular-nums">{formatUSD(nonEconomicTotal)}</span>
                      </div>
                      <div className="pt-2.5 border-t border-[#D6F2F7] flex items-center justify-between gap-3">
                        <button onClick={() => setHistoryOpen((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-deep hover:text-ink transition-colors">
                          <History className="w-3.5 h-3.5" strokeWidth={1.75} /> {historyOpen ? "Hide" : "View"} Edit History
                        </button>
                        {anyOverride && (
                          <button onClick={() => DA_DAMAGE_FACTORS.forEach((f) => restoreFactor(f.category))} className="inline-flex items-center gap-1.5 text-xs font-semibold text-deep hover:text-ink transition-colors">
                            <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} /> Restore All AI
                          </button>
                        )}
                      </div>
                      {historyOpen && (
                        <div className="pt-1 space-y-2">
                          {Object.entries(factorHistory).filter(([, h]) => h.length > 0).length === 0 ? (
                            <p className="secondary-text">No attorney overrides yet — every factor is at its AI recommendation.</p>
                          ) : (
                            Object.entries(factorHistory).filter(([, h]) => h.length > 0).map(([cat, h]) => (
                              <div key={cat} className="rounded-lg border border-line bg-white p-3">
                                <div className="text-xs font-semibold text-ink mb-1.5">{cat}</div>
                                <div className="space-y-1">
                                  {h.map((e, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs text-[#5B6B78] flex-wrap">
                                      <span className="tabular-nums">{fmtMult(e.from)}</span>
                                      <ArrowRight className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                                      <span className="font-semibold text-ink tabular-nums">{fmtMult(e.to)}</span>
                                      <span className="text-[#8A98A3]">· {e.at}</span>
                                      {e.note && <span className="truncate">— {e.note}</span>}
                                    </div>
                                  ))}
                                  <div className="flex items-center gap-2 text-xs text-[#8A98A3]">
                                    <Sparkles className="w-3 h-3 shrink-0" strokeWidth={1.75} /> AI recommendation: <span className="tabular-nums">{fmtMult(factorByCat(cat).aiMultiplier)}</span>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="eyebrow mb-3">Recommendation Factors</div>
                <div className="flex flex-wrap gap-2">
                  {DA_STRATEGY_FACTORS.map((f) => (
                    <span key={f} className="pill pill-neutral"><CheckCircle className="w-4 h-4" strokeWidth={1.75} />{f}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          )}

          {/* Total Estimated Settlement — stays below both tabs (recalculates live) */}
          <div className="bg-ink rounded-xl px-5 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="eyebrow text-soft mb-1">Total Estimated Settlement</div>
              <div className="font-mono text-xs text-soft tabular-nums truncate">
                {formatUSD(economicTotal)} <span className="text-brand">+</span> {formatUSD(nonEconomicTotal)}
              </div>
            </div>
            <div className="text-white font-bold tabular-nums shrink-0" style={{ fontSize: "24px", lineHeight: 1.1, letterSpacing: "-0.01em" }}>
              {formatUSD(recommendedSettlement)}
            </div>
          </div>
        </div>
      </div>

      {/* 3 — Verified Damage Evidence (new) — one big card; each category is a bordered tile */}
      <div ref={evidenceRef} className="lg-card bg-offwhite p-6 scroll-mt-[176px]">
        <div className="mb-5">
          <h2 className="section-header">Verified Evidence by Damage Type</h2>
          <p className="secondary-text mt-1 max-w-2xl">How each economic amount and non-economic factor is supported by evidence on file. Open any to review its documents.</p>
        </div>

        {/* Tabs — Economic · Non-Economic */}
        <div className="flex items-center gap-2 mb-5">
          {([
            { key: "economic", label: "Economic Damages", count: DAMAGE_EVIDENCE.length },
            { key: "noneconomic", label: "Non-Economic Damages", count: DA_DAMAGE_FACTORS.length },
          ] as const).map((t) => {
            const active = evidenceTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setEvidenceTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  active ? "bg-tint border-brand text-deep" : "bg-white border-line text-[#5B6B78] hover:border-soft hover:text-ink"
                }`}
              >
                {t.label}
                <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold ${
                  active ? "bg-brand text-white" : "bg-track text-[#5B6B78]"
                }`}>{t.count}</span>
              </button>
            );
          })}
        </div>

        {evidenceTab === "economic" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DAMAGE_EVIDENCE.map((d, i) => (
            <div key={d.category} className="border border-line rounded-xl bg-white p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="eyebrow mb-1.5">Category</div>
                  <div className="card-title truncate">{d.category}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="eyebrow mb-1.5">Amount</div>
                  <div className="text-lg font-bold text-ink tabular-nums">{formatUSD(d.amount)}</div>
                </div>
              </div>

              <div className="border-t border-line pt-4">
                <button
                  onClick={() => toggleEvidenceExpand(i)}
                  className="w-full flex items-center justify-between gap-2 mb-2.5 group"
                >
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                    <span className="text-sm font-semibold text-ink">{d.docCount} Supporting Documents</span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-deep transition-transform ${evidenceExpand.has(i) ? "rotate-180" : ""}`} strokeWidth={1.75} />
                </button>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => openEvidence(i)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-offwhite px-3 py-2 text-sm text-ink cursor-pointer hover:border-brand hover:bg-tint hover:shadow-sm transition-all"
                  >
                    <FileText className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
                    <span className="truncate max-w-[180px]">{d.primary}</span>
                  </button>
                  {d.docCount > 1 && (
                    <button
                      onClick={() => openEvidence(i)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-offwhite px-3 py-2 text-sm font-medium text-deep cursor-pointer hover:border-brand hover:bg-tint hover:shadow-sm transition-all"
                    >
                      <FileText className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                      +{d.docCount - 1} More
                    </button>
                  )}
                </div>
                {evidenceExpand.has(i) && (
                  <div className="mt-3 rounded-lg bg-tint border border-[#D6F2F7] p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                      <span className="eyebrow text-deep">AI Summary</span>
                    </div>
                    <p className="secondary-text leading-relaxed">{d.insight.summary}</p>
                  </div>
                )}
              </div>

              {/* Divider above the action buttons */}
              <div className="mt-auto border-t border-line" />

              {/* Actions — Preview & Insights open the same Document Workspace
                  used by the Analysis tab's signal cards. */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEvidence(i, "preview")}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-line text-ink rounded-lg text-sm font-medium hover:bg-wash transition-colors"
                >
                  <Eye className="w-4 h-4" strokeWidth={1.75} /> Preview
                </button>
                <button
                  onClick={() => openEvidence(i, "insights")}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-line text-deep rounded-lg text-sm font-medium hover:bg-tint transition-colors"
                >
                  <Sparkles className="w-4 h-4" strokeWidth={1.75} /> Insights
                </button>
              </div>
            </div>
          ))}
        </div>
        )}

        {evidenceTab === "noneconomic" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DA_DAMAGE_FACTORS.map((f) => {
            const names = padDocsToCount([], f.category, f.docCount);
            const primary = names[0];
            const expanded = neEvidenceExpand.has(f.category);
            return (
              <div key={f.category} className="border border-line rounded-xl bg-white p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="eyebrow mb-1.5">Factor</div>
                    <div className="card-title truncate">{f.category}</div>
                    <span className={`${SEVERITY_PILL[f.severity]} mt-1.5`}>{f.severity}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="eyebrow mb-1.5">Multiplier</div>
                    <div className="text-lg font-bold text-ink tabular-nums">{fmtMult(currentMult(f.category))}</div>
                  </div>
                </div>

                <div className="border-t border-line pt-4">
                  <button
                    onClick={() => toggleNeEvidence(f.category)}
                    className="w-full flex items-center justify-between gap-2 mb-2.5 group"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                      <span className="text-sm font-semibold text-ink">{f.docCount} Supporting Documents</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-deep transition-transform ${expanded ? "rotate-180" : ""}`} strokeWidth={1.75} />
                  </button>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => openFactorDoc(f.category, primary)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-offwhite px-3 py-2 text-sm text-ink cursor-pointer hover:border-brand hover:bg-tint hover:shadow-sm transition-all"
                    >
                      <FileText className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
                      <span className="truncate max-w-[180px]">{primary}</span>
                    </button>
                    {f.docCount > 1 && (
                      <button
                        onClick={() => openFactorWs(f.category, "preview")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-offwhite px-3 py-2 text-sm font-medium text-deep cursor-pointer hover:border-brand hover:bg-tint hover:shadow-sm transition-all"
                      >
                        <FileText className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                        +{f.docCount - 1} More
                      </button>
                    )}
                  </div>
                  {expanded && (
                    <div className="mt-3 rounded-lg bg-tint border border-[#D6F2F7] p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                        <span className="eyebrow text-deep">AI Summary</span>
                      </div>
                      <p className="secondary-text leading-relaxed">{f.aiReasoning}</p>
                    </div>
                  )}
                </div>

                <div className="mt-auto border-t border-line" />

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openFactorWs(f.category, "preview")}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-line text-ink rounded-lg text-sm font-medium hover:bg-wash transition-colors"
                  >
                    <Eye className="w-4 h-4" strokeWidth={1.75} /> Preview
                  </button>
                  <button
                    onClick={() => openFactorWs(f.category, "insights")}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-line text-deep rounded-lg text-sm font-medium hover:bg-tint transition-colors"
                  >
                    <Sparkles className="w-4 h-4" strokeWidth={1.75} /> Insights
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>
      </div>
    </div>

    {/* Shared Document Workspace — Preview / Insights for the selected category */}
    <DocumentWorkspaceModal
      docs={wsOpen ? (evidenceDocSets[wsIndex] ?? []) : null}
      noteContext={evidenceContexts[wsIndex]}
      insights={evidenceInsights[wsIndex]}
      contextPanel={evidencePanels[wsIndex]}
      initialView={wsView}
      position={wsIndex + 1}
      total={evidenceDocSets.length}
      onPrev={() => setWsIndex((i) => Math.max(0, i - 1))}
      onNext={() => setWsIndex((i) => Math.min(evidenceDocSets.length - 1, i + 1))}
      onClose={() => setWsOpen(false)}
      onDownload={() => {}}
    />

    {/* Economic line-item detail drawer — itemized, evidence-backed breakdown */}
    {drawerItem && (
      <>
        <div className="fixed inset-0 bg-ink/40 z-50" onClick={() => setDrawerItem(null)} />
        <div className="fixed top-0 right-0 h-full w-[380px] max-w-[90vw] bg-white shadow-xl z-50 flex flex-col">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
            <h2 className="card-title">Document Details</h2>
            <button onClick={() => setDrawerItem(null)} className="p-1.5 hover:bg-tint rounded-lg transition-colors">
              <X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <div className="eyebrow mb-1">Category</div>
              <div className="text-sm font-semibold text-ink">{drawerItem.category}</div>
            </div>
            <div>
              <div className="eyebrow mb-1">Amount</div>
              <div className="text-sm font-semibold text-ink tabular-nums">{formatUSD(drawerItem.value)}</div>
            </div>

            <div className="border-t border-line" />

            <div>
              <div className="eyebrow mb-2">{drawerItem.docCount} Supporting Documents</div>
              <div className="space-y-2">
                {(drawerDocsOpen ? breakdown : breakdown.slice(0, 3)).map((doc, i) => {
                  const open = expandedDocRows.has(doc.name);
                  return (
                    <div key={doc.name} className="rounded-lg border border-line bg-offwhite overflow-hidden">
                      <button onClick={() => toggleDocRow(doc.name)} className="w-full text-left px-3 py-2.5 hover:bg-wash transition-colors">
                        <div className="eyebrow text-[#8A98A3] mb-1.5">Document {String(i + 1).padStart(2, "0")}</div>
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                          <span className="text-xs font-medium text-ink truncate flex-1">{doc.name}</span>
                          <span className="text-xs font-semibold text-ink tabular-nums shrink-0">{formatUSD(doc.amount)}</span>
                          <ChevronDown className={`w-3.5 h-3.5 text-deep shrink-0 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} />
                        </div>
                      </button>
                      {open && (
                        <div className="px-3 pb-3 pt-2.5 border-t border-line bg-white space-y-3">
                          <div>
                            <div className="eyebrow flex items-center gap-1.5 mb-1">
                              <Sparkles className="w-3 h-3 text-deep" strokeWidth={1.75} /> AI Summary
                            </div>
                            <p className="text-xs text-[#5B6B78] leading-relaxed">{doc.aiSummary}</p>
                          </div>
                          <div>
                            <div className="eyebrow mb-1">Billing Period</div>
                            <p className="text-xs font-medium text-ink">{doc.billingPeriod}</p>
                          </div>
                          <button
                            onClick={() => { setEcoWsFocus(doc.name); setEcoWsView("preview"); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-line text-deep text-xs font-medium hover:bg-tint transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" strokeWidth={1.75} /> Preview Document
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {drawerItem.docCount > 3 && (
                <button onClick={() => setDrawerDocsOpen((o) => !o)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-deep hover:text-ink transition-colors">
                  {drawerDocsOpen ? "Show less" : `+${drawerItem.docCount - 3} More`}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${drawerDocsOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
                </button>
              )}
            </div>

            {/* Verified Total — itemized amounts reconcile to the category total */}
            <div className="border-t border-line pt-4">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-tint border border-[#D6F2F7] px-3.5 py-3">
                <div className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
                  <span className="text-xs font-semibold text-deep">Verified Total</span>
                </div>
                <span className="text-sm font-bold text-ink tabular-nums">{formatUSD(verifiedTotal)}</span>
              </div>
              <p className="text-[11px] text-[#8A98A3] mt-1.5">Sum of all {drawerItem.docCount} itemized documents · matches the verified {drawerItem.category} total.</p>
            </div>
          </div>

          <div className="border-t border-line p-4 flex items-center gap-2">
            <button onClick={() => { setEcoWsFocus(null); setEcoWsView("preview"); }} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-white border border-line text-ink text-sm font-medium hover:bg-wash transition-colors">
              <Eye className="w-4 h-4" strokeWidth={1.75} /> Preview
            </button>
            <button onClick={() => { setEcoWsFocus(null); setEcoWsView("insights"); }} className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-brand hover:bg-deep text-white text-sm font-semibold transition-colors">
              <Sparkles className="w-4 h-4" strokeWidth={1.75} /> Insights
            </button>
          </div>
        </div>
      </>
    )}

    {/* Preview / Insights workspace for the economic drawer's documents */}
    <DocumentWorkspaceModal
      docs={ecoWsView && drawerItem ? orderedDrawerDocs : null}
      contextPanel={drawerItem ? { summary: [
        { label: "Category", value: drawerItem.category },
        { label: "Amount", value: formatUSD(drawerItem.value) },
        { label: "Supporting Documents", value: String(drawerItem.docCount) },
      ] } : undefined}
      initialView={ecoWsView ?? "preview"}
      onClose={() => { setEcoWsView(null); setEcoWsFocus(null); }}
      onDownload={() => {}}
    />

    {/* Precedent case detail drawer */}
    {selectedPrecedent && (
      <>
        <div className="fixed inset-0 bg-ink/40 z-50" onClick={() => setSelectedPrecedent(null)} />
        <div className="fixed top-0 right-0 h-full w-[460px] max-w-[92vw] bg-white shadow-xl z-50 flex flex-col">
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line">
            <div className="min-w-0">
              <div className="eyebrow mb-1">PRECEDENT CASE</div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="card-title">{selectedPrecedent.caseName}</h2>
                <span className="pill pill-complete">{selectedPrecedent.matchScore}% Match</span>
              </div>
            </div>
            <button onClick={() => setSelectedPrecedent(null)} className="p-1.5 hover:bg-tint rounded-lg transition-colors shrink-0"><X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div className="text-xs text-[#5B6B78] flex items-center gap-2.5 flex-wrap">
              <span>{selectedPrecedent.matchScore}% Match <span className="font-semibold text-ink">•</span> {selectedPrecedent.labels[0]} <span className="font-semibold text-ink">•</span> {selectedPrecedent.labels[1] ?? selectedPrecedent.tags[0]}</span>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-offwhite p-3.5">
              <div>
                <div className="eyebrow mb-0.5">SETTLEMENT OUTCOME</div>
                <div className="text-xl font-bold text-ink tabular-nums">{formatUSD(selectedPrecedent.amount)}</div>
                <div className="text-xs text-[#8A98A3] mt-0.5">Resolved through Pre-Trial Settlement</div>
              </div>
            </div>

            <div>
              <div className="eyebrow mb-1.5">SIMILARITY DRIVERS</div>
              <div className="flex flex-wrap gap-1.5">
                {selectedPrecedent.labels.map((label) => <span key={label} className="pill pill-neutral">{label}</span>)}
                {selectedPrecedent.tags.map((tag) => <span key={tag} className="pill pill-neutral">{tag}</span>)}
              </div>
            </div>

            <div className="rounded-xl border border-line overflow-hidden">
              <button onClick={() => setPrecedentReasoningOpen((v) => !v)} className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-wash transition-colors">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink"><Sparkles className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> AI Summary</span>
                <ChevronDown className={`w-4 h-4 text-deep transition-transform ${precedentReasoningOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
              </button>
              {precedentReasoningOpen && (
                <div className="px-3.5 pb-3.5 pt-2 border-t border-line bg-tint">
                  <div className="eyebrow mb-1.5">Why {selectedPrecedent.matchScore}% Match</div>
                  <p className="secondary-text leading-relaxed">
                    LECO identified this precedent because it closely aligns with Estate of Miller across multiple legal and factual dimensions. Both matters involve catastrophic injuries, clearly documented negligence, strong liability evidence, and long-term medical impact. The comparable jurisdiction and settlement outcome make this case a reliable benchmark for estimating recovery potential and supporting the recommended settlement corridor.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-line overflow-hidden">
              <button onClick={() => setPrecedentSuggestionOpen((v) => !v)} className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-wash transition-colors">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-ink"><Sparkles className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> AI Suggestions</span>
                <ChevronDown className={`w-4 h-4 text-deep transition-transform ${precedentSuggestionOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
              </button>
              {precedentSuggestionOpen && (
                <div className="px-3.5 pb-3.5 pt-2 border-t border-line bg-offwhite space-y-2.5">
                  <div className="rounded-lg bg-white border border-line p-2.5">
                    <div className="eyebrow mb-1">Recommended Use</div>
                    <ul className="space-y-1.5 text-sm text-ink">
                      <li>• Support the initial settlement demand with a comparable recovery outcome.</li>
                      <li>• Reference this case when explaining long-term injury valuation.</li>
                      <li>• Strengthen liability discussions using similar negligence findings.</li>
                      <li>• Cite this precedent during negotiation to reinforce the recommended settlement corridor.</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-line p-4 flex items-center gap-2">
            <button className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-white border border-line text-ink text-sm font-medium hover:bg-wash transition-colors">💬 Chat with AI</button>
            <button className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-brand hover:bg-deep text-white text-sm font-semibold transition-colors">✨ View Insights</button>
          </div>
        </div>
      </>
    )}

    {/* ── Damage-factor "View Details" drawer (with inline edit) ── */}
    {detailFactor && (() => {
      const f = factorByCat(detailFactor);
      const cur = currentMult(detailFactor);
      const [lo, hi] = SEVERITY_RANGE[f.severity];
      const overridden = hasOverride(detailFactor);
      const prevForFactor = settlementForOverall(overallMult - cur + f.aiMultiplier);
      const diff = recommendedSettlement - prevForFactor;
      const gainSettlement = Math.round(economicTotal * f.suggestion.multiplierGain);
      const docNames = padDocsToCount([], detailFactor, f.docCount);
      const stamp = modifiedAt[detailFactor];
      const presets = Array.from(new Set([lo, Math.round(((lo + hi) / 2) * 100) / 100, hi]));
      const draftDiff = draftSettlement - recommendedSettlement;
      const dim = editMode ? "opacity-50 pointer-events-none select-none" : "";
      return (
        <>
          <div className="fixed inset-0 bg-ink/40 z-50" onClick={() => setDetailFactor(null)} />
          <div className="fixed top-0 right-0 h-full w-[460px] max-w-[92vw] bg-white shadow-xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line">
              <div className="min-w-0">
                <div className="eyebrow mb-1">Damage Factor</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="card-title">{f.category}</h2>
                  <span className={SEVERITY_PILL[f.severity]}>{f.severity}</span>
                </div>
              </div>
              <button onClick={() => setDetailFactor(null)} className="p-1.5 hover:bg-tint rounded-lg transition-colors shrink-0"><X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} /></button>
            </div>

            {detailChatOpen ? (
              <PrecedentChatPanel caseName={f.category} onBack={() => setDetailChatOpen(false)} />
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {/* Current Multiplier — read view or inline editor */}
                  {!editMode ? (
                    <div className="rounded-xl border border-line bg-offwhite p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="eyebrow mb-0.5">Current Multiplier</div>
                          <div className="text-xl font-bold text-ink tabular-nums">{fmtMult(cur)}</div>
                          <div className="text-xs text-[#8A98A3] mt-0.5">Range {fmtMult(lo)}–{fmtMult(hi)} · AI recommended {fmtMult(f.aiMultiplier)}</div>
                        </div>
                        <button onClick={startEdit} className="btn btn-secondary text-xs px-3 py-2 gap-1.5 shrink-0">
                          <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} /> Edit
                        </button>
                      </div>
                      {overridden && (
                        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-line flex-wrap">
                          <div className="text-xs text-ink">
                            <span className="font-semibold tabular-nums">{diff > 0 ? "+" : ""}{formatUSD(diff)}</span> vs. AI recommendation
                            {stamp && <span className="text-[#8A98A3]"> · {stamp}</span>}
                          </div>
                          <button onClick={() => restoreFactor(detailFactor)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-deep hover:text-ink transition-colors">
                            <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} /> Restore AI Recommendation
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-brand bg-tint p-3.5 space-y-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="eyebrow">Edit Multiplier</div>
                        <button onClick={() => restoreFactor(detailFactor)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-deep hover:text-ink transition-colors">
                          <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} /> Restore AI
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        {presets.map((p) => (
                          <button
                            key={p}
                            onClick={() => setDraftMult(p)}
                            className={`flex-1 rounded-lg border px-2 py-2 text-sm font-semibold tabular-nums transition-colors ${draftMult === p ? "border-brand bg-brand text-white" : "border-line bg-white text-ink hover:bg-wash"}`}
                          >
                            {fmtMult(p)}
                          </button>
                        ))}
                      </div>
                      <div>
                        <div className="eyebrow mb-1.5">Custom Value</div>
                        <input
                          type="number" step="0.05" value={draftMult}
                          onChange={(e) => setDraftMult(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg border border-line text-sm text-ink focus:outline-none focus:border-brand transition-colors"
                        />
                      </div>
                      <div className="rounded-lg bg-white border border-line p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="secondary-text">Settlement Impact</span>
                          <span className="font-semibold tabular-nums text-ink">{draftDiff === 0 ? "No change" : `${draftDiff > 0 ? "+" : ""}${formatUSD(draftDiff)}`}</span>
                        </div>
                        <div className="text-xs text-[#8A98A3] mt-1">New Total: {formatUSD(draftSettlement)}</div>
                      </div>
                      <div>
                        <div className="eyebrow mb-1.5">Note (optional)</div>
                        <textarea
                          value={draftNote} onChange={(e) => setDraftNote(e.target.value)} rows={2}
                          placeholder="Reason for adjustment..."
                          className="w-full px-3 py-2 rounded-lg border border-line text-sm text-ink focus:outline-none focus:border-brand transition-colors resize-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={cancelEdit} className="btn btn-secondary flex-1 justify-center">Cancel</button>
                        <button onClick={saveFactorEdit} className="btn btn-primary flex-1 justify-center">Save Changes</button>
                      </div>
                    </div>
                  )}

                  <div className={`space-y-5 transition-opacity ${dim}`}>
                    <div className="rounded-xl border border-line overflow-hidden">
                      <div className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-ink border-b border-line bg-tint">
                        <Sparkles className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> AI Summary
                      </div>
                      <div className="px-3.5 py-3 bg-tint">
                        <p className="secondary-text leading-relaxed">{f.aiReasoning}</p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-line overflow-hidden">
                      <div className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-ink border-b border-line bg-offwhite">
                        <Sparkles className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> AI Suggestions
                      </div>
                      <div className="px-3.5 py-3 bg-offwhite">
                        <div className="rounded-lg bg-white border border-line p-3">
                          <div className="eyebrow mb-1">Recommended Additional Evidence</div>
                          <div className="text-sm font-semibold text-ink">{f.suggestion.evidence}</div>
                          <p className="secondary-text mt-1.5 leading-relaxed">{f.suggestion.why}</p>
                          <div className="flex items-center gap-5 mt-3 pt-3 border-t border-line">
                            <div>
                              <div className="eyebrow">Multiplier Gain</div>
                              <div className="text-sm font-bold text-deep tabular-nums mt-0.5">+{fmtMult(f.suggestion.multiplierGain)}</div>
                            </div>
                            <div>
                              <div className="eyebrow">Settlement Impact</div>
                              <div className="text-sm font-bold text-deep tabular-nums mt-0.5">+{formatUSD(gainSettlement)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="eyebrow mb-2">Supporting Documents ({f.docCount})</div>
                      <div className="space-y-1.5">
                        {(detailDocsOpen ? docNames : docNames.slice(0, 5)).map((name) => (
                          <button
                            key={name}
                            onClick={() => openFactorDoc(detailFactor, name)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-line bg-white hover:bg-wash transition-colors text-left"
                          >
                            <FileText className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                            <span className="text-sm text-ink truncate">{name}</span>
                          </button>
                        ))}
                        {docNames.length > 5 && (
                          <button onClick={() => setDetailDocsOpen((v) => !v)} className="text-xs font-semibold text-deep hover:text-ink transition-colors">
                            {detailDocsOpen ? "Show less" : `View ${docNames.length - 5} more`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-line p-4">
                  <button onClick={() => setDetailChatOpen(true)} className="btn btn-primary w-full justify-center gap-2">
                    <Bot className="w-4 h-4" strokeWidth={1.75} /> Chat with AI
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      );
    })()}

    {/* Preview / Insights workspace for a damage factor's supporting evidence */}
    <DocumentWorkspaceModal
      docs={factorWsCat ? (() => {
        const names = padDocsToCount([], factorWsCat, factorByCat(factorWsCat).docCount);
        const ordered = factorWsFocus ? [factorWsFocus, ...names.filter((n) => n !== factorWsFocus)] : names;
        return ordered.map((n) => docForFile(n));
      })() : null}
      contextPanel={factorWsCat ? { summary: [
        { label: "Factor", value: factorWsCat },
        { label: "Severity", value: factorByCat(factorWsCat).severity },
        { label: "Multiplier", value: fmtMult(currentMult(factorWsCat)) },
        { label: "Supporting Documents", value: String(factorByCat(factorWsCat).docCount) },
      ] } : undefined}
      insights={factorWsCat ? {
        summary: factorByCat(factorWsCat).aiReasoning,
        keyPoints: factorByCat(factorWsCat).drivers.map((d) => `${d} — verified in the record.`),
        entities: [
          { label: "Factor", value: factorWsCat },
          { label: "Confidence", value: `${factorByCat(factorWsCat).confidence}%` },
        ],
        supportingDocs: padDocsToCount([], factorWsCat, factorByCat(factorWsCat).docCount),
        confidence: { level: "High", score: factorByCat(factorWsCat).confidence },
      } : undefined}
      initialView={factorWsView}
      onClose={() => { setFactorWsCat(null); setFactorWsFocus(null); }}
      onDownload={() => {}}
    />
    </>
  );
}

// ── Tab 4 — Negligence ────────────────────────────────────────────────────────
// An attorney's negligence investigation workspace: the four legal elements,
// the negligent events (expected vs actual), the evidence proving each, the AI
// assessment, the supporting documents, and the overall liability strength.

// Section 1 — the four legal elements of negligence.
const NEGLIGENCE_PILLARS = [
  {
    no: "01", title: "Duty of Care", subtitle: "What was expected?", icon: ShieldCheck, confidence: 97,
    body: "Under Texas Nursing Standards and the facility's custodial care agreement, staff were required to administer physician-prescribed Plavix continuously, monitor neurological symptoms, and initiate emergency stroke protocols without delay.",
    insight: "Physician orders, the custodial care agreement, and Texas nursing standards together establish a clear, non-discretionary duty to medicate and monitor the resident.",
    docCount: 5,
    docs: ["Physician_Prescription_Orders.pdf", "Custodial_Care_Agreement.pdf", "Texas_Nursing_Standards.pdf"],
  },
  {
    no: "02", title: "Breach of Duty", subtitle: "What failed?", icon: AlertTriangle, confidence: 98,
    body: "The facility failed to administer prescribed medication for five consecutive days and delayed emergency stroke response, violating accepted nursing standards and physician instructions.",
    insight: "The medication record and pharmacy log show five consecutive missed Plavix doses, and the stroke-protocol checklist was never initiated — a documented departure from the required standard of care.",
    docCount: 18,
    docs: ["Medication_Administration_Record.pdf", "Pharmacy_Dispensing_Log.pdf", "Nursing_Shift_Notes.pdf", "Stroke_Protocol_Checklist.pdf"],
  },
  {
    no: "03", title: "Causation", subtitle: "How did the breach lead to the injury?", icon: Activity, confidence: 96,
    body: "The prolonged medication omission and delayed emergency response directly contributed to arterial thrombosis, irreversible neurological damage, and the plaintiff's catastrophic injuries.",
    insight: "Neurology and admission records tie the medication omission and the 2.5-hour dispatch delay directly to the ischemic stroke and its irreversible progression.",
    docCount: 9,
    docs: ["Neurology_Consultation_Report.pdf", "Hospital_Admission_Records.pdf", "EMS_Dispatch_Report.pdf"],
  },
  {
    no: "04", title: "Damages", subtitle: "What harm resulted?", icon: HeartPulse, confidence: 99,
    body: "The negligence resulted in permanent neurological impairment, loss of independence, extensive medical treatment, significant emotional suffering, and ultimately wrongful death.",
    insight: "Admission records, the neurology report, and the death certificate document permanent neurological impairment and the ultimate wrongful death resulting from the negligence.",
    docCount: 7,
    docs: ["Hospital_Admission_Records.pdf", "Neurology_Consultation_Report.pdf", "Death_Certificate.pdf"],
  },
];

// AI reasoning for why this constitutes negligence (concise).
const AI_REASONING = [
  "Duty of care clearly established.",
  "Multiple documented breaches of standard care.",
  "Direct causation linked to the stroke and death.",
  "Evidence shows deviation from medical standards.",
  "Liability strongly supported by the pattern of harm.",
];


// Circular AI-confidence indicator drawn as an SVG ring (green success stroke).
function ConfidenceRing({ value }: { value: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);
  return (
    <div className="relative w-[150px] h-[150px] shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#EAEEF2" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#3FB5D7" strokeWidth="10" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-bold text-ink tabular-nums" style={{ fontSize: "26px", letterSpacing: "-0.02em" }}>{value}%</div>
        <div className="eyebrow mt-0.5">AI Confidence</div>
      </div>
    </div>
  );
}

export function NonEconomicDamagesTab({ goTo, documents }: TabProps) {
  // Shared Document Workspace — Preview / Insights for each pillar's evidence.
  const [wsOpen, setWsOpen] = useState(false);
  const [wsIndex, setWsIndex] = useState(0);
  const [wsView, setWsView] = useState<"preview" | "insights">("preview");
  const docForFile = buildDocResolver(documents);
  const negDocSets = NEGLIGENCE_PILLARS.map((p) => padDocsToCount(p.docs, p.title, p.docCount).map(docForFile));
  const negContexts = NEGLIGENCE_PILLARS.map((p) => ({ contextType: "Negligence Element", reference: p.title }));
  const negInsights = NEGLIGENCE_PILLARS.map((p) => ({
    summary: p.insight,
    keyPoints: p.docs.map((d) => `${d.replace(/_/g, " ").replace(/\.pdf$/, "")} reviewed and verified.`),
    entities: [
      { label: "Element", value: p.title },
      { label: "Confidence", value: `${p.confidence}%` },
    ],
    supportingDocs: p.docs,
    confidence: { level: "High", score: p.confidence },
  }));
  // Document Context Panel data for the preview rail (per negligence element).
  const negPanels = NEGLIGENCE_PILLARS.map((p) => ({
    summary: [
      { label: "Element", value: p.title },
      { label: "Confidence", value: `${p.confidence}%` },
      { label: "Supporting Documents", value: String(p.docCount) },
    ],
  }));
  const openNeg = (i: number, view: "preview" | "insights" = "preview") => { setWsIndex(i); setWsView(view); setWsOpen(true); };

  // Which pillar cards have their Supporting Documents AI summary expanded.
  const [pillarExpand, setPillarExpand] = useState<Set<number>>(new Set());
  const togglePillar = (i: number) =>
    setPillarExpand((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <>
    <div className="w-full space-y-5">

      {/* ── Core Negligence Framework (70%) + AI Assessment (30%) side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6 items-start">
      <div className="lg:col-span-7 lg:order-1 lg-card bg-offwhite p-6">
        <h2 className="section-header mb-5">Negligence Analysis</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {NEGLIGENCE_PILLARS.map((p, i) => {
            const shown = p.docs.slice(0, 1);
            const more = p.docCount - shown.length;
            return (
              <div key={p.no} className="border border-line rounded-xl bg-white p-6 flex flex-col gap-4">
                {/* Legal reasoning */}
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="eyebrow text-deep">Pillar {p.no}</span>
                    <div className="w-9 h-9 rounded-lg bg-tint flex items-center justify-center shrink-0">
                      <p.icon className="w-4 h-4 text-deep" strokeWidth={1.75} />
                    </div>
                  </div>
                  <h3 className="card-title" style={{ fontSize: "18px" }}>{p.title}</h3>
                  <p className="text-sm font-medium text-deep mt-0.5 mb-3">{p.subtitle}</p>
                  <p className="body-text leading-relaxed">{p.body}</p>
                </div>

                {/* Supporting documents — header dropdown reveals the AI summary */}
                <div className="border-t border-line pt-4">
                  <button onClick={() => togglePillar(i)} className="w-full flex items-center justify-between gap-2 mb-2.5 group">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                      <span className="text-sm font-semibold text-ink">{p.docCount} Supporting Documents</span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-deep transition-transform ${pillarExpand.has(i) ? "rotate-180" : ""}`} strokeWidth={1.75} />
                  </button>
                  <div className="flex items-center gap-2 flex-wrap">
                    {shown.map((d) => (
                      <button
                        key={d}
                        onClick={() => openNeg(i, "preview")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-offwhite px-2.5 py-1.5 text-xs text-ink cursor-pointer hover:border-brand hover:bg-tint hover:shadow-sm transition-all"
                      >
                        <FileText className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                        <span className="truncate max-w-[150px]">{d}</span>
                      </button>
                    ))}
                    {more > 0 && (
                      <button
                        onClick={() => openNeg(i, "preview")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-offwhite px-2.5 py-1.5 text-xs font-medium text-deep cursor-pointer hover:border-brand hover:bg-tint hover:shadow-sm transition-all"
                      >
                        +{more} more
                      </button>
                    )}
                  </div>
                  {pillarExpand.has(i) && (
                    <div className="mt-3 rounded-lg bg-tint border border-[#D6F2F7] p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                        <span className="eyebrow text-deep">AI Summary</span>
                      </div>
                      <p className="secondary-text leading-relaxed">{p.insight}</p>
                    </div>
                  )}
                </div>

                {/* Actions — Preview / Insights open the shared Document Workspace */}
                <div className="mt-auto border-t border-line" />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openNeg(i, "preview")}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-line text-ink rounded-lg text-sm font-medium hover:bg-wash transition-colors"
                  >
                    <Eye className="w-4 h-4" strokeWidth={1.75} /> Preview Evidence
                  </button>
                  <button
                    onClick={() => openNeg(i, "insights")}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-line text-deep rounded-lg text-sm font-medium hover:bg-tint transition-colors"
                  >
                    <Sparkles className="w-4 h-4" strokeWidth={1.75} /> View Insights
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI assessment card (30%) — placed on the right, sticky, no section title */}
      <div className="lg:col-span-3 lg:order-2 lg:sticky lg:top-[176px] self-start lg-card p-6 flex flex-col">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles className="w-5 h-5 text-deep" strokeWidth={1.75} />
          <h3 className="card-title" style={{ fontSize: "18px" }}>Why This Constitutes Negligence</h3>
        </div>
        <div className="flex flex-col items-center gap-5">
          <ConfidenceRing value={98.4} />
          <ul className="space-y-2.5 w-full">
            {AI_REASONING.map((r) => (
              <li key={r} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-deep mt-0.5 shrink-0" strokeWidth={1.75} />
                <span className="body-text leading-snug">{r}</span>
              </li>
            ))}
          </ul>
        </div>
        <button onClick={() => goTo("liability")} className="btn btn-primary w-full gap-2 mt-6">
          Proceed to Violations <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>
      </div>
    </div>

    {/* Shared Document Workspace — Preview / Insights for the selected pillar's evidence */}
    <DocumentWorkspaceModal
      docs={wsOpen ? (negDocSets[wsIndex] ?? []) : null}
      noteContext={negContexts[wsIndex]}
      insights={negInsights[wsIndex]}
      contextPanel={negPanels[wsIndex]}
      initialView={wsView}
      position={wsIndex + 1}
      total={negDocSets.length}
      onPrev={() => setWsIndex((i) => Math.max(0, i - 1))}
      onNext={() => setWsIndex((i) => Math.min(negDocSets.length - 1, i + 1))}
      onClose={() => setWsOpen(false)}
      onDownload={() => {}}
    />
    </>
  );
}

// ── Tab 5 — Liability Analysis ────────────────────────────────────────────────

// Severity tag → pill class for violations (Critical = red, Major = amber, Moderate = teal).
export const VIOLATION_SEVERITY_PILL: Record<string, string> = {
  Critical: "pill pill-risk",
  High: "pill pill-progress",
  Medium: "pill pill-neutral",
  Low: "pill pill-complete",
};

// The legal framework that governs every violation shown on this page.
const LEGAL_FRAMEWORK = {
  venue: "Circuit Court of Cook County, IL",
  agency: "Illinois Secretary of State · FMCSA",
  statute: "Illinois Vehicle Code (625 ILCS 5)",
};

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

export const VIOLATION_CARDS: ViolationCard[] = [
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

// Toggle a card id within a Set-based open/closed state.
type SetState = (updater: (prev: Set<string>) => Set<string>) => void;
const toggleId = (setter: SetState, id: string) =>
  setter((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

export function LiabilityAnalysisTab({ goTo, documents }: TabProps) {
  const [statuteOpen, setStatuteOpen] = useState<Set<string>>(new Set());
  const [similarOpen, setSimilarOpen] = useState<Set<string>>(new Set());
  const [docsOpen, setDocsOpen] = useState<Set<string>>(new Set());

  // Shared Document Workspace — Preview / Insights for each violation's evidence
  // (mirrors the Negligence Analysis cards).
  const [wsOpen, setWsOpen] = useState(false);
  const [wsIndex, setWsIndex] = useState(0);
  const [wsView, setWsView] = useState<"preview" | "insights">("preview");
  const docForFile = buildDocResolver(documents);
  const violationDocSets = VIOLATION_CARDS.map((v) => v.evidence.map(docForFile));
  const violationContexts = VIOLATION_CARDS.map((v) => ({ contextType: "Violation", reference: v.title }));
  const violationInsights = VIOLATION_CARDS.map((v) => ({
    summary: v.aiSummary,
    keyPoints: v.evidence.map((d) => `${d.replace(/_/g, " ").replace(/\.[a-z0-9]+$/i, "")} reviewed and verified.`),
    entities: [
      { label: "Violation", value: v.title },
      { label: "Severity", value: v.severity },
      { label: "Confidence", value: `${v.confidence}%` },
    ],
    supportingDocs: v.evidence,
    confidence: { level: v.confidence >= 90 ? "High" : v.confidence >= 75 ? "Medium" : "Low", score: v.confidence },
  }));
  // Document Context Panel data for the preview rail (per violation).
  const violationPanels = VIOLATION_CARDS.map((v) => ({
    summary: [
      { label: "Violation", value: v.title },
      { label: "Severity", value: v.severity },
      { label: "Jurisdiction", value: v.jurisdiction },
      { label: "Supporting Documents", value: String(v.evidence.length) },
    ],
  }));
  const openViolation = (i: number, view: "preview" | "insights" = "preview") => { setWsIndex(i); setWsView(view); setWsOpen(true); };

  const total = VIOLATION_CARDS.length;
  const counts = {
    Critical: VIOLATION_CARDS.filter((v) => v.severity === "Critical").length,
    High: VIOLATION_CARDS.filter((v) => v.severity === "High").length,
    Medium: VIOLATION_CARDS.filter((v) => v.severity === "Medium").length,
    Low: VIOLATION_CARDS.filter((v) => v.severity === "Low").length,
  };
  // Severity cells — Low is only shown when at least one Low violation exists.
  const severityCells = ([["Critical", counts.Critical], ["High", counts.High], ["Medium", counts.Medium], ["Low", counts.Low]] as const)
    .filter(([label, n]) => label !== "Low" || n > 0);

  return (
    <>
    <div className="w-full">
      <div className="w-full flex flex-col lg:flex-row-reverse gap-6 items-start">
      {/* RIGHT — Applicable Legal Framework (sticky sidebar, ~32%) */}
      <aside className="w-full lg:w-[32%] shrink-0 lg:sticky lg:top-[176px] self-start">
        <div className="lg-card p-6 space-y-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-tint border border-line flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 text-deep" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h2 className="card-title leading-tight">Applicable Legal Framework</h2>
              <p className="secondary-text leading-snug">Legal context for every violation</p>
            </div>
          </div>

          {/* Framework facts */}
          <div className="space-y-3">
            {[
              { icon: MapPin, label: "Target Venue", value: LEGAL_FRAMEWORK.venue },
              { icon: Building2, label: "Governing Regulatory Agency", value: LEGAL_FRAMEWORK.agency },
              { icon: Gavel, label: "Applicable Legal Code", value: LEGAL_FRAMEWORK.statute },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="lg-zone rounded-xl p-3.5 flex items-start gap-2.5">
                <Icon className="w-4 h-4 text-deep mt-0.5 shrink-0" strokeWidth={1.75} />
                <div className="min-w-0">
                  <div className="eyebrow mb-0.5">{label}</div>
                  <div className="text-sm font-semibold text-ink leading-snug">{value}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-line" />

          {/* Total Violations */}
          <div className="flex items-end justify-between">
            <div>
              <div className="eyebrow mb-1">Total Violations</div>
              <div className="kpi-value leading-none">{total}</div>
            </div>
            <Hash className="w-5 h-5 text-deep shrink-0" strokeWidth={1.75} />
          </div>

          {/* Severity counts */}
          <div className={`grid gap-2 ${severityCells.length >= 4 ? "grid-cols-2" : "grid-cols-3"}`}>
            {severityCells.map(([label, n]) => (
              <div key={label} className="rounded-xl border border-line bg-white p-3 flex flex-col items-center gap-1.5">
                <div className="text-lg font-bold text-ink tabular-nums leading-none">{n}</div>
                <span className={VIOLATION_SEVERITY_PILL[label]}>{label}</span>
              </div>
            ))}
          </div>

          {/* Primary CTA — review the full case journey */}
          <button
            onClick={() => goTo("evidence")}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand hover:bg-deep text-white text-sm font-semibold transition-all"
          >
            View Case Journey
            <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      {/* RIGHT — Violation cards inside an off-white container (~68%) */}
      <div className="flex-1 min-w-0">
        <div className="lg-card bg-offwhite p-6 space-y-4">
        <h2 className="page-title" style={{ fontSize: "24px" }}>Violations</h2>
        {VIOLATION_CARDS.map((v, i) => {
          const statuteShown = statuteOpen.has(v.id);
          const similarShown = similarOpen.has(v.id);
          const docsShown = docsOpen.has(v.id);
          return (
            <div key={v.id} className="lg-card p-6 space-y-4">
              {/* Header — title + severity + description */}
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Gavel className="w-5 h-5 text-deep shrink-0" strokeWidth={1.75} />
                  <h3 className="text-xl font-semibold text-ink leading-tight tracking-tight">{v.title}</h3>
                  <span className={VIOLATION_SEVERITY_PILL[v.severity]}>{v.severity}</span>
                </div>
                <p className="body-text leading-relaxed mt-2">{v.description}</p>
              </div>

              {/* Meta row — Location | Supporting Documents | Applied Legal Statute, divided */}
              <div className="grid grid-cols-1 sm:grid-cols-3 border-y border-line divide-y sm:divide-y-0 sm:divide-x divide-line">
                {/* Location */}
                <div className="py-4 sm:pr-5">
                  <div className="flex items-center gap-1.5 eyebrow mb-1">
                    <MapPin className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} /> Location
                  </div>
                  <div className="text-sm font-semibold text-ink">{v.jurisdiction}</div>
                </div>

                {/* Supporting Documents */}
                <div className="py-4 sm:px-5">
                  <div className="eyebrow mb-1">Supporting Documents ({v.evidence.length})</div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                      <span className="mono-ref">{v.evidence[0]}</span>
                    </span>
                    {v.evidence.length > 1 && (
                      <button
                        onClick={() => toggleId(setDocsOpen, v.id)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-deep hover:text-ink transition-colors"
                      >
                        {docsShown ? "Show less" : `+${v.evidence.length - 1} More`}
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${docsShown ? "rotate-180" : ""}`} strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                  {docsShown && v.evidence.length > 1 && (
                    <div className="space-y-2 mt-2">
                      {v.evidence.slice(1).map((doc) => (
                        <div key={doc} className="flex items-center gap-2.5 rounded-lg bg-white border border-line px-3 py-2">
                          <FileText className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} /><span className="mono-ref">{doc}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Applied Legal Statute — statute code only; click to expand reasoning */}
                <div className="py-4 sm:px-5">
                  <div className="eyebrow mb-1">Applied Legal Statute</div>
                  <button
                    onClick={() => toggleId(setStatuteOpen, v.id)}
                    aria-expanded={statuteShown}
                    className="flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-deep transition-colors"
                  >
                    <Gavel className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
                    {v.statute.split(" — ")[0]}
                    <ChevronDown className={`w-4 h-4 text-[#5B6B78] shrink-0 transition-transform duration-200 ${statuteShown ? "rotate-180" : ""}`} strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              {/* Applied Legal Statute — expanded reasoning */}
              {statuteShown && (
                <div className="rounded-xl border border-line p-4 space-y-3 bg-offwhite">
                  <div className="rounded-lg bg-[#F6FDFF] border border-[#D6F2F7] p-3.5">
                    <div className="flex items-center gap-2 mb-1"><Sparkles className="w-4 h-4 text-deep" strokeWidth={1.75} /><span className="eyebrow text-deep">AI Summary</span></div>
                    <p className="secondary-text">{v.aiSummary}</p>
                  </div>
                  <div>
                    <div className="eyebrow mb-1">Why This Statute Applies</div>
                    <p className="secondary-text">{v.whyApplied}</p>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-line bg-white px-3.5 py-2.5">
                    <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-deep" strokeWidth={1.75} /><span className="eyebrow">Confidence Score</span></div>
                    <span className="text-sm font-bold text-ink tabular-nums">{v.confidence}%</span>
                  </div>
                </div>
              )}

              {/* Similar Statutes — collapsed by default */}
              <div className="rounded-xl border border-line overflow-hidden">
                <button
                  onClick={() => toggleId(setSimilarOpen, v.id)}
                  aria-expanded={similarShown}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-wash transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-deep">
                    <Scale className="w-4 h-4 shrink-0" strokeWidth={1.75} /> Want to see similar statutes considered?
                  </span>
                  <ChevronDown className={`w-4 h-4 text-[#5B6B78] shrink-0 transition-transform duration-200 ${similarShown ? "" : "-rotate-90"}`} strokeWidth={1.75} />
                </button>
                {similarShown && (
                  <div className="border-t border-line p-4 space-y-2 bg-offwhite">
                    {v.similar.map((s) => (
                      <div key={s.name} className="rounded-lg border border-line bg-white p-3.5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-ink mb-1.5"><Scale className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />{s.name}</div>
                        <p className="secondary-text mb-1"><span className="font-medium text-ink">Considered:</span> {s.reasonConsidered}</p>
                        <p className="secondary-text"><span className="font-medium text-ink">Not selected:</span> {s.whyNot}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider between similar statutes and actions */}
              <div className="border-t border-line" />

              {/* Actions — open the shared Document Workspace (Preview / Insights) */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openViolation(i, "preview")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-line text-deep text-sm font-medium hover:bg-wash transition-all"
                >
                  <Eye className="w-4 h-4" strokeWidth={1.75} /> Preview Evidence
                </button>
                <button
                  onClick={() => openViolation(i, "insights")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand hover:bg-deep text-white text-sm font-semibold transition-all"
                >
                  <Sparkles className="w-4 h-4" strokeWidth={1.75} /> View Insights
                </button>
              </div>
            </div>
          );
        })}
        </div>
      </div>
      </div>
    </div>

    {/* Shared Document Workspace — Preview / Insights for the selected violation's evidence */}
    <DocumentWorkspaceModal
      docs={wsOpen ? (violationDocSets[wsIndex] ?? []) : null}
      noteContext={violationContexts[wsIndex]}
      contextPanel={violationPanels[wsIndex]}
      insights={violationInsights[wsIndex]}
      initialView={wsView}
      position={wsIndex + 1}
      total={violationDocSets.length}
      onPrev={() => setWsIndex((i) => Math.max(0, i - 1))}
      onNext={() => setWsIndex((i) => Math.min(violationDocSets.length - 1, i + 1))}
      onClose={() => setWsOpen(false)}
      onDownload={() => {}}
    />
    </>
  );
}

// ── Tab 6 — Evidence Repository ───────────────────────────────────────────────

const EVIDENCE_GROUPS: { name: string; icon: any; match: RegExp }[] = [
  { name: "Medical Records", icon: Stethoscope, match: /(mri|er_|hospital|medical|therapy|treatment|discharge|physical|radiology|bills)/ },
  { name: "Police Reports", icon: FileText, match: /(police|accident|incident|citation|crash|report)/ },
  { name: "Witness Statements", icon: MessageSquare, match: /(witness|statement)/ },
  { name: "Insurance & Financial", icon: DollarSign, match: /(insurance|policy|wage|loss|claim)/ },
  { name: "Photos", icon: ImageIcon, match: /\.(jpg|jpeg|png|gif|webp)$|photo|image|scene/ },
  { name: "Videos", icon: Video, match: /\.(mp4|mov|avi|webm)$|video|dashcam/ },
];

export function EvidenceRepositoryTab({ documents }: TabProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const q = search.trim().toLowerCase();
  const classify = (name: string) => EVIDENCE_GROUPS.find((g) => g.match.test(name.toLowerCase()))?.name ?? "Other Documents";

  const visible = documents.filter((d) => (!q || d.name.toLowerCase().includes(q)) && (filter === "All" || classify(d.name) === filter));
  const groupNames = [...EVIDENCE_GROUPS.map((g) => g.name), "Other Documents"];
  const grouped = groupNames
    .map((name) => ({ name, icon: EVIDENCE_GROUPS.find((g) => g.name === name)?.icon ?? FileText, docs: visible.filter((d) => classify(d.name) === name) }))
    .filter((g) => g.docs.length > 0);

  return (
    <div className="max-w-4xl space-y-6">
      <Section title="Evidence Repository" description="Every verified document supporting the case, organized by type. Preview, inspect insights, or download.">
        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents…"
              className="w-full bg-white border border-line rounded-lg pl-10 pr-4 py-2.5 text-sm text-ink placeholder:text-[#5B6B78] focus:outline-none focus:border-brand transition-colors"
            />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="bg-white border border-line rounded-lg px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-brand transition-colors">
            <option value="All">All Types</option>
            {groupNames.map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>

        {grouped.length === 0 ? (
          <div className="lg-card flex flex-col items-center justify-center py-16 text-center">
            <FileText className="w-8 h-8 text-soft mb-3" strokeWidth={1.75} />
            <p className="text-sm font-medium text-ink">No documents match</p>
            <p className="secondary-text mt-1">Try a different search or filter.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map((g) => (
              <div key={g.name}>
                <div className="flex items-center gap-2 mb-3">
                  <g.icon className="w-4 h-4 text-deep" strokeWidth={1.75} />
                  <h3 className="card-title">{g.name}</h3>
                  <span className="pill pill-neutral">{g.docs.length}</span>
                </div>
                <div className="lg-card divide-y divide-line">
                  {g.docs.map((d) => (
                    <div key={d.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="w-9 h-9 rounded-lg bg-tint flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4 text-deep" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-ink truncate">{d.name}</div>
                        <div className="mono-ref">{d.source} · {d.date}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button title="Preview" className="p-2 rounded-lg text-[#5B6B78] hover:text-deep hover:bg-tint transition-colors"><Eye className="w-4 h-4" strokeWidth={1.75} /></button>
                        <button title="Insights" className="p-2 rounded-lg text-[#5B6B78] hover:text-deep hover:bg-tint transition-colors"><Lightbulb className="w-4 h-4" strokeWidth={1.75} /></button>
                        <button title="Download" className="p-2 rounded-lg text-[#5B6B78] hover:text-deep hover:bg-tint transition-colors"><Download className="w-4 h-4" strokeWidth={1.75} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Tab 7 — Intelligence ──────────────────────────────────────────────────────
// Litigation intelligence dashboard: coverage & deadline posture, the settlement
// corridor, an AI valuation brief, comparable verdicts, a negligence audit, and
// attorney trial-prep directives — all built from the existing case model.

export const POLICY_LIMIT = 2_000_000;

// ── Corridor simulation — AI processing steps, context graph, and result ──
const CORRIDOR_STEPS = [
  "Reading verified case evidence…",
  "Mapping negligence findings…",
  "Loading jurisdiction & venue…",
  "Analyzing insurance coverage…",
  "Searching comparable verdicts…",
  "Building legal context graph…",
  "Computing settlement corridor…",
  "Selecting optimal litigation strategy…",
];

// Context-graph nodes (positions in % of the panel) and the links between them.
const GRAPH_NODES: { label: string; x: number; y: number }[] = [
  { label: "Case Evidence", x: 50, y: 12 },
  { label: "Negligence", x: 16, y: 32 },
  { label: "Damages", x: 84, y: 32 },
  { label: "Insurance Policy", x: 13, y: 64 },
  { label: "Jurisdiction", x: 50, y: 47 },
  { label: "Historical Cases", x: 87, y: 64 },
  { label: "Settlement Strategy", x: 50, y: 84 },
];
const GRAPH_EDGES: [number, number][] = [[0, 4], [1, 4], [2, 4], [3, 4], [5, 4], [4, 6], [0, 1], [0, 2], [3, 6], [5, 6]];

// Simulation output — the actuarial loss corridor.
const CORRIDOR_RESULT = {
  rapid: 242_175,
  recommended: 1_775_950,
  maximum: 2_663_925,
  confidence: 94,
  matchedCases: 12,
};

// The AI's reasoning behind the recommended strategy — the factors it weighed.
const VALUATION_BRIEF: { label: string; icon: any; text: string }[] = [
  { label: "Damages", icon: DollarSign, text: "Verified economic damages plus permanent, MRI-documented injuries support a high non-economic multiplier." },
  { label: "Liability", icon: Scale, text: "Officer fault determination and a corroborated red-light violation leave little room to contest fault." },
  { label: "Jurisdiction", icon: MapPin, text: "Cook County venue trends plaintiff-favorable for commercial-carrier intersection collisions." },
  { label: "Precedent Matches", icon: Gavel, text: "Three closely-matched local verdicts cluster near the recommended value, anchoring the corridor." },
  { label: "Policy Limits", icon: ShieldCheck, text: "Confirmed $2.0M commercial policy makes a full policy-informed recovery realistic and collectible." },
];

// Local comparable verdicts / settlements matched to this case profile. `labels`
// are the short category chips shown above each card.
type ComparableFilterKey = "injuryType" | "severity" | "jurisdiction" | "violation" | "legalStatute" | "caseType";

type ComparableVerdict = {
  caseName: string;
  amount: number;
  summary: string;
  matchScore: number;
  labels: string[];
  tags: string[];
  whyThisMatters: string;
  similarityBreakdown: { label: string; contribution: number; explanation: string }[];
  filterValues: Record<ComparableFilterKey, string>;
  jurisdictionState: string;
};

const COMPARABLE_FILTERS: { key: ComparableFilterKey; label: string; allLabel: string }[] = [
  { key: "injuryType", label: "Injury Type", allLabel: "All injury types" },
  { key: "severity", label: "Severity", allLabel: "All severity levels" },
  { key: "jurisdiction", label: "Jurisdiction", allLabel: "All jurisdictions" },
  { key: "violation", label: "Violation", allLabel: "All violations" },
  { key: "legalStatute", label: "Legal Statute", allLabel: "All statutes" },
  { key: "caseType", label: "Case Type", allLabel: "All case types" },
];

export const COMPARABLE_VERDICTS: ComparableVerdict[] = [
  {
    caseName: "Reyes v. Interstate Freight Lines",
    amount: 1_750_000,
    summary: "Commercial truck entered a controlled intersection against the signal; plaintiff sustained multi-level cervical herniations requiring ongoing care.",
    matchScore: 94,
    labels: ["Commercial Vehicle", "Cervical Injury"],
    tags: ["Red-light violation", "Commercial vehicle", "Cervical injury", "Cook County"],
    whyThisMatters: "This precedent is a strong match because the liability narrative, cervical injury pattern, and venue profile align closely with the current case and support a policy-informed settlement corridor.",
    similarityBreakdown: [
      { label: "Jurisdiction", contribution: 18, explanation: "Same Cook County jurisdiction" },
      { label: "Injury Type", contribution: 22, explanation: "Cervical injury pattern" },
      { label: "Injury Severity", contribution: 20, explanation: "Severe, ongoing impairment and care" },
      { label: "Liability", contribution: 16, explanation: "Strong red-light violation evidence" },
      { label: "Long-Term Impact", contribution: 10, explanation: "Similar long-term medical impact" },
      { label: "Case Context", contribution: 8, explanation: "Comparable commercial vehicle matter" },
    ],
    filterValues: { injuryType: "Cervical Injury", severity: "Severe", jurisdiction: "Cook County", violation: "Red-light violation", legalStatute: "Commercial vehicle", caseType: "Commercial Vehicle" },
    jurisdictionState: "Illinois",
  },
  {
    caseName: "Donovan v. Metro Cartage Co.",
    amount: 1_420_000,
    summary: "Failure-to-yield collision with a delivery vehicle; disputed liability resolved on the responding officer's fault determination.",
    matchScore: 89,
    labels: ["Commercial Vehicle", "Disputed Liability"],
    tags: ["Failure to yield", "Officer fault", "Disputed liability"],
    whyThisMatters: "This case is useful because it reflects a comparable commercial-carrier crash with a disputed liability posture, showing how a strong liability narrative can still support a meaningful recovery.",
    similarityBreakdown: [
      { label: "Jurisdiction", contribution: 12, explanation: "Comparable venue profile" },
      { label: "Injury Type", contribution: 18, explanation: "Comparable collision injury pattern" },
      { label: "Injury Severity", contribution: 17, explanation: "Meaningful injury with ongoing care" },
      { label: "Liability", contribution: 17, explanation: "Officer fault determination" },
      { label: "Long-Term Impact", contribution: 14, explanation: "Comparable recovery implications" },
      { label: "Case Context", contribution: 11, explanation: "Similar commercial-carrier crash" },
    ],
    filterValues: { injuryType: "Delivery Vehicle Collision", severity: "Moderate", jurisdiction: "Not specified", violation: "Failure to yield", legalStatute: "Officer fault", caseType: "Commercial Vehicle" },
    jurisdictionState: "Illinois",
  },
  {
    caseName: "Whitfield v. Prairie Logistics",
    amount: 1_180_000,
    summary: "Intersection crash producing permanent impairment; carrier policy limits framed the settlement corridor.",
    matchScore: 85,
    labels: ["Permanent Impairment", "Policy-Limit"],
    tags: ["Permanent impairment", "Policy-limit demand", "MVA"],
    whyThisMatters: "This precedent is relevant because it demonstrates how permanent impairment and policy-limit exposure can shape settlement leverage in a similar commercial vehicle matter.",
    similarityBreakdown: [
      { label: "Jurisdiction", contribution: 11, explanation: "Comparable venue profile" },
      { label: "Injury Type", contribution: 16, explanation: "Comparable impairment pattern" },
      { label: "Injury Severity", contribution: 19, explanation: "Permanent impairment" },
      { label: "Liability", contribution: 14, explanation: "Comparable liability posture" },
      { label: "Long-Term Impact", contribution: 15, explanation: "Similar lasting medical impact" },
      { label: "Case Context", contribution: 10, explanation: "Similar policy-limit MVA context" },
    ],
    filterValues: { injuryType: "Permanent Impairment", severity: "Severe", jurisdiction: "Not specified", violation: "Policy-limit demand", legalStatute: "Policy-limit demand", caseType: "Motor Vehicle" },
    jurisdictionState: "Illinois",
  },
];

// Attorney action checklist generated from case intelligence.
const TRIAL_DIRECTIVES: { title: string; icon: any; items: string[] }[] = [
  { title: "Recommended Depositions", icon: MessageSquare, items: ["Defendant commercial driver", "Responding officer (fault determination)", "Corroborating eyewitness", "Carrier corporate representative"] },
  { title: "Expert Witnesses", icon: User, items: ["Accident reconstructionist", "Treating neurosurgeon", "Life-care planner", "Vocational economist"] },
  { title: "Discovery Priorities", icon: Search, items: ["Driver qualification & hours-of-service logs", "Telematics / ELD and dashcam data", "Carrier maintenance & training records", "Intersection signal-timing records"] },
  { title: "Trial Preparation", icon: ClipboardList, items: ["Prepare demonstrative reconstruction exhibits", "Draft motions in limine on comparative fault", "Assemble the medical-chronology exhibit binder", "Develop jury themes on commercial-carrier negligence"] },
];

export function DemandPackageTab({ model, goTo, onGenerateDemand }: TabProps) {
  // "Generated From" label + numeric estimate for whichever strategy is active
  // when a demand package is generated (used by both Generate Demand CTAs below).
  const strategyStageLabel: Record<"negotiation" | "settlement" | "trial", string> = {
    negotiation: "Negotiation Strategy",
    settlement: "Settlement Strategy",
    trial: "Trial Strategy",
  };
  const consumption = Math.round((model.recommendedSettlement / POLICY_LIMIT) * 100);
  const dashboard = [
    { icon: ShieldCheck, label: "Policy Coverage", value: formatUSD(POLICY_LIMIT), sub: "Commercial auto liability limit" },
    { icon: DollarSign, label: "Verified Economic Damages", value: formatUSD(model.economicTotal), sub: "Documented & reconciled" },
    { icon: SlidersHorizontal, label: "Coverage Consumption", value: `${consumption}%`, sub: "of available policy limit", bar: consumption },
    { icon: Calendar, label: "Filing Deadline", value: "Feb 14, 2028", sub: "Statute of limitations · ≈19 mo left" },
  ];

  // The three strategy paths the AI weighed — Settlement (recommended) sits in the middle.
  const strategyOptions = [
    { key: "Negotiation", label: "Rapid Exit Strategy", icon: MessageSquare, value: `${formatCompact(model.estimatedLow)} – ${formatCompact(model.recommendedSettlement)}`, desc: "Trade demands to close above the corridor midpoint.", recommended: false },
    { key: "Settlement", label: "Median Target (Recommended)", icon: DollarSign, value: formatCompact(model.recommendedSettlement), desc: "Resolve pre-suit at the policy-informed value — strongest risk-adjusted recovery.", recommended: true },
    { key: "Trial", label: "Max Litigation Strategy", icon: Gavel, value: formatCompact(POLICY_LIMIT), desc: "Highest exposure, but added cost and timeline risk.", recommended: false },
  ];

  const supportingFindings = [
    {
      title: "Duty & Breach Established",
      confidence: 96,
      summary: "The duty of care was clearly established and the record shows repeated breaches through unsafe operation, failure to preserve safe conditions, and disregard for known roadway hazards.",
      takeaways: ["Duty of care is well documented.", "Operational breaches are clearly traceable.", "Liability themes remain straightforward and persuasive."],
    },
    {
      title: "Direct Medical Link",
      confidence: 94,
      summary: "The negligence sequence directly aligns with the plaintiff's injuries, with documented clinical deterioration and ongoing treatment that ties the harm to the incident rather than to pre-existing conditions alone.",
      takeaways: ["Injury causation is strongly supported.", "Medical records reinforce a direct link.", "The damages narrative is well anchored in evidence."],
    },
    {
      title: "Regulatory Violations Confirmed",
      confidence: 95,
      summary: "Traffic and safety violations materially reinforce the liability case by showing objective statutory and regulatory noncompliance that strengthens the plaintiff's narrative of unreasonable conduct.",
      takeaways: ["Regulatory breaches are confirmed.", "Violations strengthen fault findings.", "The record supports a robust liability argument."],
    },
    {
      title: "Litigation Advantage",
      confidence: 93,
      summary: "Taken together, the negligence findings, medical linkage, and confirmed violations create significant settlement leverage and materially increase defense exposure in a plaintiff-favorable venue.",
      takeaways: ["Settlement leverage is materially stronger.", "Defense exposure is meaningfully elevated.", "The case posture supports an assertive strategy."],
    },
  ];

  // ── Corridor simulation state machine: idle → analyzing → done ──
  const [corridorPhase, setCorridorPhase] = useState<"idle" | "analyzing" | "done">("idle");
  const [corridorStep, setCorridorStep] = useState(0);
  const [showGraph, setShowGraph] = useState(false); // done-state toggle: strategy ↔ context graph
  const [selectedPrecedent, setSelectedPrecedent] = useState<(typeof COMPARABLE_VERDICTS)[number] | null>(null);
  const [precedentChatOpen, setPrecedentChatOpen] = useState(false);
  const [similarityBreakdownOpen, setSimilarityBreakdownOpen] = useState<string | null>(null);
  const [precedentWhyOpen, setPrecedentWhyOpen] = useState<string | null>(null);
  const [caseSearch, setCaseSearch] = useState("");
  const [caseFiltersOpen, setCaseFiltersOpen] = useState(false);
  const [draftCaseFilters, setDraftCaseFilters] = useState<Record<ComparableFilterKey, string>>({
    injuryType: "",
    severity: "",
    jurisdiction: "",
    violation: "",
    legalStatute: "",
    caseType: "",
  });
  const [draftJurisdictionState, setDraftJurisdictionState] = useState("");
  const [jurisdictionState, setJurisdictionState] = useState("");
  const [caseFilters, setCaseFilters] = useState<Record<ComparableFilterKey, string>>({
    injuryType: "",
    severity: "",
    jurisdiction: "",
    violation: "",
    legalStatute: "",
    caseType: "",
  });
  const [supportingFindingsOpen, setSupportingFindingsOpen] = useState<Record<string, boolean>>({});

  const normalizedCaseSearch = caseSearch.trim().toLowerCase();
  const visibleComparableVerdicts = COMPARABLE_VERDICTS.filter((v) => {
    const searchableText = [
      v.caseName,
      v.summary,
      v.whyThisMatters,
      ...v.labels,
      ...v.tags,
      ...Object.values(v.filterValues),
    ].join(" ").toLowerCase();
    const matchesSearch = !normalizedCaseSearch || searchableText.includes(normalizedCaseSearch);
    const matchesFilters = COMPARABLE_FILTERS.every(({ key }) => {
      const selected = caseFilters[key].trim().toLowerCase();
      if (!selected) return true;
      const value = v.filterValues[key].toLowerCase();
      return ["injuryType", "violation", "legalStatute"].includes(key) ? value.includes(selected) : value === selected;
    }) &&
      (!jurisdictionState || v.jurisdictionState === jurisdictionState);
    return matchesSearch && matchesFilters;
  });
  const hasCaseDiscovery = Boolean(normalizedCaseSearch || Object.values(caseFilters).some(Boolean) || jurisdictionState);
  const activeCaseFilters = COMPARABLE_FILTERS.filter(({ key }) => caseFilters[key]);
  const jurisdictionStates = [...new Set(COMPARABLE_VERDICTS.map((v) => v.jurisdictionState))];
  const jurisdictionCounties = draftJurisdictionState
    ? [...new Set(COMPARABLE_VERDICTS.filter((v) => v.jurisdictionState === draftJurisdictionState && v.filterValues.jurisdiction !== "Not specified").map((v) => v.filterValues.jurisdiction))]
    : [];
  const clearCaseFilters = () => {
    const emptyFilters = { injuryType: "", severity: "", jurisdiction: "", violation: "", legalStatute: "", caseType: "" };
    setCaseFilters(emptyFilters);
    setDraftCaseFilters(emptyFilters);
    setJurisdictionState("");
    setDraftJurisdictionState("");
  };

  // Lock background scroll while the precedent drawer is open, so the dimmed
  // backdrop always covers the full viewport regardless of scroll position.
  useEffect(() => {
    document.body.style.overflow = selectedPrecedent ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [selectedPrecedent]);

  const [showStrategyDashboard, setShowStrategyDashboard] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<"negotiation" | "settlement" | "trial">("settlement");
  const openStrategyDashboard = (strategy: "negotiation" | "settlement" | "trial") => {
    setSelectedStrategy(strategy);
    setShowStrategyDashboard(true);
  };
  const closeStrategyDashboard = () => setShowStrategyDashboard(false);
  const strategyProfiles = {
    negotiation: {
      key: "negotiation" as const,
      title: "High-Velocity Pre-Litigation Demurrer Alignment",
      label: "Rapid Exit Strategy",
      heroTitle: "Rapid Exit Strategy (Negotiation)",
      heroSubtitle: "For Estate of Miller vs Logistics Co., the Rapid Exit Strategy bypasses extensive court dockets to target an expedited compromise of $242,175. Suited to clients seeking fast liquidity and avoiding intrusive depositions.",
      summary: "Accept pre-litigation policy cap limits instantly to minimize trial risks and lawyer retainers.",
      recommendation: "Avoid public trial exposure; secure immediate settlement payout within 30–60 days.",
      timeline: "2–3 Months",
      recovery: "$242,175",
      riskLevel: "Very Low (15%)",
      confidence: 92,
      advantage: "Avoid public trial exposure; secure immediate settlement payout within 30–60 days.",
      lever: "Policy occurrence caps; early pre-litigation package release.",
      reasons: ["Avoid public trial exposure", "Fast liquidity strategy", "Minimal deposition burden", "Policy cap leverage"],
      steps: ["Complete demand package", "Release early pre-litigation package", "Leverage policy cap limits", "Close quickly"],
      risks: ["Carrier may resist speed", "Limited ceiling under policy caps", "Need rapid evidence compilation"],
      mitigations: ["Use clear policy cap rationale", "Highlight fast settlement benefit", "Keep demands narrowly focused"],
    },
    settlement: {
      key: "settlement" as const,
      title: "Intermediate Pre-Trial Remediation & Mediation",
      label: "Median Target (Recommended)",
      heroTitle: "Median Target (Recommended)",
      heroSubtitle: "This recommended route leverages strict Care Standard violations to compel the carrier to early mediation, targeting $1,775,950. Balance carrier exhaustion points with clinical healing timelines.",
      summary: "File formal complaints and leverage liability infractions to force early mandatory mediation sessions.",
      recommendation: "Provides strong mediation pressure backed by radiographic medical and wage records.",
      timeline: "6–9 Months",
      recovery: "$1,775,950",
      riskLevel: "Moderate (45%)",
      confidence: 94,
      advantage: "Provides strong mediation pressure backed by radiographic medical and wage records.",
      lever: "Deposition threats; certified rehabilitation diagnostic summaries.",
      reasons: ["Care Standard violations leveraged", "Early mediation pressure", "Strong medical and wage record support", "Balanced recovery timeline"],
      steps: ["Prepare medical and wage dossier", "File formal complaints", "Push for early mediation", "Manage carrier exhaustion"],
      risks: ["Carrier may challenge causation", "Mediation may extend timeline", "Records review delay"],
      mitigations: ["Use strong diagnostic summaries", "Highlight carrier liability infractions", "Keep mediation agenda focused"],
    },
    trial: {
      key: "trial" as const,
      title: "Max Jury Pressure & Exemplary Punitive Multipliers",
      label: "Max Litigation Strategy",
      heroTitle: "Max Litigation Strategy (Trial)",
      heroSubtitle: "A high-pressure litigation action alleging gross negligence and corporate standard omissions for Estate of Miller vs Logistics Co. Focuses on records manipulation or fatigued operators to trigger a $2,663,925 punitive-level model.",
      summary: "Take case to wrongful death or commercial jury trial, pleading gross disregard for full punitive multipliers.",
      recommendation: "Maximizes total recovery using punitive multi-district trial exposure and statutory counts.",
      timeline: "12–24 Months",
      recovery: "$2,663,925",
      riskLevel: "High (85%)",
      confidence: 89,
      advantage: "Maximizes total recovery using punitive multi-district trial exposure and statutory counts.",
      lever: "Audited electronic charting logs; operator hour-of-service fatigue limits.",
      reasons: ["Gross negligence allegation", "High punitive exposure", "Strong trial posture", "Multi-district leverage"],
      steps: ["Prepare trial exhibits", "Audit operator logs", "Build punitive narrative", "Push toward jury exposure"],
      risks: ["High litigation cost", "Extended case duration", "Carrier trial readiness"],
      mitigations: ["Use documentary evidence", "Highlight regulatory breaches", "Focus on jury-impact themes"],
    },
  };
  const roadmapStepsByStrategy = {
    negotiation: [
      {
        number: 1,
        title: "Generate Demand Package",
        description: "Compile verified damages, negligence findings, supporting evidence, and generate the demand package.",
        status: "Ready",
        duration: "20–30 min",
        owner: "Attorney + AI",
        action: "Generate Demand",
      },
      {
        number: 2,
        title: "Issue Policy-Limit Demand",
        description: "Deliver the demand package to the defendant's insurance carrier and begin negotiations.",
        status: "In Progress",
        duration: "1–2 days",
        owner: "Attorney",
        action: "Send Demand",
      },
      {
        number: 3,
        title: "Review Carrier Response",
        description: "Compare the insurer's offer against the AI Settlement Corridor and historical precedent.",
        status: "Waiting",
        duration: "3–7 days",
        owner: "Attorney + AI",
        action: "Review Response",
      },
      {
        number: 4,
        title: "Escalate Strategy",
        description: "If negotiations fail, prepare mediation or transition into litigation based on the selected strategy.",
        status: "Blocked",
        duration: "1–2 weeks",
        owner: "Attorney",
        action: "Prepare Litigation",
      },
    ],
    settlement: [
      {
        number: 1,
        title: "Generate Demand Package",
        description: "Compile verified damages, negligence findings, supporting evidence, and generate the demand package.",
        status: "Completed",
        duration: "20–30 min",
        owner: "Attorney + AI",
        action: "Generate Demand",
      },
      {
        number: 2,
        title: "Issue Policy-Limit Demand",
        description: "Deliver the demand package to the defendant's insurance carrier and begin negotiations.",
        status: "In Progress",
        duration: "1–2 days",
        owner: "Attorney",
        action: "Send Demand",
      },
      {
        number: 3,
        title: "Review Carrier Response",
        description: "Compare the insurer's offer against the AI Settlement Corridor and historical precedent.",
        status: "Waiting",
        duration: "3–7 days",
        owner: "Attorney + AI",
        action: "Review Response",
      },
      {
        number: 4,
        title: "Prepare Mediation Agenda",
        description: "Prepare the mediation strategy and negotiate toward the recommended settlement target.",
        status: "Ready",
        duration: "3–5 days",
        owner: "Attorney",
        action: "Prepare Mediation",
      },
    ],
    trial: [
      {
        number: 1,
        title: "Generate Demand Package",
        description: "Compile verified damages, negligence findings, supporting evidence, and generate the demand package.",
        status: "Completed",
        duration: "20–30 min",
        owner: "Attorney + AI",
        action: "Generate Demand",
      },
      {
        number: 2,
        title: "Issue Policy-Limit Demand",
        description: "Deliver the demand package to the defendant's insurance carrier and begin negotiations.",
        status: "Completed",
        duration: "1–2 days",
        owner: "Attorney",
        action: "Send Demand",
      },
      {
        number: 3,
        title: "Review Carrier Response",
        description: "Compare the insurer's offer against the AI Settlement Corridor and historical precedent.",
        status: "In Progress",
        duration: "3–7 days",
        owner: "Attorney + AI",
        action: "Review Response",
      },
      {
        number: 4,
        title: "Escalate Strategy",
        description: "If negotiations fail, prepare mediation or transition into litigation based on the selected strategy.",
        status: "Waiting",
        duration: "1–2 weeks",
        owner: "Attorney",
        action: "Prepare Litigation",
      },
    ],
  } as const;
  const activeStrategy = strategyProfiles[selectedStrategy];
  const roadmapSteps = roadmapStepsByStrategy[selectedStrategy];
  const strategyOptionMap = { Negotiation: "negotiation" as const, Settlement: "settlement" as const, Trial: "trial" as const };
  const startCorridor = () => { setCorridorStep(0); setShowGraph(false); setCorridorPhase("analyzing"); };

  // Advance one processing step every ~420ms; hand off to "done" at the end.
  useEffect(() => {
    if (corridorPhase !== "analyzing") return;
    if (corridorStep >= CORRIDOR_STEPS.length) {
      const t = setTimeout(() => setCorridorPhase("done"), 550);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCorridorStep((s) => s + 1), 420);
    return () => clearTimeout(t);
  }, [corridorPhase, corridorStep]);

  // Graph helpers — nodes appear progressively while analyzing; all lit when done.
  const visibleNodes = corridorPhase === "done" ? GRAPH_NODES.length : corridorPhase === "analyzing" ? Math.min(GRAPH_NODES.length, corridorStep) : GRAPH_NODES.length;
  const matchPct = corridorPhase === "done" ? CORRIDOR_RESULT.confidence : Math.round((Math.min(corridorStep, CORRIDOR_STEPS.length) / CORRIDOR_STEPS.length) * CORRIDOR_RESULT.confidence);

  if (showStrategyDashboard) {
    return (
      <div className="space-y-8">
        <div className="lg-card p-5">
          <div className="relative flex items-center justify-between gap-3">
            <button type="button" onClick={closeStrategyDashboard} className="inline-flex items-center gap-2 text-sm font-medium text-deep hover:text-ink transition-colors">
              <ChevronLeft className="w-4 h-4" strokeWidth={1.75} /> Back to Intelligence
            </button>
            <div className="absolute inset-x-0 text-center section-header pointer-events-none">Intelligence Strategy Dashboard</div>
            <div className="secondary-text">Intelligence <span className="mx-1">›</span> Strategy Dashboard</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="rounded-xl bg-ink p-6 text-white">
            <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_0.9fr] gap-6">
              <div>
                <div className="eyebrow text-brand mb-3">Execution Strategy</div>
                <div className="page-title text-white">{activeStrategy.title}</div>
                <p className="text-soft text-sm mt-4 leading-relaxed max-w-2xl">{activeStrategy.heroSubtitle}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="eyebrow text-soft">Primary Advantage</div>
                    <div className="mt-3 text-sm leading-relaxed text-white">{activeStrategy.advantage}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="eyebrow text-soft">Strategic Lever</div>
                    <div className="mt-3 text-sm leading-relaxed text-white">{activeStrategy.lever}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/10 p-5">
                <div className="eyebrow text-brand mb-3">Outcome Model</div>
                <div className="card-title text-white">Recommended Outcome</div>
                <div className="kpi-value text-white mt-4">{activeStrategy.recovery}</div>
                <div className="text-sm text-soft mt-3">{activeStrategy.recommendation}</div>
                <button
                  type="button"
                  onClick={() => onGenerateDemand?.(strategyStageLabel[selectedStrategy], Number(activeStrategy.recovery.replace(/[^0-9.]/g, "")))}
                  className="btn btn-primary w-full mt-6 justify-center gap-2"
                >
                  Generate Demand <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {Object.values(strategyProfiles).map((strategy) => {
              const selected = strategy.key === selectedStrategy;
              return (
                <button
                  key={strategy.key}
                  type="button"
                  onClick={() => setSelectedStrategy(strategy.key)}
                  className={`rounded-xl border p-5 text-left transition-all duration-200 ${selected ? "border-brand bg-tint shadow-sm" : "border-line bg-white hover:bg-wash"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="card-title">{strategy.label}</div>
                      <div className="kpi-value mt-3">{strategy.recovery}</div>
                    </div>
                    {strategy.key === "settlement" && (
                      <span className="pill pill-complete shrink-0"><CheckCircle className="w-3 h-3" strokeWidth={1.75} /> Recommended</span>
                    )}
                  </div>
                  <p className="secondary-text mt-4">{strategy.summary}</p>
                  <div className="grid grid-cols-2 gap-3 mt-5 text-sm text-ink">
                    <div className="rounded-xl border border-line bg-offwhite p-3">
                      <div className="eyebrow">Timeline</div>
                      <div className="mt-2 font-semibold">{strategy.timeline}</div>
                    </div>
                    <div className="rounded-xl border border-line bg-offwhite p-3">
                      <div className="eyebrow">Risk Level</div>
                      <div className="mt-2 font-semibold">{strategy.riskLevel}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg-card bg-offwhite p-6">
            <div className="eyebrow text-deep mb-2">Execution Roadmap</div>
            <p className="secondary-text max-w-2xl">A step-by-step execution plan for the selected litigation strategy.</p>
            <div className="space-y-4 mt-6">
              {roadmapSteps.map((step) => (
                <div key={step.number} className="rounded-xl border border-line bg-white p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="card-title">{step.title}</div>
                    <span className={`pill shrink-0 ${step.status === "Completed" ? "pill-complete" : step.status === "In Progress" ? "pill-progress" : step.status === "Blocked" ? "pill-risk" : "pill-neutral"}`}>{step.status}</span>
                  </div>
                  <p className="secondary-text mt-3">{step.description}</p>
                  <div className="grid grid-cols-3 gap-3 mt-4 text-sm text-ink">
                    <div className="rounded-xl border border-line bg-offwhite p-3">
                      <div className="eyebrow">Estimated Duration</div>
                      <div className="mt-2 font-semibold">{step.duration}</div>
                    </div>
                    <div className="rounded-xl border border-line bg-offwhite p-3">
                      <div className="eyebrow">Owner</div>
                      <div className="mt-2 font-semibold">{step.owner}</div>
                    </div>
                    <div className="rounded-xl border border-line bg-offwhite p-3">
                      <div className="eyebrow">Next Action</div>
                      <div className="mt-2 font-semibold">{step.action}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg-card p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="eyebrow text-deep mb-3">Potential Risks</div>
              <ul className="space-y-2">
                {activeStrategy.risks.map((risk) => (
                  <li key={risk} className="flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-deep mt-0.5 shrink-0" strokeWidth={1.75} />
                    <span className="body-text leading-snug">{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="eyebrow text-deep mb-3">Mitigation</div>
              <ul className="space-y-2">
                {activeStrategy.mitigations.map((mitigation) => (
                  <li key={mitigation} className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-deep mt-0.5 shrink-0" strokeWidth={1.75} />
                    <span className="body-text leading-snug">{mitigation}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-10">
      {/* ── 1 · Litigation Strategy Dashboard (case overview) ── */}
      <div className="lg-card p-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="section-header">Case Intelligence</h2>
        </div>
        <span className="pill pill-complete shrink-0">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inline-flex w-full h-full rounded-full bg-green-500 opacity-75 animate-ping" />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-green-500" />
          </span>
          AI Active
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboard.map((c) => (
          <div key={c.label} className="lg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-lg bg-tint flex items-center justify-center shrink-0">
                <c.icon className="w-4 h-4 text-deep" strokeWidth={1.75} />
              </div>
              <span className="eyebrow">{c.label}</span>
            </div>
            <div className="kpi-value">{c.value}</div>
            {typeof c.bar === "number" && (
              <div className="mt-2.5 h-1.5 rounded-full bg-track overflow-hidden">
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, c.bar)}%` }} />
              </div>
            )}
            <p className="secondary-text mt-2">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="lg-card p-6 relative overflow-hidden order-1">
        <div className="absolute left-0 top-4 bottom-4 w-1 rounded-full bg-brand" />
        <div className="pl-5">
          <div className="eyebrow text-brand mb-2">STRATEGIC LITIGATION VALUATION BRIEF</div>
          <p className="body-text leading-relaxed">
            This matter anchors <strong className="font-semibold text-ink">high recovery potential</strong> in Cook County because the timeline of negligence is linear and well-documented. For <strong className="font-semibold text-ink">Estate of Miller</strong>, the defensive narrative of pre-existing comorbidities is medically undermined by direct clinical omissions. Symmetrical neglect of rotational safety or sudden motor safety duties triggers <strong className="font-semibold text-ink">high jury outrage factors</strong> in local jurisdictions.
          </p>
        </div>
      </div>

      {/* ── 2 · Strategic Settlement Corridor — interactive AI workflow (idle → analyzing → done) ── */}
      <div className="bg-ink rounded-xl overflow-hidden order-3">
        <div className="grid grid-cols-1 lg:grid-cols-5 items-stretch">

          {/* LEFT panel — idle copy / processing steps / insights found */}
          <div className="lg:col-span-2 p-6 lg:border-r border-white/10">
            {corridorPhase === "idle" && (
              <>
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-4 h-4 text-brand" strokeWidth={1.75} />
                  <span className="eyebrow text-brand">AI Recommended Strategy</span>
                </div>
                <h2 className="section-header text-white mb-2">Strategic Settlement Corridor</h2>
                <p className="text-soft text-sm leading-relaxed">
                  Run LECO's corridor simulation. The AI reasons across the verified evidence, negligence findings, coverage, and matched precedent to generate the recommended settlement strategy.
                </p>
                <button onClick={startCorridor} className="btn btn-primary gap-2 mt-6">
                  <SlidersHorizontal className="w-4 h-4" strokeWidth={1.75} /> Execute Corridor Simulation
                </button>
              </>
            )}

            {corridorPhase === "analyzing" && (
              <>
                <div className="flex items-center gap-1.5 mb-4">
                  <Loader2 className="w-4 h-4 text-brand animate-spin" strokeWidth={1.75} />
                  <span className="eyebrow text-brand">AI Analyzing Case</span>
                </div>
                <div className="space-y-2.5">
                  {CORRIDOR_STEPS.map((s, i) => {
                    const done = i < corridorStep;
                    const active = i === corridorStep;
                    return (
                      <div key={s} className={`flex items-center gap-2.5 text-sm transition-opacity duration-300 ${done || active ? "opacity-100" : "opacity-30"}`}>
                        {done ? (
                          <CheckCircle className="w-4 h-4 text-brand shrink-0" strokeWidth={1.75} />
                        ) : active ? (
                          <Loader2 className="w-4 h-4 text-brand shrink-0 animate-spin" strokeWidth={1.75} />
                        ) : (
                          <Circle className="w-4 h-4 text-white/30 shrink-0" strokeWidth={1.75} />
                        )}
                        <span className={done ? "text-soft" : "text-white"}>{s}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {corridorPhase === "done" && (
              <>
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckCircle className="w-4 h-4 text-brand" strokeWidth={1.75} />
                  <span className="eyebrow text-brand">Analysis Complete</span>
                </div>
                <h2 className="section-header text-white mb-3">Insights Found</h2>
                <ul className="space-y-2.5">
                  <li className="flex items-start gap-2.5 text-sm text-soft"><CheckCircle className="w-4 h-4 text-brand mt-0.5 shrink-0" strokeWidth={1.75} /><span><span className="text-white font-semibold tabular-nums">{CORRIDOR_RESULT.matchedCases}</span> historical cases matched.</span></li>
                  <li className="flex items-start gap-2.5 text-sm text-soft"><CheckCircle className="w-4 h-4 text-brand mt-0.5 shrink-0" strokeWidth={1.75} /><span><span className="text-white font-semibold tabular-nums">{CORRIDOR_RESULT.confidence}%</span> similarity with comparable verdicts.</span></li>
                  <li className="flex items-start gap-2.5 text-sm text-soft"><CheckCircle className="w-4 h-4 text-brand mt-0.5 shrink-0" strokeWidth={1.75} /><span>Recommended recovery corridor generated.</span></li>
                </ul>
                <div className="flex items-center gap-2 mt-6 flex-wrap">
                  <button onClick={() => openStrategyDashboard("settlement")} className="btn btn-primary gap-2">
                    Open Strategy Dashboard <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* RIGHT panel — idle graph / animated reasoning graph / corridor result */}
          <div className="lg:col-span-3 relative border-t lg:border-t-0 border-white/10 bg-white/[0.03] p-6 min-h-[320px]">

            {/* Match badge — climbs while analyzing */}
            {corridorPhase !== "idle" && !(corridorPhase === "done" && !showGraph) && (
              <div className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-semibold text-white tabular-nums">
                <Sparkles className="w-3 h-3 text-brand" strokeWidth={1.75} /> Match {matchPct}%
              </div>
            )}

            {(corridorPhase === "idle" || corridorPhase === "analyzing" || (corridorPhase === "done" && showGraph)) && (
              <div className="absolute inset-0">
                {/* Edges */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {GRAPH_EDGES.map(([a, b]) => {
                    const na = GRAPH_NODES[a], nb = GRAPH_NODES[b];
                    const on = corridorPhase !== "analyzing" || (a < visibleNodes && b < visibleNodes);
                    return (
                      <line key={`${a}-${b}`} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
                        stroke="#3FB5D7" strokeWidth={corridorPhase === "idle" ? 0.15 : 0.25}
                        className={`transition-opacity duration-500 ${corridorPhase === "analyzing" ? "animate-pulse" : ""}`}
                        opacity={corridorPhase === "idle" ? 0.15 : on ? 0.45 : 0} vectorEffect="non-scaling-stroke" strokeDasharray={corridorPhase === "analyzing" ? "3 3" : undefined}
                      />
                    );
                  })}
                </svg>

                {/* Floating data particles while analyzing */}
                {corridorPhase === "analyzing" && [
                  { x: 30, y: 24, d: "0s" }, { x: 68, y: 40, d: "0.4s" }, { x: 40, y: 66, d: "0.8s" },
                  { x: 74, y: 74, d: "1.2s" }, { x: 22, y: 52, d: "1.6s" }, { x: 58, y: 20, d: "0.6s" },
                ].map((p, i) => (
                  <span key={i} className="absolute w-1.5 h-1.5 rounded-full bg-brand animate-ping" style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: p.d }} />
                ))}

                {/* Nodes */}
                {GRAPH_NODES.map((n, i) => {
                  const lit = corridorPhase === "idle" ? false : i < visibleNodes;
                  return (
                    <div key={n.label} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 transition-opacity duration-500" style={{ left: `${n.x}%`, top: `${n.y}%`, opacity: corridorPhase === "idle" ? 0.35 : lit ? 1 : 0.15 }}>
                      <span className={`relative flex w-3 h-3 ${lit && corridorPhase === "analyzing" ? "" : ""}`}>
                        {lit && corridorPhase === "analyzing" && <span className="absolute inline-flex w-full h-full rounded-full bg-brand opacity-60 animate-ping" />}
                        <span className={`relative inline-flex w-3 h-3 rounded-full ${lit ? "bg-brand" : "bg-white/30"}`} />
                      </span>
                      <span className={`text-[10px] font-medium whitespace-nowrap ${lit ? "text-white" : "text-white/40"}`}>{n.label}</span>
                    </div>
                  );
                })}

                {corridorPhase === "idle" && (
                  <div className="absolute inset-x-0 bottom-4 text-center text-xs text-white/40">Legal context graph · idle — run the simulation to begin</div>
                )}
              </div>
            )}

            {/* Done — Strategy Options (recommended in the middle) */}
            {corridorPhase === "done" && !showGraph && (
              <div className="h-full flex flex-col justify-center">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="eyebrow text-soft">Strategy Options</div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-semibold text-white tabular-nums">
                    <ShieldCheck className="w-3 h-3 text-brand" strokeWidth={1.75} /> {CORRIDOR_RESULT.confidence}% Confidence
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {strategyOptions.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => openStrategyDashboard(strategyOptionMap[o.key as keyof typeof strategyOptionMap])}
                      className={`rounded-xl p-4 flex flex-col text-left ${o.recommended ? "bg-brand/10 border-2 border-brand" : "bg-white/5 border border-white/10"}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${o.recommended ? "bg-brand" : "bg-white/10"}`}>
                          <o.icon className="w-4 h-4 text-white" strokeWidth={1.75} />
                        </div>
                        {o.recommended && <span className="inline-flex items-center gap-1 rounded-full bg-brand/20 border border-brand/40 px-2 py-0.5 text-[10px] font-semibold text-brand uppercase tracking-wide"><CheckCircle className="w-3 h-3" strokeWidth={1.75} /> Recommended</span>}
                      </div>
                      <div className="text-white font-semibold">{o.label}</div>
                      <div className="text-lg font-bold text-white tabular-nums mt-0.5">{o.value}</div>
                      <p className="text-soft text-xs leading-relaxed mt-1.5 flex-1">{o.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 3 · Precedent Analysis — historical cases used ── */}
      <div className="lg-card p-6 order-1">
        <div className="mb-5">
          <h2 className="section-header">Similar Past Cases</h2>
          <p className="secondary-text mt-1 max-w-2xl">AI found historical cases most similar to the current matter to support the recommended litigation strategy.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} />
            <input
              value={caseSearch}
              onChange={(e) => setCaseSearch(e.target.value)}
              placeholder="Search past cases"
              className="w-full bg-white border border-line rounded-lg pl-10 pr-4 py-2.5 text-sm text-ink placeholder:text-[#5B6B78] focus:outline-none focus:border-brand transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={() => setCaseFiltersOpen((open) => !open)}
            className={`inline-flex items-center justify-center gap-2 bg-white border border-line rounded-lg px-3 py-2.5 text-sm transition-colors ${caseFiltersOpen || hasCaseDiscovery && activeCaseFilters.length > 0 ? "text-deep border-brand" : "text-ink hover:text-deep hover:border-brand"}`}
          >
            <SlidersHorizontal className="w-4 h-4" strokeWidth={1.75} />
            Filters
          </button>
        </div>

        {caseFiltersOpen && (
          <div className="mb-5 rounded-lg border border-line bg-white p-4">
            <div className="eyebrow mb-3">Filter Cases</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              <label className="flex items-center gap-3 text-sm">
                <span className="text-[#5B6B78] min-w-28">Injury Type</span>
                <input
                  value={draftCaseFilters.injuryType}
                  onChange={(e) => setDraftCaseFilters((current) => ({ ...current, injuryType: e.target.value }))}
                  placeholder="All injury types"
                  className="min-w-0 flex-1 bg-white border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-[#5B6B78] focus:outline-none focus:border-brand transition-colors"
                />
              </label>

              <label className="flex items-center gap-3 text-sm">
                <span className="text-[#5B6B78] min-w-28">Severity</span>
                <select
                  value={draftCaseFilters.severity}
                  onChange={(e) => setDraftCaseFilters((current) => ({ ...current, severity: e.target.value }))}
                  className="min-w-0 flex-1 bg-white border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand transition-colors"
                >
                  <option value="">All severity levels</option>
                  {['Mild', 'Moderate', 'Severe', 'Critical'].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>

              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-3">
                  <span className="text-[#5B6B78] min-w-28">Jurisdiction</span>
                  <select
                    value={draftJurisdictionState}
                    onChange={(e) => {
                      setDraftJurisdictionState(e.target.value);
                      setDraftCaseFilters((current) => ({ ...current, jurisdiction: "" }));
                    }}
                    className="min-w-0 flex-1 bg-white border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand transition-colors"
                  >
                    <option value="">Select state</option>
                    {jurisdictionStates.map((state) => <option key={state} value={state}>{state}</option>)}
                  </select>
                </label>
                {draftJurisdictionState && (
                  <label className="flex items-center gap-3 pl-[7.5rem]">
                    <span className="sr-only">District / County</span>
                    <select
                      value={draftCaseFilters.jurisdiction}
                      onChange={(e) => setDraftCaseFilters((current) => ({ ...current, jurisdiction: e.target.value }))}
                      className="min-w-0 flex-1 bg-white border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand transition-colors"
                    >
                      <option value="">Select district / county</option>
                      {jurisdictionCounties.map((county) => <option key={county} value={county}>{county}</option>)}
                    </select>
                  </label>
                )}
              </div>

              <label className="flex items-center gap-3 text-sm">
                <span className="text-[#5B6B78] min-w-28">Violation</span>
                <input
                  value={draftCaseFilters.violation}
                  onChange={(e) => setDraftCaseFilters((current) => ({ ...current, violation: e.target.value }))}
                  placeholder="All violations"
                  className="min-w-0 flex-1 bg-white border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-[#5B6B78] focus:outline-none focus:border-brand transition-colors"
                />
              </label>

              <label className="flex items-center gap-3 text-sm">
                <span className="text-[#5B6B78] min-w-28">Legal Statute</span>
                <input
                  value={draftCaseFilters.legalStatute}
                  onChange={(e) => setDraftCaseFilters((current) => ({ ...current, legalStatute: e.target.value }))}
                  placeholder="All statutes"
                  className="min-w-0 flex-1 bg-white border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-[#5B6B78] focus:outline-none focus:border-brand transition-colors"
                />
              </label>

              <label className="flex items-center gap-3 text-sm">
                <span className="text-[#5B6B78] min-w-28">Case Type</span>
                <select
                  value={draftCaseFilters.caseType}
                  onChange={(e) => setDraftCaseFilters((current) => ({ ...current, caseType: e.target.value }))}
                  className="min-w-0 flex-1 bg-white border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand transition-colors"
                >
                  <option value="">All case types</option>
                  {['Personal Injury', 'Medical Malpractice', 'Motor Vehicle', 'Commercial Vehicle', 'Wrongful Death'].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-line">
              <button
                type="button"
                onClick={clearCaseFilters}
                className="text-sm text-deep hover:text-ink transition-colors"
              >
                Clear filters
              </button>
              <button
                type="button"
                onClick={() => { setCaseFilters(draftCaseFilters); setJurisdictionState(draftJurisdictionState); setCaseFiltersOpen(false); }}
                className="text-sm font-semibold text-deep hover:text-ink transition-colors"
              >
                Apply filters
              </button>
            </div>
          </div>
        )}

        {(activeCaseFilters.length > 0 || jurisdictionState) && (
          <div className="mb-5">
            <div className="eyebrow mb-2">Active Filters</div>
            <div className="flex flex-wrap gap-2">
              {jurisdictionState && (
                <button
                  type="button"
                  onClick={() => {
                    setJurisdictionState("");
                    setDraftJurisdictionState("");
                    setCaseFilters((current) => ({ ...current, jurisdiction: "" }));
                    setDraftCaseFilters((current) => ({ ...current, jurisdiction: "" }));
                  }}
                  className="pill pill-neutral hover:text-deep transition-colors"
                >
                  {jurisdictionState} <span aria-hidden="true">×</span>
                </button>
              )}
              {activeCaseFilters.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setCaseFilters((current) => ({ ...current, [key]: "" }));
                    setDraftCaseFilters((current) => ({ ...current, [key]: "" }));
                  }}
                  className="pill pill-neutral hover:text-deep transition-colors"
                >
                  {caseFilters[key]} <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <h3 className="card-title">{hasCaseDiscovery ? "Filtered Cases" : "Recommended Cases"}</h3>
          <p className="secondary-text mt-1 text-xs">
            {hasCaseDiscovery ? "Cases matching your selected search and filter criteria." : "AI-selected cases based on similarity to the current matter."}
          </p>
        </div>

        {visibleComparableVerdicts.length === 0 ? (
          <div className="lg-card flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-ink">No matching cases found.</p>
            <p className="secondary-text mt-1">Try a different search term or adjust your filters.</p>
            <button
              type="button"
              onClick={() => { setCaseSearch(""); clearCaseFilters(); }}
              className="mt-3 text-sm font-semibold text-deep hover:text-ink transition-colors"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleComparableVerdicts.map((v) => {
            const isWhyOpen = precedentWhyOpen === v.caseName;
            return (
              <div key={v.caseName} className="lg-card lg-card-i p-5 flex flex-col">
                <h3 className="card-title leading-snug mb-3">{v.caseName}</h3>
                <div className="text-xl font-bold text-ink tabular-nums mb-2">{formatUSD(v.amount)}</div>
                <div className="text-sm font-medium text-deep mb-3">Final Settlement</div>
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      const breakdownIsOpen = similarityBreakdownOpen === v.caseName;
                      const whyIsOpen = precedentWhyOpen === v.caseName;
                      setPrecedentWhyOpen(null);
                      setSimilarityBreakdownOpen(breakdownIsOpen && !whyIsOpen ? null : v.caseName);
                    }}
                    className="pill pill-complete cursor-pointer hover:text-deep hover:underline transition-colors"
                    aria-expanded={similarityBreakdownOpen === v.caseName}
                  >
                    {v.matchScore}% Match
                  </button>
                  {v.labels.map((l) => (
                    <span key={l} className="pill pill-neutral">{l}</span>
                  ))}
                </div>

                <div className="rounded-xl border border-line overflow-hidden bg-offwhite/70">
                  <button
                    onClick={() => {
                      const shouldOpen = precedentWhyOpen !== v.caseName;
                      setPrecedentWhyOpen(shouldOpen ? v.caseName : null);
                      setSimilarityBreakdownOpen(shouldOpen ? v.caseName : null);
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-wash transition-colors"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">Why this case matters</span>
                    <ChevronDown className={`w-4 h-4 text-deep transition-transform ${isWhyOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
                  </button>
                  {isWhyOpen && (
                    <div className="px-3.5 pb-3.5 pt-2 border-t border-line bg-white/80">
                      <p className="secondary-text leading-relaxed">{v.whyThisMatters}</p>
                    </div>
                  )}
                </div>

                {similarityBreakdownOpen === v.caseName && (
                  <div className="mt-3 rounded-xl border border-line bg-white/80 px-3.5 pb-3.5 pt-3">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className="eyebrow">Similarity Breakdown</span>
                      <span className="text-xs font-bold text-deep tabular-nums">{v.matchScore}% Match</span>
                    </div>
                    <div className="space-y-2.5">
                      {v.similarityBreakdown.map((factor) => (
                        <div key={factor.label}>
                              <div className="text-xs text-[#5B6B78] mb-1">{factor.label}</div>
                          <div className="h-1.5 rounded-full bg-wash overflow-hidden">
                                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, factor.contribution * 3.5)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-line">
                      <div className="eyebrow mb-2">Why this case matches</div>
                      <ul className="space-y-1">
                        {v.similarityBreakdown.map((factor) => (
                          <li key={factor.label} className="text-xs text-[#5B6B78] flex items-start gap-2">
                            <CheckCircle className="w-3.5 h-3.5 text-deep shrink-0 mt-0.5" strokeWidth={1.75} />
                            <span>{factor.explanation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-ink">
                      <span>Overall Match</span>
                      <span className="text-deep tabular-nums">{v.similarityBreakdown.reduce((total, factor) => total + factor.contribution, 0)}%</span>
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <div className="eyebrow mb-2">Key Matching Factors</div>
                  <div className="flex flex-wrap gap-1.5">
                    {v.tags.slice(0, 4).map((t) => (
                      <span key={t} className="pill pill-neutral">{t}</span>
                    ))}
                  </div>
                </div>

                <div className="mt-auto pt-4 flex justify-end">
                  <button onClick={() => { setSelectedPrecedent(v); setPrecedentChatOpen(false); }} className="inline-flex items-center gap-1.5 text-sm font-medium text-deep hover:text-ink transition-colors">
                    <Eye className="w-4 h-4" strokeWidth={1.75} /> View Details
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {selectedPrecedent && (
        <>
          <div className="fixed inset-0 bg-ink/40 z-50" onClick={() => setSelectedPrecedent(null)} />
          <div className="fixed top-0 right-0 h-full w-[460px] max-w-[92vw] bg-white shadow-xl z-50 flex flex-col">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line">
              <div className="min-w-0">
                <div className="eyebrow mb-1">Precedent Case</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="card-title">{selectedPrecedent.caseName}</h2>
                  <span className="pill pill-complete">{selectedPrecedent.matchScore}% Match</span>
                </div>
              </div>
              <button onClick={() => setSelectedPrecedent(null)} className="p-1.5 hover:bg-tint rounded-lg transition-colors shrink-0"><X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} /></button>
            </div>

            {precedentChatOpen ? (
              <PrecedentChatPanel caseName={selectedPrecedent.caseName} onBack={() => setPrecedentChatOpen(false)} />
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  <div className="text-xs text-[#5B6B78] flex items-center gap-2.5 flex-wrap">
                    <span>{selectedPrecedent.matchScore}% Match <span className="font-semibold text-ink">•</span> Commercial Vehicle <span className="font-semibold text-ink">•</span> Cervical Injury</span>
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-offwhite p-3.5">
                    <div>
                      <div className="eyebrow mb-0.5">Settlement Outcome</div>
                      <div className="text-xl font-bold text-ink tabular-nums">{formatUSD(selectedPrecedent.amount)}</div>
                      <div className="text-xs text-[#8A98A3] mt-0.5">Resolved through Pre-Trial Settlement</div>
                    </div>
                  </div>

                  <div>
                    <div className="eyebrow mb-1.5">Similarity Drivers</div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="pill pill-neutral">Commercial Vehicle</span>
                      <span className="pill pill-neutral">Commercial Carrier</span>
                      <span className="pill pill-neutral">Cervical Injury</span>
                      <span className="pill pill-neutral">Long-Term Treatment</span>
                      <span className="pill pill-neutral">Cook County</span>
                      <span className="pill pill-neutral">Strong Liability</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-line overflow-hidden">
                    <div className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-ink border-b border-line bg-tint">
                      <Sparkles className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> AI Summary
                    </div>
                    <div className="px-3.5 py-3 bg-tint">
                      <div className="eyebrow mb-1.5">Why {selectedPrecedent.matchScore}% Match</div>
                      <p className="secondary-text leading-relaxed">
                        LECO identified this precedent because it closely aligns with Estate of Miller across multiple legal and factual dimensions. Both matters involve catastrophic injuries, clearly documented negligence, strong liability evidence, and long-term medical impact. The comparable jurisdiction and settlement outcome make this case a reliable benchmark for estimating recovery potential and supporting the recommended settlement corridor.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-line overflow-hidden">
                    <div className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-ink border-b border-line bg-offwhite">
                      <Sparkles className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> AI Suggestions
                    </div>
                    <div className="px-3.5 py-3 bg-offwhite space-y-2.5">
                      <div className="rounded-lg bg-white border border-line p-2.5">
                        <div className="eyebrow mb-1">Recommended Use</div>
                        <ul className="space-y-1.5 text-sm text-ink">
                          <li>• Support the initial settlement demand with a comparable recovery outcome.</li>
                          <li>• Reference this case when explaining long-term injury valuation.</li>
                          <li>• Strengthen liability discussions using similar negligence findings.</li>
                          <li>• Cite this precedent during negotiation to reinforce the recommended settlement corridor.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-line p-4">
                  <button onClick={() => setPrecedentChatOpen(true)} className="btn btn-primary w-full justify-center gap-2">
                    <Bot className="w-4 h-4" strokeWidth={1.75} /> Chat with AI
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── 4 · Supporting Findings — strategic insights derived from negligence & violations ── */}
      <div className="lg-card p-6 order-4">
        <div className="mb-5">
          <h2 className="section-header">Supporting Findings</h2>
          <p className="secondary-text mt-1 max-w-2xl">Insights Derived from Negligence &amp; Violations</p>
          <p className="secondary-text mt-1 max-w-2xl">These case findings increase settlement leverage and strengthen the recommended litigation strategy.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {supportingFindings.map((finding) => {
            const isOpen = supportingFindingsOpen[finding.title] ?? false;
            return (
              <div key={finding.title} className="lg-card p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <div className="w-8 h-8 rounded-lg bg-tint flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4 text-deep" strokeWidth={1.75} />
                    </div>
                    <h3 className="card-title">{finding.title}</h3>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-deep tabular-nums">{finding.confidence}%</div>
                    <div className="eyebrow">Confidence</div>
                  </div>
                </div>

                <div className="rounded-xl border border-line overflow-hidden bg-offwhite/70">
                  <button
                    onClick={() => setSupportingFindingsOpen((prev) => ({ ...prev, [finding.title]: !isOpen }))}
                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-wash transition-colors"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                      <Sparkles className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> AI Summary
                    </span>
                    <ChevronDown className={`w-4 h-4 text-deep transition-transform ${isOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
                  </button>
                  {isOpen && (
                    <div className="px-3.5 pb-3.5 pt-2 border-t border-line bg-white/80">
                      <p className="secondary-text leading-relaxed">{finding.summary}</p>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <div className="eyebrow mb-2">Key Takeaways</div>
                  <ul className="space-y-2">
                    {finding.takeaways.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <CheckCircle className="w-4 h-4 text-deep mt-0.5 shrink-0" strokeWidth={1.75} />
                        <span className="body-text leading-snug">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 6 · Litigation & Trial Preparation Directives — the action plan ── */}
      <div className="lg-card p-6 order-5">
        <div className="mb-5">
          <div className="eyebrow text-deep mb-1">Action Plan</div>
          <h2 className="section-header">Litigation &amp; Trial Preparation Directives</h2>
          <p className="secondary-text mt-1 max-w-2xl">These actions are generated from the recommended strategy and the weaknesses identified in the analysis above.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TRIAL_DIRECTIVES.map((d) => (
            <div key={d.title} className="lg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-tint flex items-center justify-center shrink-0">
                  <d.icon className="w-4 h-4 text-deep" strokeWidth={1.75} />
                </div>
                <h3 className="card-title">{d.title}</h3>
              </div>
              <ul className="space-y-2.5">
                {d.items.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle className="w-4 h-4 text-deep mt-0.5 shrink-0" strokeWidth={1.75} />
                    <span className="body-text leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* ── 7 · Generate Demand CTA ── */}
      <div className="bg-ink rounded-xl px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 order-6">
        <div className="min-w-0">
          <h2 className="section-header text-white">Ready to assemble the demand</h2>
          <p className="text-soft text-sm mt-1 max-w-xl">Compile the recommended strategy, precedent, and findings into an attorney-ready demand package.</p>
        </div>
        <button
          onClick={() => onGenerateDemand?.(strategyStageLabel[selectedStrategy], Number(activeStrategy.recovery.replace(/[^0-9.]/g, "")))}
          className="btn btn-primary gap-2 shrink-0"
        >
          <FileSignature className="w-4 h-4" strokeWidth={1.75} /> Generate Demand
        </button>
      </div>
    </div>
  );
}

// ── Tab 8 — Negotiation ───────────────────────────────────────────────────────

const STRATEGY_POINTS = [
  "Open with the full demand to anchor the negotiation above the projected settlement range.",
  "Lead with objective liability evidence — officer fault determination and red-light violation — to limit comparative-fault arguments.",
  "Hold firm on documented economic damages; treat the non-economic multiplier as the primary negotiable lever.",
  "Reference confirmed policy limits to keep the conversation anchored to an adequate source of recovery.",
];

const COUNTER_OFFERS = [
  { round: "Initial Demand", party: "Plaintiff", amount: 1850000, date: "Jun 12, 2026", status: "Sent" },
  { round: "Carrier Response", party: "Defendant", amount: 720000, date: "Jun 18, 2026", status: "Received" },
  { round: "Counter", party: "Plaintiff", amount: 1650000, date: "Jun 22, 2026", status: "Sent" },
];

const SETTLEMENT_HISTORY = [
  { date: "Jun 12, 2026", event: "Demand package delivered to carrier." },
  { date: "Jun 18, 2026", event: "Carrier responded below the projected range." },
  { date: "Jun 22, 2026", event: "Plaintiff counter issued near recommended value." },
];

export function NegotiationTab({ model }: TabProps) {
  const [notes, setNotes] = useState("");
  return (
    <div className="max-w-4xl space-y-8">
      <Section title="Negotiation" description="Settlement preparation — strategy, offers, and history in one place.">
        {/* Settlement Recommendation */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="lg-card p-5">
            <div className="eyebrow mb-1">Recommended Settlement</div>
            <div className="text-2xl font-bold text-ink tabular-nums">{formatUSD(model.recommendedSettlement)}</div>
          </div>
          <div className="lg-card p-5">
            <div className="eyebrow mb-1">Settlement Range</div>
            <div className="text-2xl font-bold text-deep tabular-nums">{formatCompact(model.estimatedLow)} – {formatCompact(model.estimatedHigh)}</div>
          </div>
          <div className="lg-card p-5">
            <div className="eyebrow mb-1">Confidence</div>
            <div className="text-2xl font-bold text-deep tabular-nums">{model.confidence}%</div>
          </div>
        </div>
      </Section>

      <Section title="Negotiation Strategy">
        <div className="lg-card p-6">
          <ul className="space-y-3">
            {STRATEGY_POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <CheckCircle className="w-4 h-4 text-deep mt-0.5 shrink-0" strokeWidth={1.75} />
                <span className="body-text leading-relaxed">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="Counter Offers">
        <div className="lg-card divide-y divide-line">
          {COUNTER_OFFERS.map((o, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">{o.round}</div>
                <div className="mono-ref">{o.party} · {o.date}</div>
              </div>
              <span className={`pill ${o.party === "Plaintiff" ? "pill-neutral" : "pill-progress"} shrink-0`}>{o.status}</span>
              <div className="text-sm font-semibold text-ink tabular-nums w-28 text-right shrink-0">{formatUSD(o.amount)}</div>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Section title="Negotiation Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Capture negotiation notes, carrier positions, and next steps…"
            rows={6}
            className="w-full bg-white border border-line rounded-xl px-4 py-3 text-sm text-ink placeholder:text-[#5B6B78] focus:outline-none focus:border-brand resize-none transition-colors"
          />
        </Section>

        <Section title="Settlement History">
          <div className="relative pl-6 space-y-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-line">
            {SETTLEMENT_HISTORY.map((h, i) => (
              <div key={i} className="relative">
                <span className="absolute -left-[22px] top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-brand" />
                <div className="mono-ref mb-0.5">{h.date}</div>
                <div className="body-text">{h.event}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Final Recommended Offer */}
      <div className="bg-ink rounded-xl px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <div className="eyebrow text-soft mb-1">Final Recommended Offer</div>
          <div className="secondary-text text-soft">Target settlement aligned to the recommended case value</div>
        </div>
        <div className="text-white font-bold tabular-nums shrink-0" style={{ fontSize: "30px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
          {formatUSD(model.recommendedSettlement)}
        </div>
      </div>
    </div>
  );
}

// ── Stage Evidence — which documents support which stage ──────────────────────
// The case has ONE document repository. A stage does not own copies of files;
// it points at the documents its own content already cites, plus anything in
// the repository matching that stage's subject matter. The same MRI can back
// Chronology, Damages, and Intelligence while remaining a single document.

// `evidence` is the long-standing id of the Case Journey stage; the Evidence
// stage added after Violations uses `evidencehub` so existing goTo("evidence")
// callers keep working.
export type StageId =
  | "overview" | "medical" | "economic" | "noneconomic"
  | "liability" | "evidencehub" | "evidence" | "demand" | "negotiation";

// Human label per stage — matches the workspace tab labels.
export const STAGE_LABELS: Record<StageId, string> = {
  overview: "Case Overview",
  medical: "Chronology",
  economic: "Damages Analysis",
  noneconomic: "Negligence",
  liability: "Violations",
  evidencehub: "Evidence",
  evidence: "Case Journey",
  demand: "Intelligence",
  negotiation: "Negotiations",
};

// Repository documents a stage should surface, by subject matter. Applied to the
// uploaded case file so newly added documents reach the right stages on their own.
const STAGE_REPO_MATCH: Record<StageId, RegExp> = {
  // Core case file: primary medical, the incident record, and coverage.
  overview: /(mri|hospital_medical|police|witness|insurance|policy|retainer|intake)/,
  // Treatment and incident timeline.
  medical: /(mri|er_|hospital|medical|therapy|treatment|imaging|discharge|admission|police|dispatch|emergency|claim)/,
  // Economic and medical damages.
  economic: /(mri|er_|bill|invoice|hospital|medical|therapy|treatment|wage|payroll|income|receipt|mileage|life_care|prognosis|impairment)/,
  // Liability and breach of duty.
  noneconomic: /(police|witness|accident|incident|crash|camera|dashcam|vehicle|photo|scene|reconstruction|officer|driver|safety|ems|dispatch)/,
  // Regulatory, citation, inspection, compliance.
  liability: /(citation|violation|inspection|compliance|policy|log|fmcsa|carrier|safety|regulation|standard|permit|officer|police|scene|camera|dashcam|edr|skid|signal)/,
  // The Evidence stage reads the whole case record — it builds its own
  // catalogue from every stage, so this rule is only a fallback.
  evidencehub: /.*/,
  // Filings, claims, correspondence, case preparation.
  evidence: /(claim|insurance|policy|demand|letter|correspondence|filing|court|motion|pleading|wage|medical_records)/,
  // Everything the AI analysis reads from.
  demand: /(mri|hospital|medical|police|witness|wage|insurance|policy|therapy|bill)/,
  // Settlement value and negotiation leverage.
  negotiation: /(demand|letter|settlement|offer|correspondence|insurance|policy|bill|wage|medical|mri)/,
};

// Filenames each stage already cites in its own content. Chronology is computed
// at call time so it also picks up manually added events and their attachments.
function stageCitations(stage: StageId, userChron: ChronEvent[]): string[] {
  switch (stage) {
    case "medical":
      return [...MEDICAL_CHRONOLOGY, ...EVENT_CHRONOLOGY, ...userChron].flatMap((e) => e.evidence);
    case "economic":
      return [
        ...ECONOMIC.flatMap((e) => e.docs),
        ...DAMAGE_EVIDENCE.flatMap((d) => [d.primary, ...d.docs]),
      ];
    case "noneconomic":
      return NEGLIGENCE_PILLARS.flatMap((p) => p.docs);
    case "liability":
      return VIOLATION_CARDS.flatMap((v) => v.evidence);
    case "evidence":
      // The procedural half of the case timeline: investigation, claim, prep, negotiation.
      return EVENT_CHRONOLOGY
        .filter((e) => /Insurance Claim|Case Preparation|Settlement Negotiation|Police Investigation/.test(e.title))
        .flatMap((e) => e.evidence);
    case "negotiation":
      return EVENT_CHRONOLOGY
        .filter((e) => /Settlement Negotiation|Insurance Claim/.test(e.title))
        .flatMap((e) => e.evidence);
    default:
      return [];
  }
}

// Resolve a stage to its supporting documents. Identity is the filename, so a
// document cited by several stages stays one record throughout.
export function stageEvidence(
  stage: StageId,
  documents: CaseDocument[],
  opts: { findings?: AnalysisFinding[]; userChronology?: ChronEvent[] } = {},
): CaseDocument[] {
  const docForFile = buildDocResolver(documents);
  const names: string[] = [];

  // 1 — repository documents whose subject matter belongs to this stage
  const rule = STAGE_REPO_MATCH[stage];
  for (const d of documents) if (rule.test(d.name.toLowerCase())) names.push(d.name);

  // 2 — documents this stage's own content cites
  names.push(...stageCitations(stage, opts.userChronology ?? []));

  // 3 — Intelligence additionally reads from every analysis finding
  if (stage === "demand") {
    for (const f of opts.findings ?? []) names.push(...f.sources, ...f.evidence.map((e) => e.file));
  }

  const seen = new Set<string>();
  return names
    .filter((n) => {
      const key = n.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(docForFile);
}

// ── Context-aware AI Insights ─────────────────────────────────────────────────
// The same document means different things in different stages. Preview and
// Insights open the existing Document Workspace unchanged; only the insight
// content is re-framed for the stage the attorney opened it from.

const STAGE_INSIGHT: Record<StageId, { lens: string; points: string[] }> = {
  overview: {
    lens: "how it frames the case as a whole",
    points: [
      "Establishes a core fact the rest of the case is built on.",
      "Corroborated by the other documents in the case file.",
      "No conflict with the recorded case summary.",
    ],
  },
  medical: {
    lens: "what it establishes chronologically",
    points: [
      "Fixes the date and sequence of a documented event.",
      "Treatment findings fall inside the injury window.",
      "Supports causation by tying the injury to the incident date.",
    ],
  },
  economic: {
    lens: "what it contributes to damages",
    points: [
      "Documents injury severity and its treatment impact.",
      "Supports the functional impairment claimed in the damages model.",
      "Carries future-care implications for the projected total.",
    ],
  },
  noneconomic: {
    lens: "what it proves about liability",
    points: [
      "Speaks directly to breach of the duty owed.",
      "Records facts establishing negligence.",
      "No contradiction or gap identified against the other evidence.",
    ],
  },
  liability: {
    lens: "which regulatory duty it engages",
    points: [
      "Ties the conduct to a specific statutory or regulatory standard.",
      "Supports the cited violation with a contemporaneous record.",
      "Usable as an exhibit for the compliance argument.",
    ],
  },
  evidencehub: {
    lens: "what it establishes as evidence",
    points: [
      "Classified and cross-referenced against the rest of the case record.",
      "Linked to the stages that rely on it.",
      "Reviewed for corroboration, contradictions and gaps.",
    ],
  },
  evidence: {
    lens: "where it sits in the procedural history",
    points: [
      "Marks a step in the claim's procedural sequence.",
      "Dated and attributable for the case chronology.",
      "Retained in the file for the record.",
    ],
  },
  demand: {
    lens: "how it feeds the case analysis",
    points: [
      "Read by the AI analysis as a primary source.",
      "Contributes to the confidence attached to the case assessment.",
      "Consistent with the other sources behind the valuation.",
    ],
  },
  negotiation: {
    lens: "what it is worth at the table",
    points: [
      "Supports the asserted settlement position.",
      "Backs the damages figure with documented value.",
      "Adds leverage against a below-range carrier response.",
    ],
  },
};

// AI Insights payload for a document, framed by the stage it was opened from.
// Shape matches what the Document Workspace already renders.
export function stageDocInsights(stage: StageId, doc: CaseDocument) {
  const s = STAGE_INSIGHT[stage];
  return {
    summary: `Reviewed for ${STAGE_LABELS[stage]} — ${s.lens}. ${doc.name} is read here as support for this stage's conclusions.`,
    keyPoints: s.points,
    entities: [
      { label: "Stage", value: STAGE_LABELS[stage] },
      { label: "Source", value: doc.source ?? "Attorney Office" },
      { label: "Date", value: doc.date ?? "—" },
    ],
    supportingDocs: [doc.name],
    confidence: { level: "High", score: 92 },
  };
}
