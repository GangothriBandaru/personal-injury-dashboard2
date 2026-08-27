import { useState } from "react";
import { Sparkles, FileText, Check, Calendar, X } from "lucide-react";
import type { ChronCandidate, ChronEdit } from "./chronologyActions";

// ── Chronology proposals ──────────────────────────────────────────────────────
// Rendered inside the conversation only when the assistant is proposing a real
// change to the timeline. Ordinary answers stay ordinary chat. Nothing reaches
// the chronology until the attorney approves it here.

export interface EditableCandidate extends ChronCandidate {}

// A proposed new event: compact in the thread, expandable for review and edit.
export function ProposedEvent({
  candidate, state, source = "ai", onAdd,
}: {
  candidate: ChronCandidate;
  state: "pending" | "added";
  /** attorney = they asked for this event; ai = the assistant surfaced it. */
  source?: "attorney" | "ai";
  onAdd: (c: ChronCandidate) => void;
}) {
  const [review, setReview] = useState(false);
  const [draft, setDraft] = useState<ChronCandidate>(candidate);
  const [editing, setEditing] = useState(false);
  const timeline = candidate.kind === "medical" ? "Medical Chronology" : "Event Chronology";

  const field = (label: string, value: string, key: keyof ChronCandidate, multiline = false) => (
    <div className="px-3.5 py-2">
      <div className="eyebrow mb-1">{label}</div>
      {editing ? (
        multiline ? (
          <textarea
            value={value}
            rows={3}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value } as ChronCandidate)}
            className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-brand transition-colors resize-y"
          />
        ) : (
          <input
            value={value}
            onChange={(e) => setDraft({ ...draft, [key]: e.target.value } as ChronCandidate)}
            className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-brand transition-colors"
          />
        )
      ) : (
        <p className="body-text leading-relaxed">{value || "—"}</p>
      )}
    </div>
  );

  return (
    <div className={`rounded-xl border p-4 mt-3 ${
      source === "attorney" ? "border-[#D6F2F7] bg-[#F6FDFF]" : "border-line bg-offwhite"
    }`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Sparkles className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
        <span className="eyebrow text-deep">
          {source === "attorney" ? "Proposed Chronology Event" : "Potential Missing Event"}
        </span>
      </div>
      <p className="secondary-text mb-2.5">
        {source === "attorney"
          ? `Based on your request, I have prepared this event for the ${timeline}.`
          : `I found this in the case records. It may not be represented in the ${timeline}.`}
      </p>

      {/* Compact summary — always visible */}
      <div className="flex items-center gap-1.5 mono-ref">
        <Calendar className="w-3.5 h-3.5 text-[#5B6B78]" strokeWidth={1.75} />
        {draft.date}{draft.time ? ` · ${draft.time}` : ""}
      </div>
      <div className="card-title mt-0.5">{draft.title}</div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {draft.evidence.map((d) => (
          <span key={d} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1 text-xs text-ink">
            <FileText className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> {d}
            {draft.evidencePage && <span className="text-[#8A98A3]">· {draft.evidencePage}</span>}
          </span>
        ))}
      </div>

      {/* Full review — the attorney can edit every field before saving */}
      {review && (
        <div className="rounded-xl border border-[#D6F2F7] bg-white divide-y divide-[#D6F2F7] mt-3">
          <div className="px-3.5 py-2">
            <div className="eyebrow">Add {timeline} Event</div>
          </div>
          {field("Date", draft.date, "date")}
          {field("Time", draft.time ?? "", "time")}
          {field("Event", draft.title, "title")}
          {field("Description", draft.description, "description", true)}
          {field("Event Type", draft.eventType, "eventType")}
          <div className="px-3.5 py-2">
            <div className="eyebrow mb-1">Supporting Evidence</div>
            <div className="flex flex-wrap gap-1.5">
              {draft.evidence.map((d) => (
                <span key={d} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-offwhite px-2.5 py-1 text-xs text-ink">
                  <FileText className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> {d}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 px-3.5 py-2">
            <span className="text-sm text-[#5B6B78]">AI Confidence</span>
            <span className="pill pill-neutral">{draft.confidence}%</span>
          </div>
        </div>
      )}

      {state === "pending" ? (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {review ? (
            <>
              <button onClick={() => { setReview(false); setEditing(false); setDraft(candidate); }} className="btn btn-secondary px-3 py-2 text-sm">
                Cancel
              </button>
              <button onClick={() => setEditing((e) => !e)} className="btn btn-secondary px-3 py-2 text-sm">
                {editing ? "Done Editing" : "Edit"}
              </button>
              <button onClick={() => onAdd(draft)} className="btn btn-primary px-3 py-2 text-sm">Add Event</button>
            </>
          ) : (
            <>
              <button onClick={() => setReview(true)} className="btn btn-secondary px-3 py-2 text-sm">
                {source === "attorney" ? "Review Event" : "Review"}
              </button>
              <button onClick={() => onAdd(draft)} className="btn btn-primary px-3 py-2 text-sm">Add to {timeline}</button>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mt-3 text-xs font-medium text-[#5B6B78]">
          <Check className="w-3.5 h-3.5 text-[#15803D]" strokeWidth={2} /> Added to {timeline}
        </div>
      )}
    </div>
  );
}

// A proposed change to an event already on the timeline.
export function ProposedEdit({
  edit, state, onApply,
}: {
  edit: ChronEdit;
  state: "pending" | "applied";
  onApply: (e: ChronEdit) => void;
}) {
  const [draft, setDraft] = useState(edit.proposed);
  const [editing, setEditing] = useState(false);
  return (
    <div className="rounded-xl border border-[#FDE6C8] bg-[#FFF7ED] p-4 mt-3">
      <div className="eyebrow text-[#B45309] mb-2.5">Suggested Update</div>
      <div className="flex items-center gap-1.5 mono-ref">
        <Calendar className="w-3.5 h-3.5 text-[#5B6B78]" strokeWidth={1.75} /> {edit.key}
      </div>
      <div className="rounded-lg border border-[#FDE6C8] bg-white divide-y divide-[#FDE6C8] mt-2.5">
        <div className="px-3.5 py-2">
          <div className="eyebrow mb-1">Current</div>
          <p className="body-text leading-relaxed">{edit.current}</p>
        </div>
        <div className="px-3.5 py-2">
          <div className="eyebrow mb-1">Suggested</div>
          {editing ? (
            <textarea
              value={draft}
              rows={4}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-brand transition-colors resize-y"
            />
          ) : (
            <p className="body-text leading-relaxed font-medium">{draft}</p>
          )}
        </div>
        <div className="px-3.5 py-2">
          <div className="eyebrow mb-1">Source</div>
          <div className="flex flex-wrap gap-1.5">
            {edit.sources.map((d) => (
              <span key={d} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-offwhite px-2.5 py-1 text-xs text-ink">
                <FileText className="w-3.5 h-3.5 text-deep" strokeWidth={1.75} /> {d}
              </span>
            ))}
          </div>
        </div>
      </div>
      {state === "pending" ? (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button onClick={() => { setDraft(edit.proposed); setEditing(false); }} className="btn btn-secondary px-3 py-2 text-sm">
            <X className="w-3.5 h-3.5" strokeWidth={1.75} /> Cancel
          </button>
          <button onClick={() => setEditing((e) => !e)} className="btn btn-secondary px-3 py-2 text-sm">
            {editing ? "Done Editing" : "Edit"}
          </button>
          <button onClick={() => onApply({ ...edit, proposed: draft })} className="btn btn-primary px-3 py-2 text-sm">
            Apply Update
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mt-3 text-xs font-medium text-[#5B6B78]">
          <Check className="w-3.5 h-3.5 text-[#15803D]" strokeWidth={2} /> Chronology updated
        </div>
      )}
    </div>
  );
}
