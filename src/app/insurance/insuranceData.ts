// ── Insurance policy analysis ─────────────────────────────────────────────────
// The policy-intake analysis for a case, as structured data rather than text in
// a page, so the summary and the detailed view read the same record and a real
// policy extraction can replace this without touching either page.
//
// The content below is the founder-supplied reference analysis, reproduced as
// given. Tone keys map to the product's own semantic palette — they are never
// colours in their own right.

export type Tone = "positive" | "warning" | "critical" | "info";

export interface Metric {
  label: string;
  value: string;
  note?: string;
  tone: Tone;
}

export interface PolicyCheck {
  label: string;
  status: string;
  tone: Tone;
  detail: string[];
  /** Labelled facts behind the check, for a check shown in full. */
  fields?: { label: string; value: string }[];
}

export interface Line {
  label: string;
  note?: string;
  amount: string;
}

export interface ActionItem {
  title: string;
  detail: string;
  tone: Tone;
}

export interface Field {
  label: string;
  value: string;
  tone?: Tone;
}

export interface Flag {
  severity: "Critical" | "Warning";
  title: string;
  detail: string;
  action: string;
}

export interface Panel {
  no: number;
  title: string;
  fields: Field[];
  /** Two-column layout, for panels that are a table of limits. */
  columns?: boolean;
  flags?: Flag[];
  total?: { label: string; value: string };
  insight: string;
}

export interface InsuranceAnalysis {
  /** When the analysis was produced. The founder figures imply this date:
   *  the Oct 14 notice deadline is "27 days remaining". */
  analysedOn: string;
  title: string;
  subtitle: string;
  metrics: Metric[];
  /** The Insurance Summary page's four headline cards. */
  summaryCards: Metric[];
  checks: PolicyCheck[];
  recovery: {
    sources: Line[];
    totalAvailable: string;
    deductions: Line[];
    totalDeductions: string;
    net: string;
  };
  actions: ActionItem[];
  attorneySummary: string;
  panels: Panel[];
  intakeSummary: string[];
}

export const INSURANCE_ANALYSIS: InsuranceAnalysis = {
  analysedOn: "Sep 17, 2024",
  title: "Insurance Policy Analysis",
  subtitle: "Policy Intake Analysis — Simple View for Attorney Decision-Making",

  metrics: [
    { label: "Case Viability", value: "Viable", note: "Sufficient coverage & viable theory", tone: "positive" },
    { label: "Total Coverage", value: "$1.75M", note: "Primary $1M + umbrella $750K", tone: "info" },
    { label: "Red Flags", value: "3 — Medium Risk", tone: "warning" },
    { label: "Net Recovery Est.", value: "$820K – $1.1M", note: "After liens", tone: "positive" },
    { label: "First Action", value: "Send ELD demand today", note: "Data overwrites in 27 days", tone: "warning" },
  ],

  summaryCards: [
    { label: "Case Viability", value: "Viable", tone: "positive" },
    { label: "Total Coverage", value: "$1.75M", tone: "info" },
    { label: "Net to Client", value: "$820K–$1.1M", tone: "positive" },
    { label: "Risk Level", value: "Medium", tone: "warning" },
  ],

  checks: [
    {
      label: "Policy valid", status: "Yes", tone: "positive",
      detail: ["Policy period: Jan 1 – Dec 31, 2024", "Incident date: Sept 14, 2024", "Days in period at incident: 109 days remaining"],
      fields: [
        { label: "Status", value: "Yes" },
        { label: "Policy period", value: "Jan 1 – Dec 31, 2024" },
        { label: "Incident date", value: "Sept 14, 2024" },
        { label: "Days in period at incident", value: "109 days remaining" },
      ],
    },
    { label: "Coverage applies", status: "Partial", tone: "warning", detail: ["Verify driver exclusion + dispatch"] },
    { label: "Limits adequate", status: "Yes", tone: "positive", detail: ["$1M primary · $750K Umbrella"] },
    { label: "Red flags", status: "3 found", tone: "warning", detail: ["Driver exclusion · ELD · Defense costs"] },
    { label: "Competing liens", status: "3 liens", tone: "warning", detail: ["Medicare · Health insurer · WC"] },
    { label: "Insurer behavior", status: "Litigation-first", tone: "critical", detail: ["Progressive Commercial · A+ rated"] },
  ],

  recovery: {
    sources: [
      { label: "Bodily Injury Liability", note: "per person limit", amount: "$500,000" },
      { label: "Umbrella / Excess", note: "Sentry Insurance", amount: "+$750,000" },
      { label: "MCS-90 Floor", amount: "$750,000" },
    ],
    totalAvailable: "$1,750,000",
    deductions: [
      { label: "Defense costs inside limits", note: "litigation risk", amount: "-$150K–$400K" },
      { label: "Medicare / Medicaid lien", amount: "-$40K–$80K" },
      { label: "Health insurer subrogation", amount: "-$20K–$60K" },
      { label: "Workers' Comp lien", amount: "-$20K–$40K" },
      { label: "SIR / Deductible", amount: "$10,000" },
    ],
    totalDeductions: "-$240K–$590K",
    net: "$820K – $1.1M",
  },

  actions: [
    {
      title: "Confirm driver identity — exclusion may void primary coverage",
      detail: "Check police report against excluded driver: John R. Simmons (CA 23 17, added June 12)",
      tone: "critical",
    },
    {
      title: "Send ELD preservation demand today — data overwrites in 27 days",
      detail: "Deadline: Oct 14, 2024. Critical for HOS violations and fatigue evidence.",
      tone: "critical",
    },
    {
      title: "Notice deadline: Oct 14, 2024 — 27 days remaining",
      detail: "Policy requires written notice within 30 days of incident (Sept 14).",
      tone: "warning",
    },
  ],

  attorneySummary:
    "Viable case — $1.75M available, medium risk. Confirm driver exclusion before accepting; if it doesn't apply, issue a Stowers demand early against this litigation-first carrier.",

  panels: [
    {
      no: 1, title: "Legal Validity",
      fields: [
        { label: "Policy active on incident date", value: "Yes", tone: "positive" },
        { label: "Policy period", value: "Jan 1, 2024 – Jan 1, 2025" },
        { label: "Policy number", value: "PC-2024-887643" },
        { label: "Named insured", value: "Apex Freight Solutions LLC" },
        { label: "Named insured matches defendant", value: "Yes — confirmed", tone: "positive" },
        { label: "Policy form type", value: "ISO Standard — CA 00 01 11 13" },
        { label: "Endorsements present", value: "4 endorsements: MCS-90; CA 20 54 hired auto; CA 23 17 excluded driver; CA 99 33 deductible" },
        { label: "Lapse or cancellation", value: "None detected", tone: "positive" },
        { label: "Mid-term changes", value: "Driver exclusion added June 12, 2024 — John R. Simmons", tone: "critical" },
      ],
      insight:
        "The mid-term driver exclusion is the most critical validity issue — if the incident driver is the excluded individual, the primary policy does not respond and recovery is limited to the MCS-90 floor. Confirm driver identity from the police report before investing further in this case.",
    },
    {
      no: 2, title: "Coverage Applicability",
      fields: [
        { label: "Incident type", value: "Commercial vehicle — bodily injury to third party" },
        { label: "Incident type covered", value: "Yes — Bodily Injury Liability", tone: "positive" },
        { label: "Incident date within policy period", value: "Yes — September 14, 2024", tone: "positive" },
        { label: "Claimant qualifies as covered party", value: "Yes — third-party claimant qualifies", tone: "positive" },
        { label: "Incident location covered", value: "United States, Canada, Puerto Rico" },
        { label: "Policy trigger", value: "Occurrence — date of injury controls" },
        { label: "Driver under dispatch at time", value: "Verify — non-trucking clause limits coverage if off-dispatch", tone: "warning" },
      ],
      insight:
        "Coverage applies on its face — the incident type, date and claimant all fall within the policy. The open question is dispatch status: if the driver was off-dispatch, the non-trucking clause narrows coverage, so obtain the dispatch log alongside the ELD data.",
    },
    {
      no: 3, title: "Policy Limits", columns: true,
      fields: [
        { label: "Per-person limit", value: "$500,000" },
        { label: "Per-occurrence limit", value: "$1,000,000" },
        { label: "General aggregate", value: "$1,000,000" },
        { label: "Property damage liability", value: "$100,000" },
        { label: "UM / UIM", value: "$500,000 per person / $1,000,000 per occurrence" },
        { label: "Medical Payments", value: "$5,000 per person" },
        { label: "Defense costs", value: "Inside Limits — erodes available recovery during litigation", tone: "warning" },
        { label: "SIR / Deductible", value: "$10,000 per occurrence" },
        { label: "Umbrella / Excess layer", value: "$750,000" },
        { label: "MCS-90 public liability floor", value: "$750,000" },
      ],
      total: { label: "Total stacked coverage", value: "$1,750,000" },
      insight:
        "The primary and umbrella layers stack to $1.75M, but defense costs sit inside the limits — every month of litigation reduces what is available to the client. That is the case for pressing an early demand at the primary limit.",
    },
    {
      no: 4, title: "Red Flags & Cautions",
      fields: [],
      flags: [
        {
          severity: "Critical", title: "Driver Exclusion — John R. Simmons",
          detail: "CA 23 17 added June 12, 2024. If incident driver is this individual, primary policy does not respond.",
          action: "Confirm driver identity from police report immediately.",
        },
        {
          severity: "Warning", title: "ELD Data Expires Oct 14, 2024",
          detail: "Electronic logs overwrite after 30 days. Critical for HOS violations and fatigue evidence.",
          action: "Send preservation demand today.",
        },
        {
          severity: "Warning", title: "Defense Costs Inside Limits",
          detail: "Progressive Commercial is litigation-first. Extended defense reduces the $1M primary limit.",
          action: "Issue a Stowers demand early.",
        },
      ],
      insight:
        "Two of the three flags are time-bound. The driver exclusion decides whether the primary layer responds at all, and the ELD data is gone after Oct 14 — both need action this week, ahead of any valuation work.",
    },
    {
      no: 5, title: "Competing Interests",
      fields: [
        { label: "Subrogation rights", value: "Yes — no workers' comp endorsement found", tone: "warning" },
        { label: "Additional insureds", value: "Apex Freight Solutions LLC; hired auto operators (CA 20 54)" },
        { label: "Competing claimants", value: "Possible — multi-vehicle accident; verify other claims filed", tone: "warning" },
        { label: "Known lien holders", value: "Medicare / Medicaid; Health Insurer; Workers' Comp Carrier" },
        { label: "Estimated lien total", value: "$80,000–$180,000 (pending confirmation)", tone: "warning" },
        { label: "Estimated net recovery to client", value: "$820,000–$1,100,000", tone: "positive" },
      ],
      insight:
        "Three lien holders and a possible competing claimant all draw on the same limits. The Medicare / Medicaid lien carries the widest estimated range, so confirming its amount narrows the net recovery estimate most.",
    },
    {
      no: 6, title: "Insurer Profile",
      fields: [
        { label: "Insurer name", value: "Progressive Commercial Insurance" },
        { label: "Insurer type", value: "Standard Carrier — publicly regulated" },
        { label: "Financial rating (A.M. Best)", value: "A+ (Superior)", tone: "positive" },
        { label: "Known behavior pattern", value: "Litigation-first — commercial truck cases routinely contested through discovery", tone: "warning" },
        { label: "Bad faith history", value: "Noted — documented pattern of low initial offers in high-severity truck cases prior to Stowers demands", tone: "warning" },
        { label: "Claims process", value: "Dedicated commercial claims team; expect recorded statement requests within 72 hours — decline until represented" },
        { label: "Recommended approach", value: "Issue Stowers demand at primary limits early; tender umbrella simultaneously; document all communications", tone: "info" },
      ],
      insight:
        "An A+ carrier can pay, but this one contests commercial truck claims through discovery and opens low. A Stowers demand at the primary limit, tendered with the umbrella, puts the bad-faith exposure on the carrier early.",
    },
  ],

  intakeSummary: [
    "$1.75M in stacked coverage across the primary and umbrella layers.",
    "Estimated net recovery to the client of $820K–$1.1M after liens.",
    "The driver exclusion is the critical issue — it decides whether the primary policy responds.",
    "Defense costs sit inside the limits, so extended litigation erodes available recovery.",
    "ELD data must be preserved before it overwrites on Oct 14, 2024.",
    "Confirm the incident driver's identity from the police report before accepting the case.",
  ],
};
