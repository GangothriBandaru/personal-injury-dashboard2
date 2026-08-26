import { useEffect, useRef, useState } from "react";
import {
  Sparkles, X, Send, ChevronDown, Maximize2, Minimize2, Plus, MessageSquare, FileText, Info,
} from "lucide-react";
import { useAssistant } from "./AssistantContext";
import {
  CONTEXTS, contextLabel, suggestionsFor, answer,
  type ContextId, type AssistantAnswer,
} from "./assistantEngine";

// ── AI Assistant ──────────────────────────────────────────────────────────────
// One assistant for the whole dashboard. It defaults to the stage the attorney
// is looking at and widens on request; it never becomes a second, separate chat
// for intake or for the workspace.

interface Message {
  id: string;
  role: "user" | "assistant";
  text?: string;              // user message
  answer?: AssistantAnswer;   // assistant reply
  context: string;            // the scope label this turn used
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

const newConversation = (n: number): Conversation => ({
  id: `c-${n}-${Math.round(performance.now())}`,
  title: "New Chat",
  messages: [],
});

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

function Thread({ messages, thinking }: { messages: Message[]; thinking: boolean }) {
  return (
    <div className="space-y-5">
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="flex justify-end">
            <div className="rounded-xl rounded-tr-sm bg-tint border border-[#D6F2F7] px-3.5 py-2.5 max-w-[85%]">
              <p className="body-text leading-relaxed">{m.text}</p>
            </div>
          </div>
        ) : (
          <div key={m.id} className="flex gap-2.5">
            <div className="w-8 h-8 rounded-full bg-tint flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-deep" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="eyebrow mb-1.5">{m.context}</div>
              <AnswerBlock a={m.answer!} />
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

// ── Context selector ──────────────────────────────────────────────────────────

function ContextSelect({ value, onChange, label }: { value: ContextId; onChange: (c: ContextId) => void; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-line bg-white text-sm font-medium text-ink hover:border-soft transition-colors max-w-full"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#5B6B78] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1.5 z-20 w-[280px] rounded-lg border border-line bg-white shadow-lg p-1">
            {CONTEXTS.map((c) => (
              <button
                key={c.id}
                onClick={() => { onChange(c.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  value === c.id ? "bg-tint" : "hover:bg-wash"
                }`}
              >
                <div className={`text-sm ${value === c.id ? "font-semibold text-deep" : "text-ink"}`}>{c.label}</div>
                <div className="text-[11px] text-[#8A98A3] mt-0.5">{c.blurb}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Composer + suggestions ────────────────────────────────────────────────────

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

// ── Assistant ─────────────────────────────────────────────────────────────────

export function AiAssistant() {
  const { location } = useAssistant();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [ctx, setCtx] = useState<ContextId>("stage");
  const [convos, setConvos] = useState<Conversation[]>([newConversation(1)]);
  const [activeId, setActiveId] = useState<string>("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!activeId && convos[0]) setActiveId(convos[0].id); }, [convos, activeId]);

  const active = convos.find((c) => c.id === activeId) ?? convos[0];
  const label = contextLabel(ctx, location);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.messages.length, thinking]);

  const send = (text: string) => {
    const usedContext = contextLabel(ctx, location);
    const stamp = Math.round(performance.now());
    setConvos((prev) =>
      prev.map((c) =>
        c.id !== active.id ? c : {
          ...c,
          title: c.messages.length === 0 ? (text.length > 38 ? `${text.slice(0, 38)}…` : text) : c.title,
          messages: [...c.messages, { id: `u-${stamp}`, role: "user", text, context: usedContext }],
        },
      ),
    );
    setThinking(true);
    setTimeout(() => {
      const a = answer(text, ctx, location);
      setConvos((prev) =>
        prev.map((c) =>
          c.id !== active.id ? c : {
            ...c,
            messages: [...c.messages, { id: `a-${stamp}`, role: "assistant", answer: a, context: usedContext }],
          },
        ),
      );
      setThinking(false);
    }, 700);
  };

  const startNew = () => {
    const c = newConversation(convos.length + 1);
    setConvos((p) => [c, ...p]);
    setActiveId(c.id);
  };

  const empty = !active || active.messages.length === 0;
  const suggestions = suggestionsFor(ctx, location);

  // ── Launcher ──
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="AI Assistant"
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-line bg-white text-sm font-medium text-deep hover:border-brand hover:bg-tint transition-colors"
      >
        <Sparkles className="w-4 h-4" strokeWidth={1.75} /> AI Assistant
      </button>
    );
  }

  const header = (
    <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line shrink-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
          <h2 className="card-title">AI Assistant</h2>
        </div>
        <div className="mt-2">
          <ContextSelect value={ctx} onChange={setCtx} label={label} />
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setExpanded((e) => !e)}
          title={expanded ? "Collapse" : "Expand to full screen"}
          className="p-1.5 hover:bg-tint rounded-lg transition-colors"
        >
          {expanded
            ? <Minimize2 className="w-4.5 h-4.5 text-[#5B6B78]" strokeWidth={1.75} />
            : <Maximize2 className="w-4.5 h-4.5 text-[#5B6B78]" strokeWidth={1.75} />}
        </button>
        <button onClick={() => { setOpen(false); setExpanded(false); }} title="Close" className="p-1.5 hover:bg-tint rounded-lg transition-colors">
          <X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );

  const conversationPane = (
    <>
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {empty ? (
          <>
            <div className="rounded-xl border border-[#D6F2F7] bg-[#F6FDFF] p-4">
              <p className="body-text leading-relaxed">
                Ask about the case and I will answer from <span className="font-semibold text-deep">{label}</span>.
                Change the scope above to widen or narrow what I read.
              </p>
            </div>
            <Suggestions items={suggestions} onPick={send} />
          </>
        ) : (
          <Thread messages={active.messages} thinking={thinking} />
        )}
        <div ref={endRef} />
      </div>
      <div className="p-4 border-t border-line shrink-0">
        <Composer onSend={send} disabled={thinking} />
        <p className="text-[11px] text-[#8A98A3] mt-2">
          Answers are drawn from this case record. Review before relying on them.
        </p>
      </div>
    </>
  );

  // ── Expanded full-screen workspace ──
  if (expanded) {
    return (
      <>
        <div className="fixed inset-0 bg-ink/50 z-[80]" onClick={() => setExpanded(false)} />
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 pointer-events-none">
          <div className="relative bg-white rounded-2xl shadow-xl w-[92vw] h-[90vh] max-w-[1300px] flex flex-col overflow-hidden pointer-events-auto">
            {header}
            <div className="flex-1 min-h-0 flex">
              {/* Chat history */}
              <aside className="w-[260px] shrink-0 border-r border-line flex flex-col bg-offwhite">
                <div className="p-4 shrink-0">
                  <button onClick={startNew} className="w-full btn btn-secondary gap-1.5">
                    <Plus className="w-4 h-4" strokeWidth={1.75} /> New Chat
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
                  <div className="eyebrow px-2 mb-2">Chat History</div>
                  {convos.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setActiveId(c.id)}
                      className={`w-full flex items-start gap-2 text-left px-2.5 py-2 rounded-lg transition-colors ${
                        c.id === active.id ? "bg-tint text-deep" : "text-ink hover:bg-wash"
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 text-deep" strokeWidth={1.75} />
                      <span className="text-sm truncate">{c.title}</span>
                    </button>
                  ))}
                </div>
              </aside>
              {/* Current conversation */}
              <div className="flex-1 min-w-0 flex flex-col">{conversationPane}</div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Drawer ──
  return (
    <>
      <div className="fixed inset-0 bg-ink/40 z-[80]" onClick={() => setOpen(false)} />
      <div className="fixed top-0 right-0 h-full w-[460px] max-w-[94vw] bg-white shadow-xl z-[80] flex flex-col">
        {header}
        {conversationPane}
      </div>
    </>
  );
}
