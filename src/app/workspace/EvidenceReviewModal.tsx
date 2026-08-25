import { useState, useEffect } from "react";
import {
  X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, ShieldCheck, Send,
  Download, Sparkles, Lightbulb, FileText, Stethoscope, AlertTriangle, MessageSquare, CheckCircle, UserPlus,
} from "lucide-react";

export interface EvidenceDoc {
  id: string;
  name: string;
  category?: string;
  source?: string;
  date?: string;
}

export interface KeyAction { text: string; time?: string; description?: string; evidence?: string[] }

interface EvidenceReviewModalProps {
  open: boolean;
  title: string;          // originating event title
  date?: string;
  time?: string;
  insight: string;
  description: string;
  actions?: KeyAction[];  // key actions within the event
  docs: EvidenceDoc[];
  initialAI?: "actions" | "insights" | "chat" | PanelMode | null; // open directly into a detail view
  // Origin of the event — omitted (or "system") for chronology generated from
  // verified evidence, "user" for an entry the attorney created by hand.
  source?: "system" | "user";
  addedBy?: string;
  addedAt?: string;
  details?: { label: string; value: string }[]; // extra fields captured on creation
  onClose: () => void;
}

type PanelMode = "severity" | "forensic" | "expert";

// ── AI Analysis panels (also reused inline on timeline cards) ─────────────────

export function SeverityPanel() {
  return (
    <div className="rounded-xl border border-[#D6F2F7] bg-[#F6FDFF] p-4">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <h4 className="text-sm font-semibold text-ink">Priority Assessment</h4>
        <span className="pill pill-neutral"><AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} /> Moderate Priority</span>
      </div>
      <div className="eyebrow text-deep mb-2">Liability Priority Assessment</div>
      <p className="body-text leading-relaxed">
        Requires regulatory review. This event has moderate litigation importance and contributes supporting evidence toward liability.
      </p>
    </div>
  );
}

export function ForensicPanel({ insight, description }: { insight: string; description: string }) {
  const sections: [string, string][] = [
    ["Evidence Summary", description],
    ["Medical Interpretation", "Findings are consistent with a traumatic cervical injury showing disc herniation and nerve-root involvement — a significant, objectively documented impairment."],
    ["Legal Significance", "Reinforces the negligence theory and ties the documented harm directly to the defendant's breach of duty."],
    ["Settlement Impact", "Reinforces causation and injury severity, supporting the recommended multiplier and overall settlement value."],
  ];
  return (
    <div className="rounded-xl border border-[#D6F2F7] bg-[#F6FDFF] p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Sparkles className="w-4 h-4 text-deep" strokeWidth={1.75} />
        <h4 className="text-sm font-semibold text-ink">Forensic Analysis</h4>
        <span className="pill pill-neutral">AI Generated</span>
      </div>
      {/* AI Summary — leads the forensic analysis */}
      <div className="rounded-lg border border-[#D6F2F7] bg-white p-3 mb-3">
        <div className="eyebrow text-deep mb-1">AI Summary</div>
        <p className="body-text leading-relaxed">{insight}</p>
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

export function ExpertPanel({ insight: _insight }: { insight: string }) {
  const questions = ["Explain standard of care", "What is the medical causation?", "What future medical costs can we claim?"];
  return (
    <div className="rounded-xl border border-[#D6F2F7] bg-[#F6FDFF] p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-tint flex items-center justify-center shrink-0">
          <Stethoscope className="w-5 h-5 text-deep" strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-ink leading-tight">Dr. Sarah Lin, MD</h4>
          <div className="secondary-text">Forensic Medical Consultant</div>
        </div>
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
          className="flex-1 min-w-0 bg-white border border-[#D6F2F7] rounded-lg px-3 py-2 text-sm text-ink placeholder:text-[#5B6B78] focus:outline-none focus:border-brand transition-colors"
        />
        <button className="btn btn-primary shrink-0">Consult Expert</button>
      </div>
    </div>
  );
}

// AI Insights — concise case-level summary for the selected evidence.
function InsightsView({ docs, onSelectDoc }: { docs: EvidenceDoc[]; onSelectDoc: (i: number) => void }) {
  const keyPoints = [
    "Objective injury finding supports causation.",
    "Treatment dates fall within the injury window.",
    "$18,450 in billing usable for damages.",
  ];
  const details: [string, string][] = [
    ["Provider", "St. Mary's Medical"],
    ["Date", "Jun 2, 2026"],
  ];
  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow text-deep mb-1.5">Summary</div>
        <p className="body-text leading-relaxed">Spinal MRI confirms a herniated L4–L5 disc consistent with the claimed injury.</p>
      </div>
      <div>
        <div className="eyebrow text-deep mb-2">Key Points</div>
        <ul className="space-y-2">
          {keyPoints.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-deep mt-0.5 shrink-0" strokeWidth={1.75} />
              <span className="body-text leading-relaxed">{p}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="eyebrow text-deep mb-2">Key Details</div>
        <div className="rounded-xl border border-line divide-y divide-line">
          {details.map(([l, v]) => (
            <div key={l} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className="text-sm text-[#5B6B78]">{l}</span>
              <span className="text-sm font-medium text-ink text-right">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="eyebrow text-deep mb-2">Supporting Documents</div>
        <div className="flex flex-col gap-2">
          {docs.map((d, idx) => (
            <button key={d.id ?? d.name} onClick={() => onSelectDoc(idx)} className="flex items-center gap-2 rounded-lg border border-line bg-offwhite px-3 py-2 text-sm text-ink text-left hover:border-brand hover:bg-tint transition-all">
              <FileText className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
              <span className="truncate">{d.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Key Actions — detailed view (title, time, description, supporting evidence).
function KeyActionsView({ actions, onJumpToEvidence }: { actions: KeyAction[]; onJumpToEvidence: (label: string) => void }) {
  return (
    <div className="relative">
      {actions.map((a, idx) => {
        const isLast = idx === actions.length - 1;
        return (
          <div key={idx} className="relative flex gap-3 pb-6 last:pb-0">
            {/* Icon + connecting line */}
            <div className="flex flex-col items-center shrink-0">
              <CheckCircle className="w-4 h-4 text-deep mt-0.5 shrink-0" strokeWidth={1.75} />
              {!isLast && <div className="w-px flex-1 bg-line mt-1.5" />}
            </div>
            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-ink leading-snug">{a.text}</div>
              {a.time && <div className="mono-ref mt-0.5">{a.time}</div>}
              {a.description && <p className="body-text leading-relaxed mt-1.5">{a.description}</p>}
              {a.evidence && a.evidence.length > 0 && (
                <div className="mt-2.5">
                  <div className="eyebrow mb-1.5">Evidence</div>
                  <div className="flex flex-wrap gap-1.5">
                    {a.evidence.map((e) => (
                      <button
                        key={e}
                        onClick={() => onJumpToEvidence(e)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-offwhite px-2.5 py-1 text-xs text-ink hover:border-brand hover:bg-tint transition-all"
                      >
                        <FileText className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Chat with AI — a general AI assistant chat that fills the panel height.
function ChatView() {
  const suggestions = ["Summarize this evidence", "What does this prove for liability?", "Draft a note for the file"];
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="flex gap-2.5">
          <div className="w-8 h-8 rounded-full bg-tint flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-deep" strokeWidth={1.75} />
          </div>
          <div className="rounded-xl rounded-tl-sm bg-tint border border-[#D6F2F7] px-3.5 py-2.5 max-w-[85%]">
            <p className="body-text leading-relaxed">Hi — I'm your AI assistant. Ask me anything about this evidence or the case and I'll help you analyze it.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pl-[42px]">
          {suggestions.map((s) => (
            <button key={s} className="inline-flex items-center rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink hover:border-brand hover:bg-tint transition-all">{s}</button>
          ))}
        </div>
      </div>
      <div className="p-4 border-t border-line shrink-0">
        <div className="flex items-center gap-2">
          <input
            placeholder="Ask the AI assistant…"
            className="flex-1 min-w-0 bg-white border border-line rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-[#5B6B78] focus:outline-none focus:border-brand transition-colors"
          />
          <button className="btn btn-primary shrink-0 gap-1.5"><Send className="w-4 h-4" strokeWidth={1.75} /> Send</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function EvidenceReviewModal({ open, title, date, time, insight, description, actions, docs, initialAI, source, addedBy, addedAt, details, onClose }: EvidenceReviewModalProps) {
  const [activeDoc, setActiveDoc] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [page, setPage] = useState(1);
  // Which detail view fills the right panel (null = the context list).
  const [activeView, setActiveView] = useState<"actions" | "insights" | "chat" | PanelMode | null>(null);

  // Reset viewer state when the modal opens (optionally into a specific detail view).
  useEffect(() => {
    if (open) { setActiveDoc(0); setActiveView(initialAI ?? null); }
  }, [open]);
  // Reset per-document view when switching documents.
  useEffect(() => { setPage(1); setZoom(100); setRotation(0); }, [activeDoc]);

  if (!open || docs.length === 0) return null;

  const doc = docs[Math.min(activeDoc, docs.length - 1)];
  const totalPages = 3 + (activeDoc % 3);
  const hasActions = !!(actions && actions.length > 0);

  // Switch the PDF to a document matching an action's evidence label (best-effort).
  const jumpToEvidence = (label: string) => {
    const words = label.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const i = docs.findIndex((d) => words.some((w) => d.name.toLowerCase().includes(w)));
    if (i >= 0) setActiveDoc(i);
  };

  // Event chronology (has key actions) gets a focused toolset; medical keeps the full set.
  const AI_TOOLS: { key: "actions" | "insights" | "chat" | PanelMode; label: string; icon: any }[] = hasActions
    ? [
        { key: "actions", label: "View Key Actions", icon: CheckCircle },
        { key: "insights", label: "AI Insights", icon: Lightbulb },
        { key: "chat", label: "Chat with AI", icon: MessageSquare },
      ]
    : [
        { key: "insights", label: "AI Insights", icon: Lightbulb },
        { key: "severity", label: "Assess Severity", icon: AlertTriangle },
        { key: "forensic", label: "Forensic Analysis", icon: Sparkles },
        { key: "expert", label: "Ask Medical Expert", icon: Stethoscope },
      ];
  const VIEW_LABELS: Record<string, string> = { actions: "Key Actions", insights: "AI Insights", chat: "Chat with AI", severity: "Assess Severity", forensic: "Forensic Analysis", expert: "Ask Medical Expert" };
  const activeLabel = activeView ? VIEW_LABELS[activeView] : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-[90vw] h-[90vh] max-w-[1500px] flex overflow-hidden">

        {/* ── LEFT (60%) — PDF viewer ── */}
        <div className="w-[60%] flex flex-col border-r border-line bg-[#F1F3F5] min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-line shrink-0">
            <FileText className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
            <span className="mono-ref text-ink truncate">{doc.name}</span>
            <div className="ml-auto flex items-center gap-1 shrink-0">
              {/* Page nav */}
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg hover:bg-tint disabled:opacity-40 transition-colors"><ChevronLeft className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} /></button>
              <span className="text-xs tabular-nums text-[#5B6B78] px-1">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg hover:bg-tint disabled:opacity-40 transition-colors"><ChevronRight className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} /></button>
              <span className="w-px h-5 bg-line mx-1" />
              {/* Zoom */}
              <button onClick={() => setZoom((z) => Math.max(50, z - 25))} className="p-1.5 rounded-lg hover:bg-tint transition-colors"><ZoomOut className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} /></button>
              <span className="text-xs tabular-nums text-[#5B6B78] px-1 w-10 text-center">{zoom}%</span>
              <button onClick={() => setZoom((z) => Math.min(200, z + 25))} className="p-1.5 rounded-lg hover:bg-tint transition-colors"><ZoomIn className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} /></button>
              <span className="w-px h-5 bg-line mx-1" />
              {/* Rotate */}
              <button onClick={() => setRotation((r) => (r + 90) % 360)} className="p-1.5 rounded-lg hover:bg-tint transition-colors"><RotateCw className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} /></button>
            </div>
          </div>
          {/* Document chips — switch the active PDF */}
          <div className="px-4 py-2 bg-white border-b border-line shrink-0">
            <div className="flex items-center gap-2 overflow-x-auto">
              {docs.map((d, idx) => {
                const active = idx === activeDoc;
                return (
                  <button
                    key={d.id ?? d.name}
                    onClick={() => setActiveDoc(idx)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm whitespace-nowrap transition-all ${
                      active ? "bg-tint border-brand text-deep shadow-sm" : "bg-white border-line text-ink hover:border-soft hover:bg-wash"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                    <span className="truncate max-w-[200px]">{d.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Page canvas */}
          <div className="flex-1 overflow-auto p-8 flex justify-center items-start">
            <div style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)`, transformOrigin: "top center" }} className="transition-transform duration-200 shrink-0">
              <div className="bg-white shadow-lg border border-line w-[520px] min-h-[700px] p-12 flex flex-col">
                <div className="mono-ref mb-8">{doc.name}</div>
                <h3 className="text-lg font-semibold text-ink mb-1" style={{ fontFamily: "var(--font-display)" }}>{title}</h3>
                <div className="mono-ref mb-6">{doc.category ?? "General Document"} · {doc.source ?? "Attorney Office"}</div>
                <div className="space-y-2.5 flex-1">
                  {Array.from({ length: 12 }).map((_, k) => (
                    <div key={k} className="h-2.5 rounded bg-[#EEF3F6]" style={{ width: `${[100, 96, 88, 92, 70, 100, 84, 95, 60, 90, 80, 45][k]}%` }} />
                  ))}
                </div>
                <div className="mono-ref text-center pt-8">Page {page} of {totalPages}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT (40%) — context list, opens an AI tool detail in place ── */}
        <div className="w-[40%] flex flex-col min-w-0">
          {activeView === null ? (
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
                <h2 className="section-header">Evidence Review</h2>
                <button onClick={onClose} title="Close" className="p-1.5 hover:bg-tint rounded-lg transition-colors"><X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Section 1 — Event Information */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    {(date || time) && <div className="mono-ref">{date}{time ? ` • ${time}` : ""}</div>}
                    {source === "user" ? (
                      <span className="pill pill-neutral shrink-0"><UserPlus className="w-3.5 h-3.5" strokeWidth={1.75} /> User Added</span>
                    ) : (
                      <span className="pill pill-complete shrink-0"><ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.75} /> Verified</span>
                    )}
                  </div>
                  <h3 className="card-title leading-snug">{title}</h3>
                  <p className="body-text leading-relaxed mt-2">{description}</p>

                  {/* Fields captured when the entry was created — secondary to the event itself */}
                  {details && details.length > 0 && (
                    <div className="rounded-xl border border-line divide-y divide-line mt-3">
                      {details.map((d) => (
                        <div key={d.label} className="flex items-start justify-between gap-4 px-4 py-2.5">
                          <span className="text-sm text-[#5B6B78] shrink-0">{d.label}</span>
                          <span className="text-sm font-medium text-ink text-right">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {source === "user" && addedBy && (
                    <p className="text-[11px] text-[#8A98A3] mt-2.5">Added by {addedBy}{addedAt ? ` · ${addedAt}` : ""}</p>
                  )}
                </div>

                {/* Section 2 — Supporting Evidence (switches the PDF) */}
                <div>
                  <div className="eyebrow mb-2.5">Supporting Evidence</div>
                  <div className="flex flex-col gap-2">
                    {docs.map((d, idx) => {
                      const active = idx === activeDoc;
                      return (
                        <button
                          key={d.id ?? d.name}
                          onClick={() => setActiveDoc(idx)}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left transition-all ${
                            active ? "bg-tint border-brand text-deep shadow-sm" : "bg-offwhite border-line text-ink hover:border-soft hover:bg-wash"
                          }`}
                        >
                          <FileText className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
                          <span className="truncate">{d.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section 4 — AI Tools (each opens a detail view in place) */}
                <div>
                  <div className="eyebrow mb-2.5">AI Tools</div>
                  <div className="space-y-2">
                    {AI_TOOLS.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setActiveView(t.key)}
                        className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-line bg-white text-ink hover:border-soft hover:bg-wash transition-colors"
                      >
                        <t.icon className="w-4 h-4 text-deep" strokeWidth={1.75} /> {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Download pinned to the bottom */}
              <div className="p-5 border-t border-line shrink-0">
                <button className="btn btn-secondary w-full gap-2"><Download className="w-4 h-4" strokeWidth={1.75} /> Download</button>
              </div>
            </>
          ) : (
            <>
              {/* Detail header — close (✕) returns to the list */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-line shrink-0">
                <h2 className="section-header truncate">{activeLabel}</h2>
                <button onClick={() => setActiveView(null)} title="Back" className="p-1.5 hover:bg-tint rounded-lg transition-colors shrink-0"><X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} /></button>
              </div>
              {activeView === "chat" ? (
                <ChatView />
              ) : (
                <div className="flex-1 overflow-y-auto p-5">
                  {activeView === "actions" && actions && <KeyActionsView actions={actions} onJumpToEvidence={jumpToEvidence} />}
                  {activeView === "insights" && <InsightsView docs={docs} onSelectDoc={setActiveDoc} />}
                  {activeView === "severity" && <SeverityPanel />}
                  {activeView === "forensic" && <ForensicPanel insight={insight} description={description} />}
                  {activeView === "expert" && <ExpertPanel insight={insight} />}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
