import { useEffect, useRef, useState } from "react";
import {
  Sparkles, X, Send, ChevronDown, ChevronRight, Maximize2, Minimize2, Plus,
  MessageSquare, FileText, Info, History, Check, Layers,
} from "lucide-react";
import {
  useAssistant, DRAWER_MIN, DRAWER_DEFAULT, drawerMax, expandThreshold,
  type Message, type WorkStage,
} from "./AssistantContext";
import {
  contextLabel, answer, contextChangeNotice, workStageLabel, effectiveScope, pinnedStage,
  documentsForStage, STAGE_TREE, type ContextSel, type AssistantAnswer, type WorkStageDef,
} from "./assistantEngine";
import { DOC_ACTIONS, documentAction, proposalFor, suggestionsForWork, type DocActionId } from "./documentActions";

// ── AI Assistant ──────────────────────────────────────────────────────────────
// The launcher sits in the top bar; the panel is part of the shell layout, so
// opening it shrinks the dashboard rather than covering it. Two independent
// selections drive it:
//   Context  — how wide the AI may reason
//   Work With — which stage's documents the attorney is handling
// Neither ever navigates the dashboard.

export function AssistantLauncher() {
  const { open, setOpen } = useAssistant();
  return (
    <button
      onClick={() => setOpen(!open)}
      title="AI Assistant"
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
        open ? "border-brand bg-tint text-deep" : "border-line bg-white text-deep hover:border-brand hover:bg-tint"
      }`}
    >
      <Sparkles className="w-4 h-4" strokeWidth={1.75} /> AI Assistant
    </button>
  );
}

// The dashboard body. It shrinks when the drawer opens and steps aside entirely
// when the assistant is expanded, so the assistant never overlays the app.
export function AssistantMain({ children }: { children: React.ReactNode }) {
  const { open, expanded } = useAssistant();
  if (open && expanded) return null;
  return <main className="flex-1 min-w-0 overflow-auto">{children}</main>;
}

// ── Message rendering ─────────────────────────────────────────────────────────

function AnswerBlock({ a }: { a: AssistantAnswer }) {
  return (
    <div className="space-y-3">
      <p className="body-text leading-relaxed">{a.headline}</p>
      {a.points.length > 0 && (
        <ul className="space-y-1.5">
          {a.points.map((p, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-deep mt-[7px] shrink-0" />
              <span className="body-text leading-relaxed">{p}</span>
            </li>
          ))}
        </ul>
      )}
      {a.citations.length > 0 && (
        <div>
          <div className="eyebrow mb-1.5">Sources</div>
          <div className="flex flex-wrap gap-1.5">
            {a.citations.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-xs text-ink">
                <FileText className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> {c}
              </span>
            ))}
          </div>
        </div>
      )}
      {a.caveat && (
        <p className="flex items-start gap-1.5 text-[11px] text-[#8A98A3] leading-relaxed">
          <Info className="w-3 h-3 shrink-0 mt-0.5" strokeWidth={1.75} /> {a.caveat}
        </p>
      )}
    </div>
  );
}

// A proposed document change. Never applied on its own — the attorney reviews
// the before/after and applies it explicitly.
function Proposal({ m, onApply }: { m: Message; onApply: (id: string) => void }) {
  const p = m.proposal!;
  const [review, setReview] = useState(false);
  return (
    <div className="rounded-xl border border-[#FDE6C8] bg-[#FFF7ED] p-4 mt-3">
      <div className="eyebrow text-[#B45309] mb-2.5">Proposed Change</div>
      <div className="rounded-lg border border-[#FDE6C8] bg-white divide-y divide-[#FDE6C8]">
        <div className="flex items-start justify-between gap-4 px-3 py-2">
          <span className="text-sm text-[#5B6B78] shrink-0">Document</span>
          <span className="mono-ref text-ink text-right">{p.doc}</span>
        </div>
        <div className="flex items-start justify-between gap-4 px-3 py-2">
          <span className="text-sm text-[#5B6B78] shrink-0">Section</span>
          <span className="text-sm font-medium text-ink text-right">{p.section}</span>
        </div>
        <div className="flex items-start justify-between gap-4 px-3 py-2">
          <span className="text-sm text-[#5B6B78] shrink-0">Current</span>
          <span className="text-sm text-ink text-right">{p.current}</span>
        </div>
        <div className="flex items-start justify-between gap-4 px-3 py-2">
          <span className="text-sm text-[#5B6B78] shrink-0">Proposed</span>
          <span className="text-sm font-semibold text-ink text-right">{p.proposed}</span>
        </div>
      </div>
      {review && (
        <p className="text-[11px] text-[#8A98A3] mt-2.5 leading-relaxed">
          Applying this updates the {p.section.toLowerCase()} on {p.doc} from {p.current} to {p.proposed}. Nothing else on the document changes.
        </p>
      )}
      {p.state === "pending" ? (
        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => setReview((r) => !r)} className="btn btn-secondary px-3 py-2 text-sm">
            {review ? "Hide Change" : "Review Change"}
          </button>
          <button onClick={() => onApply(m.id)} className="btn btn-primary px-3 py-2 text-sm">Apply Change</button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mt-3 text-xs font-medium text-[#5B6B78]">
          <Check className="w-3.5 h-3.5 text-[#15803D]" strokeWidth={2} /> Applied by you
        </div>
      )}
    </div>
  );
}

function Thread({ messages, thinking, onApply }: { messages: Message[]; thinking: boolean; onApply: (id: string) => void }) {
  return (
    <div className="space-y-5">
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[85%]">
              <div className="rounded-xl rounded-tr-sm bg-tint border border-[#D6F2F7] px-3.5 py-2.5">
                <p className="body-text leading-relaxed">{m.text}</p>
              </div>
              {m.usingDocs && m.usingDocs.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-end mt-1.5">
                  <span className="text-[11px] text-[#8A98A3]">using</span>
                  {m.usingDocs.map((d) => (
                    <span key={d} className="text-[11px] text-[#8A98A3]">{d}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div key={m.id} className="flex gap-2.5">
            <div className="w-8 h-8 rounded-full bg-tint flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-deep" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="eyebrow mb-1.5">{m.role === "system" ? (m.noticeLabel ?? "Context changed") : m.context}</div>
              <AnswerBlock a={m.answer!} />
              {m.proposal && <Proposal m={m} onApply={onApply} />}
            </div>
          </div>
        ),
      )}
      {thinking && (
        <div className="flex gap-2.5">
          <div className="w-8 h-8 rounded-full bg-tint flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-deep animate-pulse" strokeWidth={1.75} />
          </div>
          <div className="secondary-text pt-1.5">Reviewing the case record…</div>
        </div>
      )}
    </div>
  );
}

// ── Selectors ─────────────────────────────────────────────────────────────────

function ContextSelect({ value, onChange, label }: { value: ContextSel; onChange: (c: ContextSel) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const Row = ({ on, text, onPick, indent }: { on: boolean; text: string; onPick: () => void; indent?: boolean }) => (
    <button
      onClick={() => { onPick(); setOpen(false); }}
      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${indent ? "pl-6" : ""} ${
        on ? "bg-tint text-deep font-medium" : "text-ink hover:bg-wash"
      }`}
    >
      {text}
    </button>
  );
  return (
    <div className="relative min-w-0 flex-1">
      <div className="eyebrow mb-1.5">Context</div>
      <button
        onClick={() => setOpen((o) => !o)}
        title="What the AI reasons over"
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-line bg-white text-sm font-medium text-ink hover:border-soft transition-colors"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#5B6B78] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-1.5 z-20 max-h-[360px] overflow-y-auto rounded-lg border border-line bg-white shadow-lg p-1">
            <div className="eyebrow px-3 pt-2 pb-1">Current Stage</div>
            <Row on={value.kind === "current"} text={label.replace("Current Stage · ", "")} onPick={() => onChange({ kind: "current" })} indent />
            {STAGE_TREE.map((group) => (
              <div key={group.pipeline}>
                <div className="eyebrow px-3 pt-3 pb-1">{group.label}</div>
                <Row
                  on={value.kind === group.pipeline}
                  text={`All of ${group.label}`}
                  onPick={() => onChange({ kind: group.pipeline })}
                  indent
                />
                {group.stages.map((st) => (
                  <Row
                    key={st.key}
                    on={value.kind === "stage" && value.stage.key === st.key}
                    text={st.label}
                    onPick={() => onChange({ kind: "stage", stage: st })}
                    indent
                  />
                ))}
              </div>
            ))}
            <div className="eyebrow px-3 pt-3 pb-1">Whole case</div>
            <Row on={value.kind === "case"} text="Entire Case" onPick={() => onChange({ kind: "case" })} indent />
            <Row on={value.kind === "global"} text="Global" onPick={() => onChange({ kind: "global" })} indent />
          </div>
        </>
      )}
    </div>
  );
}

function WorkWithSelect({ value, label, onChange }: { value: WorkStage | null; label: string; onChange: (w: WorkStage | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative min-w-0 flex-1">
      <div className="eyebrow mb-1.5 flex items-center gap-1.5">
        <Layers className="w-3 h-3 text-deep shrink-0" strokeWidth={1.75} /> Work With
      </div>
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          title="Which stage's documents the AI can use. This does not navigate the dashboard."
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            value ? "border-brand bg-tint text-deep" : "border-line bg-white text-ink hover:border-soft"
          }`}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className={`w-4 h-4 text-[#5B6B78] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 right-0 mt-1.5 z-20 max-h-[320px] overflow-y-auto rounded-lg border border-line bg-white shadow-lg p-1">
              <button
                onClick={() => { onChange(null); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${!value ? "bg-tint text-deep font-medium" : "text-ink hover:bg-wash"}`}
              >
                Follow my current page
              </button>
              {STAGE_TREE.map((group) => (
                <div key={group.pipeline}>
                  <div className="eyebrow px-3 pt-3 pb-1.5">{group.label}</div>
                  {group.stages.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => { onChange(s); setOpen(false); }}
                      className={`w-full flex items-center gap-1.5 text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        value?.key === s.key ? "bg-tint text-deep font-medium" : "text-ink hover:bg-wash"
                      }`}
                    >
                      <ChevronRight className="w-3 h-3 text-[#9BA8B4] shrink-0" strokeWidth={2} /> {s.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Document picker + actions ─────────────────────────────────────────────────

function DocumentPanel({
  docs, selected, onToggle, onSelectAll, onAction,
}: {
  docs: { id: string; name: string }[];
  selected: string[];
  onToggle: (n: string) => void;
  onSelectAll: () => void;
  onAction: (a: DocActionId) => void;
}) {
  if (docs.length === 0) {
    return <p className="secondary-text">No documents are available from this stage yet.</p>;
  }
  const allOn = selected.length === docs.length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="eyebrow">Documents</div>
        <button onClick={onSelectAll} className="text-xs font-semibold text-deep hover:text-ink transition-colors">
          {allOn ? "Clear all" : "Select All"}
        </button>
      </div>
      <div className="rounded-xl border border-line bg-white divide-y divide-line max-h-[220px] overflow-y-auto">
        {docs.map((d) => {
          const on = selected.includes(d.name);
          return (
            <button
              key={d.id ?? d.name}
              onClick={() => onToggle(d.name)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-wash transition-colors"
            >
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                on ? "bg-brand border-brand" : "border-line bg-white"
              }`}>
                {on && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </span>
              <FileText className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
              <span className="mono-ref text-ink truncate">{d.name}</span>
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div>
          <div className="eyebrow mb-2">{selected.length} selected · actions</div>
          <div className="flex flex-wrap gap-1.5">
            {DOC_ACTIONS.filter((a) => !a.needsTwo || selected.length >= 2).map((a) => (
              <button
                key={a.id}
                onClick={() => onAction(a.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-deep hover:border-brand hover:bg-tint transition-colors"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Suggestions({ items, onPick }: { items: string[]; onPick: (s: string) => void }) {
  return (
    <div>
      <div className="eyebrow mb-2">Suggested questions</div>
      <div className="flex flex-col gap-2">
        {items.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="text-left rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink hover:border-brand hover:bg-tint transition-all"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Composer({ onSend, disabled }: { onSend: (t: string) => void; disabled: boolean }) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    setText("");
    onSend(t);
  };
  return (
    <div className="flex items-end gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        rows={1}
        placeholder="Ask anything about this case…"
        className="flex-1 min-w-0 resize-none bg-white border border-line rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-[#9BA8B4] focus:outline-none focus:border-brand transition-colors"
      />
      <button onClick={submit} disabled={disabled} className="btn btn-primary shrink-0 gap-1.5 disabled:opacity-50">
        <Send className="w-4 h-4" strokeWidth={1.75} /> Send
      </button>
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function AssistantPanel() {
  const {
    location, documents, findings, open, setOpen, expanded, setExpanded, width, setWidth,
    context, setContext, workWith, setWorkWith, selectedDocs, setSelectedDocs,
    conversations, activeId, setActiveId, setConversations, newConversation,
  } = useAssistant();

  const [thinking, setThinking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const ctxLabel = contextLabel(context, location);
  const workLabel = workStageLabel(workWith, location);
  const stageDocs = documentsForStage(workWith, documents, findings);
  const suggestions = suggestionsForWork(effectiveScope(context), location, workWith ?? pinnedStage(context));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.messages.length, thinking]);

  // Expanded keeps history in the sidebar, so the header button is drawer-only.
  useEffect(() => { if (expanded) setShowHistory(false); }, [expanded]);

  // Dragging the left edge resizes the drawer; the dashboard reflows around it.
  // Crossing the threshold hands over to the expanded workspace, so resizing
  // and expanding read as one gesture.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const next = window.innerWidth - e.clientX;
      if (next >= expandThreshold()) {
        setDragging(false);
        setExpanded(true);
        setWidth(DRAWER_DEFAULT);
        return;
      }
      setWidth(Math.min(drawerMax(), Math.max(DRAWER_MIN, next)));
    };
    const stop = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [dragging, setExpanded, setWidth]);

  if (!open) return null;

  const push = (m: Message) =>
    setConversations((prev) =>
      prev.map((c) =>
        c.id !== active.id ? c : {
          ...c,
          title: c.messages.length === 0 && m.role === "user" && m.text
            ? (m.text.length > 34 ? `${m.text.slice(0, 34)}…` : m.text)
            : c.title,
          contextLabel: ctxLabel,
          messages: [...c.messages, m],
        },
      ),
    );

  // Only a genuine change of reasoning scope produces a message. Work With and
  // document selection are UI state and stay silent.
  const changeContext = (sel: ContextSel) => {
    if (JSON.stringify(sel) === JSON.stringify(context)) return;
    setContext(sel);
    push({
      id: `s-${Math.round(performance.now())}-${Math.random()}`,
      role: "system",
      answer: contextChangeNotice(sel, location),
      context: contextLabel(sel, location),
      noticeLabel: "Context changed",
    });
  };

  const changeWorkWith = (w: WorkStageDef | null) => {
    setWorkWith(w);
    setSelectedDocs([]);
    setDocsOpen(true);
  };

  const send = (text: string) => {
    const id = Math.round(performance.now());
    push({ id: `u-${id}`, role: "user", text, context: ctxLabel, usingDocs: selectedDocs.length ? selectedDocs : undefined });
    setThinking(true);
    setShowHistory(false);
    setTimeout(() => {
      push({ id: `a-${id}`, role: "assistant", answer: answer(text, effectiveScope(context), location), context: ctxLabel });
      setThinking(false);
    }, 700);
  };

  const runAction = (act: DocActionId) => {
    const id = Math.round(performance.now());
    const label = DOC_ACTIONS.find((d) => d.id === act)!.label;
    push({ id: `u-${id}`, role: "user", text: `${label} the selected documents`, context: ctxLabel, usingDocs: [...selectedDocs] });
    setThinking(true);
    setShowHistory(false);
    setDocsOpen(false);
    setTimeout(() => {
      const ans = documentAction(act, selectedDocs, workLabel);
      const proposal = act === "tags" ? proposalFor(selectedDocs[0]) : null;
      push({
        id: `a-${id}`, role: "assistant", answer: ans, context: ctxLabel,
        proposal: proposal ? { ...proposal, state: "pending" } : undefined,
      });
      setThinking(false);
    }, 700);
  };

  const applyProposal = (msgId: string) =>
    setConversations((prev) =>
      prev.map((c) =>
        c.id !== active.id ? c : {
          ...c,
          messages: c.messages.map((m) =>
            m.id !== msgId || !m.proposal ? m : { ...m, proposal: { ...m.proposal, state: "applied" } },
          ),
        },
      ),
    );

  const toggleDoc = (n: string) =>
    setSelectedDocs(selectedDocs.includes(n) ? selectedDocs.filter((x) => x !== n) : [...selectedDocs, n]);

  const empty = !active || active.messages.length === 0;

  const header = (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
        <h2 className="card-title truncate">AI Assistant</h2>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!expanded && (
          <button
            onClick={() => setShowHistory((h) => !h)}
            title="Chat history"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showHistory ? "bg-tint text-deep" : "text-[#5B6B78] hover:bg-tint hover:text-ink"
            }`}
          >
            <History className="w-3.5 h-3.5" strokeWidth={1.75} /> History
          </button>
        )}
        <button onClick={() => setExpanded(!expanded)} title={expanded ? "Collapse" : "Expand"} className="p-1.5 hover:bg-tint rounded-lg transition-colors">
          {expanded
            ? <Minimize2 className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} />
            : <Maximize2 className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} />}
        </button>
        <button onClick={() => { setOpen(false); setExpanded(false); }} title="Close" className="p-1.5 hover:bg-tint rounded-lg transition-colors">
          <X className="w-4.5 h-4.5 text-[#5B6B78]" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );

  // Compact toolbar. Two inline selects plus a one-row document disclosure —
  // the conversation keeps the rest of the height.
  const toolbar = (
    <div className="px-4 py-2.5 border-b border-line shrink-0 space-y-2">
      <div className={`flex gap-2 ${expanded ? "flex-row" : "flex-col"}`}>
        <ContextSelect value={context} onChange={changeContext} label={ctxLabel} />
        <WorkWithSelect value={workWith} label={workLabel} onChange={changeWorkWith} />
      </div>
      <button
        onClick={() => setDocsOpen((d) => !d)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-ink hover:bg-wash transition-colors"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <FileText className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
          <span className="truncate">
            Documents · {selectedDocs.length} selected
            <span className="text-[#8A98A3]"> of {stageDocs.length}</span>
          </span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#5B6B78] shrink-0 transition-transform ${docsOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
      </button>
      {docsOpen && (
        <DocumentPanel
          docs={stageDocs}
          selected={selectedDocs}
          onToggle={toggleDoc}
          onSelectAll={() => setSelectedDocs(selectedDocs.length === stageDocs.length ? [] : stageDocs.map((d) => d.name))}
          onAction={runAction}
        />
      )}
    </div>
  );

  // Drawer-only history view. Titles only, no state descriptions.
  const historyPanel = (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
      <div className="flex items-center justify-between gap-2">
        <div className="eyebrow">Chat History</div>
        <button onClick={() => { newConversation(ctxLabel); setShowHistory(false); }} className="btn btn-secondary px-3 py-1.5 text-sm gap-1.5">
          <Plus className="w-3.5 h-3.5" strokeWidth={1.75} /> New Chat
        </button>
      </div>
      <div className="space-y-1">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => { setActiveId(c.id); setShowHistory(false); }}
            className={`w-full flex items-center gap-2 text-left rounded-lg px-3 py-2.5 transition-colors ${
              c.id === active.id ? "bg-tint text-deep" : "text-ink hover:bg-wash"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
            <span className="text-sm truncate">{c.title}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const conversationPane = (
    <>
      {toolbar}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 min-h-0">
        {empty ? (
          <Suggestions items={suggestions} onPick={send} />
        ) : (
          <Thread messages={active.messages} thinking={thinking} onApply={applyProposal} />
        )}
        <div ref={endRef} />
      </div>
      <div className="p-3 border-t border-line shrink-0">
        <Composer onSend={send} disabled={thinking} />
      </div>
    </>
  );

  // Expanded is a full workspace inside the dashboard viewport with a
  // ChatGPT-style history sidebar. Collapsed is a resizable drawer the
  // dashboard reflows around. Neither overlays the application.
  return (
    <aside
      style={expanded ? undefined : { width }}
      className={`relative shrink-0 border-l border-line bg-white flex flex-col min-h-0 ${
        expanded ? "flex-1 w-full border-l-0" : ""
      }`}
    >
      {!expanded && (
        <div
          onPointerDown={(e) => { e.preventDefault(); setDragging(true); }}
          onDoubleClick={() => setWidth(DRAWER_DEFAULT)}
          title="Drag to resize · drag fully left to expand"
          className={`absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 z-30 cursor-col-resize group ${dragging ? "bg-brand" : "hover:bg-soft"}`}
        >
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-1 rounded-full bg-line group-hover:bg-brand transition-colors" />
        </div>
      )}
      {header}
      {expanded ? (
        <div className="flex-1 min-h-0 flex">
          <div className="w-[240px] shrink-0 border-r border-line bg-offwhite flex flex-col min-h-0">
            <div className="p-4 shrink-0">
              <button onClick={() => newConversation(ctxLabel)} className="w-full btn btn-secondary gap-1.5">
                <Plus className="w-4 h-4" strokeWidth={1.75} /> New Chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-4 min-h-0">
              <div className="eyebrow px-2 mb-2">Chat History</div>
              <div className="space-y-1">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-lg transition-colors ${
                      c.id === active.id ? "bg-tint text-deep" : "text-ink hover:bg-wash"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 text-deep" strokeWidth={1.75} />
                    <span className="text-sm truncate">{c.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col min-h-0">{conversationPane}</div>
        </div>
      ) : (
        showHistory ? historyPanel : conversationPane
      )}
    </aside>
  );
}
