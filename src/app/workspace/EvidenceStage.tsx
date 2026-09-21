import { useState, useMemo } from "react";
import {
  FileText, Image as ImageIcon, Video, Search, SlidersHorizontal, ChevronDown, X, Sparkles,
  ShieldCheck, UserPlus, AlertTriangle, CheckCircle, Eye, Play, Pause, ZoomIn, ZoomOut,
  Scale, Activity, DollarSign, Gavel, Link2, Loader2, RotateCcw, ArrowRight, Users,
  Layers, Clock,
} from "lucide-react";
import type { CaseDocument, AnalysisFinding } from "../types/case";
import {
  buildDocResolver, stageEvidence, STAGE_LABELS, type StageId, type ChronEvent, type UserChronology,
} from "./WorkspaceTabs";
import { DocumentWorkspaceModal } from "../components/DocumentWorkspace";
import {
  EVIDENCE_INTEL, EVIDENCE_MEDIA, bucketFor, formatFor, FORMAT_LABEL,
  type EvidenceIntel, type EvidenceFormat, type Confidence,
} from "./evidenceData";

// ── Tab 6 — Evidence ──────────────────────────────────────────────────────────
// Evidence review + evidence intelligence for the whole case. It owns no files:
// the catalogue is derived from the case's one document repository plus every
// file the other stages already cite, so police_report_final.pdf here and in
// Chronology, Negligence and Violations are the same underlying record.

const ANALYSIS_STAGES: StageId[] = ["overview", "medical", "economic", "noneconomic", "liability", "evidence", "demand", "negotiation"];

type AnalysisState = "analyzed" | "review" | "pending" | "analyzing" | "failed";

interface EvidenceItem {
  key: string;                 // lowercased filename — the identity of the evidence
  name: string;
  title: string;
  bucket: string;
  format: EvidenceFormat;
  doc: CaseDocument;
  intel?: EvidenceIntel;
  verified: boolean;           // present in the uploaded document repository
  userAdded: boolean;          // reached the case through a manually created chronology event
  citedBy: StageId[];
  search: string;
}

// ── Derivation ────────────────────────────────────────────────────────────────

// Analysis for evidence that has not been through the authored review. It only
// asserts what is genuinely derivable — never invented findings.
function deriveIntel(item: EvidenceItem): EvidenceIntel {
  const where = item.citedBy.map((s) => STAGE_LABELS[s]).join(", ");
  const none = "Not assessed — this evidence has not been through detailed analysis.";
  return {
    title: item.title,
    summary: `${item.name} is classified as ${item.bucket.toLowerCase()} and is referenced by ${where || "no stage yet"}. Detailed analysis has not been performed, so the findings below are limited to what the case record already establishes.`,
    keyFacts: [
      { text: `Classified as ${item.bucket}`, verified: true },
      { text: `Recorded source: ${item.doc.source}`, verified: true },
      { text: `Recorded date: ${item.doc.date}`, verified: true },
      ...(item.citedBy.length ? [{ text: `Cited by ${where}`, verified: true }] : []),
    ],
    parties: [],
    liability: none,
    violations: [],
    causation: none,
    damages: none,
    impact: {
      liability: none, causation: none, damages: none, violations: none,
      settlement: none, overall: "Low",
    },
    related: [],
    contradictions: [],
    gaps: ["Detailed analysis has not been performed on this evidence."],
    confidence: { level: "Low", score: 0 },
    supports: item.citedBy,
  };
}

function titleFromName(name: string) {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\bv\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Small shared pieces ───────────────────────────────────────────────────────

const FORMAT_ICON: Record<EvidenceFormat, any> = { document: FileText, image: ImageIcon, video: Video };

function FormatBadge({ format }: { format: EvidenceFormat }) {
  const Icon = FORMAT_ICON[format];
  return (
    <span className="pill pill-neutral shrink-0">
      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} /> {FORMAT_LABEL[format]}
    </span>
  );
}

function OriginBadge({ item }: { item: EvidenceItem }) {
  if (item.userAdded) {
    return <span className="pill pill-neutral shrink-0"><UserPlus className="w-3.5 h-3.5" strokeWidth={1.75} /> User Added</span>;
  }
  if (item.verified) {
    return <span className="pill pill-complete shrink-0"><ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.75} /> Verified</span>;
  }
  return <span className="pill pill-neutral shrink-0">System Generated</span>;
}

function AnalysisBadge({ state }: { state: AnalysisState }) {
  if (state === "analyzing") {
    return <span className="pill pill-neutral shrink-0"><Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} /> Analyzing…</span>;
  }
  if (state === "failed") {
    return <span className="pill pill-risk shrink-0"><AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} /> Analysis Failed</span>;
  }
  if (state === "review") {
    return <span className="pill pill-progress shrink-0"><AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} /> Needs Review</span>;
  }
  if (state === "pending") {
    return <span className="pill pill-neutral shrink-0">Pending Analysis</span>;
  }
  return <span className="pill pill-neutral shrink-0"><Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} /> AI Analyzed</span>;
}

// Dropdown built from the same markup as the Chronology filter dropdowns.
function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="eyebrow mb-2">{label}</div>
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            value !== "All" ? "border-brand bg-tint text-deep" : "border-line bg-white text-ink hover:border-soft"
          }`}
        >
          <span className="truncate">{value}</span>
          <ChevronDown className={`w-4 h-4 text-[#5B6B78] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 right-0 mt-1.5 z-20 max-h-[240px] overflow-y-auto rounded-lg border border-line bg-white shadow-lg p-1">
              {options.map((o) => (
                <button
                  key={o}
                  onClick={() => { onChange(o); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    value === o ? "bg-tint text-deep font-medium" : "text-ink hover:bg-wash"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Media viewers ─────────────────────────────────────────────────────────────
// Same modal shell and toolbar language as the Evidence Review document viewer.

function ViewerShell({
  name, bucket, children, onAnalyze, onClose, toolbar,
}: { name: string; bucket: string; children: React.ReactNode; onAnalyze: () => void; onClose: () => void; toolbar?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-[90vw] h-[88vh] max-w-[1200px] flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-line shrink-0">
          <FileText className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
          <span className="mono-ref text-ink truncate">{name}</span>
          <span className="secondary-text truncate hidden sm:inline">· {bucket}</span>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {toolbar}
            <button onClick={onAnalyze} className="btn btn-secondary px-3 py-1.5 text-sm gap-1.5">
              <Sparkles className="w-4 h-4 text-deep" strokeWidth={1.75} /> AI Analysis
            </button>
            <button onClick={onClose} title="Close" className="p-1.5 hover:bg-tint rounded-lg transition-colors">
              <X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function ImageViewer({ item, onAnalyze, onClose }: { item: EvidenceItem; onAnalyze: () => void; onClose: () => void }) {
  const [zoom, setZoom] = useState(100);
  return (
    <ViewerShell
      name={item.name}
      bucket={item.bucket}
      onAnalyze={onAnalyze}
      onClose={onClose}
      toolbar={
        <>
          <button onClick={() => setZoom((z) => Math.max(50, z - 25))} className="p-1.5 rounded-lg hover:bg-tint transition-colors"><ZoomOut className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} /></button>
          <span className="text-xs tabular-nums text-[#5B6B78] px-1 w-10 text-center">{zoom}%</span>
          <button onClick={() => setZoom((z) => Math.min(200, z + 25))} className="p-1.5 rounded-lg hover:bg-tint transition-colors"><ZoomIn className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} /></button>
          <span className="w-px h-5 bg-line mx-1" />
        </>
      }
    >
      <div className="flex-1 overflow-auto bg-[#F1F3F5] p-8 flex items-start justify-center">
        <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }} className="transition-transform duration-200 shrink-0">
          {/* Placeholder frame — the prototype has no bundled image assets */}
          <div className="bg-white shadow-lg border border-line w-[640px] h-[420px] flex flex-col items-center justify-center gap-3">
            <ImageIcon className="w-10 h-10 text-soft" strokeWidth={1.5} />
            <div className="mono-ref">{item.name}</div>
            <div className="secondary-text">{item.bucket}</div>
          </div>
          {item.intel?.observations && (
            <div className="mt-4 w-[640px] rounded-xl border border-line bg-white p-4">
              <div className="eyebrow mb-2">What the image shows</div>
              <ul className="space-y-1.5">
                {item.intel.observations.map((o) => (
                  <li key={o} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-deep mt-0.5 shrink-0" strokeWidth={1.75} />
                    <span className="body-text leading-relaxed">{o}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </ViewerShell>
  );
}

function VideoViewer({ item, onAnalyze, onClose }: { item: EvidenceItem; onAnalyze: () => void; onClose: () => void }) {
  const moments = item.intel?.moments ?? [];
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0); // index into moments, used as a stand-in timeline
  return (
    <ViewerShell name={item.name} bucket={item.bucket} onAnalyze={onAnalyze} onClose={onClose}>
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="flex-1 min-w-0 bg-[#F1F3F5] p-8 flex flex-col items-center justify-center gap-4">
          <div className="bg-ink rounded-xl w-full max-w-[720px] aspect-video flex flex-col items-center justify-center gap-3">
            <Video className="w-10 h-10 text-soft" strokeWidth={1.5} />
            <div className="mono-ref text-soft">{item.name}</div>
            {moments[at] && <div className="text-sm text-white px-6 text-center">{moments[at].time} · {moments[at].text}</div>}
          </div>
          {/* Playback + scrub */}
          <div className="w-full max-w-[720px] flex items-center gap-3">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="w-9 h-9 rounded-full bg-brand hover:bg-deep text-white flex items-center justify-center transition-colors shrink-0"
            >
              {playing ? <Pause className="w-4 h-4" strokeWidth={2} /> : <Play className="w-4 h-4" strokeWidth={2} />}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0, moments.length - 1)}
              value={at}
              onChange={(e) => setAt(Number(e.target.value))}
              className="flex-1 accent-[#3FB5D7]"
            />
            <span className="mono-ref shrink-0">{moments[at]?.time ?? "00:00"}</span>
          </div>
        </div>

        {/* Important moments — read the video without watching it */}
        {moments.length > 0 && (
          <div className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l border-line overflow-y-auto p-5">
            <div className="eyebrow mb-3">Important Moments</div>
            <div className="space-y-2">
              {moments.map((m, i) => (
                <button
                  key={m.time}
                  onClick={() => setAt(i)}
                  className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
                    i === at ? "border-brand bg-tint" : "border-line bg-offwhite hover:border-soft hover:bg-wash"
                  }`}
                >
                  <div className="mono-ref">{m.time}</div>
                  <div className="body-text leading-snug mt-0.5">{m.text}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </ViewerShell>
  );
}

// ── Evidence Analysis drawer ──────────────────────────────────────────────────

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow text-deep mb-1.5">{title}</div>
      {children}
    </div>
  );
}

function AnalysisDrawer({
  item, state, onClose, onOpenRelated, onGoToStage, onRetry,
}: {
  item: EvidenceItem;
  state: AnalysisState;
  onClose: () => void;
  onOpenRelated: (name: string) => void;
  onGoToStage: (s: StageId) => void;
  onRetry: () => void;
}) {
  const intel = item.intel ?? deriveIntel(item);
  const analysed = state === "analyzed" || state === "review";

  return (
    <>
      <div className="fixed inset-0 bg-ink/40 z-[70]" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[520px] max-w-[94vw] bg-white shadow-xl z-[70] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line shrink-0">
          <div className="min-w-0">
            <div className="eyebrow mb-1">Evidence Analysis</div>
            <h2 className="card-title">{item.title}</h2>
            <div className="mono-ref mt-1 truncate">{item.name}</div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <FormatBadge format={item.format} />
              <OriginBadge item={item} />
              <AnalysisBadge state={state} />
            </div>
          </div>
          <button onClick={onClose} title="Close" className="p-1.5 hover:bg-tint rounded-lg transition-colors shrink-0">
            <X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} />
          </button>
        </div>

        {/* Running / failed states never show findings */}
        {state === "analyzing" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <Loader2 className="w-7 h-7 text-brand animate-spin" strokeWidth={1.75} />
            <p className="text-sm font-medium text-ink">Analyzing evidence…</p>
            <p className="secondary-text max-w-xs">Reading {item.name} and cross-checking it against the rest of the case record.</p>
          </div>
        ) : state === "failed" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertTriangle className="w-7 h-7 text-[#B91C1C]" strokeWidth={1.75} />
            <p className="text-sm font-medium text-ink">Analysis failed</p>
            <p className="secondary-text max-w-xs">This evidence could not be analyzed. No findings are available.</p>
            <button onClick={onRetry} className="btn btn-secondary gap-1.5 mt-1">
              <RotateCcw className="w-4 h-4" strokeWidth={1.75} /> Retry Analysis
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* 1 — Evidence Summary */}
            <Block title="Evidence Summary">
              <p className="body-text leading-relaxed">{intel.summary}</p>
            </Block>

            {/* 2 — Key Facts */}
            {intel.keyFacts.length > 0 && (
              <Block title="Key Facts">
                <ul className="space-y-2">
                  {intel.keyFacts.map((f) => (
                    <li key={f.text} className="flex items-start gap-2">
                      {f.verified
                        ? <CheckCircle className="w-4 h-4 text-deep mt-0.5 shrink-0" strokeWidth={1.75} />
                        : <Sparkles className="w-4 h-4 text-[#8A98A3] mt-0.5 shrink-0" strokeWidth={1.75} />}
                      <span className="body-text leading-relaxed">
                        {f.text}
                        {!f.verified && <span className="text-[11px] text-[#8A98A3]"> · AI interpretation</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {/* 3 — Parties Involved */}
            {intel.parties.length > 0 && (
              <Block title="Parties Involved">
                <div className="rounded-xl border border-line divide-y divide-line">
                  {intel.parties.map((p) => (
                    <div key={p.role + p.name} className="flex items-start justify-between gap-4 px-4 py-2.5">
                      <span className="text-sm text-[#5B6B78] shrink-0">{p.role}</span>
                      <span className="text-sm font-medium text-ink text-right">{p.name}</span>
                    </div>
                  ))}
                </div>
              </Block>
            )}

            {/* 4/5 — Liability & the AI-estimated allocation */}
            <Block title="Liability Analysis">
              <p className="body-text leading-relaxed">{intel.liability}</p>
              {intel.allocation && (
                <div className="rounded-xl border border-[#D6F2F7] bg-[#F6FDFF] p-4 mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                    <span className="eyebrow text-deep">AI-Estimated Liability Allocation</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-[#5B6B78]">Defendant Driver</span>
                      <span className="text-sm font-semibold text-ink tabular-nums">{intel.allocation.defendant}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-[#5B6B78]">Plaintiff</span>
                      <span className="text-sm font-semibold text-ink tabular-nums">{intel.allocation.plaintiff}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#D6F2F7]">
                    <span className="eyebrow">AI Confidence</span>
                    <span className="pill pill-neutral">{intel.allocation.confidence}</span>
                  </div>
                  <p className="text-[11px] text-[#8A98A3] mt-2">
                    An AI estimate from the evidence currently on file — not a legal determination of fault.
                  </p>
                </div>
              )}
            </Block>

            {/* 6 — Potential Violations */}
            {intel.violations.length > 0 && (
              <Block title="Potential Violations">
                <div className="space-y-2">
                  {intel.violations.map((v) => (
                    <div key={v.name} className="rounded-xl border border-line bg-offwhite p-3.5">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-ink">{v.name}</span>
                        <span className="pill pill-neutral shrink-0">{v.confidence}</span>
                      </div>
                      <p className="secondary-text leading-relaxed">{v.why}</p>
                      {v.docs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {v.docs.map((d) => (
                            <button
                              key={d}
                              onClick={() => onOpenRelated(d)}
                              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-xs text-ink hover:border-brand hover:bg-tint transition-all"
                            >
                              <FileText className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> {d}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Block>
            )}

            {/* 7/8 — Causation & Damages */}
            <Block title="Causation"><p className="body-text leading-relaxed">{intel.causation}</p></Block>
            <Block title="Damages Relevance"><p className="body-text leading-relaxed">{intel.damages}</p></Block>

            {/* Images — observations kept separate from inference */}
            {intel.observations && intel.observations.length > 0 && (
              <Block title="What the Image Shows">
                <ul className="space-y-1.5">
                  {intel.observations.map((o) => (
                    <li key={o} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-deep mt-0.5 shrink-0" strokeWidth={1.75} />
                      <span className="body-text leading-relaxed">{o}</span>
                    </li>
                  ))}
                </ul>
              </Block>
            )}
            {intel.inferences && intel.inferences.length > 0 && (
              <Block title="What It May Suggest">
                <ul className="space-y-1.5">
                  {intel.inferences.map((o) => (
                    <li key={o} className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-[#8A98A3] mt-0.5 shrink-0" strokeWidth={1.75} />
                      <span className="body-text leading-relaxed">{o}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-[#8A98A3] mt-2">AI inference from the visible content — not established fact.</p>
              </Block>
            )}

            {/* Videos — important moments */}
            {intel.moments && intel.moments.length > 0 && (
              <Block title="Important Moments">
                <div className="rounded-xl border border-line divide-y divide-line">
                  {intel.moments.map((m) => (
                    <div key={m.time} className="flex items-start gap-3 px-4 py-2.5">
                      <span className="mono-ref shrink-0">{m.time}</span>
                      <span className="body-text leading-relaxed">{m.text}</span>
                    </div>
                  ))}
                </div>
              </Block>
            )}

            {/* 9 — Case Impact */}
            <Block title="Case Impact">
              <div className="rounded-xl border border-line divide-y divide-line">
                {([
                  ["Liability", intel.impact.liability],
                  ["Causation", intel.impact.causation],
                  ["Damages", intel.impact.damages],
                  ["Violations", intel.impact.violations],
                  ["Settlement", intel.impact.settlement],
                ] as const).map(([l, v]) => (
                  <div key={l} className="px-4 py-2.5">
                    <div className="eyebrow mb-0.5">{l}</div>
                    <p className="body-text leading-relaxed">{v}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2.5">
                <span className="eyebrow">Overall Impact</span>
                <span className={`pill ${intel.impact.overall === "High" ? "pill-complete" : intel.impact.overall === "Moderate" ? "pill-progress" : "pill-neutral"}`}>
                  {intel.impact.overall.toUpperCase()}
                </span>
              </div>
            </Block>

            {/* 10 — Supports (navigates into the stage) */}
            {intel.supports.length > 0 && (
              <Block title="Supports">
                <div className="flex flex-wrap gap-1.5">
                  {intel.supports.map((s) => (
                    <button
                      key={s}
                      onClick={() => onGoToStage(s)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-sm text-ink hover:border-brand hover:bg-tint transition-all"
                    >
                      {STAGE_LABELS[s]} <ArrowRight className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} />
                    </button>
                  ))}
                </div>
              </Block>
            )}

            {/* 11 — Related Evidence */}
            {intel.related.length > 0 && (
              <Block title="Related Evidence">
                <div className="flex flex-col gap-2">
                  {intel.related.map((r) => (
                    <button
                      key={r}
                      onClick={() => onOpenRelated(r)}
                      className="flex items-center gap-2 rounded-lg border border-line bg-offwhite px-3 py-2 text-sm text-ink text-left hover:border-brand hover:bg-tint transition-all"
                    >
                      <Link2 className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{r}</span>
                    </button>
                  ))}
                </div>
              </Block>
            )}

            {/* 12 — Contradictions */}
            {intel.contradictions.length > 0 && (
              <Block title="Contradictions">
                <div className="space-y-2">
                  {intel.contradictions.map((c, i) => (
                    <div key={i} className="rounded-xl border border-[#FDE6C8] bg-[#FFF7ED] p-3.5">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-[#B45309] shrink-0" strokeWidth={1.75} />
                        <span className="text-xs font-semibold text-[#B45309]">Potential discrepancy</span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="eyebrow mb-0.5">{c.source}</div>
                          <p className="body-text leading-relaxed">{c.text}</p>
                        </div>
                        <div>
                          <div className="eyebrow mb-0.5">{c.against}</div>
                          <p className="body-text leading-relaxed">{c.againstText}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Block>
            )}

            {/* 13 — Evidence Gaps */}
            {intel.gaps.length > 0 && (
              <Block title="Evidence Gaps">
                <ul className="space-y-2">
                  {intel.gaps.map((g) => (
                    <li key={g} className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#B45309] mt-0.5 shrink-0" strokeWidth={1.75} />
                      <span className="body-text leading-relaxed">{g}</span>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {/* 14 — AI Confidence */}
            <div className="flex items-center gap-2 pt-1 border-t border-line pt-4">
              <span className="eyebrow">AI Confidence</span>
              <span className={`pill ${intel.confidence.level === "High" ? "pill-complete" : intel.confidence.level === "Moderate" ? "pill-progress" : "pill-neutral"}`}>
                {analysed && intel.confidence.score > 0
                  ? `${intel.confidence.level} — ${intel.confidence.score}%`
                  : intel.confidence.level}
              </span>
            </div>
            <p className="text-[11px] text-[#8A98A3] -mt-4">
              Confidence in this analysis of the evidence. Not a probability of case outcome.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// ── Evidence card ─────────────────────────────────────────────────────────────

function EvidenceCard({
  item, state, onOpen, onAnalyze, onRun, onGoToStage,
}: {
  item: EvidenceItem;
  state: AnalysisState;
  onOpen: () => void;
  onAnalyze: () => void;
  onRun: () => void;
  onGoToStage: (s: StageId) => void;
}) {
  const openLabel = item.format === "image" ? "View Image" : item.format === "video" ? "Watch Video" : "Preview";
  const OpenIcon = item.format === "video" ? Play : Eye;
  const supports = item.intel?.supports ?? item.citedBy;

  return (
    <div className="lg-card lg-card-i p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h4 className="card-title leading-snug">{item.title}</h4>
          <div className="mono-ref mt-0.5 truncate">{item.name}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          <FormatBadge format={item.format} />
          <OriginBadge item={item} />
          <AnalysisBadge state={state} />
        </div>
      </div>

      <div className="secondary-text">
        {item.bucket} · Source: {item.doc.source} · {item.doc.date}
      </div>

      {/* AI summary — only once the evidence has actually been analyzed */}
      {(state === "analyzed" || state === "review") && item.intel && (
        <div className="mt-3">
          <div className="eyebrow text-deep mb-1">AI Summary</div>
          <p className="body-text leading-relaxed">{item.intel.summary}</p>
        </div>
      )}
      {state === "analyzing" && (
        <div className="mt-3 flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-brand animate-spin shrink-0" strokeWidth={1.75} />
          <span className="secondary-text">Analyzing evidence…</span>
        </div>
      )}
      {state === "pending" && (
        <p className="secondary-text mt-3">This evidence has not been analyzed yet.</p>
      )}
      {state === "failed" && (
        <p className="secondary-text mt-3">Analysis failed for this evidence.</p>
      )}

      {/* Supports — jump into the stage that relies on this evidence */}
      {supports.length > 0 && (
        <div className="mt-3">
          <div className="eyebrow mb-1.5">Supports</div>
          <div className="flex flex-wrap gap-1.5">
            {supports.map((s) => (
              <button
                key={s}
                onClick={() => onGoToStage(s)}
                className="inline-flex items-center gap-1 rounded-md border border-line bg-offwhite px-2.5 py-1 text-xs text-ink hover:border-brand hover:bg-tint transition-all"
              >
                {STAGE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-line flex items-center gap-2 flex-wrap">
        <button onClick={onOpen} className="btn btn-secondary px-3 py-2 text-sm gap-1.5">
          <OpenIcon className="w-4 h-4 text-deep" strokeWidth={1.75} /> {openLabel}
        </button>
        {state === "pending" || state === "failed" ? (
          <button onClick={onRun} className="btn btn-primary px-3 py-2 text-sm gap-1.5">
            <Sparkles className="w-4 h-4" strokeWidth={1.75} /> {state === "failed" ? "Retry Analysis" : "Run Analysis"}
          </button>
        ) : (
          <button onClick={onAnalyze} disabled={state === "analyzing"} className="btn btn-secondary px-3 py-2 text-sm gap-1.5 disabled:opacity-50">
            <Sparkles className="w-4 h-4 text-deep" strokeWidth={1.75} /> AI Analysis
          </button>
        )}
        <button onClick={onAnalyze} disabled={state === "analyzing" || state === "pending"} className="btn btn-secondary px-3 py-2 text-sm gap-1.5 disabled:opacity-50">
          <Scale className="w-4 h-4 text-deep" strokeWidth={1.75} /> Case Impact
        </button>
      </div>
    </div>
  );
}

// ── Stage ─────────────────────────────────────────────────────────────────────

interface Props {
  documents: CaseDocument[];
  findings: AnalysisFinding[];
  userChronology: UserChronology;
  goTo: (tab: string) => void;
}

const TYPE_FILTERS = ["All", "Medical", "Accident / Scene", "Police / Official", "Witness", "Insurance", "Financial", "Legal", "Vehicle / Physical", "Communications", "Other"];
const FILE_FILTERS = ["All", "Documents", "PDF", "Images", "Videos", "Images & Videos"];
const ANALYSIS_FILTERS = ["All", "Analyzed", "Needs Review", "Pending Analysis"];
const STATUS_FILTERS = ["All", "Verified", "User Added", "System Generated"];
const RELEVANCE_FILTERS = ["All", "Liability", "Causation", "Damages", "Violations", "Settlement", "Multiple"];

// Bucket name → the "Evidence Type" filter label.
const TYPE_OF_BUCKET: Record<string, string> = {
  "Medical Evidence": "Medical",
  "Accident / Scene Evidence": "Accident / Scene",
  "Police & Official Reports": "Police / Official",
  "Witness Evidence": "Witness",
  "Insurance Evidence": "Insurance",
  "Financial & Wage Loss Evidence": "Financial",
  "Legal & Case Documents": "Legal",
  "Vehicle / Physical Evidence": "Vehicle / Physical",
  "Communications": "Communications",
  "Other Evidence": "Other",
};

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const BUCKET_ORDER = [
  "Medical Evidence", "Accident / Scene Evidence", "Police & Official Reports", "Witness Evidence",
  "Insurance Evidence", "Financial & Wage Loss Evidence", "Legal & Case Documents",
  "Vehicle / Physical Evidence", "Communications", "Other Evidence",
];

// ── Quick Access ──────────────────────────────────────────────────────────────
// The attorney arrives asking "what do I want to look at?" rather than knowing
// how the evidence is filed. These are shortcuts onto the filters and sections
// already on the page — no new view, no second set of categories.

// A high-level shortcut: what it sets, and how to tell it is the one in force.
interface Shortcut {
  label: string;
  hint: string;
  icon: any;
  /** The filter state this shortcut represents. */
  file: string;
  analysis: string;
  recent: boolean;
}

const SHORTCUTS: Shortcut[] = [
  { label: "All Evidence", hint: "Everything on the case", icon: Layers, file: "All", analysis: "All", recent: false },
  { label: "Documents", hint: "Document-based evidence", icon: FileText, file: "Documents", analysis: "All", recent: false },
  { label: "Images & Videos", hint: "Visual evidence", icon: ImageIcon, file: "Images & Videos", analysis: "All", recent: false },
  { label: "Needs Review", hint: "Awaiting your review", icon: AlertTriangle, file: "All", analysis: "Needs Review", recent: false },
  { label: "Recently Added", hint: "Newest on the file", icon: Clock, file: "All", analysis: "All", recent: true },
];

// The eight categories the page already groups by, with a line saying what each
// holds. The bucket name is the link — clicking opens that same section.
const CATEGORY_BLURB: Record<string, string> = {
  "Medical Evidence": "Medical records, treatment notes, imaging and related evidence",
  "Accident / Scene Evidence": "Photos, videos, scene documentation and accident evidence",
  "Police & Official Reports": "Police reports and other official records",
  "Witness Evidence": "Witness statements and testimony-related evidence",
  "Insurance Evidence": "Policies, correspondence and coverage documentation",
  "Financial & Wage Loss Evidence": "Bills, wage records and financial documentation",
  "Legal & Case Documents": "Pleadings, legal documents, correspondence and case records",
  "Vehicle / Physical Evidence": "Vehicle records, inspection evidence and physical evidence",
};

export function EvidenceStageTab({ documents, findings, userChronology, goTo }: Props) {
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fType, setFType] = useState("All");
  const [fFile, setFFile] = useState("All");
  const [fAnalysis, setFAnalysis] = useState("All");
  const [fStatus, setFStatus] = useState("All");
  const [fRelevance, setFRelevance] = useState("All");
  // "Recently Added" reads the date the repository records against each
  // document. It is a view of the newest, not a new category.
  const [fRecent, setFRecent] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [runState, setRunState] = useState<Record<string, AnalysisState>>({});
  const [previewDoc, setPreviewDoc] = useState<CaseDocument | null>(null);
  const [viewer, setViewer] = useState<EvidenceItem | null>(null);
  const [analysisItem, setAnalysisItem] = useState<EvidenceItem | null>(null);

  // ── Catalogue: the repository plus every file the other stages cite ──
  const items = useMemo<EvidenceItem[]>(() => {
    const docForFile = buildDocResolver(documents);
    const userChron: ChronEvent[] = [...userChronology.medical, ...userChronology.event];
    const userNames = new Set(userChron.flatMap((e) => e.evidence).map((n) => n.toLowerCase()));

    // Which stages cite each file — drives "Supports" and keeps one identity.
    const citedBy = new Map<string, StageId[]>();
    const order: string[] = [];
    for (const stage of ANALYSIS_STAGES) {
      for (const d of stageEvidence(stage, documents, { findings, userChronology: userChron })) {
        const key = d.name.toLowerCase();
        if (!citedBy.has(key)) { citedBy.set(key, []); order.push(d.name); }
        citedBy.get(key)!.push(stage);
      }
    }
    // Case-referenced media (photos and footage) join the same catalogue.
    for (const m of EVIDENCE_MEDIA) {
      const key = m.name.toLowerCase();
      if (!citedBy.has(key)) { citedBy.set(key, []); order.push(m.name); }
    }

    const repo = new Set(documents.map((d) => d.name.toLowerCase()));
    const mediaByName = new Map(EVIDENCE_MEDIA.map((m) => [m.name.toLowerCase(), m]));

    return order.map((name) => {
      const key = name.toLowerCase();
      const intel = EVIDENCE_INTEL[key];
      const media = mediaByName.get(key);
      const base = docForFile(name);
      const doc: CaseDocument = media
        ? { ...base, source: media.source as CaseDocument["source"], date: media.date }
        : base;
      const item: EvidenceItem = {
        key,
        name,
        title: intel?.title ?? titleFromName(name),
        bucket: bucketFor(name),
        format: formatFor(name),
        doc,
        intel,
        verified: repo.has(key),
        userAdded: userNames.has(key) && !repo.has(key),
        citedBy: citedBy.get(key) ?? [],
        search: "",
      };
      item.search = [
        item.name, item.title, item.bucket,
        intel?.summary ?? "",
        ...(intel?.keyFacts ?? []).map((f) => f.text),
        ...(intel?.parties ?? []).map((p) => `${p.role} ${p.name}`),
        ...(intel?.violations ?? []).map((v) => `${v.name} ${v.why}`),
        ...(intel?.keywords ?? []),
        ...(intel?.observations ?? []),
        ...(intel?.moments ?? []).map((m) => m.text),
        intel?.liability ?? "", intel?.causation ?? "", intel?.damages ?? "",
      ].join(" ").toLowerCase();
      return item;
    });
  }, [documents, findings, userChronology]);

  // Needs Review means the analysis surfaced something the attorney must weigh —
  // a contradiction against other evidence, or a result the model is not
  // confident in. Identified gaps alone are ordinary output, not a flag.
  const stateOf = (item: EvidenceItem): AnalysisState => {
    const run = runState[item.key];
    if (run) return run;
    if (!item.intel) return "pending";
    return item.intel.contradictions.length > 0 || item.intel.confidence.level === "Low" ? "review" : "analyzed";
  };

  const runAnalysis = (item: EvidenceItem) => {
    setRunState((p) => ({ ...p, [item.key]: "analyzing" }));
    setTimeout(() => setRunState((p) => ({ ...p, [item.key]: "analyzed" })), 1600);
  };

  // ── Summary counts — derived, never hard-coded ──
  const counts = useMemo(() => {
    const c = { total: items.length, document: 0, image: 0, video: 0, analyzed: 0, review: 0 };
    for (const i of items) {
      c[i.format]++;
      const s = stateOf(i);
      if (s === "analyzed") c.analyzed++;
      if (s === "review") c.review++;
    }
    return c;
  }, [items, runState]);

  // ── Evidence intelligence — rolled up from the analyzed evidence ──
  const intelligence = useMemo(() => {
    const analysed = items.filter((i) => i.intel);
    const strength = (pick: (x: EvidenceIntel) => string) =>
      analysed.filter((i) => !/^Not (relevant|assessed)/i.test(pick(i.intel!))).length;
    const label = (n: number) => (n >= 5 ? "Strong Support" : n >= 3 ? "Moderate Support" : n >= 1 ? "Limited Support" : "No Support Yet");
    const violations = new Set(analysed.flatMap((i) => i.intel!.violations.map((v) => v.name)));
    const gapItems = analysed.filter((i) => i.intel!.gaps.length > 0);
    const scores = analysed.map((i) => i.intel!.confidence.score).filter(Boolean);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const high = analysed.filter((i) => i.intel!.impact.overall === "High").length;
    return {
      liability: label(strength((x) => x.impact.liability)),
      causation: label(strength((x) => x.impact.causation)),
      damages: label(strength((x) => x.impact.damages)),
      violations: violations.size,
      gaps: gapItems.length,
      overall: high >= 5 ? "High" : high >= 2 ? "Moderate" : "Developing",
      confidence: avg,
    };
  }, [items]);

  // ── Filtering ──
  const q = search.trim().toLowerCase();
  const visible = items.filter((i) => {
    if (q && !i.search.includes(q)) return false;
    if (fType !== "All" && TYPE_OF_BUCKET[i.bucket] !== fType) return false;
    if (fFile !== "All") {
      if (fFile === "Images" && i.format !== "image") return false;
      if (fFile === "Videos" && i.format !== "video") return false;
      if (fFile === "Images & Videos" && i.format !== "image" && i.format !== "video") return false;
      if ((fFile === "Documents" || fFile === "PDF") && i.format !== "document") return false;
    }
    if (fAnalysis !== "All") {
      const s = stateOf(i);
      if (fAnalysis === "Analyzed" && s !== "analyzed") return false;
      if (fAnalysis === "Needs Review" && s !== "review") return false;
      if (fAnalysis === "Pending Analysis" && s !== "pending") return false;
    }
    if (fStatus !== "All") {
      if (fStatus === "Verified" && !i.verified) return false;
      if (fStatus === "User Added" && !i.userAdded) return false;
      if (fStatus === "System Generated" && (i.verified || i.userAdded)) return false;
    }
    if (fRelevance !== "All") {
      const rel = new Set<string>();
      const it = i.intel;
      if (it) {
        if (!/^Not /i.test(it.impact.liability)) rel.add("Liability");
        if (!/^Not /i.test(it.impact.causation)) rel.add("Causation");
        if (!/^Not /i.test(it.impact.damages)) rel.add("Damages");
        if (it.violations.length) rel.add("Violations");
        if (!/^Not /i.test(it.impact.settlement)) rel.add("Settlement");
      }
      if (fRelevance === "Multiple" ? rel.size < 2 : !rel.has(fRelevance)) return false;
    }
    return true;
  });

  // "Recently Added" narrows to the newest items by the date the repository
  // records, applied after the other filters so it composes with them.
  const RECENT_COUNT = 10;
  const recentKeys = useMemo(() => {
    const dated = [...items]
      .map((i) => ({ key: i.key, at: Date.parse(i.doc.date) }))
      .filter((d) => !Number.isNaN(d.at))
      .sort((a, b) => b.at - a.at)
      .slice(0, RECENT_COUNT);
    return new Set(dated.map((d) => d.key));
  }, [items]);

  const shown = fRecent ? visible.filter((i) => recentKeys.has(i.key)) : visible;

  const buckets = BUCKET_ORDER
    .map((name) => ({ name, docs: shown.filter((i) => i.bucket === name) }))
    .filter((b) => b.docs.length > 0);

  const activeFilters = [fType, fFile, fAnalysis, fStatus, fRelevance].filter((f) => f !== "All").length + (fRecent ? 1 : 0);
  const resetFilters = () => {
    setFType("All"); setFFile("All"); setFAnalysis("All"); setFStatus("All"); setFRelevance("All"); setFRecent(false);
  };

  // ── Quick Access actions ────────────────────────────────────────────────
  // Each drives the filters and sections already on the page. A category card
  // opens that same section and scrolls to it — it never opens a second view.
  const applyShortcut = (sc: Shortcut) => {
    setFType("All");
    setFFile(sc.file);
    setFAnalysis(sc.analysis);
    setFStatus("All");
    setFRelevance("All");
    setFRecent(sc.recent);
    setSearch("");
    document.getElementById("evidence-sections")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activeShortcut = SHORTCUTS.find((sc) =>
    sc.file === fFile && sc.analysis === fAnalysis && sc.recent === fRecent
    && fType === "All" && fStatus === "All" && fRelevance === "All");

  const openCategory = (bucket: string) => {
    resetFilters();
    setSearch("");
    setExpanded((p) => ({ ...p, [bucket]: true }));
    // Let the section render open before scrolling to it.
    window.setTimeout(() => {
      document.getElementById(`evidence-bucket-${slugOf(bucket)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const openItem = (item: EvidenceItem) => {
    if (item.format === "document") setPreviewDoc(item.doc);
    else setViewer(item);
  };
  const openByName = (name: string) => {
    const found = items.find((i) => i.key === name.toLowerCase());
    if (found) setAnalysisItem(found);
  };

  const SUMMARY = [
    { label: "Total Evidence", value: counts.total, icon: FileText },
    { label: "Documents", value: counts.document, icon: FileText },
    { label: "Images", value: counts.image, icon: ImageIcon },
    { label: "Videos", value: counts.video, icon: Video },
    { label: "Analyzed", value: counts.analyzed, icon: Sparkles },
    { label: "Needs Review", value: counts.review, icon: AlertTriangle },
  ];

  const INTEL_ROWS = [
    { label: "Liability", value: intelligence.liability, icon: Scale },
    { label: "Causation", value: intelligence.causation, icon: Activity },
    { label: "Damages", value: intelligence.damages, icon: DollarSign },
    { label: "Violations", value: `${intelligence.violations} Potential`, icon: Gavel },
    // Distinct from the "Needs Review" counter above: gaps are identified by a
    // completed analysis, they do not mean the analysis itself needs review.
    { label: "Evidence Gaps", value: `${intelligence.gaps} Identified`, icon: AlertTriangle },
  ];

  return (
    <>
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="section-header" style={{ fontSize: "22px" }}>Evidence</h2>
            <p className="secondary-text mt-1 max-w-2xl">
              Review, organize, and analyze all evidence supporting the case.
            </p>
          </div>
          <span className="pill pill-complete shrink-0">
            <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.75} /> {counts.total} Evidence Items
          </span>
        </div>

        {items.length === 0 ? (
          <div className="lg-card flex flex-col items-center justify-center py-16 text-center px-6">
            <FileText className="w-8 h-8 text-soft mb-3" strokeWidth={1.75} />
            <p className="text-sm font-medium text-ink">No evidence available</p>
            <p className="secondary-text mt-1 max-w-md">
              Upload or add evidence through the existing Documents / Collection workflow.
            </p>
          </div>
        ) : (
          <>
            {/* Evidence counts */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {SUMMARY.map((s) => (
                <div key={s.label} className="rounded-xl border border-line bg-offwhite p-4">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <s.icon className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                    <span className="eyebrow">{s.label}</span>
                  </div>
                  <div className="kpi-value" style={{ fontSize: "24px" }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* ── Quick Access ──────────────────────────────────────────────
                Shortcuts onto the filters and sections below, so the attorney
                does not have to know how the evidence is filed to find it. */}
            <div className="rounded-2xl border border-line bg-white p-5">
              <h3 className="card-title">What would you like to review?</h3>
              <p className="secondary-text mt-1">
                Access case documents, medical records, reports, images, videos and other evidence from one place.
              </p>

              <div className="eyebrow mt-4 mb-2">Quick Access</div>
              <div className="flex flex-wrap gap-2">
                {SHORTCUTS.map((sc) => {
                  const on = activeShortcut?.label === sc.label;
                  return (
                    <button
                      key={sc.label}
                      onClick={() => applyShortcut(sc)}
                      title={sc.hint}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                        on ? "border-brand bg-tint text-deep" : "border-line bg-white text-[#5B6B78] hover:border-brand hover:text-deep"
                      }`}
                    >
                      <sc.icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} /> {sc.label}
                    </button>
                  );
                })}
              </div>

              <div className="eyebrow mt-5 mb-2">Explore Evidence</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {BUCKET_ORDER.filter((name) => CATEGORY_BLURB[name]).map((name) => {
                  const count = items.filter((i) => i.bucket === name).length;
                  return (
                    <button
                      key={name}
                      onClick={() => openCategory(name)}
                      disabled={count === 0}
                      className={`text-left rounded-xl border p-3 transition-colors ${
                        count === 0
                          ? "border-line bg-wash cursor-not-allowed opacity-60"
                          : "border-line bg-white hover:border-brand hover:bg-tint"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-ink leading-snug">{name}</span>
                        <span className="text-xs font-medium text-[#5B6B78] bg-white border border-line px-2 py-0.5 rounded-full shrink-0">
                          {count}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8A98A3] leading-snug mt-1">{CATEGORY_BLURB[name]}</p>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-deep mt-2">
                        {count === 0 ? "Nothing on file yet" : "View"} {count > 0 && <ArrowRight className="w-3 h-3" strokeWidth={2} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Evidence intelligence */}
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-deep" strokeWidth={1.75} />
                <h3 className="card-title">Evidence Intelligence</h3>
                <span className="pill pill-neutral">AI Generated</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {INTEL_ROWS.map((r) => (
                  <div key={r.label} className="rounded-xl border border-line bg-offwhite p-3.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <r.icon className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                      <span className="eyebrow">{r.label}</span>
                    </div>
                    <div className="text-sm font-semibold text-ink">{r.value}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-line flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="eyebrow">Overall Evidence Strength</span>
                  <span className={`pill ${intelligence.overall === "High" ? "pill-complete" : "pill-progress"}`}>{intelligence.overall}</span>
                </div>
                {intelligence.confidence > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="eyebrow">AI Confidence</span>
                    <span className="pill pill-neutral">{intelligence.confidence}%</span>
                  </div>
                )}
                <p className="text-[11px] text-[#8A98A3] w-full">
                  An AI assessment of the evidence currently on file. Confidence describes the analysis, not the likelihood of any case outcome.
                </p>
              </div>
            </div>

            {/* Search + filters */}
            <div id="evidence-sections" className="space-y-3 scroll-mt-[184px]">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search evidence..."
                    className="w-full bg-white border border-line rounded-lg pl-10 pr-4 py-2.5 text-sm text-ink placeholder:text-[#9BA8B4] focus:outline-none focus:border-brand transition-colors"
                  />
                </div>
                <button
                  onClick={() => setFiltersOpen((o) => !o)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    activeFilters > 0 ? "border-brand bg-tint text-deep" : "border-line bg-white text-ink hover:border-soft"
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" strokeWidth={1.75} /> Filters
                  {activeFilters > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-brand text-white">{activeFilters}</span>
                  )}
                </button>
              </div>

              {filtersOpen && (
                <div className="rounded-2xl border border-line bg-white p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <FilterSelect label="Evidence Type" value={fType} options={TYPE_FILTERS} onChange={setFType} />
                    <FilterSelect label="File Type" value={fFile} options={FILE_FILTERS} onChange={setFFile} />
                    <FilterSelect label="Analysis Status" value={fAnalysis} options={ANALYSIS_FILTERS} onChange={setFAnalysis} />
                    <FilterSelect label="Evidence Status" value={fStatus} options={STATUS_FILTERS} onChange={setFStatus} />
                    <FilterSelect label="Case Relevance" value={fRelevance} options={RELEVANCE_FILTERS} onChange={setFRelevance} />
                  </div>
                  {activeFilters > 0 && (
                    <button onClick={resetFilters} className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#5B6B78] hover:text-ink transition-colors">
                      <X className="w-3 h-3" strokeWidth={2} /> Clear all filters
                    </button>
                  )}
                </div>
              )}

              {(q || activeFilters > 0) && (
                <div className="secondary-text">
                  {visible.length} of {items.length} evidence items match.
                </div>
              )}
            </div>

            {/* Buckets */}
            {buckets.length === 0 ? (
              <div className="text-center py-16 secondary-text">No evidence matches the current search or filters.</div>
            ) : (
              <div className="space-y-4">
                {buckets.map((b) => {
                  const open = !!expanded[b.name];
                  const groups = ([
                    ["Documents", "document"], ["Images", "image"], ["Videos", "video"],
                  ] as const)
                    .map(([label, fmt]) => ({ label, docs: b.docs.filter((d) => d.format === fmt) }))
                    .filter((g) => g.docs.length > 0);
                  return (
                    <div key={b.name} id={`evidence-bucket-${slugOf(b.name)}`} className="border border-line rounded-xl overflow-hidden bg-white scroll-mt-[184px]">
                      <button
                        onClick={() => setExpanded((p) => ({ ...p, [b.name]: !p[b.name] }))}
                        className="w-full flex items-center justify-between px-5 py-3.5 bg-wash hover:bg-tint transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink uppercase tracking-[0.04em]">{b.name}</span>
                          <span className="text-xs font-medium text-[#5B6B78] bg-white border border-line px-2 py-0.5 rounded-full">{b.docs.length}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-[#5B6B78] transition-transform ${open ? "" : "-rotate-90"}`} strokeWidth={1.75} />
                      </button>

                      {open && (
                        <div className="p-5 space-y-5 border-t border-line bg-offwhite">
                          {groups.map((g) => (
                            <div key={g.label}>
                              <div className="flex items-center gap-2 mb-3">
                                <span className="eyebrow">{g.label}</span>
                                <span className="text-xs font-medium text-[#5B6B78] bg-white border border-line px-2 py-0.5 rounded-full">{g.docs.length}</span>
                              </div>
                              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                {g.docs.map((item) => (
                                  <EvidenceCard
                                    key={item.key}
                                    item={item}
                                    state={stateOf(item)}
                                    onOpen={() => openItem(item)}
                                    onAnalyze={() => setAnalysisItem(item)}
                                    onRun={() => runAnalysis(item)}
                                    onGoToStage={goTo}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Documents open in the existing Document Workspace */}
      <DocumentWorkspaceModal
        docs={previewDoc ? [previewDoc] : null}
        initialView="preview"
        noteContext={{ contextType: "Evidence", reference: previewDoc?.name ?? "" }}
        onClose={() => setPreviewDoc(null)}
        onDownload={() => {}}
      />

      {viewer?.format === "image" && (
        <ImageViewer item={viewer} onAnalyze={() => { setAnalysisItem(viewer); setViewer(null); }} onClose={() => setViewer(null)} />
      )}
      {viewer?.format === "video" && (
        <VideoViewer item={viewer} onAnalyze={() => { setAnalysisItem(viewer); setViewer(null); }} onClose={() => setViewer(null)} />
      )}

      {analysisItem && (
        <AnalysisDrawer
          item={analysisItem}
          state={stateOf(analysisItem)}
          onClose={() => setAnalysisItem(null)}
          onOpenRelated={openByName}
          onGoToStage={(s) => { setAnalysisItem(null); goTo(s); }}
          onRetry={() => runAnalysis(analysisItem)}
        />
      )}
    </>
  );
}
