import { useState, useEffect } from "react";
import {
  X, Plus, Calendar, ChevronLeft, ChevronRight, ChevronDown, FileText, AlertTriangle, Trash2, Sparkles, RotateCcw,
} from "lucide-react";

// ── Manual chronology creation ────────────────────────────────────────────────
// A right-side drawer (same shell as the Evidence / Key Actions drawers) that
// lets an attorney add a Medical or Case event by hand. The active Chronology
// tab decides which of the two forms opens — the type is never asked twice.

const MONTHS_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const MEDICAL_EVENT_TYPES = [
  "Emergency / Admission", "Diagnostic Test", "Imaging", "Specialist Consultation", "Treatment",
  "Physical Therapy", "Follow-Up Evaluation", "Re-Evaluation", "Surgery / Procedure", "Medication", "Other",
];
const CASE_EVENT_TYPES = [
  "Collision / Incident", "Emergency Response", "Police Investigation", "Insurance Claim",
  "Legal / Case Preparation", "Settlement / Negotiation", "Court / Filing", "Communication", "Other",
];
const SEVERITIES = ["Mild", "Moderate", "Severe", "Critical"];

// ── Tag taxonomy ──────────────────────────────────────────────────────────────
// Category → the specificity options available beneath it. Selecting a category
// (and optionally a subcategory) is what generates a card's contextual tags.

export const MEDICAL_TAG_CATEGORIES: Record<string, string[]> = {
  "Emergency Care": ["Initial Assessment", "Hospitalization", "Discharge"],
  "Diagnostic Imaging": ["MRI", "CT Scan", "X-Ray"],
  "Diagnostic Testing": ["Medical Monitoring"],
  "Specialist Consultation": ["Neurology", "Orthopedic Consultation", "Pain Management"],
  "Treatment": ["Medication", "Surgery", "Pain Management"],
  "Rehabilitation": ["Physical Therapy"],
  "Follow-Up": ["Treatment Progress", "Re-Evaluation"],
  "Follow-Up Care": ["Prognosis", "Permanent Impairment"],
  "Hospitalization": ["Discharge", "Medical Monitoring"],
};

export const CASE_TAG_CATEGORIES: Record<string, string[]> = {
  "Accident": ["Collision", "Liability"],
  "Emergency Response": ["Accident Response"],
  "Police Investigation": ["Liability Evidence", "Evidence Collection"],
  "Evidence Collection": ["Witness Evidence", "Medical Evidence", "Damages Evidence"],
  "Insurance": ["Claim", "Insurance Claim"],
  "Case Preparation": ["Evidence Collection", "Document Collection"],
  "Legal Review": ["Discovery", "Court Filing", "Defense Response"],
  "Settlement": ["Negotiation", "Demand"],
  "Case Milestone": [],
};

// Keyword rules behind the AI suggestion, used only when the attorney has not
// picked a category. Ordered — the first match becomes the primary tag.
const MEDICAL_HINTS: [RegExp, string, string?][] = [
  [/\bmri\b/i, "Diagnostic Imaging", "MRI"],
  [/\bct\b|cat scan/i, "Diagnostic Imaging", "CT Scan"],
  [/x-?ray|radiograph/i, "Diagnostic Imaging", "X-Ray"],
  [/emergency|ambulance|admitted|admission|\ber\b/i, "Emergency Care", "Initial Assessment"],
  [/physical therapy|\bpt\b|rehab/i, "Rehabilitation", "Physical Therapy"],
  [/neurolog/i, "Specialist Consultation", "Neurology"],
  [/orthoped/i, "Specialist Consultation", "Orthopedic Consultation"],
  [/consult|specialist|evaluated by/i, "Specialist Consultation"],
  [/surger|operat|procedure/i, "Treatment", "Surgery"],
  [/medication|prescrib|dispens/i, "Treatment", "Medication"],
  [/pain management/i, "Treatment", "Pain Management"],
  [/re-?evaluat|progress|mid-treatment/i, "Follow-Up", "Treatment Progress"],
  [/prognos|permanent|impairment|residual/i, "Follow-Up Care", "Prognosis"],
  [/follow-?up/i, "Follow-Up", undefined],
  [/discharge/i, "Hospitalization", "Discharge"],
  [/imaging|scan/i, "Diagnostic Imaging"],
  [/treatment|therapy/i, "Treatment"],
];

const CASE_HINTS: [RegExp, string, string?][] = [
  [/collision|crash|struck|accident|impact/i, "Accident", "Liability"],
  [/ambulance|emergency service|first responder|dispatch|\bems\b/i, "Emergency Response", "Accident Response"],
  [/police|officer|citation|investigat/i, "Police Investigation", "Liability Evidence"],
  [/witness/i, "Evidence Collection", "Witness Evidence"],
  [/insurance|carrier|policy|claim/i, "Insurance", "Claim"],
  [/demand|settle|negotiat|offer/i, "Settlement", "Negotiation"],
  [/court|filing|motion|pleading|discovery/i, "Legal Review", "Court Filing"],
  [/records|document|assembl|prepar|index/i, "Case Preparation", "Evidence Collection"],
  [/deposition|defense|response/i, "Legal Review", "Defense Response"],
];

// Suggest up to two tags from the event's own text and attachments.
export function suggestTags(kind: "medical" | "event", title: string, description: string, evidence: string[] = []): string[] {
  const hay = [title, description, ...evidence].join(" ");
  const hints = kind === "medical" ? MEDICAL_HINTS : CASE_HINTS;
  for (const [re, cat, sub] of hints) {
    if (re.test(hay)) return sub ? [cat, sub] : [cat];
  }
  return [];
}

// Category + subcategory → the tags a card renders. Primary category first,
// then specificity; duplicates collapsed and capped at three.
export function tagsFor(category: string, subcategory: string): string[] {
  return Array.from(new Set([category, subcategory].filter(Boolean))).slice(0, 3);
}

// Event type → the category the Chronology filter dropdown groups by, so a
// manually added event stays reachable through the existing Filters card.
const MEDICAL_TYPE_CATEGORY: Record<string, string> = {
  "Emergency / Admission": "Emergency",
  "Diagnostic Test": "Diagnostic",
  "Imaging": "Diagnostic",
  "Specialist Consultation": "Consultation",
  "Treatment": "Therapy",
  "Physical Therapy": "Therapy",
  "Follow-Up Evaluation": "Evaluation",
  "Re-Evaluation": "Evaluation",
  "Surgery / Procedure": "Procedure",
  "Medication": "Medication",
  "Other": "Other",
};
const CASE_TYPE_CATEGORY: Record<string, string> = {
  "Collision / Incident": "Incident",
  "Emergency Response": "Medical Response",
  "Police Investigation": "Investigation",
  "Insurance Claim": "Insurance",
  "Legal / Case Preparation": "Preparation",
  "Settlement / Negotiation": "Negotiation",
  "Court / Filing": "Filing",
  "Communication": "Communication",
  "Other": "Other",
};

// What the drawer hands back to the Chronology timeline on save.
export interface CreatedChronology {
  kind: "medical" | "event";
  date: string;                                  // "Mar 1, 2026"
  time?: string;                                 // "2:30 PM"
  title: string;
  description: string;
  category: string;                              // drives the existing event-type filter
  // Structured tag metadata — what the chronology card renders as contextual tags.
  taxonomy: { eventType: "medical" | "case"; category: string; subcategory?: string; tags: string[] };
  evidence: string[];
  actions?: { text: string }[];                  // Event Chronology key actions
  details: { label: string; value: string }[];   // provider / injury / severity / notes
  addedBy: string;
  addedAt: string;                               // "Aug 25, 2026 · 12:42 AM"
}

export interface ExistingChronology { date: string; title: string; description: string }

const fmtDate = (d: Date) => `${MONTHS_ABBR[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

// "14:30" (native time input) → "2:30 PM"
function fmtTime(v: string): string {
  if (!v) return "";
  const [h, m] = v.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function fmtStamp(d: Date) {
  return `${fmtDate(d)} · ${fmtTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`)}`;
}

// ── Form primitives (same input language as the workspace filters) ────────────

const INPUT_BASE =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm text-ink placeholder:text-[#9BA8B4] focus:outline-none transition-colors";
const inputCls = (invalid?: boolean) =>
  `${INPUT_BASE} ${invalid ? "border-[#DC2626] focus:border-[#DC2626]" : "border-line focus:border-brand"}`;

function Field({
  label, required, error, hint, children,
}: { label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow mb-2">
        {label}{required && <span className="text-[#DC2626] ml-0.5">*</span>}
      </div>
      {children}
      {hint && !error && <p className="text-[11px] text-[#8A98A3] mt-1.5">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1.5 text-[11px] text-[#B91C1C] mt-1.5">
          <AlertTriangle className="w-3 h-3 shrink-0" strokeWidth={2} /> {error}
        </p>
      )}
    </div>
  );
}

// Dropdown built from the same markup as the Chronology Filters dropdown.
function SelectField({
  value, placeholder, options, invalid, onChange,
}: { value: string; placeholder: string; options: string[]; invalid?: boolean; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
          invalid ? "border-[#DC2626]" : value ? "border-line bg-white text-ink hover:border-soft" : "border-line bg-white hover:border-soft"
        }`}
      >
        <span className={`truncate ${value ? "text-ink" : "text-[#9BA8B4]"}`}>{value || placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-[#5B6B78] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-1.5 z-20 max-h-[230px] overflow-y-auto rounded-lg border border-line bg-white shadow-lg p-1">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  value === opt ? "bg-tint text-deep font-medium" : "text-ink hover:bg-wash"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Date field — the same month grid the Chronology date filter uses, expanded
// in place so it is never clipped by the drawer's scroll area.
function DateField({ value, invalid, onChange }: { value: Date | null; invalid?: boolean; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  const initial = value ?? new Date(2026, 1, 1);
  const [cal, setCal] = useState({ year: initial.getFullYear(), month: initial.getMonth() });
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
  const isSelected = (d: Date) =>
    !!value && d.getFullYear() === value.getFullYear() && d.getMonth() === value.getMonth() && d.getDate() === value.getDate();

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
          invalid ? "border-[#DC2626] bg-white text-ink" : value ? "border-brand bg-tint text-deep" : "border-line bg-white text-ink hover:border-soft"
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Calendar className="w-4 h-4 text-[#5B6B78] shrink-0" strokeWidth={1.75} />
          <span className={`truncate ${value ? "" : "text-[#9BA8B4] font-normal"}`}>{value ? fmtDate(value) : "Select a date"}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-[#5B6B78] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="mt-1.5 rounded-xl border border-line bg-white shadow-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5B6B78] hover:bg-wash hover:text-ink transition-colors">
              <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
            </button>
            <span className="card-title">{MONTHS_FULL[cal.month]} {cal.year}</span>
            <button type="button" onClick={() => shift(1)} aria-label="Next month" className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5B6B78] hover:bg-wash hover:text-ink transition-colors">
              <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, k) => (
              <div key={k} className="text-center eyebrow py-1">{d}</div>
            ))}
            {cells.map((day, k) => {
              if (day === null) return <div key={k} />;
              const date = new Date(cal.year, cal.month, day);
              const selected = isSelected(date);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => { onChange(date); setOpen(false); }}
                  className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                    selected ? "bg-brand text-white" : "text-ink hover:bg-wash"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Supporting Evidence — attach existing case documents; each becomes a file chip.
function EvidencePicker({
  selected, documents, invalid, onChange,
}: { selected: string[]; documents: string[]; invalid?: boolean; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const available = documents.filter((d) => !selected.includes(d));
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((name) => (
          <span key={name} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-offwhite px-3 py-2 text-sm text-ink">
            <FileText className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
            <span className="truncate max-w-[200px]">{name}</span>
            <button
              type="button"
              onClick={() => onChange(selected.filter((n) => n !== name))}
              aria-label={`Remove ${name}`}
              className="ml-0.5 w-5 h-5 flex items-center justify-center rounded-md text-[#8A98A3] hover:bg-tint hover:text-ink transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </span>
        ))}

        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            disabled={available.length === 0}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              invalid ? "border-[#DC2626] bg-white text-ink" : "border-line bg-white text-deep hover:border-brand hover:bg-tint"
            }`}
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} /> Attach Evidence
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute left-0 mt-1.5 z-20 w-[260px] max-h-[230px] overflow-y-auto rounded-lg border border-line bg-white shadow-lg p-1">
                {available.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { onChange([...selected, d]); setOpen(false); }}
                    className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-md text-sm text-ink hover:bg-wash transition-colors"
                  >
                    <FileText className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
                    <span className="truncate">{d}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Duplicate detection ───────────────────────────────────────────────────────

const tokens = (s: string) =>
  new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2));

// Jaccard overlap — cheap and good enough to flag a near-identical entry.
function overlap(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  A.forEach((w) => { if (B.has(w)) shared++; });
  return shared / (A.size + B.size - shared);
}

// An existing label may be a range ("Feb 14 – 15, 2026"), so match the month/day
// on a word boundary — "Feb 1" must not match "Feb 14".
function coversDate(label: string, d: Date): boolean {
  const re = new RegExp(`${MONTHS_ABBR[d.getMonth()]}\\s+${d.getDate()}(?!\\d)`, "i");
  return re.test(label) && label.includes(String(d.getFullYear()));
}

function findSimilar(existing: ExistingChronology[], date: Date, title: string, description: string) {
  return existing.find(
    (e) => coversDate(e.date, date) && (overlap(e.title, title) >= 0.5 || overlap(e.description, description) >= 0.45),
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  kind: "medical" | "event";
  documents: string[];
  existing: ExistingChronology[];
  addedBy: string;
  onCancel: () => void;
  onSubmit: (created: CreatedChronology) => void;
}

const emptyForm = () => ({
  title: "", date: null as Date | null, time: "", type: "", provider: "", description: "",
  injury: "", severity: "", evidence: [] as string[], notes: "", actions: [""] as string[],
  tagCategory: "", tagSub: "", tags: [] as string[], tagsTouched: false,
});
type FormState = ReturnType<typeof emptyForm>;

export function AddChronologyDrawer({ open, kind, documents, existing, addedBy, onCancel, onSubmit }: Props) {
  const [f, setF] = useState<FormState>(emptyForm);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [dup, setDup] = useState<ExistingChronology | null>(null);
  const [dupExpanded, setDupExpanded] = useState(false);

  const isMedical = kind === "medical";

  // Reset the form each time the drawer opens.
  useEffect(() => {
    if (open) { setF(emptyForm()); setTouched({}); setConfirmDiscard(false); setDup(null); setDupExpanded(false); }
  }, [open, kind]);

  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setF((p) => ({ ...p, [key]: value }));
    setDup(null);
    setDupExpanded(false);
  };
  const touch = (key: string) => setTouched((t) => ({ ...t, [key]: true }));

  const filledActions = f.actions.map((a) => a.trim()).filter(Boolean);
  const dirty =
    f.title.trim() !== "" || !!f.date || f.time !== "" || f.type !== "" || f.provider.trim() !== "" ||
    f.description.trim() !== "" || f.injury.trim() !== "" || f.severity !== "" || f.evidence.length > 0 ||
    f.notes.trim() !== "" || filledActions.length > 0 || f.tagCategory !== "" || f.tags.length > 0;

  // ── Contextual tags ──
  // A chosen category always wins. With nothing chosen, the AI suggests tags
  // from the event's own text and attachments — and the attorney can edit
  // either result before saving.
  const catalogue = isMedical ? MEDICAL_TAG_CATEGORIES : CASE_TAG_CATEGORIES;
  const tagCategories = Object.keys(catalogue);
  const tagSubs = f.tagCategory ? catalogue[f.tagCategory] ?? [] : [];
  const aiTags = suggestTags(kind, f.title, f.description, f.evidence);
  const derivedTags = f.tagCategory ? tagsFor(f.tagCategory, f.tagSub) : aiTags;
  // Once the attorney edits the strip, their list is authoritative.
  const effectiveTags = f.tagsTouched ? f.tags : derivedTags;
  const tagsAreSuggested = !f.tagsTouched && !f.tagCategory && aiTags.length > 0;

  const removeTag = (t: string) =>
    setF((prev) => ({ ...prev, tags: effectiveTags.filter((x) => x !== t), tagsTouched: true }));
  const applySuggestion = () =>
    setF((prev) => ({ ...prev, tags: aiTags, tagsTouched: true }));

  // Required: title, date, type, description — plus evidence for a medical event.
  const missing = {
    title: f.title.trim() === "",
    date: !f.date,
    type: f.type === "",
    description: f.description.trim() === "",
    evidence: isMedical && f.evidence.length === 0,
  };
  const complete = !Object.values(missing).some(Boolean);
  // A required field only turns red once the attorney has been through it.
  const invalid = (key: keyof typeof missing) => !!touched[key] && missing[key];
  const err = (key: keyof typeof missing, message: string) => (invalid(key) ? message : undefined);

  const requestClose = () => (dirty ? setConfirmDiscard(true) : onCancel());

  const save = () => {
    const date = fmtDate(f.date!);
    const now = new Date();
    onSubmit({
      kind,
      date,
      time: fmtTime(f.time) || undefined,
      title: f.title.trim(),
      description: f.description.trim(),
      category: (isMedical ? MEDICAL_TYPE_CATEGORY : CASE_TYPE_CATEGORY)[f.type] ?? "Other",
      taxonomy: {
        eventType: isMedical ? "medical" : "case",
        category: f.tagCategory || effectiveTags[0] || "",
        subcategory: f.tagSub || effectiveTags[1] || undefined,
        tags: effectiveTags,
      },
      evidence: f.evidence,
      actions: isMedical ? undefined : filledActions.map((text) => ({ text })),
      details: [
        { label: isMedical ? "Medical Event Type" : "Event Type", value: f.type },
        ...(isMedical && f.provider.trim() ? [{ label: "Provider / Facility", value: f.provider.trim() }] : []),
        ...(isMedical && f.injury.trim() ? [{ label: "Injury / Condition", value: f.injury.trim() }] : []),
        ...(isMedical && f.severity ? [{ label: "Severity", value: f.severity }] : []),
        ...(f.notes.trim() ? [{ label: "Additional Notes", value: f.notes.trim() }] : []),
      ],
      addedBy,
      addedAt: fmtStamp(now),
    });
  };

  // First click warns about a near-identical entry; the attorney is never blocked.
  const attemptSave = () => {
    if (!complete) { setTouched({ title: true, date: true, type: true, description: true, evidence: true }); return; }
    const match = findSimilar(existing, f.date!, f.title.trim(), f.description.trim());
    if (match && !dup) { setDup(match); return; }
    save();
  };

  const heading = isMedical ? "Add Medical Chronology" : "Add Event Chronology";
  const sub = isMedical
    ? "Create a medical event and add it to the treatment timeline."
    : "Create a case event and add it to the case timeline.";

  return (
    <>
      {/* Sits above the floating notes button (z-60) so the footer actions stay clickable */}
      <div className="fixed inset-0 bg-ink/40 z-[70]" onClick={requestClose} />
      <div className="fixed top-0 right-0 h-full w-[460px] max-w-[92vw] bg-white shadow-xl z-[70] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line shrink-0">
          <div className="min-w-0">
            <div className="eyebrow mb-1">{isMedical ? "Medical Chronology" : "Event Chronology"}</div>
            <h2 className="card-title">{heading}</h2>
            <p className="secondary-text mt-1">{sub}</p>
          </div>
          <button onClick={requestClose} title="Close" className="p-1.5 hover:bg-tint rounded-lg transition-colors shrink-0">
            <X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <Field label="Event Title" required error={err("title", "Event title is required.")}>
            <input
              value={f.title}
              onChange={(e) => set("title", e.target.value)}
              onBlur={() => touch("title")}
              placeholder={isMedical ? "e.g. Neurology Consultation" : "e.g. Police Investigation"}
              className={inputCls(invalid("title"))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required error={err("date", "Please select a date.")}>
              <DateField value={f.date} invalid={invalid("date")} onChange={(d) => { set("date", d); touch("date"); }} />
            </Field>
            <Field label="Time">
              <input
                type="time"
                value={f.time}
                onChange={(e) => set("time", e.target.value)}
                className={inputCls()}
              />
            </Field>
          </div>

          <Field label={isMedical ? "Medical Event Type" : "Event Type"} required error={err("type", "Please select an event type.")}>
            <SelectField
              value={f.type}
              placeholder="Select a type"
              options={isMedical ? MEDICAL_EVENT_TYPES : CASE_EVENT_TYPES}
              invalid={invalid("type")}
              onChange={(v) => { set("type", v); touch("type"); }}
            />
          </Field>

          {/* Event Category → the contextual tags shown on the chronology card */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Event Category">
              <SelectField
                value={f.tagCategory}
                placeholder="Select a category"
                options={tagCategories}
                onChange={(v) => setF((prev) => ({ ...prev, tagCategory: v, tagSub: "", tagsTouched: false }))}
              />
            </Field>
            <Field label={isMedical ? "Specialty / Subcategory" : "Subcategory"}>
              <SelectField
                value={f.tagSub}
                placeholder={f.tagCategory ? "Optional" : "Category first"}
                options={tagSubs}
                onChange={(v) => setF((prev) => ({ ...prev, tagSub: v, tagsTouched: false }))}
              />
            </Field>
          </div>

          <Field
            label="Tags"
            hint={
              effectiveTags.length === 0
                ? "Pick a category, or add a title and description and the tags will be suggested for you."
                : tagsAreSuggested
                ? "Suggested from this event — remove any that do not fit before saving."
                : "Shown on the chronology card, in this order."
            }
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {effectiveTags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-md border border-[#DCEEF4] bg-tint px-2 py-1 text-[11px] font-medium text-deep"
                >
                  {t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    aria-label={`Remove ${t}`}
                    className="ml-0.5 w-4 h-4 flex items-center justify-center rounded hover:bg-[#D7EEF5] transition-colors"
                  >
                    <X className="w-3 h-3" strokeWidth={2} />
                  </button>
                </span>
              ))}
              {tagsAreSuggested && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#8A98A3]">
                  <Sparkles className="w-3 h-3" strokeWidth={1.75} /> AI suggested
                </span>
              )}
              {aiTags.length > 0 && effectiveTags.length === 0 && (
                <button
                  type="button"
                  onClick={applySuggestion}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-deep hover:border-brand hover:bg-tint transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} /> Use suggested tags
                </button>
              )}
              {f.tagsTouched && (
                <button
                  type="button"
                  onClick={() => setF((prev) => ({ ...prev, tags: [], tagsTouched: false }))}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#5B6B78] hover:text-ink transition-colors"
                >
                  <RotateCcw className="w-3 h-3" strokeWidth={1.75} /> Reset
                </button>
              )}
            </div>
          </Field>

          {isMedical && (
            <Field label="Provider / Facility">
              <input
                value={f.provider}
                onChange={(e) => set("provider", e.target.value)}
                placeholder="e.g. Cook County Medical Center"
                className={inputCls()}
              />
            </Field>
          )}

          <Field label="Description" required error={err("description", "A description is required.")}>
            <textarea
              value={f.description}
              onChange={(e) => set("description", e.target.value)}
              onBlur={() => touch("description")}
              rows={4}
              placeholder={isMedical ? "Describe what happened during this medical event..." : "Describe what happened during this case event..."}
              className={`${inputCls(invalid("description"))} resize-y leading-relaxed`}
            />
          </Field>

          {isMedical && (
            <>
              <Field label="Injury / Condition">
                <input
                  value={f.injury}
                  onChange={(e) => set("injury", e.target.value)}
                  placeholder="e.g. Cervical spine injury, C5-C6 disc herniation"
                  className={inputCls()}
                />
              </Field>
              <Field label="Severity">
                <SelectField value={f.severity} placeholder="Select severity" options={SEVERITIES} onChange={(v) => set("severity", v)} />
              </Field>
            </>
          )}

          {/* Event Chronology — repeatable key actions */}
          {!isMedical && (
            <Field label="Key Actions" hint="Add the individual steps within this event. These appear in the card and the Key Actions drawer.">
              <div className="space-y-2">
                {f.actions.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={a}
                      onChange={(e) => set("actions", f.actions.map((x, k) => (k === i ? e.target.value : x)))}
                      placeholder={`e.g. ${["Commercial vehicle entered the intersection", "Impact with plaintiff's vehicle", "Emergency services notified"][i % 3]}`}
                      className={inputCls()}
                    />
                    {f.actions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => set("actions", f.actions.filter((_, k) => k !== i))}
                        aria-label="Remove action"
                        className="p-2 rounded-lg text-[#8A98A3] hover:bg-tint hover:text-ink transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => set("actions", [...f.actions, ""])}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium text-deep hover:border-brand hover:bg-tint transition-colors"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.75} /> Add Action
                </button>
              </div>
            </Field>
          )}

          <Field
            label="Supporting Evidence"
            required={isMedical}
            error={err("evidence", "Please add at least one supporting document.")}
            hint={isMedical ? undefined : "Attach case documents so Preview Evidences and Insights stay available on this event."}
          >
            <EvidencePicker
              selected={f.evidence}
              documents={documents}
              invalid={invalid("evidence")}
              onChange={(next) => { set("evidence", next); touch("evidence"); }}
            />
          </Field>

          <Field label="Additional Notes">
            <textarea
              value={f.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              placeholder="Anything else the file should record about this event..."
              className={`${inputCls()} resize-y leading-relaxed`}
            />
          </Field>

          {/* Duplicate warning — informative, never blocking */}
          {dup && (
            <div className="rounded-xl border border-[#FDE6C8] bg-[#FFF7ED] p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0" strokeWidth={1.75} />
                <h4 className="text-sm font-semibold text-[#B45309]">Similar chronology already exists</h4>
              </div>
              <p className="secondary-text leading-relaxed">
                An event on {dup.date} looks close to what you entered. You can review it first or add this one anyway.
              </p>
              {dupExpanded && (
                <div className="rounded-lg border border-[#FDE6C8] bg-white p-3 mt-3">
                  <div className="mono-ref mb-1">{dup.date}</div>
                  <div className="text-sm font-semibold text-ink leading-snug">{dup.title}</div>
                  <p className="body-text leading-relaxed mt-1.5">{dup.description}</p>
                </div>
              )}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => setDupExpanded((v) => !v)}
                  className="btn btn-secondary px-3 py-2 text-sm"
                >
                  {dupExpanded ? "Hide Existing" : "Review Existing"}
                </button>
                <button onClick={save} className="btn btn-primary px-3 py-2 text-sm">Add Anyway</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line p-4 flex items-center justify-between gap-2 shrink-0">
          <button onClick={requestClose} className="btn btn-secondary">Cancel</button>
          <button onClick={attemptSave} disabled={!complete} className="btn btn-primary gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus className="w-4 h-4" strokeWidth={1.75} /> Add Chronology
          </button>
        </div>

        {/* Discard confirmation */}
        {confirmDiscard && (
          <div className="absolute inset-0 z-30 flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-ink/40" onClick={() => setConfirmDiscard(false)} />
            <div className="relative w-full rounded-xl border border-line bg-white shadow-xl p-5">
              <h3 className="card-title mb-1.5">Discard changes?</h3>
              <p className="body-text leading-relaxed">
                You have unsaved chronology information. Are you sure you want to close?
              </p>
              <div className="flex items-center justify-end gap-2 mt-4">
                <button onClick={() => setConfirmDiscard(false)} className="btn btn-secondary">Keep Editing</button>
                {/* Destructive actions read as red text on a soft wash here, never a solid fill */}
                <button
                  onClick={() => { setConfirmDiscard(false); onCancel(); }}
                  className="btn border border-[#FBD5D5] bg-[#FEF2F2] text-[#B91C1C] hover:bg-[#FDE6E6]"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
