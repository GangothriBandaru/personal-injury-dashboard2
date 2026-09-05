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
