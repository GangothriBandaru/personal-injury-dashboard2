import type { ChronAddition, ChronVersion } from "../chronology/ChronologyContext";
import { versionStamp } from "../chronology/ChronologyContext";

// ── AI-assisted chronology ────────────────────────────────────────────────────
// The assistant recognises when a message is asking to change the timeline
// rather than asking a question, and answers with a proposal. Nothing reaches
// the chronology until the attorney approves it.

export type ChronIntent =
  | { kind: "none" }
  | { kind: "find-missing"; timeline: "medical" | "event" }
  | { kind: "create"; timeline: "medical" | "event" }
  | { kind: "modify"; target: string };

// Which timeline a message is about. Medical wording wins over case wording
// when both appear, since "medical timeline" is the more specific phrase.
function timelineOf(q: string): "medical" | "event" {
  if (/medical|treatment|clinical|mri|therapy|neurolog|diagnos|hospital|injur/i.test(q)) return "medical";
  if (/case (event|chronolog|timeline)|accident|police|investigation|insurance|settlement|incident/i.test(q)) return "event";
  return "medical";
}

export function detectIntent(q: string): ChronIntent {
  const asksMissing = /missing|not (currently )?(in|represented)|aren.?t (currently )?in|gaps? in the (chronolog|timeline)/i.test(q);
  const asksCompare = /compare.*(chronolog|timeline)|(chronolog|timeline).*compare|cross-?check.*(chronolog|timeline)/i.test(q);
  const asksAdd = /\b(add|create|insert|record|log)\b/i.test(q) && /(chronolog|timeline|event)/i.test(q);
  const asksModify = /\b(update|correct|fix|amend|revise|change)\b/i.test(q) && /(chronolog|timeline|event|entry|description|date)/i.test(q);

  // Priority: what the attorney explicitly asked for wins. Missing-event
  // detection only runs when they ask for it, or ask for a comparison.
  if (asksModify) {
    // Pull out the event being referred to, e.g. "the Feb 16 MRI event".
    const m = q.match(/\b(feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b/i);
    const named = q.match(/\b(mri|emergency|admission|neurolog|therapy|collision|police|insurance|settlement|preparation)\w*/i);
    return { kind: "modify", target: [m?.[0], named?.[0]].filter(Boolean).join(" ") };
  }
  if (asksAdd) return { kind: "create", timeline: timelineOf(q) };
  if (asksMissing || asksCompare) return { kind: "find-missing", timeline: timelineOf(q) };
  return { kind: "none" };
}

// ── Candidate events ──────────────────────────────────────────────────────────
// Events the records support but the timeline does not yet carry. Each is tied
// to the document that evidences it, so an approved event keeps its provenance.

export interface ChronCandidate {
  kind: "medical" | "event";
  date: string;
  time?: string;
  title: string;
  description: string;
  eventType: string;
  tags: string[];
  evidence: string[];
  evidencePage?: string;
  confidence: number;
}

export const CANDIDATES: ChronCandidate[] = [
  {
    kind: "medical",
    date: "Feb 18, 2026",
    time: "10:30 AM",
    title: "Neurological Follow-up Assessment",
    description:
      "The plaintiff underwent a neurological follow-up assessment documenting continued neurological symptoms and ongoing treatment.",
    eventType: "Follow-Up Care",
    tags: ["Follow-Up Care", "Neurology"],
    evidence: ["hospital_medical_records.pdf"],
    evidencePage: "Page 14",
    confidence: 92,
  },
  {
    kind: "medical",
    date: "Feb 22, 2026",
    time: "2:15 PM",
    title: "Physical Therapy Evaluation",
    description:
      "An initial physical therapy evaluation recorded baseline cervical range-of-motion deficits before the therapy programme began.",
    eventType: "Rehabilitation",
    tags: ["Rehabilitation", "Physical Therapy"],
    evidence: ["physical_therapy_notes.pdf"],
    evidencePage: "Page 3",
    confidence: 88,
  },
  {
    kind: "event",
    date: "Feb 17, 2026",
    time: "11:00 AM",
    title: "Supplemental Witness Located",
    description:
      "A second independent witness was identified during a follow-up canvass of the intersection and provided a signed account.",
    eventType: "Evidence Collection",
    tags: ["Evidence Collection", "Witness Evidence"],
    evidence: ["witness_statement.pdf"],
    evidencePage: "Page 1",
    confidence: 84,
  },
  {
    kind: "event",
    date: "Feb 25, 2026",
    title: "Carrier Acknowledged Claim",
    description:
      "The commercial carrier acknowledged the liability claim in writing and opened its own investigation file.",
    eventType: "Insurance",
    tags: ["Insurance", "Claim"],
    evidence: ["insurance_policy_v2.pdf"],
    confidence: 79,
  },
];

// Candidates the timeline does not already carry, matched on title.
export function missingCandidates(
  kind: "medical" | "event",
  existingTitles: string[],
): ChronCandidate[] {
  const have = new Set(existingTitles.map((t) => t.toLowerCase()));
  return CANDIDATES.filter((c) => c.kind === kind && !have.has(c.title.toLowerCase()));
}

// ── Attorney-requested events ─────────────────────────────────────────────────
// When the attorney says what to add, the assistant prepares exactly that event.
// It never substitutes something else it happened to find in the records.

const MONTHS: Record<string, string> = {
  jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", may: "May", jun: "Jun",
  jul: "Jul", aug: "Aug", sep: "Sep", oct: "Oct", nov: "Nov", dec: "Dec",
};

const CASE_YEAR = "2026";

// "February 24" / "Feb 24, 2026" / "24 February" → "Feb 24, 2026"
function parseDate(q: string): string | null {
  const names = Object.keys(MONTHS).join("|");
  const a = q.match(new RegExp(`\\b(${names})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?`, "i"));
  if (a) return `${MONTHS[a[1].toLowerCase()]} ${parseInt(a[2], 10)}, ${a[3] ?? CASE_YEAR}`;
  const b = q.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${names})[a-z]*\\.?(?:,?\\s*(\\d{4}))?`, "i"));
  if (b) return `${MONTHS[b[2].toLowerCase()]} ${parseInt(b[1], 10)}, ${b[3] ?? CASE_YEAR}`;
  return null;
}

// "10:30 am" → "10:30 AM"
function parseTime(q: string): string | undefined {
  const m = q.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (!m) return undefined;
  return `${parseInt(m[1], 10)}:${m[2] ?? "00"} ${m[3].toUpperCase()}`;
}

const TITLE_CASE = (t: string) =>
  t.replace(/\s+/g, " ").trim().replace(/\b[a-z]/g, (c) => c.toUpperCase());

// Strip the instruction wrapper so what remains is the event the attorney named.
function parseTitle(q: string): string | null {
  let t = ` ${q} `;
  t = t.replace(/[.?!]+\s*$/, " ");
  // the command itself
  t = t.replace(/^\s*(please\s+)?(can you\s+|could you\s+|i want to\s+|i'd like to\s+)?(add|create|insert|record|log)\s+/i, " ");
  // "a/the medical chronology (entry|event) that|for|saying|noting"
  t = t.replace(/\b(a|an|the|this|that)\b/gi, " ");
  t = t.replace(/\b(medical|case|event)?\s*(chronolog\w*|timeline)\s*(entry|event|card)?\b/gi, " ");
  t = t.replace(/\b(entry|event)\b/gi, " ");
  t = t.replace(/\b(to|into|in|on|for|of|and|with|showing|saying|noting|stating|where|when|which)\b/gi, " ");
  // the party and the verb they performed
  t = t.replace(/\b(plaintiff|client|patient|claimant|she|he|they)\b/gi, " ");
  t = t.replace(/\b(went|had|attended|underwent|received|was|were|is|are|has|have|did|goes)\b/gi, " ");
  // any date or time already captured separately
  const names = Object.keys(MONTHS).join("|");
  t = t.replace(new RegExp(`\\b(${names})[a-z]*\\.?\\s*\\d{0,2}(?:st|nd|rd|th)?,?\\s*\\d{0,4}`, "gi"), " ");
  t = t.replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)?\b/gi, " ");
  const cleaned = t.replace(/\s+/g, " ").trim();
  if (cleaned.length < 3) return null;
  // keep it short — a chronology title, not a sentence
  const words = cleaned.split(" ").filter(Boolean).slice(0, 6);
  return TITLE_CASE(words.join(" "));
}

export interface RequestedEvent {
  candidate: ChronCandidate;
  /** True when a source document backs the event; false = attorney-provided. */
  verified: boolean;
  note?: string;
}

// Build the event the attorney described. A selected document, or a candidate
// on the same date, provides the source; otherwise the event is proposed as
// attorney-provided and says so rather than inventing detail.
export function parseRequestedEvent(
  q: string,
  timeline: "medical" | "event",
  selectedDocs: string[],
): RequestedEvent | null {
  const title = parseTitle(q);
  if (!title) return null;
  const date = parseDate(q);
  const time = parseTime(q);

  // A candidate on the same date, or with a similar title, corroborates it.
  const match = CANDIDATES.find(
    (c) =>
      c.kind === timeline &&
      ((date && c.date === date) || c.title.toLowerCase().includes(title.toLowerCase())),
  );

  if (match) {
    return {
      candidate: { ...match, date: date ?? match.date, time: time ?? match.time, title },
      verified: true,
    };
  }

  const source = selectedDocs[0];
  const base: ChronCandidate = {
    kind: timeline,
    date: date ?? "",
    time,
    title,
    // No document to draw from means no invented narrative — the attorney can
    // write the description in Review before approving.
    description: source
      ? `${title} on ${date ?? "the stated date"}, recorded from ${source}.`
      : `${title}${date ? ` on ${date}` : ""}, as described by the attorney.`,
    eventType: timeline === "medical" ? "Medical Event" : "Case Event",
    tags: timeline === "medical" ? ["Medical Event"] : ["Case Event"],
    evidence: source ? [source] : [],
    confidence: source ? 70 : 0,
  };

  return {
    candidate: base,
    verified: !!source,
    note: source
      ? undefined
      : `I could not verify ${title}${date ? ` on ${date}` : ""} from the available documents. You can add it as an attorney-provided event, or select the source document under Work With first.`,
  };
}

// ── Proposed modification of an existing event ────────────────────────────────

export interface ChronEdit {
  kind: "medical" | "event";
  key: string;              // the seeded event title
  field: "description" | "title" | "date";
  current: string;
  proposed: string;
  reason: string;
  sources: string[];
}

const EDITS: ChronEdit[] = [
  {
    kind: "medical",
    key: "MRI Completed",
    field: "description",
    current: "Diagnostic MRI of the cervical spine was performed, confirming C5–C6 and C6–C7 disc herniations with nerve-root compression.",
    proposed:
      "MRI of the cervical spine confirmed C5–C6 and C6–C7 disc herniations with nerve-root compression, with no evidence of pre-existing degenerative change at either level.",
    reason: "Updated using the MRI report.",
    sources: ["MRI_Report_2026.pdf"],
  },
  {
    kind: "medical",
    key: "Initial Emergency Admission",
    field: "description",
    current: "The plaintiff arrived by ambulance at Cook County Medical Center with acute neck pain and neurological symptoms. Trauma assessment and cervical immobilization were performed on arrival.",
    proposed:
      "The plaintiff arrived by ambulance at Cook County Medical Center at 9:42 AM with acute neck pain and radiating neurological symptoms. Trauma assessment, cervical immobilisation and initial radiographs were performed on arrival.",
    reason: "Updated using the hospital medical record.",
    sources: ["hospital_medical_records.pdf"],
  },
  {
    kind: "event",
    key: "Police Investigation",
    field: "description",
    current: "Responding officers investigated the scene, determined fault, and collected initial witness accounts.",
    proposed:
      "Responding officers investigated the scene, documented skid marks and the debris field, cited the commercial driver for failure to yield, and collected initial witness accounts.",
    reason: "Updated using the police report.",
    sources: ["police_report_final.pdf"],
  },
];

// Best matching edit for a modify request, scored on the words in the message.
export function findEdit(target: string, kind: "medical" | "event" | null): ChronEdit | null {
  const t = target.toLowerCase();
  const pool = kind ? EDITS.filter((e) => e.kind === kind) : EDITS;
  const scored = pool
    .map((e) => {
      const words = e.key.toLowerCase().split(/\s+/);
      return { e, score: words.filter((w) => w.length > 3 && t.includes(w)).length };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0] && scored[0].score > 0 ? scored[0].e : (pool[0] ?? null);
}

// ── Turning an approved candidate into a chronology entry ─────────────────────

export function toAddition(c: ChronCandidate, approvedBy: string): ChronAddition {
  const at = versionStamp();
  const v1: ChronVersion = {
    version: 1,
    label: "AI Generated",
    at,
    by: "AI Assistant",
    approvedBy,
    reason: "Created through AI Assistant from the supporting record.",
    sources: c.evidence,
    snapshot: { title: c.title, description: c.description, date: c.date, time: c.time },
  };
  return {
    id: `ai-${at}-${c.title}`,
    kind: c.kind,
    date: c.date,
    time: c.time,
    title: c.title,
    description: c.description,
    insight:
      "Identified by the AI Assistant from the supporting record and approved by the attorney before being added to the timeline.",
    evidence: c.evidence,
    evidencePage: c.evidencePage,
    category: c.tags[0],
    taxonomy: {
      eventType: c.kind === "medical" ? "medical" : "case",
      category: c.tags[0],
      subcategory: c.tags[1],
      tags: c.tags,
    },
    details: [
      { label: c.kind === "medical" ? "Medical Event Type" : "Event Type", value: c.eventType },
      { label: "AI Confidence", value: `${c.confidence}%` },
    ],
    provenance: "ai-generated",
    addedBy: "AI Assistant",
    addedAt: at,
    history: [v1],
  };
}
