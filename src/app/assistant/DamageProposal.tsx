import { useState } from "react";
import { Sparkles, FileText, Check, DollarSign, Trash2, ArrowRight, X, AlertTriangle } from "lucide-react";
import { formatDamageUSD } from "../damages/DamagesContext";
import type {
  DamageAddProposal, DamageDeleteProposal, DamageEditProposal, DamageMoveProposal, DamageSuggestion,
} from "./damagesActions";

// ── Damage proposals ──────────────────────────────────────────────────────────
// Rendered inside the conversation only when the assistant is proposing a real
// change to the damage record. Ordinary answers stay ordinary chat. Nothing
// reaches the damages store until the attorney confirms it here.
//
// The destructive card (delete) is deliberately the odd one out: it is red, it
// spells out what will be removed, and its confirm button says what it does.

function Frame({
  tone = "brand", eyebrow, title, children, footer,
}: {
  tone?: "brand" | "danger";
  eyebrow: string;
  title?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const skin = tone === "danger"
    ? { box: "border-[#F5C9C4] bg-[#FEF4F3]", text: "text-[#B42318]" }
    : { box: "border-[#D6F2F7] bg-[#F6FDFF]", text: "text-deep" };
  return (
    <div className={`rounded-xl border p-4 mt-3 ${skin.box}`}>
      <div className="flex items-center gap-2 mb-1.5">
        {tone === "danger"
          ? <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${skin.text}`} strokeWidth={1.75} />
          : <Sparkles className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />}
        <span className={`eyebrow ${skin.text}`}>{eyebrow}</span>
      </div>
      {title && <div className="card-title mb-2.5">{title}</div>}
      {children}
      <div className="flex items-center gap-2 mt-3 flex-wrap">{footer}</div>
    </div>
  );
}

// A labelled row inside a proposal's detail table.
function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="px-3.5 py-2">
      <div className="eyebrow mb-1">{label}</div>
      <p className={`body-text leading-relaxed ${strong ? "font-semibold text-ink" : ""}`}>{value || "—"}</p>
    </div>
  );
}

function Applied({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-[#5B6B78]">
      <Check className="w-3.5 h-3.5 text-[#15803D]" strokeWidth={2} /> {text}
    </div>
  );
}

// ── Edit ──────────────────────────────────────────────────────────────────────
// Current and proposed sit side by side; the attorney can amend the proposed
// value before applying it, so a near-miss is corrected rather than rejected.

export function ProposedDamageEdit({
  proposal, state, onApply, onCancel,
}: {
  proposal: DamageEditProposal;
  state: "pending" | "applied" | "cancelled";
  onApply: (p: DamageEditProposal) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(proposal.proposed);
  const [editing, setEditing] = useState(false);
  const changed = draft !== proposal.proposed;

  // Re-derive the numeric amount when the attorney amends the proposed figure.
  const applied = (): DamageEditProposal => {
    if (proposal.field !== "amount") return { ...proposal, proposed: draft };
    const n = Number(draft.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) && n > 0
      ? { ...proposal, proposed: formatDamageUSD(n), amount: Math.round(n) }
      : proposal;
  };

  return (
    <Frame
      eyebrow="Proposed Damage Update"
      title={`Update ${proposal.label}`}
      footer={
        state === "pending" ? (
          <>
            <button onClick={onCancel} className="btn btn-secondary px-3 py-2 text-sm">
              <X className="w-3.5 h-3.5" strokeWidth={1.75} /> Cancel
            </button>
            <button onClick={() => setEditing((e) => !e)} className="btn btn-secondary px-3 py-2 text-sm">
              {editing ? "Done Editing" : "Edit"}
            </button>
            <button onClick={() => onApply(applied())} className="btn btn-primary px-3 py-2 text-sm">Apply Change</button>
          </>
        ) : state === "applied" ? (
          <Applied text={`${proposal.label} updated`} />
        ) : (
          <span className="text-xs font-medium text-[#5B6B78]">Cancelled — nothing was changed.</span>
        )
      }
    >
      <div className="rounded-xl border border-[#D6F2F7] bg-white divide-y divide-[#D6F2F7]">
        <Row label={`Current ${proposal.fieldLabel}`} value={proposal.current} />
        <div className="px-3.5 py-2">
          <div className="eyebrow mb-1">New {proposal.fieldLabel}</div>
          {editing ? (
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-brand transition-colors"
            />
          ) : (
            <p className="body-text leading-relaxed font-semibold text-ink">{draft}{changed && <span className="ml-1.5 text-xs font-normal text-[#8A98A3]">(amended)</span>}</p>
          )}
        </div>
        <Row label="Reason" value={proposal.reason} />
        {proposal.sources && proposal.sources.length > 0 && (
          <div className="px-3.5 py-2">
            <div className="eyebrow mb-1">Derived From</div>
            <div className="flex flex-wrap gap-1.5">
              {proposal.sources.map((d) => (
                <span key={d} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-offwhite px-2.5 py-1 text-xs text-ink">
                  <FileText className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> {d}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Frame>
  );
}

// ── Add ───────────────────────────────────────────────────────────────────────

export function ProposedDamageAdd({
  proposal, state, onAdd, onCancel,
}: {
  proposal: DamageAddProposal;
  state: "pending" | "applied" | "cancelled";
  onAdd: (p: DamageAddProposal) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(proposal);
  const [editing, setEditing] = useState(false);

  const text = (label: string, value: string, key: "label" | "description" | "category", multiline = false) => (
    <div className="px-3.5 py-2">
      <div className="eyebrow mb-1">{label}</div>
      {editing ? (
        multiline ? (
          <textarea
            value={value} rows={2}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-brand transition-colors resize-y"
          />
        ) : (
          <input
            value={value}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-brand transition-colors"
          />
        )
      ) : (
        <p className="body-text leading-relaxed">{value || "—"}</p>
      )}
    </div>
  );

  return (
    <Frame
      eyebrow="Proposed New Damage"
      title="Add Damage"
      footer={
        state === "pending" ? (
          <>
            <button onClick={onCancel} className="btn btn-secondary px-3 py-2 text-sm">
              <X className="w-3.5 h-3.5" strokeWidth={1.75} /> Cancel
            </button>
            <button onClick={() => setEditing((e) => !e)} className="btn btn-secondary px-3 py-2 text-sm">
              {editing ? "Done Editing" : "Edit"}
            </button>
            <button onClick={() => onAdd(draft)} className="btn btn-primary px-3 py-2 text-sm">Add Damage</button>
          </>
        ) : state === "applied" ? (
          <Applied text={`${draft.label} added to ${draft.bucketLabel}`} />
        ) : (
          <span className="text-xs font-medium text-[#5B6B78]">Cancelled — nothing was added.</span>
        )
      }
    >
      <div className="rounded-xl border border-[#D6F2F7] bg-white divide-y divide-[#D6F2F7]">
        <Row label="Category" value={draft.bucketLabel} />
        {text("Damage", draft.label, "label")}
        <div className="px-3.5 py-2">
          <div className="eyebrow mb-1">Amount</div>
          {editing ? (
            <input
              value={String(draft.amount)}
              onChange={(e) => setDraft({ ...draft, amount: Math.max(0, Math.round(Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)) })}
              className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink tabular-nums focus:outline-none focus:border-brand transition-colors"
            />
          ) : (
            <p className="body-text font-semibold text-ink tabular-nums">{formatDamageUSD(draft.amount)}</p>
          )}
        </div>
        {text("Description", draft.description, "description", true)}
        {text("Damage Type", draft.category, "category")}
      </div>
      {state === "pending" && draft.assumed.length > 0 && (
        <p className="secondary-text mt-2">
          I filled in the {draft.assumed.join(" and ").toLowerCase()} — edit before adding if
          {draft.assumed.length > 1 ? " either is" : " it is"} wrong.
        </p>
      )}
    </Frame>
  );
}

// ── Delete ────────────────────────────────────────────────────────────────────

export function ProposedDamageDelete({
  proposal, state, onDelete, onCancel,
}: {
  proposal: DamageDeleteProposal;
  state: "pending" | "applied" | "cancelled";
  onDelete: (p: DamageDeleteProposal) => void;
  onCancel: () => void;
}) {
  return (
    <Frame
      tone="danger"
      eyebrow="Delete Damage?"
      footer={
        state === "pending" ? (
          <>
            <button onClick={onCancel} className="btn btn-secondary px-3 py-2 text-sm">
              <X className="w-3.5 h-3.5" strokeWidth={1.75} /> Cancel
            </button>
            <button
              onClick={() => onDelete(proposal)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white bg-[#B42318] hover:bg-[#96200F] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} /> Delete Damage
            </button>
          </>
        ) : state === "applied" ? (
          <Applied text={`${proposal.label} deleted`} />
        ) : (
          <span className="text-xs font-medium text-[#5B6B78]">Cancelled — nothing was deleted.</span>
        )
      }
    >
      <div className="rounded-xl border border-[#F5C9C4] bg-white px-3.5 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="card-title">{proposal.label}</span>
          <span className="text-sm font-bold text-ink tabular-nums shrink-0">{formatDamageUSD(proposal.amount)}</span>
        </div>
        <p className="secondary-text mt-1.5">This will remove this damage from the current calculation.</p>
      </div>
    </Frame>
  );
}

// ── Move ──────────────────────────────────────────────────────────────────────

export function ProposedDamageMove({
  proposal, state, onMove, onCancel,
}: {
  proposal: DamageMoveProposal;
  state: "pending" | "applied" | "cancelled";
  onMove: (p: DamageMoveProposal) => void;
  onCancel: () => void;
}) {
  return (
    <Frame
      eyebrow="Proposed Damage Move"
      title="Move Damage"
      footer={
        state === "pending" ? (
          <>
            <button onClick={onCancel} className="btn btn-secondary px-3 py-2 text-sm">
              <X className="w-3.5 h-3.5" strokeWidth={1.75} /> Cancel
            </button>
            <button onClick={() => onMove(proposal)} className="btn btn-primary px-3 py-2 text-sm">Move Damage</button>
          </>
        ) : state === "applied" ? (
          <Applied text={`${proposal.label} moved to ${proposal.toLabel}`} />
        ) : (
          <span className="text-xs font-medium text-[#5B6B78]">Cancelled — nothing was moved.</span>
        )
      }
    >
      <div className="rounded-xl border border-[#D6F2F7] bg-white divide-y divide-[#D6F2F7]">
        <div className="px-3.5 py-2 flex items-center justify-between gap-3">
          <span className="card-title">{proposal.label}</span>
          <span className="text-sm font-bold text-ink tabular-nums shrink-0">{formatDamageUSD(proposal.amount)}</span>
        </div>
        <Row label="From" value={proposal.fromLabel} />
        <Row label="To" value={proposal.toLabel} strong />
      </div>
      <p className="secondary-text mt-2">
        Both subtotals and the estimated settlement recalculate when this is applied.
      </p>
    </Frame>
  );
}

// ── Suggestion ────────────────────────────────────────────────────────────────
// Deliberately not a proposal. It has no confirm button that changes anything —
// "Review" only opens the add proposal, which the attorney then confirms.

export function SuggestedDamage({
  suggestion, state, onReview, onDismiss,
}: {
  suggestion: DamageSuggestion;
  state: "open" | "reviewing" | "dismissed";
  onReview: (s: DamageSuggestion) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#FDE6C8] bg-[#FFF7ED] p-4 mt-3">
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles className="w-3.5 h-3.5 text-[#B45309] shrink-0" strokeWidth={1.75} />
        <span className="eyebrow text-[#B45309]">Potential Missing Damage</span>
      </div>
      <div className="card-title">{suggestion.label}</div>
      <p className="secondary-text mt-1 leading-relaxed">{suggestion.why}</p>
      {suggestion.amount !== null && (
        <div className="flex items-center gap-1.5 mt-2 text-xs text-[#5B6B78]">
          <DollarSign className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
          The records would support roughly {formatDamageUSD(suggestion.amount)}.
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {suggestion.docs.map((d) => (
          <span key={d} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-xs text-ink">
            <FileText className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> {d}
          </span>
        ))}
      </div>
      {state === "open" ? (
        <>
          <p className="secondary-text mt-2.5">Nothing has been added. Would you like to review this as a damage?</p>
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <button onClick={onDismiss} className="btn btn-secondary px-3 py-2 text-sm">Not Now</button>
            <button onClick={() => onReview(suggestion)} className="btn btn-secondary px-3 py-2 text-sm">
              Review <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-1.5 mt-2.5 text-xs font-medium text-[#5B6B78]">
          {state === "reviewing" ? "Opened for review below." : "Dismissed — nothing was added."}
        </div>
      )}
    </div>
  );
}
