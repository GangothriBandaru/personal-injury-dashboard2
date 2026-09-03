import {
  BUCKET_LABEL, DAMAGE_FIELD_LABEL, formatDamageUSD,
  type DamageBucket, type DamageField, type DamageItem,
} from "../damages/DamagesContext";

// ── AI-assisted damages ───────────────────────────────────────────────────────
// The assistant recognises when a message is asking to change the damage record
// rather than asking a question about it, and answers with a proposal. Nothing
// reaches the damages store until the attorney confirms it here.
//
// A question is answered. Only an instruction produces a proposal, and only a
// confirmed proposal produces a change.

export type DamageIntent =
  | { kind: "none" }
  | { kind: "edit"; target: string; field: DamageField | null; amount: number | null; value: string | null }
  | { kind: "add"; label: string | null; amount: number | null; bucket: DamageBucket | null }
  | { kind: "delete"; target: string }
  | { kind: "move"; target: string; bucket: DamageBucket | null };

// ── Parsing ───────────────────────────────────────────────────────────────────

// "$90,000" · "90000" · "$15k" · "15 k". Returns whole dollars.
export function parseAmount(q: string): number | null {
  const m = q.match(/\$?\s*([\d][\d,]*(?:\.\d{1,2})?)\s*(k|m)?\b/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const scale = m[2]?.toLowerCase() === "k" ? 1_000 : m[2]?.toLowerCase() === "m" ? 1_000_000 : 1;
  return Math.round(n * scale);
}

// The last amount in a sentence, which is the new value in "change X from $A to $B".
function parseTargetAmount(q: string): number | null {
  const all = [...q.matchAll(/\$\s*([\d][\d,]*(?:\.\d{1,2})?)\s*(k|m)?\b/gi)];
  const pool = all.length > 0 ? all : [...q.matchAll(/\b([\d][\d,]{2,}(?:\.\d{1,2})?)\s*(k|m)?\b/gi)];
  if (pool.length === 0) return null;
  const m = pool[pool.length - 1];
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const scale = m[2]?.toLowerCase() === "k" ? 1_000 : m[2]?.toLowerCase() === "m" ? 1_000_000 : 1;
  return Math.round(n * scale);
}

function parseBucket(q: string): DamageBucket | null {
  if (/non-?\s?economic/i.test(q)) return "noneconomic";
  if (/economic/i.test(q)) return "economic";
  return null;
}

// Which field the attorney is naming. Absent an explicit field, an amount in the
// message means the amount; anything else is ambiguous and stays null.
function parseField(q: string, amount: number | null): DamageField | null {
  if (/\bdescription\b|\bdescribe\b/i.test(q)) return "description";
  if (/supporting (information|detail|rationale|reasoning)|\breasoning\b|\brationale\b|\bjustification\b/i.test(q)) return "reasoning";
  if (/supporting evidence|\bevidence\b|\bdocuments? (for|on|behind)\b/i.test(q)) return "docs";
  if (/\bnotes?\b|\bcomment\b/i.test(q)) return "notes";
  if (/damage type|\bcategory\b|\bclassification\b/i.test(q)) return "category";
  if (/\bamount\b|\bvalue\b|\bfigure\b|\btotal\b/i.test(q)) return "amount";
  return amount !== null ? "amount" : null;
}

// Quoted replacement text — "change the description to \"…\"" — when given.
function parseQuoted(q: string): string | null {
  const m = q.match(/["“]([^"”]{3,})["”]/);
  if (m) return m[1].trim();
  const to = q.match(/\bto\s+(?:read\s+)?([A-Z][^.?!]{10,})$/);
  return to ? to[1].trim() : null;
}

// ── Matching a damage by name ─────────────────────────────────────────────────
// Matched against the damages actually on file, never against a fixed list, so
// items the attorney or the assistant added are just as addressable.

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Whether a message names a damage on file, matched strictly. Used to decide
// whether a message is about the damages at all — the fuzzy matching below is
// far too eager for that question.
export function namesDamage(q: string, items: DamageItem[]): boolean {
  const t = norm(q);
  return items.some((i) => t.includes(norm(i.label)) || t.includes(norm(i.category)));
}

export function findDamage(target: string, items: DamageItem[]): DamageItem | null {
  const t = norm(target);
  if (!t) return null;
  // Exact label, then category, then a word-overlap fallback so "medical
  // expenses" still reaches "Medical Expenses" inside a longer sentence.
  const exact = items.find((i) => norm(i.label) === t || norm(i.category) === t);
  if (exact) return exact;
  const contained = items.find((i) => t.includes(norm(i.label)) || norm(i.label).includes(t));
  if (contained) return contained;
  const byCategory = items.find((i) => t.includes(norm(i.category)));
  if (byCategory) return byCategory;
  const words = t.split(" ").filter((w) => w.length > 3);
  let best: { item: DamageItem; score: number } | null = null;
  for (const item of items) {
    const label = norm(item.label).split(" ");
    const score = words.filter((w) => label.some((l) => l.startsWith(w) || w.startsWith(l))).length;
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item ?? null;
}

// Strip the instruction wording so what remains is the damage being named.
function targetPhrase(q: string): string {
  return q
    .replace(/^\s*(please\s+)?/i, "")
    .replace(/\b(change|update|set|edit|modify|revise|amend|correct|adjust|delete|remove|drop|move|reclassify|shift|add|create|the|for|to|from|in|of|under|into|this|damage|damages|entry|line item|item)\b/gi, " ")
    .replace(/\$\s*[\d][\d,]*(\.\d{1,2})?\s*(k|m)?/gi, " ")
    .replace(/\bnon-?\s?economic\b|\beconomic\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Intent ────────────────────────────────────────────────────────────────────

export function detectDamageIntent(q: string): DamageIntent {
  // A question about the damages is a question, never an instruction. This is
  // the guard that keeps analysis from turning into an edit.
  if (/^\s*(what|which|why|how|who|when|where|is|are|do|does|can|could|should|would|explain|summari[sz]e|review|check|compare|tell me|show me|list)\b/i.test(q)
      && !/\b(and|then)\s+(add|delete|remove|move|change|update)\b/i.test(q)) {
    return { kind: "none" };
  }

  const amount = parseTargetAmount(q);
  const bucket = parseBucket(q);

  const asksMove = /\b(move|reclassify|shift|recategori[sz]e|put)\b/i.test(q);
  const asksDelete = /\b(delete|remove|drop|take out|get rid of)\b/i.test(q);
  const asksAdd = /\b(add|create|include|insert|record)\b/i.test(q);
  const asksEdit = /\b(change|update|set|edit|modify|revise|amend|correct|adjust|increase|decrease|raise|lower)\b/i.test(q);

  if (asksMove) return { kind: "move", target: targetPhrase(q), bucket };
  if (asksDelete) return { kind: "delete", target: targetPhrase(q) };
  // "Add … to Economic Damages" is a creation; "change … to $X" is an edit. The
  // verb decides, so a bucket named in an add is a destination, not a move.
  if (asksAdd && !asksEdit) {
    const label = addLabel(q);
    return { kind: "add", label, amount, bucket };
  }
  if (asksEdit) {
    const field = parseField(q, amount);
    return { kind: "edit", target: targetPhrase(q), field, amount, value: parseQuoted(q) };
  }
  return { kind: "none" };
}

// The name of a damage being added — "add $2,500 in transportation expenses",
// "add a new economic damage for home modification costs of $15,000".
function addLabel(q: string): string | null {
  const forPhrase = q.match(/\b(?:for|in|of|covering)\s+([a-z][a-z\s&/-]{2,60}?)(?:\s+(?:costs?|expenses?|damages?|charges?|fees?))?\s*(?:of|at|worth|totalling|totaling|for)?\s*\$?[\d]/i);
  const trailing = q.match(/\b(?:for|in|of|covering)\s+([a-z][a-z\s&/-]{2,60}?)(?:\s+(?:costs?|expenses?|damages?|charges?|fees?))?\s*\.?\s*$/i);
  const raw = (forPhrase?.[1] ?? trailing?.[1] ?? "").trim();
  const cleaned = raw
    .replace(/\b(a|an|the|new|additional|another|economic|non-?economic|damage|damages|bucket|category)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 3) return null;
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Proposals ─────────────────────────────────────────────────────────────────
// Each is a complete, reviewable description of a change. None of them touches
// the store; applying one is a separate, explicit step.

export interface DamageEditProposal {
  id: string;
  label: string;
  /** The attorney's own words, recorded against the change in the audit trail. */
  instruction: string;
  field: DamageField;
  fieldLabel: string;
  current: string;
  proposed: string;
  /** Raw proposed amount, when the field is the amount. */
  amount?: number;
  reason: string;
  /** Documents the figure was derived from, when the attorney selected some. */
  sources?: string[];
}

export interface DamageAddProposal {
  instruction: string;
  bucket: DamageBucket;
  bucketLabel: string;
  label: string;
  amount: number;
  description: string;
  category: string;
  reasoning: string;
  docs: string[];
  /** Fields the assistant had to assume because the request did not say. */
  assumed: string[];
}

export interface DamageDeleteProposal { id: string; label: string; amount: number; bucket: DamageBucket; instruction: string }

export interface DamageMoveProposal {
  instruction: string;
  id: string; label: string; amount: number;
  from: DamageBucket; to: DamageBucket;
  fromLabel: string; toLabel: string;
}

// A damage the records may support that is not on file. Never applied, never
// pre-confirmed — it is an offer to review, and nothing more.
export interface DamageSuggestion {
  label: string;
  category: string;
  bucket: DamageBucket;
  amount: number | null;
  why: string;
  docs: string[];
}

export const DAMAGE_CANDIDATES: DamageSuggestion[] = [
  {
    label: "Household Services", category: "Other Damages", bucket: "economic", amount: 4200,
    why: "The therapy notes record a period of restricted lifting and driving during which household help was engaged; no household-services damage is currently listed.",
    docs: ["physical_therapy_notes.pdf", "Out_of_Pocket_Receipts.pdf"],
  },
  {
    label: "Prescription Costs", category: "Medical Bills", bucket: "economic", amount: 1850,
    why: "The hospital records list post-discharge prescriptions that do not appear in the itemised medical-expense breakdown.",
    docs: ["hospital_medical_records.pdf"],
  },
  {
    label: "Transportation", category: "Transportation", bucket: "economic", amount: 3850,
    why: "The records document repeated medical travel to appointments, which is not currently listed under Economic Damages.",
    docs: ["Mileage_Log.pdf"],
  },
];

// Candidates the damages record does not already carry, matched on the damage's
// own name. Sharing a category with something on file does not make a distinct
// damage a duplicate — prescription costs and hospital bills are both medical.
export function missingDamages(items: DamageItem[]): DamageSuggestion[] {
  const have = new Set(items.map((i) => norm(i.label)));
  return DAMAGE_CANDIDATES.filter((c) => !have.has(norm(c.label)));
}

// ── Building each proposal ────────────────────────────────────────────────────

const fieldValue = (item: DamageItem, field: DamageField): string => {
  switch (field) {
    case "amount": return formatDamageUSD(item.amount);
    case "description": return item.description;
    case "category": return item.category;
    case "reasoning": return item.reasoning;
    case "notes": return item.notes ?? "—";
    case "docs": return item.docs.join(", ");
  }
};

export function buildEditProposal(
  intent: Extract<DamageIntent, { kind: "edit" }>,
  items: DamageItem[],
  instruction: string,
): DamageEditProposal | { error: "no-damage" | "no-field" | "no-value"; target?: string } {
  const item = findDamage(intent.target, items);
  if (!item) return { error: "no-damage", target: intent.target };
  if (!intent.field) return { error: "no-field", target: item.label };

  if (intent.field === "amount") {
    if (intent.amount === null) return { error: "no-value", target: item.label };
    return {
      id: item.id, label: item.label, instruction, field: "amount", fieldLabel: DAMAGE_FIELD_LABEL.amount,
      current: formatDamageUSD(item.amount), proposed: formatDamageUSD(intent.amount),
      amount: intent.amount, reason: "Updated based on the information you provided.",
    };
  }
  if (!intent.value) return { error: "no-value", target: item.label };
  return {
    id: item.id, label: item.label, instruction, field: intent.field, fieldLabel: DAMAGE_FIELD_LABEL[intent.field],
    current: fieldValue(item, intent.field), proposed: intent.value,
    reason: "Updated based on the information you provided.",
  };
}

export function buildAddProposal(
  intent: Extract<DamageIntent, { kind: "add" }>,
  items: DamageItem[],
  instruction: string,
): DamageAddProposal | { error: "no-label" | "no-amount"; label?: string } {
  if (!intent.label) return { error: "no-label" };
  if (intent.amount === null) return { error: "no-amount", label: intent.label };
  const assumed: string[] = [];
  const bucket = intent.bucket ?? (() => { assumed.push("Category"); return "economic" as const; })();
  // An added damage inherits the category of an existing damage with the same
  // name where there is one, so the record stays internally consistent.
  const twin = findDamage(intent.label, items);
  const category = twin && norm(twin.label) === norm(intent.label) ? twin.category : intent.label;
  assumed.push("Description");
  return {
    instruction,
    bucket, bucketLabel: BUCKET_LABEL[bucket],
    label: intent.label,
    amount: intent.amount,
    description: `${intent.label} expenses related to the injury.`,
    category,
    reasoning: "Added at the attorney's instruction through the AI Assistant. Supporting evidence has not yet been attached.",
    docs: [],
    assumed,
  };
}

export function buildDeleteProposal(
  intent: Extract<DamageIntent, { kind: "delete" }>,
  items: DamageItem[],
  instruction: string,
): DamageDeleteProposal | { error: "no-damage"; target: string } {
  const item = findDamage(intent.target, items);
  if (!item) return { error: "no-damage", target: intent.target };
  return { id: item.id, label: item.label, amount: item.amount, bucket: item.bucket, instruction };
}

export function buildMoveProposal(
  intent: Extract<DamageIntent, { kind: "move" }>,
  items: DamageItem[],
  instruction: string,
): DamageMoveProposal | { error: "no-damage" | "no-bucket" | "same-bucket"; target?: string } {
  const item = findDamage(intent.target, items);
  if (!item) return { error: "no-damage", target: intent.target };
  if (!intent.bucket) return { error: "no-bucket", target: item.label };
  if (intent.bucket === item.bucket) return { error: "same-bucket", target: item.label };
  return {
    instruction,
    id: item.id, label: item.label, amount: item.amount,
    from: item.bucket, to: intent.bucket,
    fromLabel: BUCKET_LABEL[item.bucket], toLabel: BUCKET_LABEL[intent.bucket],
  };
}

// A suggestion the attorney chose to review becomes an ordinary add proposal —
// the same card, the same confirmation. Reviewing is not accepting.
export function proposalFromSuggestion(s: DamageSuggestion, instruction: string): DamageAddProposal {
  return {
    instruction,
    bucket: s.bucket, bucketLabel: BUCKET_LABEL[s.bucket],
    label: s.label,
    amount: s.amount ?? 0,
    description: `${s.label} related to the injury, identified in the case records.`,
    category: s.category,
    reasoning: s.why,
    docs: s.docs,
    assumed: s.amount === null ? ["Amount"] : [],
  };
}

// ── Document-derived figures ──────────────────────────────────────────────────
// When the attorney has selected documents and asks for a figure to be worked
// out from them, the proposal is built from those documents only. Reading a
// document never changes anything on its own — it produces a proposal.

export interface DocumentFigure {
  /** What the selected documents, and only those, come to. */
  proposed: number;
  lines: { doc: string; amount: number; counted: boolean }[];
  /** True when the selection already comes to the figure on file. */
  unchanged: boolean;
}

// The figure the selected documents evidence. Only the selection is read — a
// document the damage cites but the attorney did not select is not counted, so
// a narrowed selection deliberately produces a narrowed figure. Documents that
// carry no itemised amount are skipped rather than counted as zero.
export function figureFromDocuments(
  item: DamageItem,
  selected: string[],
  amountFor: (doc: string) => number | null,
): DocumentFigure | null {
  if (selected.length === 0) return null;
  const cited = new Set(item.docs.map((d) => d.toLowerCase()));
  const lines: DocumentFigure["lines"] = [];
  for (const doc of selected) {
    const amount = amountFor(doc);
    if (amount === null) continue;
    lines.push({ doc, amount, counted: cited.has(doc.toLowerCase()) });
  }
  if (lines.length === 0) return null;
  const proposed = lines.reduce((sum, l) => sum + l.amount, 0);
  return { proposed, lines, unchanged: proposed === item.amount };
}
