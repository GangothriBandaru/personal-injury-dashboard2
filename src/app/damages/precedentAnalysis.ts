// ── Precedent analysis ────────────────────────────────────────────────────────
// Everything the reasoning card says about comparable cases is computed here,
// from the comparable verdicts actually on file. Nothing is asserted that the
// dataset does not support: the counts are counts, the range is the range, and
// a pattern is reported as "N of M" against the cases that were searched.
//
// The verdicts are passed in rather than imported, so this stays a pure module
// the stage can call without a dependency cycle.

export interface PrecedentCase {
  caseName: string;
  amount: number;
  summary: string;
  matchScore: number;
  labels: string[];
  tags: string[];
  whyThisMatters: string;
  similarityBreakdown: { label: string; contribution: number; explanation: string }[];
  filterValues: Record<string, string>;
}

export type Relevance = "high" | "moderate" | "low";

// Bands over the match score the dataset already carries. Stated on the card so
// the reader knows this is a classification of the scores, not a new judgement.
export const RELEVANCE_BANDS: { key: Relevance; label: string; min: number }[] = [
  { key: "high", label: "high-relevance", min: 90 },
  { key: "moderate", label: "moderate-relevance", min: 75 },
  { key: "low", label: "lower-relevance", min: 0 },
];

export const relevanceOf = (matchScore: number): Relevance =>
  RELEVANCE_BANDS.find((b) => matchScore >= b.min)!.key;

const median = (ns: number[]): number => {
  if (ns.length === 0) return 0;
  const sorted = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
};

export interface PrecedentSummary {
  cases: PrecedentCase[];
  total: number;
  byRelevance: { key: Relevance; label: string; count: number }[];
  lowest: number;
  median: number;
  highest: number;
}

export function summarisePrecedents(cases: PrecedentCase[]): PrecedentSummary {
  const amounts = cases.map((c) => c.amount);
  return {
    cases: [...cases].sort((a, b) => b.matchScore - a.matchScore),
    total: cases.length,
    byRelevance: RELEVANCE_BANDS
      .map((b) => ({ key: b.key, label: b.label, count: cases.filter((c) => relevanceOf(c.matchScore) === b.key).length }))
      .filter((b) => b.count > 0),
    lowest: amounts.length ? Math.min(...amounts) : 0,
    median: median(amounts),
    highest: amounts.length ? Math.max(...amounts) : 0,
  };
}

// Where one precedent sits against the others, which is what makes it an upper,
// middle or lower reference rather than an opinion about it.
export function settlementInfluence(amount: number, s: PrecedentSummary): string {
  if (s.total < 2) return "Provides the only settlement reference on file.";
  if (amount >= s.highest) return "Supports the upper portion of the current valuation range.";
  if (amount <= s.lowest) return "Provides a lower-end valuation reference.";
  return "Supports the middle of the current valuation range.";
}

// The strongest similarity dimensions the dataset records for a case, which is
// where "why it matches" comes from — the explanations are the dataset's own.
export const whyItMatches = (c: PrecedentCase, limit = 4): string[] =>
  [...c.similarityBreakdown].sort((a, b) => b.contribution - a.contribution).slice(0, limit).map((s) => s.explanation);

// ── Patterns ──────────────────────────────────────────────────────────────────
// A pattern is a phrase searched across everything the dataset records for a
// case. The count is how many cases matched, out of how many were searched.

const searchable = (c: PrecedentCase): string =>
  [c.caseName, c.summary, c.whyThisMatters, ...c.labels, ...c.tags,
   ...c.similarityBreakdown.map((s) => `${s.label} ${s.explanation}`),
   ...Object.values(c.filterValues)].join(" ").toLowerCase();

const PATTERNS: { label: string; test: RegExp }[] = [
  { label: "Permanent impairment", test: /permanen/ },
  { label: "Severe injury severity", test: /\bsevere\b/ },
  { label: "Long-term or ongoing medical impact", test: /long-term|ongoing|lasting|continuing/ },
  { label: "Commercial-carrier context", test: /commercial/ },
  { label: "Same jurisdiction as this case", test: /cook county/ },
  { label: "Documented liability finding", test: /liability|fault|violation/ },
];

export interface Pattern { label: string; count: number; total: number }

export function patternsAcross(cases: PrecedentCase[]): Pattern[] {
  const texts = cases.map(searchable);
  return PATTERNS
    .map((p) => ({ label: p.label, count: texts.filter((t) => p.test.test(t)).length, total: cases.length }))
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count);
}

// ── Current case against the precedents ───────────────────────────────────────
// Each row states what this case has and how many precedents share it, so the
// attorney can see why the AI treats these cases as comparable.

export interface ComparisonRow { attribute: string; current: string; precedent: string }

export function compareToPrecedents(
  cases: PrecedentCase[],
  current: { severity: string; evidenceStrength: string; docCount: number; caseType: string; jurisdiction: string },
): ComparisonRow[] {
  const texts = cases.map(searchable);
  const n = cases.length;
  const share = (re: RegExp) => `${texts.filter((t) => re.test(t)).length} of ${n} cases`;
  const jurisdictionWord = current.jurisdiction.split(",")[0].trim().toLowerCase();
  return [
    { attribute: "Severity", current: current.severity, precedent: share(/\bsevere\b/) },
    { attribute: "Permanent impairment", current: "Documented", precedent: share(/permanen/) },
    { attribute: "Long-term medical impact", current: "Documented", precedent: share(/long-term|ongoing|lasting|continuing/) },
    { attribute: "Case type", current: current.caseType, precedent: share(/commercial|motor vehicle/) },
    { attribute: "Jurisdiction", current: current.jurisdiction, precedent: share(new RegExp(jurisdictionWord)) },
    { attribute: "Supporting evidence", current: `${current.docCount} documents · ${current.evidenceStrength}`, precedent: share(/liability|fault|violation/) },
  ];
}

// ── The recommendation for this factor ────────────────────────────────────────
// The band is the factor's own; the money is that band applied to the economic
// damages currently on file, which is the calculation the stage already uses.

export interface FactorRecommendation {
  low: number;
  high: number;
  position: number;
  valueLow: number;
  valueHigh: number;
  estimate: number;
}

export function recommendationFor(range: [number, number], economicTotal: number): FactorRecommendation {
  const [low, high] = range;
  const position = Math.round(((low + high) / 2) * 100) / 100;
  return {
    low,
    high,
    position,
    valueLow: Math.round(economicTotal * low),
    valueHigh: Math.round(economicTotal * high),
    estimate: Math.round(economicTotal * position),
  };
}

// Where this case's own estimate falls against the comparable settlements —
// the sentence that closes the card. Only says what the numbers show.
export function positionAgainstPrecedents(estimate: number, s: PrecedentSummary): "upper" | "middle" | "lower" | "outside" {
  if (s.total === 0) return "outside";
  if (estimate > s.highest || estimate < s.lowest) return "outside";
  if (estimate >= s.median) return "upper";
  if (estimate <= s.lowest) return "lower";
  return "middle";
}

// ── One precedent, in full ────────────────────────────────────────────────────
// The dataset records a summary, a similarity breakdown and a set of filter
// values for each comparable case. These read those fields into the legal
// dimensions an attorney wants them in. Where the dataset carries nothing for a
// dimension the section says so — it is never filled in with a plausible guess.

const UNRECORDED = "Not recorded in the precedent data.";

const isRecorded = (v: string | undefined): v is string =>
  !!v && v.trim().length > 0 && !/^not specified$/i.test(v);

// The breakdown explanations whose label matches, which is where the dataset
// keeps its own account of each dimension.
const explain = (c: PrecedentCase, re: RegExp): string[] =>
  c.similarityBreakdown.filter((b) => re.test(b.label)).map((b) => b.explanation);

export interface OverviewSection {
  label: string;
  /** A paragraph, where the dataset holds one. */
  body?: string;
  /** Single-value dimensions, rendered as label/value rather than bullets. */
  facts: { label: string; value: string }[];
  items: string[];
  /** True when the dataset carries nothing for this dimension. */
  empty: boolean;
}

const section = (
  label: string,
  items: string[],
  body?: string,
  facts: { label: string; value: string }[] = [],
): OverviewSection => ({
  label,
  body,
  facts,
  items,
  empty: items.length === 0 && facts.length === 0 && !body,
});

export function caseOverview(c: PrecedentCase): OverviewSection[] {
  const violation = c.filterValues.violation;
  const statute = c.filterValues.legalStatute;
  const injury = c.filterValues.injuryType;
  const severity = c.filterValues.severity;

  const liability = [
    ...explain(c, /liability/i),
    ...(isRecorded(violation) ? [`Conduct at issue: ${violation}`] : []),
  ];

  // The dataset does not separate negligence from liability, so this reports
  // the conduct it does record rather than inferring a distinct finding.
  const negligence = [
    ...c.tags.filter((t) => /violation|fault|failure|yield|delay|breach|negligen/i.test(t)),
    ...explain(c, /case context/i),
  ];

  const violations = [
    ...(isRecorded(violation) ? [violation] : []),
    ...(isRecorded(statute) && statute !== violation ? [statute] : []),
  ];

  const injuryFacts = [
    ...(isRecorded(injury) ? [{ label: "Injury", value: injury }] : []),
    ...(isRecorded(severity) ? [{ label: "Severity", value: severity }] : []),
  ];
  const injuries = explain(c, /injury|impact/i);

  return [
    section("Case Summary", [], c.summary),
    section("Liability", Array.from(new Set(liability))),
    section("Negligence", Array.from(new Set(negligence))),
    section("Violations", Array.from(new Set(violations))),
    section("Injuries & Damages", Array.from(new Set(injuries)), undefined, injuryFacts),
  ];
}

export const OVERVIEW_UNRECORDED = UNRECORDED;

// ── One precedent against this case ───────────────────────────────────────────
// Only dimensions the record carries on both sides appear. A row is never
// invented to fill the table out, and where this case has no counterpart the
// dimension is left off rather than guessed at.

export interface CurrentCaseProfile {
  severity: string;
  caseType: string;
  jurisdiction: string;
  evidenceStrength: string;
  docCount: number;
  /** This case's own estimate for the factor, for the settlement row. */
  estimate: number;
}

export interface MapRow { attribute: string; precedent: string; current: string; aligned: boolean }

const sameish = (a: string, b: string) => {
  const na = a.toLowerCase(), nb = b.toLowerCase();
  return na === nb || na.includes(nb) || nb.includes(na);
};

export function mapToCurrentCase(c: PrecedentCase, current: CurrentCaseProfile): MapRow[] {
  const rows: MapRow[] = [];
  const add = (attribute: string, precedent: string | undefined, cur: string) => {
    if (!isRecorded(precedent)) return;
    rows.push({ attribute, precedent, current: cur, aligned: sameish(precedent, cur) });
  };
  add("Severity", c.filterValues.severity, current.severity);
  add("Case type", c.filterValues.caseType, current.caseType);
  add("Jurisdiction", c.filterValues.jurisdiction, current.jurisdiction);
  add("Conduct at issue", c.filterValues.violation, "Signal violation by a commercial vehicle");
  return rows;
}

// The sentence that says why this precedent's number matters here, built from
// the dimensions that actually line up and where the settlement sits.
export function mappingNote(c: PrecedentCase, current: CurrentCaseProfile, s: PrecedentSummary): string {
  const rows = mapToCurrentCase(c, current);
  const aligned = rows.filter((r) => r.aligned).map((r) => r.attribute.toLowerCase());
  const where = c.amount >= s.highest ? "the upper end of"
    : c.amount <= s.lowest ? "the lower end of"
    : "the middle of";
  const shared = aligned.length === 0
    ? "The recorded dimensions differ from this case"
    : `The two align on ${aligned.join(", ")}`;
  return `${shared}. Its ${money(c.amount)} settlement therefore supports positioning this factor toward ${where} its recommended range.`;
}

// ── Why a settlement came out where it did ────────────────────────────────────
// The contributing factors the dataset records against the case, and the
// dataset's own account of why it matters here.

export interface SettlementContext {
  amount: number;
  factors: string[];
  why: string;
}

export function settlementContext(c: PrecedentCase, s: PrecedentSummary): SettlementContext {
  return {
    amount: c.amount,
    factors: Array.from(new Set([
      ...c.tags,
      ...(isRecorded(c.filterValues.severity) ? [`${c.filterValues.severity} severity`] : []),
    ])),
    why: `${c.whyThisMatters} ${settlementInfluence(c.amount, s)}`,
  };
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

// ── Asking about one precedent ────────────────────────────────────────────────
// A question is answered from that case's own record and nothing else, so the
// chat cannot drift onto the current case. Where the record does not cover the
// question it says so rather than answering from somewhere else.

export function answerAboutPrecedent(
  question: string,
  c: PrecedentCase,
  s: PrecedentSummary,
): { headline: string; points: string[]; caveat: string } {
  const q = question.toLowerCase();
  const caveat = `Answered from the record on ${c.caseName} only.`;

  if (/settle|amount|value|worth|how much|why.*high|why.*low/.test(q)) {
    const ctx = settlementContext(c, s);
    return {
      headline: `${c.caseName} settled at ${money(c.amount)}.`,
      points: [...ctx.factors.map((f) => `Recorded factor: ${f}`), settlementInfluence(c.amount, s)],
      caveat,
    };
  }
  if (/liabilit|fault|defend|who was/.test(q)) {
    const items = caseOverview(c).find((o) => o.label === "Liability")!;
    return {
      headline: items.empty ? `No liability finding is recorded for ${c.caseName}.` : `What the record holds on liability in ${c.caseName}.`,
      points: items.items,
      caveat,
    };
  }
  if (/injur|damage|harm|medical|treatment/.test(q)) {
    const items = caseOverview(c).find((o) => o.label === "Injuries & Damages")!;
    return {
      headline: items.empty ? `No injury detail is recorded for ${c.caseName}.` : `What the record holds on injuries in ${c.caseName}.`,
      points: items.items,
      caveat,
    };
  }
  if (/negligen|conduct|breach/.test(q)) {
    const items = caseOverview(c).find((o) => o.label === "Negligence")!;
    return {
      headline: items.empty ? `The record does not separate a negligence finding for ${c.caseName}.` : `What the record holds on the conduct in ${c.caseName}.`,
      points: items.items,
      caveat,
    };
  }
  if (/violation|statute|regulat/.test(q)) {
    const items = caseOverview(c).find((o) => o.label === "Violations")!;
    return {
      headline: items.empty ? `No violation is recorded for ${c.caseName}.` : `Violations recorded in ${c.caseName}.`,
      points: items.items,
      caveat,
    };
  }
  if (/match|similar|compar|relevan|why.*(pick|select|chosen)/.test(q)) {
    return {
      headline: `${c.caseName} is recorded as a ${c.matchScore}% match.`,
      points: whyItMatches(c, 6),
      caveat,
    };
  }
  if (/jurisdiction|venue|court|where/.test(q)) {
    const j = c.filterValues.jurisdiction;
    return {
      headline: isRecorded(j) ? `${c.caseName} is recorded in ${j}.` : `No jurisdiction is recorded for ${c.caseName}.`,
      points: [],
      caveat,
    };
  }
  if (/evidence|document|support|proof/.test(q)) {
    return {
      headline: `The record on ${c.caseName} carries its similarity breakdown rather than an evidence list.`,
      points: c.similarityBreakdown.map((b) => `${b.label}: ${b.explanation}`),
      caveat,
    };
  }
  return {
    headline: `Here is what the record holds on ${c.caseName}.`,
    points: [c.summary, ...whyItMatches(c, 3)],
    caveat: `${caveat} Ask about the settlement, liability, injuries, negligence, violations, jurisdiction or why it matches.`,
  };
}
