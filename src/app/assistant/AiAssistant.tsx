import { useEffect, useRef, useState } from "react";
import {
  Sparkles, X, Send, ChevronDown, ChevronRight, Maximize2, Minimize2, Plus,
  MessageSquare, FileText, Info, History, Check, Layers,
} from "lucide-react";
import {
  useAssistant, DRAWER_MIN, DRAWER_DEFAULT, drawerMax, expandThreshold,
  type Message, type WorkStage, type DamageState,
} from "./AssistantContext";
import {
  contextLabel, answer, contextChangeNotice, workStageLabel, effectiveScope, pinnedStage,
  documentsForStage, globalSource, STAGE_TREE, GLOBAL_SOURCES,
  type ContextSel, type AssistantAnswer, type WorkStageDef,
} from "./assistantEngine";
import { DOC_ACTIONS, documentAction, proposalFor, suggestionsForWork, type DocActionId } from "./documentActions";
import { ProposedEvent, ProposedEdit } from "./ChronologyProposal";
import {
  detectIntent, missingCandidates, findEdit, toAddition, parseRequestedEvent,
  type ChronCandidate, type ChronEdit,
} from "./chronologyActions";
import { useChronologyOptional, versionStamp, type ChronVersion } from "../chronology/ChronologyContext";
import {
  useDamagesOptional, aiActor, formatDamageUSD, DAMAGE_FIELD_LABEL,
  type DamageItem, type FieldChange,
} from "../damages/DamagesContext";
import {
  detectDamageIntent, buildEditProposal, buildAddProposal, buildDeleteProposal, buildMoveProposal,
  findDamage, namesDamage, missingDamages, figureFromDocuments, proposalFromSuggestion,
  type DamageAddProposal, type DamageDeleteProposal, type DamageEditProposal,
  type DamageMoveProposal, type DamageSuggestion,
} from "./damagesActions";
import {
  ProposedDamageAdd, ProposedDamageDelete, ProposedDamageEdit, ProposedDamageMove, SuggestedDamage,
} from "./DamageProposal";
import { CHRONOLOGY_TITLES, CURRENT_USER as CURRENT_ATTORNEY, documentAmount } from "../workspace/WorkspaceTabs";

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
// Hidden rather than unmounted: unmounting would reset the page, dropping the
// attorney back to the first stage when they collapse the assistant again.
export function AssistantMain({ children }: { children: React.ReactNode }) {
  const { open, expanded } = useAssistant();
  const hidden = open && expanded;
  return <main className={hidden ? "hidden" : "flex-1 min-w-0 overflow-auto"}>{children}</main>;
}

// ── Message rendering ─────────────────────────────────────────────────────────

function AnswerBlock({ a, confirmed = false }: { a: AssistantAnswer; confirmed?: boolean }) {
  return (
    <div className="space-y-3">
      <p className="body-text leading-relaxed">
        {confirmed && <Check className="w-4 h-4 text-[#15803D] inline-block mr-1.5 -mt-0.5" strokeWidth={2.25} />}
        {a.headline}
      </p>
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

// When an instruction names something the record does not hold, or leaves out
// what the change should be, the assistant asks rather than guessing. Guessing
// here would mean editing the wrong damage.
function damageAskBack(
  error: "no-damage" | "no-field" | "no-value",
  target: string | undefined,
  items: DamageItem[],
): AssistantAnswer {
  const names = items.map((i) => i.label);
  if (error === "no-damage") {
    return {
      headline: target
        ? `I could not find a damage matching “${target}” on this case.`
        : "Tell me which damage you mean.",
      points: names.length > 0 ? [`On file: ${names.join(", ")}.`] : [],
      citations: [],
    };
  }
  if (error === "no-field") {
    return {
      headline: `What should I change on ${target} — the amount, the description, the damage type, the supporting information, the supporting evidence, or a note?`,
      points: [], citations: [],
    };
  }
  return {
    headline: `What should ${target} be changed to?`,
    points: [], citations: [],
  };
}

// Every damage action the thread can hand back to the panel. Grouped so the
// signature stays readable as the set grows.
export interface DamageHandlers {
  onDamageEdit: (msgId: string, p: DamageEditProposal) => void;
  onDamageAdd: (msgId: string, p: DamageAddProposal) => void;
  onDamageDelete: (msgId: string, p: DamageDeleteProposal) => void;
  onDamageMove: (msgId: string, p: DamageMoveProposal) => void;
  onDamageCancel: (msgId: string, kind: "edit" | "add" | "delete" | "move") => void;
  onReviewSuggestion: (msgId: string, index: number, s: DamageSuggestion) => void;
  onDismissSuggestion: (msgId: string, index: number) => void;
}

function Thread({
  messages, thinking, onApply, onAddEvent, onApplyEdit, damage,
}: {
  messages: Message[]; thinking: boolean; onApply: (id: string) => void;
  onAddEvent: (msgId: string, index: number, c: ChronCandidate) => void;
  onApplyEdit: (msgId: string, e: ChronEdit) => void;
  damage: DamageHandlers;
}) {
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
              {/* Only a scope-change notice is labelled. The current context is
                  already on screen in the toolbar, so repeating it on every
                  reply is noise. */}
              {m.role === "system" && (
                <div className="eyebrow mb-1.5">{m.noticeLabel ?? "Context changed"}</div>
              )}
              <AnswerBlock a={m.answer!} confirmed={!!m.stamp} />
              {m.proposal && <Proposal m={m} onApply={onApply} />}
              {m.chronoAdds?.map((p, i) => (
                <ProposedEvent
                  key={p.candidate.title}
                  candidate={p.candidate}
                  state={p.state}
                  source={p.source}
                  onAdd={(c) => onAddEvent(m.id, i, c)}
                />
              ))}
              {m.chronoEdit && (
                <ProposedEdit edit={m.chronoEdit.edit} state={m.chronoEdit.state} onApply={(e) => onApplyEdit(m.id, e)} />
              )}
              {m.damageEdit && (
                <ProposedDamageEdit
                  proposal={m.damageEdit.proposal}
                  state={m.damageEdit.state}
                  onApply={(p) => damage.onDamageEdit(m.id, p)}
                  onCancel={() => damage.onDamageCancel(m.id, "edit")}
                />
              )}
              {m.damageAdd && (
                <ProposedDamageAdd
                  proposal={m.damageAdd.proposal}
                  state={m.damageAdd.state}
                  onAdd={(p) => damage.onDamageAdd(m.id, p)}
                  onCancel={() => damage.onDamageCancel(m.id, "add")}
                />
              )}
              {m.damageDelete && (
                <ProposedDamageDelete
                  proposal={m.damageDelete.proposal}
                  state={m.damageDelete.state}
                  onDelete={(p) => damage.onDamageDelete(m.id, p)}
                  onCancel={() => damage.onDamageCancel(m.id, "delete")}
                />
              )}
              {m.damageMove && (
                <ProposedDamageMove
                  proposal={m.damageMove.proposal}
                  state={m.damageMove.state}
                  onMove={(p) => damage.onDamageMove(m.id, p)}
                  onCancel={() => damage.onDamageCancel(m.id, "move")}
                />
              )}
              {m.damageSuggest?.map((sg, i) => (
                <SuggestedDamage
                  key={sg.suggestion.label}
                  suggestion={sg.suggestion}
                  state={sg.state}
                  onReview={(x) => damage.onReviewSuggestion(m.id, i, x)}
                  onDismiss={() => damage.onDismissSuggestion(m.id, i)}
                />
              ))}
              {/* Provenance footer on a confirmation — how the record changed
                  and where, in the same words the stage uses. */}
              {m.stamp && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  <span className="pill pill-neutral"><Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} /> {m.stamp.provenance}</span>
                  <span className="text-[11px] text-[#8A98A3]">{m.stamp.where}</span>
                </div>
              )}
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

// ── Dropdown building blocks ──────────────────────────────────────────────────
// Both selectors are simple navigation trees: pipelines stay collapsed until
// the attorney opens one, so neither menu takes over the drawer.

// Level 3 — a selectable context. Deliberately lighter than the headings above
// it so the menu reads heading → category → context at a glance. `deep` indents
// it one step further, for a context sitting two levels down.
function MenuRow({
  on, text, onPick, deep = false,
}: { on: boolean; text: string; onPick: () => void; deep?: boolean }) {
  return (
    <button
      onClick={onPick}
      className={`w-full text-left ${deep ? "pl-10" : "pl-7"} pr-3 py-1.5 rounded-md text-[13px] transition-colors ${
        on ? "bg-tint text-deep font-medium" : "text-[#5B6B78] hover:bg-wash hover:text-ink"
      }`}
    >
      {text}
    </button>
  );
}

// Level 1 — a main heading. The strongest text in the menu, with the chevron
// right-aligned: right = collapsed, down = expanded.
function MenuGroup({
  label, expanded, onToggle, children,
}: { label: string; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-1.5 first:mt-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-left hover:bg-wash transition-colors"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink">{label}</span>
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-[#5B6B78] shrink-0" strokeWidth={1.75} />
          : <ChevronRight className="w-3.5 h-3.5 text-[#5B6B78] shrink-0" strokeWidth={1.75} />}
      </button>
      {expanded && <div>{children}</div>}
    </div>
  );
}

// Level 2 — a category inside a main heading. Indented and lighter than the
// heading above it, so the two never read as the same rank.
function MenuSubGroup({
  label, expanded, onToggle, children,
}: { label: string; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-1 first:mt-0.5">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 pl-6 pr-3 py-1.5 rounded-md text-left hover:bg-wash transition-colors"
      >
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#5B6B78]">{label}</span>
        {expanded
          ? <ChevronDown className="w-3 h-3 text-[#8FA3AF] shrink-0" strokeWidth={1.75} />
          : <ChevronRight className="w-3 h-3 text-[#8FA3AF] shrink-0" strokeWidth={1.75} />}
      </button>
      {expanded && <div>{children}</div>}
    </div>
  );
}

// Level 1 that is itself the context — Entire Case has nothing beneath it, so
// it carries heading weight and is picked directly rather than expanded.
function MenuHeadingRow({
  on, label, onPick,
}: { on: boolean; label: string; onPick: () => void }) {
  return (
    <div className="mt-1.5 first:mt-0">
      <button
        onClick={onPick}
        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-left transition-colors ${
          on ? "bg-tint" : "hover:bg-wash"
        }`}
      >
        <span className={`text-[11px] font-semibold uppercase tracking-[0.06em] ${on ? "text-deep" : "text-ink"}`}>{label}</span>
        {on && <Check className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={2} />}
      </button>
    </div>
  );
}

// A category that is always open — Current Stage, which reflects where the
// attorney actually is and so is never hidden behind a chevron.
function MenuSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-1.5 first:mt-0">
      <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink">{label}</div>
      {children}
    </div>
  );
}

// Context — what the AI reasons over.
function ContextSelect({
  value, onChange, label, here,
}: {
  value: ContextSel;
  onChange: (c: ContextSel) => void;
  label: string;
  /** Where the attorney actually is — independent of the selected context. */
  here: string;
}) {
  // Two levels of disclosure, each an accordion: one main heading open at a
  // time, and inside Case one pipeline at a time.
  const [open, setOpen] = useState(false);
  const [heading, setHeading] = useState<"case" | "global" | null>(null);
  const [pipeline, setPipeline] = useState<string | null>(null);
  const closeMenu = () => { setOpen(false); setHeading(null); setPipeline(null); };
  const pick = (c: ContextSel) => { onChange(c); closeMenu(); };
  const toggleHeading = (h: "case" | "global") =>
    setHeading((prev) => {
      if (prev === h) { setPipeline(null); return null; }
      setPipeline(null);
      return h;
    });

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
          <div className="fixed inset-0 z-10" onClick={closeMenu} />
          <div className="absolute left-0 right-0 mt-1.5 z-20 max-h-[320px] overflow-y-auto rounded-lg border border-line bg-white shadow-lg p-1">
            {/* Where the attorney actually is. Kept out of the Case hierarchy
                because it follows the dashboard rather than being chosen. */}
            <MenuSection label="Current Stage">
              <MenuRow on={value.kind === "current"} text={here} onPick={() => pick({ kind: "current" })} />
            </MenuSection>

            {/* Case — one parent over both pipelines, so the menu reads
                heading → pipeline → stage all the way down. */}
            <MenuGroup label="Case" expanded={heading === "case"} onToggle={() => toggleHeading("case")}>
              {STAGE_TREE.map((group) => (
                <MenuSubGroup
                  key={group.pipeline}
                  label={group.label}
                  expanded={pipeline === group.pipeline}
                  onToggle={() => setPipeline((p) => (p === group.pipeline ? null : group.pipeline))}
                >
                  <MenuRow
                    deep
                    on={value.kind === group.pipeline}
                    text={`All of ${group.label}`}
                    onPick={() => pick({ kind: group.pipeline })}
                  />
                  {group.stages.map((st) => (
                    <MenuRow
                      key={st.key}
                      deep
                      on={value.kind === "stage" && value.stage.key === st.key}
                      text={st.label}
                      onPick={() => pick({ kind: "stage", stage: st })}
                    />
                  ))}
                </MenuSubGroup>
              ))}
            </MenuGroup>

            {/* Both pipelines at once. Nothing sits beneath it, so it is a
                heading the attorney picks rather than one they open. */}
            <MenuHeadingRow
              on={value.kind === "case"}
              label="Entire Case"
              onPick={() => pick({ kind: "case" })}
            />

            {/* Research sources outside this case file. */}
            <MenuGroup label="Global" expanded={heading === "global"} onToggle={() => toggleHeading("global")}>
              {GLOBAL_SOURCES.map((src) => (
                <MenuRow
                  key={src.id}
                  on={value.kind === "global" && value.source === src.id}
                  text={src.label}
                  onPick={() => pick({ kind: "global", source: src.id })}
                />
              ))}
            </MenuGroup>
          </div>
        </>
      )}
    </div>
  );
}

// Work With — whose documents the AI can reach. Same tree, but the stage the
// attorney is already on sits at the top and is not repeated in its pipeline.
function WorkWithSelect({
  value, label, currentStageKey, onChange,
}: {
  value: WorkStage | null;
  label: string;
  currentStageKey?: string;
  onChange: (w: WorkStage | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpandedGroup] = useState<string | null>(null);
  const pick = (w: WorkStage | null) => { onChange(w); setOpen(false); setExpandedGroup(null); };

  return (
    <div className="relative min-w-0 flex-1">
      <div className="eyebrow mb-1.5 flex items-center gap-1.5">
        <Layers className="w-3 h-3 text-deep shrink-0" strokeWidth={1.75} /> Work With
      </div>
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
            <MenuSection label="Current Stage">
              <MenuRow
                on={!value}
                text={label.replace(/ · (Case Intake|Case Workspace)$/, "")}
                onPick={() => pick(null)}
              />
            </MenuSection>

            {STAGE_TREE.map((group) => {
              // The stage the attorney is already on is offered above, so it is
              // not repeated inside its own pipeline.
              const stages = group.stages.filter((s) => s.key !== currentStageKey);
              if (stages.length === 0) return null;
              return (
                <MenuGroup
                  key={group.pipeline}
                  label={group.label}
                  expanded={expanded === group.pipeline}
                  onToggle={() => setExpandedGroup((e) => (e === group.pipeline ? null : group.pipeline))}
                >
                  {stages.map((st) => (
                    <MenuRow
                      key={st.key}
                      on={value?.key === st.key}
                      text={st.label}
                      onPick={() => pick(st)}
                    />
                  ))}
                </MenuGroup>
              );
            })}
          </div>
        </>
      )}
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

  const chronology = useChronologyOptional();
  const damages = useDamagesOptional();
  const [thinking, setThinking] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const ctxLabel = contextLabel(context, location);
  const workLabel = workStageLabel(workWith, location);
  const stageDocs = documentsForStage(workWith, documents, findings);
  const suggestions = suggestionsForWork(effectiveScope(context), location, workWith ?? pinnedStage(context), globalSource(context));

  // ── What the assistant is actively working with ────────────────────────────
  // Work With wins, then a context pinned to one stage, then where the attorney
  // actually is. This is what decides whether the damage record is in reach —
  // never the page on screen, so a cross-stage selection works without
  // navigating anywhere.
  const activeStage = workWith ?? pinnedStage(context);
  const workingStageId =
    activeStage?.pipeline === "workspace" ? activeStage.id
    : activeStage ? undefined
    : location.stageId;
  // Damages Analysis is reachable when it is the working stage, or when the
  // reasoning scope is case-wide and no other stage has been singled out.
  const damagesReachable = !!damages && (
    workingStageId === "economic" ||
    (!activeStage && (effectiveScope(context) === "case" || effectiveScope(context) === "workspace"))
  );
  const damageItems = damages?.items ?? [];

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

  // Titles already on the timeline, so the assistant only proposes what is missing.
  const existingTitles = [
    ...CHRONOLOGY_TITLES.medical,
    ...CHRONOLOGY_TITLES.event,
    ...(chronology?.additions ?? []).map((a) => a.title),
  ];

  const send = (text: string) => {
    const id = Math.round(performance.now());
    push({ id: `u-${id}`, role: "user", text, context: ctxLabel, usingDocs: selectedDocs.length ? selectedDocs : undefined });
    setThinking(true);
    setShowHistory(false);

    // ── Damages first, when the damage record is what we are working with ────
    // A message is about the damages when it names one or uses the vocabulary
    // of the stage. A message about the timeline is left to the chronology
    // path below, so the two never contend for the same instruction.
    const aboutChronology = /\b(chronolog|timeline)\b/i.test(text);
    const aboutDamages = !aboutChronology && (
      namesDamage(text, damageItems) ||
      /\b(damage|damages|expense|expenses|cost|costs|wage|wages|bucket|subtotal|economic)\b/i.test(text) ||
      // A plain instruction carrying a money amount, while the damage record is
      // what we are working with, is about the damages — "Add $5,000 for home
      // modifications" names no damage and uses none of the vocabulary above.
      (damagesReachable && /\$\s*\d/.test(text) && /\b(add|create|change|update|set|delete|remove|move)\b/i.test(text))
    );
    const damageIntent = aboutDamages ? detectDamageIntent(text) : { kind: "none" as const };

    // A request to change the timeline gets a proposal; anything else is an
    // ordinary answer with no action card.
    const intent = chronology && !aboutDamages ? detectIntent(text) : { kind: "none" as const };

    setTimeout(() => {
      // ── Damage actions ───────────────────────────────────────────────────
      // Every branch ends in a proposal or a question. None of them writes.
      if (damageIntent.kind !== "none") {
        if (!damagesReachable || !damages) {
          push({
            id: `a-${id}`, role: "assistant", context: ctxLabel,
            answer: {
              headline: "I can change the damage record once Damages Analysis is what I am working with.",
              points: ["Set Work With to Case Workspace → Damages Analysis. The dashboard stays where it is."],
              citations: [],
            },
          });
          setThinking(false);
          return;
        }

        if (damageIntent.kind === "edit") {
          const item = findDamage(damageIntent.target, damages.items);
          // Documents selected and no figure given: work the figure out from
          // those documents. Reading them proposes; it never applies.
          const wantsDocs = selectedDocs.length > 0 && /\bdocument|\bthese\b|\bselected\b|based on/i.test(text);
          if (item && damageIntent.amount === null && wantsDocs) {
            const fig = figureFromDocuments(item, selectedDocs, documentAmount);
            if (!fig) {
              push({
                id: `a-${id}`, role: "assistant", context: ctxLabel,
                answer: {
                  headline: `None of the selected documents carries an itemised amount, so I cannot work ${item.label} out from them.`,
                  points: [], citations: selectedDocs,
                },
              });
              setThinking(false);
              return;
            }
            if (fig.unchanged) {
              push({
                id: `a-${id}`, role: "assistant", context: ctxLabel,
                answer: {
                  headline: `The selected documents come to ${formatDamageUSD(fig.proposed)}, which is the ${item.label} figure already on file. I am not proposing a change.`,
                  points: fig.lines.map((l) => `${l.doc} — ${formatDamageUSD(l.amount)}.`),
                  citations: fig.lines.map((l) => l.doc),
                },
              });
              setThinking(false);
              return;
            }
            push({
              id: `a-${id}`, role: "assistant", context: ctxLabel,
              answer: {
                headline: `Based on the selected documents, I calculate ${item.label} at ${formatDamageUSD(fig.proposed)}.`,
                points: [
                  ...fig.lines.map((l) =>
                    `${l.doc} — ${formatDamageUSD(l.amount)}${l.counted ? "." : ", not currently cited against this damage."}`),
                  `Current figure on file: ${formatDamageUSD(item.amount)}.`,
                ],
                citations: [],
                // The attorney has to be able to see that a narrow selection
                // produces a narrow figure, or a subtotal looks like a correction.
                caveat: fig.lines.length < item.docCount
                  ? `Worked out from the ${fig.lines.length} selected document${fig.lines.length === 1 ? "" : "s"} only — this damage cites ${item.docCount}. Nothing changes until you apply it.`
                  : "Worked out from the selected documents only. Nothing changes until you apply it.",
              },
              damageEdit: {
                proposal: {
                  id: item.id, label: item.label, instruction: text,
                  field: "amount", fieldLabel: DAMAGE_FIELD_LABEL.amount,
                  current: formatDamageUSD(item.amount), proposed: formatDamageUSD(fig.proposed),
                  amount: fig.proposed,
                  reason: "Recalculated from the documents you selected.",
                  sources: fig.lines.map((l) => l.doc),
                },
                state: "pending",
              },
            });
            setThinking(false);
            return;
          }

          const built = buildEditProposal(damageIntent, damages.items, text);
          if ("error" in built) {
            push({
              id: `a-${id}`, role: "assistant", context: ctxLabel,
              answer: damageAskBack(built.error, built.target, damages.items),
            });
            setThinking(false);
            return;
          }
          push({
            id: `a-${id}`, role: "assistant", context: ctxLabel,
            answer: { headline: `Here is the change I would make to ${built.label}.`, points: [], citations: [] },
            damageEdit: { proposal: built, state: "pending" },
          });
          setThinking(false);
          return;
        }

        if (damageIntent.kind === "add") {
          const built = buildAddProposal(damageIntent, damages.items, text);
          if ("error" in built) {
            push({
              id: `a-${id}`, role: "assistant", context: ctxLabel,
              answer: built.error === "no-amount"
                ? { headline: `How much should I record for ${built.label}?`, points: [], citations: [] }
                : { headline: "Tell me what the damage is and how much it comes to, and I will prepare it.", points: [], citations: [] },
            });
            setThinking(false);
            return;
          }
          push({
            id: `a-${id}`, role: "assistant", context: ctxLabel,
            answer: { headline: `I can add that to ${built.bucketLabel}. Nothing is created until you confirm.`, points: [], citations: [] },
            damageAdd: { proposal: built, state: "pending" },
          });
          setThinking(false);
          return;
        }

        if (damageIntent.kind === "delete") {
          const built = buildDeleteProposal(damageIntent, damages.items, text);
          if ("error" in built) {
            push({
              id: `a-${id}`, role: "assistant", context: ctxLabel,
              answer: damageAskBack("no-damage", built.target, damages.items),
            });
            setThinking(false);
            return;
          }
          push({
            id: `a-${id}`, role: "assistant", context: ctxLabel,
            answer: { headline: `Deleting a damage cannot be undone, so please confirm.`, points: [], citations: [] },
            damageDelete: { proposal: built, state: "pending" },
          });
          setThinking(false);
          return;
        }

        if (damageIntent.kind === "move") {
          const built = buildMoveProposal(damageIntent, damages.items, text);
          if ("error" in built) {
            push({
              id: `a-${id}`, role: "assistant", context: ctxLabel,
              answer: built.error === "no-bucket"
                ? { headline: `Which bucket should ${built.target} move to — Economic or Non-Economic Damages?`, points: [], citations: [] }
                : built.error === "same-bucket"
                ? { headline: `${built.target} is already there, so there is nothing to move.`, points: [], citations: [] }
                : damageAskBack("no-damage", built.target, damages.items),
            });
            setThinking(false);
            return;
          }
          push({
            id: `a-${id}`, role: "assistant", context: ctxLabel,
            answer: { headline: `Here is the move I would make.`, points: [], citations: [] },
            damageMove: { proposal: built, state: "pending" },
          });
          setThinking(false);
          return;
        }
      }

      const timeline = intent.kind === "create" || intent.kind === "find-missing"
        ? (intent.timeline === "medical" ? "Medical Chronology" : "Event Chronology")
        : "";

      // The attorney named the event — prepare exactly that, never a
      // substitute found while reading the records.
      if (intent.kind === "create") {
        const req = parseRequestedEvent(text, intent.timeline, selectedDocs);
        if (req) {
          push({
            id: `a-${id}`, role: "assistant", context: ctxLabel,
            answer: {
              headline: req.verified
                ? `I can add that event to the ${timeline}.`
                : `I can prepare that event for the ${timeline}.`,
              points: [], citations: [],
              caveat: req.note,
            },
            chronoAdds: [{ candidate: req.candidate, state: "pending", source: "attorney", note: req.note }],
          });
          setThinking(false);
          return;
        }
        // Nothing nameable in the request — offer what the records suggest.
        const found = missingCandidates(intent.timeline, existingTitles);
        push({
          id: `a-${id}`, role: "assistant", context: ctxLabel,
          answer: {
            headline: found.length
              ? `Tell me the event and I will prepare it, or add one of these from the records.`
              : `Tell me the date and what happened and I will prepare the event.`,
            points: [], citations: [],
          },
          chronoAdds: found.map((c) => ({ candidate: c, state: "pending" as const, source: "ai" as const })),
        });
        setThinking(false);
        return;
      }

      // Missing-event detection runs only when it was asked for.
      if (intent.kind === "find-missing") {
        const found = missingCandidates(intent.timeline, existingTitles);
        push({
          id: `a-${id}`, role: "assistant", context: ctxLabel,
          answer: {
            headline: found.length === 0
              ? `Nothing in the records looks missing from the ${timeline} right now.`
              : found.length === 1
              ? `I found an event in the records that may not be represented in the ${timeline}.`
              : `I found ${found.length} events in the records that may not be represented in the ${timeline}.`,
            points: [], citations: [],
          },
          chronoAdds: found.map((c) => ({ candidate: c, state: "pending" as const, source: "ai" as const })),
        });
        setThinking(false);
        return;
      }

      if (intent.kind === "modify") {
        const edit = findEdit(intent.target, null);
        if (edit) {
          push({
            id: `a-${id}`, role: "assistant", context: ctxLabel,
            answer: { headline: `Here is the change I would make to ${edit.key}.`, points: [], citations: [] },
            chronoEdit: { edit, state: "pending" },
          });
          setThinking(false);
          return;
        }
      }

      // An ordinary answer. Where the question touches on the completeness of
      // the damages, the assistant may also surface a damage the records seem
      // to support — as an offer to review, never as a change.
      const offer = damagesReachable && damages && /\b(damage|damages|expense|expenses|cost|costs|missing|gap|gaps|complete|outstanding|overlook)\b/i.test(text)
        ? missingDamages(damages.items).slice(0, 1)
        : [];
      push({
        id: `a-${id}`, role: "assistant", context: ctxLabel,
        answer: answer(text, effectiveScope(context), location, globalSource(context)),
        damageSuggest: offer.length > 0 ? offer.map((sg) => ({ suggestion: sg, state: "open" as const })) : undefined,
      });
      setThinking(false);
    }, 700);
  };

  // Approving an event writes it to the shared chronology store, which the
  // Chronology stage renders immediately.
  const addProposedEvent = (msgId: string, index: number, c: ChronCandidate) => {
    if (!chronology) return;
    chronology.addEvent(toAddition(c, CURRENT_ATTORNEY));
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id !== active.id ? conv : {
          ...conv,
          messages: [
            ...conv.messages.map((m) =>
              m.id !== msgId || !m.chronoAdds ? m
                : { ...m, chronoAdds: m.chronoAdds.map((p, i) => (i === index ? { ...p, state: "added" as const } : p)) },
            ),
            {
              id: `a-${Math.round(performance.now())}`, role: "assistant" as const, context: ctxLabel,
              answer: {
                headline: `Added to ${c.kind === "medical" ? "Medical" : "Event"} Chronology — ${c.date}, ${c.title}.`,
                points: [], citations: [],
              },
            },
          ],
        },
      ),
    );
  };

  // Approving an edit records a new version; the previous wording is kept.
  const applyProposedEdit = (msgId: string, e: ChronEdit) => {
    if (!chronology) return;
    const at = versionStamp();
    const v: ChronVersion = {
      version: 2, label: "AI Modified", at, by: "AI Assistant", approvedBy: CURRENT_ATTORNEY,
      reason: e.reason, sources: e.sources,
      snapshot: { title: e.key, description: e.proposed, date: "" },
    };
    const v1: ChronVersion = {
      version: 1, label: "System Generated", at: "Feb 20, 2026", by: "System",
      snapshot: { title: e.key, description: e.current, date: "" },
    };
    chronology.applyOverride({
      key: e.key, kind: e.kind, patch: { [e.field]: e.proposed },
      provenance: "ai-modified", history: [v1, v],
    });
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id !== active.id ? conv : {
          ...conv,
          messages: [
            ...conv.messages.map((m) => (m.id !== msgId || !m.chronoEdit ? m : { ...m, chronoEdit: { ...m.chronoEdit, state: "applied" as const } })),
            {
              id: `a-${Math.round(performance.now())}`, role: "assistant" as const, context: ctxLabel,
              answer: { headline: `Chronology updated — ${e.key} was updated using ${e.sources[0]}.`, points: [], citations: [] },
            },
          ],
        },
      ),
    );
  };

  // ── Applying a damage action ───────────────────────────────────────────────
  // One shape for all four: write to the store, mark the card settled, and add
  // one short confirmation carrying the provenance. The dashboard picks the
  // change up from the store — nothing here navigates.

  const settle = (msgId: string, kind: "edit" | "add" | "delete" | "move", state: DamageState, confirmation?: Message) =>
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id !== active.id ? conv : {
          ...conv,
          messages: [
            ...conv.messages.map((m) => {
              if (m.id !== msgId) return m;
              if (kind === "edit" && m.damageEdit) return { ...m, damageEdit: { ...m.damageEdit, state } };
              if (kind === "add" && m.damageAdd) return { ...m, damageAdd: { ...m.damageAdd, state } };
              if (kind === "delete" && m.damageDelete) return { ...m, damageDelete: { ...m.damageDelete, state } };
              if (kind === "move" && m.damageMove) return { ...m, damageMove: { ...m.damageMove, state } };
              return m;
            }),
            ...(confirmation ? [confirmation] : []),
          ],
        },
      ),
    );

  const confirm = (headline: string, provenance: string): Message => ({
    id: `a-${Math.round(performance.now())}-${Math.random().toString(36).slice(2, 6)}`,
    role: "assistant", context: ctxLabel,
    answer: { headline, points: [], citations: [] },
    stamp: { provenance, where: "Damages Analysis" },
  });

  const applyDamageEdit = (msgId: string, prop: DamageEditProposal) => {
    if (!damages) return;
    const item = damages.items.find((i) => i.id === prop.id);
    if (!item) return;
    // Only the field named in the proposal changes. Everything else on the
    // record — including its verification status — is left exactly as it was.
    const patch: Partial<DamageItem> = {};
    if (prop.field === "amount" && prop.amount != null) patch.amount = prop.amount;
    else if (prop.field === "description") patch.description = prop.proposed;
    else if (prop.field === "category") patch.category = prop.proposed;
    else if (prop.field === "reasoning") patch.reasoning = prop.proposed;
    else if (prop.field === "notes") patch.notes = prop.proposed;
    else if (prop.field === "docs") {
      const list = prop.proposed.split(/,\s*/).map((d) => d.trim()).filter(Boolean);
      patch.docs = list;
      patch.docCount = Math.max(item.docCount, list.length);
    }
    const changes: FieldChange[] = [{ field: prop.fieldLabel, previous: prop.current, next: prop.proposed }];
    damages.updateDamage(prop.id, patch, changes, aiActor(CURRENT_ATTORNEY), prop.instruction);
    settle(msgId, "edit", "applied", confirm(
      prop.field === "amount"
        ? `${prop.label} updated to ${prop.proposed}.`
        : `${prop.label} — ${prop.fieldLabel.toLowerCase()} updated.`,
      "AI Modified",
    ));
  };

  const applyDamageAdd = (msgId: string, prop: DamageAddProposal) => {
    if (!damages) return;
    const id = `${prop.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}-${Math.round(performance.now()) % 100000}`;
    damages.createDamage(
      {
        id, label: prop.label, bucket: prop.bucket, amount: prop.amount,
        description: prop.description, category: prop.category, reasoning: prop.reasoning,
        docs: prop.docs, docCount: prop.docs.length, iconKey: "receipt",
        // Created through the attorney's instruction to the assistant, and not
        // yet backed by verified evidence — provenance and verification are
        // separate, and the store sets the provenance from the actor.
        verified: false,
      },
      aiActor(CURRENT_ATTORNEY),
      prop.instruction,
    );
    settle(msgId, "add", "applied", confirm(
      `${prop.label} — ${formatDamageUSD(prop.amount)} added to ${prop.bucketLabel}.`,
      "AI Created",
    ));
  };

  const applyDamageDelete = (msgId: string, prop: DamageDeleteProposal) => {
    if (!damages) return;
    damages.deleteDamage(prop.id, aiActor(CURRENT_ATTORNEY), prop.instruction);
    settle(msgId, "delete", "applied", confirm(
      `${prop.label} (${formatDamageUSD(prop.amount)}) removed.`,
      "AI Modified",
    ));
  };

  const applyDamageMove = (msgId: string, prop: DamageMoveProposal) => {
    if (!damages) return;
    damages.moveDamage(prop.id, prop.to, aiActor(CURRENT_ATTORNEY), prop.instruction);
    settle(msgId, "move", "applied", confirm(
      `${prop.label} moved from ${prop.fromLabel} to ${prop.toLabel}.`,
      "AI Modified",
    ));
  };

  const cancelDamage = (msgId: string, kind: "edit" | "add" | "delete" | "move") =>
    settle(msgId, kind, "cancelled");

  // Reviewing a suggestion turns it into an ordinary add proposal. It is still
  // a proposal — the attorney confirms it on the card like any other.
  const reviewSuggestion = (msgId: string, index: number, sg: DamageSuggestion) =>
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id !== active.id ? conv : {
          ...conv,
          messages: [
            ...conv.messages.map((m) =>
              m.id !== msgId || !m.damageSuggest ? m
                : { ...m, damageSuggest: m.damageSuggest.map((x, i) => (i === index ? { ...x, state: "reviewing" as const } : x)) },
            ),
            {
              id: `a-${Math.round(performance.now())}`, role: "assistant" as const, context: ctxLabel,
              answer: { headline: `Here is ${sg.label} prepared as a damage. Nothing is added until you confirm.`, points: [], citations: [] },
              damageAdd: { proposal: proposalFromSuggestion(sg, `Reviewed the suggested ${sg.label} damage`), state: "pending" as const },
            },
          ],
        },
      ),
    );

  const dismissSuggestion = (msgId: string, index: number) =>
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id !== active.id ? conv : {
          ...conv,
          messages: conv.messages.map((m) =>
            m.id !== msgId || !m.damageSuggest ? m
              : { ...m, damageSuggest: m.damageSuggest.map((x, i) => (i === index ? { ...x, state: "dismissed" as const } : x)) },
          ),
        },
      ),
    );

  const damageHandlers: DamageHandlers = {
    onDamageEdit: applyDamageEdit,
    onDamageAdd: applyDamageAdd,
    onDamageDelete: applyDamageDelete,
    onDamageMove: applyDamageMove,
    onDamageCancel: cancelDamage,
    onReviewSuggestion: reviewSuggestion,
    onDismissSuggestion: dismissSuggestion,
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
        <ContextSelect
          value={context}
          onChange={changeContext}
          label={ctxLabel}
          here={location.stageLabel || location.pipelineStage || location.pageLabel || "Current page"}
        />
        <WorkWithSelect
          value={workWith}
          label={workLabel}
          currentStageKey={location.stageId ? `workspace:${location.stageId}` : location.pipelineStage ? `intake:${location.pipelineStage}` : undefined}
          onChange={changeWorkWith}
        />
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
          <Thread
            messages={active.messages}
            thinking={thinking}
            onApply={applyProposal}
            onAddEvent={addProposedEvent}
            onApplyEdit={applyProposedEdit}
            damage={damageHandlers}
          />
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
