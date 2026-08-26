import { VIOLATION_CARDS } from "../workspace/WorkspaceTabs";
import { EVIDENCE_INTEL } from "../workspace/evidenceData";
import type { AssistantLocation } from "./AssistantContext";

// ── Contexts ──────────────────────────────────────────────────────────────────
// One assistant, five scopes. "Current Stage" follows the page; the rest widen
// deliberately. Every answer states which scope produced it.

export type ContextId = "stage" | "intake" | "workspace" | "case" | "global";

export const CONTEXTS: { id: ContextId; label: string; blurb: string }[] = [
  { id: "stage", label: "Current Stage", blurb: "Only what is on screen right now" },
  { id: "intake", label: "Case Intake Pipeline", blurb: "Collection, Analysis, Valuation, Case Ready" },
  { id: "workspace", label: "Case Workspace", blurb: "All nine workspace stages" },
  { id: "case", label: "Entire Case", blurb: "Every stage, document and finding" },
  { id: "global", label: "Global", blurb: "General legal principles, no case data" },
];

export function contextLabel(id: ContextId, loc: AssistantLocation): string {
  if (id !== "stage") return CONTEXTS.find((c) => c.id === id)!.label;
  if (loc.stageLabel) return `Current Stage · ${loc.stageLabel}`;
  if (loc.pipelineStage) return `Current Stage · ${loc.pipelineStage}`;
  return `Current Stage · ${loc.pageLabel}`;
}

// ── Suggested prompts ─────────────────────────────────────────────────────────
// Shown only while a conversation is empty, so they never clutter the thread.

const STAGE_SUGGESTIONS: Record<string, string[]> = {
  evidencehub: [
    "What evidence is strongest for liability?",
    "Are there contradictions in the evidence?",
    "What evidence gaps should we address?",
    "How does this evidence affect damages?",
  ],
  medical: [
    "Identify important gaps in the timeline",
    "What events are most important to liability?",
    "Are there conflicting dates?",
  ],
  negotiation: [
    "Summarize our strongest negotiation points",
    "What evidence supports our demand?",
    "What weaknesses could the opposing side use?",
  ],
  economic: [
    "Which damages figures are best supported?",
    "Where is the damages model most exposed?",
    "What documentation is missing for damages?",
  ],
  noneconomic: [
    "What evidence establishes breach of duty?",
    "How strong is causation on the current record?",
    "What would the defense argue against negligence?",
  ],
  liability: [
    "Which violation is best supported by evidence?",
    "What evidence backs the signal violation?",
    "Are any cited violations weakly supported?",
  ],
  overview: [
    "Give me a two-minute briefing on this case",
    "What are the strongest and weakest points?",
    "What should I prioritise next?",
  ],
  evidence: [
    "Summarise the procedural history so far",
    "Which correspondence matters most?",
    "What is still outstanding?",
  ],
  demand: [
    "What drives the current valuation?",
    "How confident is the settlement range?",
    "What would move the valuation upward?",
  ],
};

const CONTEXT_SUGGESTIONS: Record<ContextId, string[]> = {
  stage: ["What am I looking at?", "What matters most here?", "What is missing?"],
  intake: [
    "What is still outstanding in intake?",
    "Are the collected documents sufficient to proceed?",
    "What is the current pipeline status?",
  ],
  workspace: [
    "Compare the negligence findings with the violations identified in the case.",
    "Which stages have the weakest supporting evidence?",
    "Where do the stages contradict each other?",
  ],
  case: [
    "Give me a complete summary of the case and identify the strongest weaknesses in the defense.",
    "What is our theory of liability in one paragraph?",
    "What are the three biggest risks to this case?",
  ],
  global: [
    "What legal principles generally apply to comparative negligence?",
    "How is future medical care usually proven?",
    "What is the standard for admitting accident reconstruction?",
  ],
};

export function suggestionsFor(ctx: ContextId, loc: AssistantLocation): string[] {
  if (ctx === "stage") {
    const byStage = loc.stageId ? STAGE_SUGGESTIONS[loc.stageId] : undefined;
    return byStage ?? CONTEXT_SUGGESTIONS.stage;
  }
  return CONTEXT_SUGGESTIONS[ctx];
}

// ── Answering ─────────────────────────────────────────────────────────────────
// Answers are assembled from the case record actually on file — the evidence
// analysis and the cited violations — so a citation always points at something
// real. Global scope deliberately uses no case data.

export interface AssistantAnswer {
  headline: string;
  points: string[];
  citations: string[];
  caveat?: string;
}

const analysed = () => Object.entries(EVIDENCE_INTEL);

// Intel is keyed by lowercased filename for identity, but citations must show
// the real filename. Every document appears with its true casing in some
// related[] list, so that is the source for display names.
const CANONICAL: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [key, intel] of Object.entries(EVIDENCE_INTEL)) {
    map[key] = map[key] ?? key;
    for (const r of intel.related) map[r.toLowerCase()] = r;
  }
  return map;
})();

const fileName = (key: string) => CANONICAL[key.toLowerCase()] ?? key;

function strongestLiabilityEvidence(): AssistantAnswer {
  const ranked = analysed()
    // "Not relevant" and "Neutral on fault" both mean the item does not speak
    // to liability, however confident its own analysis is.
    .filter(([, i]) => !/^(Not (relevant|assessed)|Neutral)/i.test(i.impact.liability))
    .sort((a, b) => b[1].confidence.score - a[1].confidence.score)
    .slice(0, 4);
  return {
    headline: "Liability rests on the intersection record — the camera footage and the police report carry it.",
    points: ranked.map(
      ([file, i]) => `${i.title} (${fileName(file)}) — ${i.impact.liability} Confidence ${i.confidence.level}, ${i.confidence.score}%.`,
    ),
    citations: ranked.map(([f]) => fileName(f)),
    caveat: "Ranked by the confidence recorded on each analysed item. Evidence still pending analysis is excluded.",
  };
}

function contradictions(): AssistantAnswer {
  const found = analysed().filter(([, i]) => i.contradictions.length > 0);
  if (found.length === 0) {
    return { headline: "No contradictions are recorded in the analysed evidence.", points: [], citations: [] };
  }
  return {
    headline: `${found.length} potential discrepanc${found.length === 1 ? "y is" : "ies are"} recorded in the evidence.`,
    points: found.flatMap(([file, i]) =>
      i.contradictions.map((c) => `${c.source}: "${c.text}" against ${c.against}: "${c.againstText}" — ${fileName(file)}`),
    ),
    citations: found.map(([f]) => fileName(f)),
    caveat: "Flagged as discrepancies to reconcile, not as proof that either account is wrong.",
  };
}

function evidenceGaps(): AssistantAnswer {
  const withGaps = analysed().filter(([, i]) => i.gaps.length > 0);
  const all = withGaps.flatMap(([file, i]) => i.gaps.map((g) => `${g} — ${fileName(file)}`));
  return {
    headline: `${all.length} evidence gaps are recorded across ${withGaps.length} analysed items.`,
    points: all.slice(0, 6),
    citations: withGaps.slice(0, 5).map(([f]) => fileName(f)),
    caveat: all.length > 6 ? `${all.length - 6} further gaps are listed on the individual evidence items.` : undefined,
  };
}

function damagesFromEvidence(): AssistantAnswer {
  const rel = analysed().filter(([, i]) => !/^Not (relevant|assessed)/i.test(i.impact.damages)).slice(0, 5);
  return {
    headline: "Damages rest on the medical record; the liability evidence supports it only indirectly.",
    points: rel.map(([file, i]) => `${i.title} (${fileName(file)}) — ${i.damages}`),
    citations: rel.map(([f]) => fileName(f)),
  };
}

function negligenceVsViolations(): AssistantAnswer {
  return {
    headline: "The negligence findings and the cited violations describe the same conduct from two directions.",
    points: [
      "Negligence frames the conduct as a breach of a duty owed to the plaintiff — duty, breach, causation, harm.",
      `Violations frame that same conduct against specific standards: ${VIOLATION_CARDS.map((v) => v.title).join(", ")}.`,
      "The overlap is deliberate. A statutory violation supports the breach element rather than replacing it.",
      "They diverge on proof: negligence is argued from the whole record, while each violation stands or falls on the evidence cited against it.",
    ],
    citations: VIOLATION_CARDS.flatMap((v) => v.evidence).slice(0, 5),
    caveat: "A statutory violation is evidence of breach. Whether it amounts to negligence per se depends on the jurisdiction.",
  };
}

function caseSummary(loc: AssistantLocation): AssistantAnswer {
  return {
    headline: `${loc.caseName || "This case"} — a motor-vehicle claim with a documented cervical injury and a strong liability record.`,
    points: [
      "Liability: the intersection footage and the police report place the commercial vehicle entering against the signal, with independent witness corroboration.",
      "Causation: imaging within 48 hours of the collision documents C5–C6 and C6–C7 herniations, and treatment runs continuously from the admission onward.",
      "Damages: the medical record, billing and wage-loss documentation support the economic figures, and the therapy record supports permanence.",
      `Violations: ${VIOLATION_CARDS.length} are cited, the strongest being ${VIOLATION_CARDS[0]?.title}.`,
      "Defense weaknesses: no pre-incident cervical imaging excludes prior degeneration, only one independent witness has signed a statement, and the camera footage begins four seconds before impact.",
    ],
    citations: ["police_report_final.pdf", "traffic_camera.mp4", "MRI_Report_2026.pdf", "witness_statement.pdf"],
    caveat: "A summary of the record as it currently stands, not a legal opinion.",
  };
}

function exposures(loc: AssistantLocation): AssistantAnswer {
  return {
    headline: "Where this case is exposed.",
    points: [
      "No pre-incident cervical imaging is on file, leaving room for a prior-degeneration argument.",
      "Only one independent witness has signed a statement.",
      "The intersection footage begins four seconds before impact and does not capture the plaintiff signal head.",
      "The damages model leans on projections for future care, which the defense will test.",
      "Reconstruction conclusions are expert opinion and invite a competing expert.",
    ],
    citations: ["MRI_Report_2026.pdf", "witness_statement.pdf", "traffic_camera.mp4", "Scene_Reconstruction.pdf"],
    caveat: `Drawn from the gaps recorded against ${loc.caseName || "this case"}.`,
  };
}

function globalAnswer(q: string): AssistantAnswer {
  if (/comparative negligence|contributory/i.test(q)) {
    return {
      headline: "Comparative negligence apportions responsibility rather than barring recovery outright.",
      points: [
        "Pure comparative jurisdictions reduce recovery by the plaintiff share of fault, however large that share is.",
        "Modified comparative jurisdictions bar recovery once that share crosses a threshold, commonly 50% or 51%.",
        "A small number of jurisdictions retain contributory negligence, where any plaintiff fault defeats the claim.",
        "Apportionment is generally a question for the finder of fact, informed by the evidence of each party conduct.",
      ],
      citations: [],
      caveat: "General principles only. Global scope uses no case data, and the governing rule depends on the jurisdiction.",
    };
  }
  return {
    headline: "Answering from general legal principles — Global scope uses no case data.",
    points: [
      "Ask about a doctrine, a standard of proof, or a procedural rule and I will set out the general position.",
      "Switch to Entire Case or Case Workspace to ground the answer in this matter.",
    ],
    citations: [],
    caveat: "General information, not advice on this matter.",
  };
}

function stageAnswer(loc: AssistantLocation, q: string): AssistantAnswer {
  const label = loc.stageLabel ?? loc.pipelineStage ?? loc.pageLabel;
  if (loc.stageId === "medical" || /timeline|chronolog|date/i.test(q)) {
    return {
      headline: `Reading the ${label} stage only.`,
      points: [
        "Treatment runs continuously from the Feb 14 emergency admission through the June follow-up, leaving no gap to argue a break in causation.",
        "The Feb 16 imaging is the hinge — it turns a reported injury into a diagnosed one within 48 hours of the collision.",
        "One timing discrepancy is on record: the police report puts entry at about 9:04 AM, the witness recalls closer to 9:05 AM.",
        "The thinnest stretch is between the Apr 20 re-evaluation and the Jun 5 follow-up, where the record shows least activity.",
      ],
      citations: ["police_report_final.pdf", "witness_statement.pdf", "MRI_Report_2026.pdf", "physical_therapy_notes.pdf"],
    };
  }
  return {
    headline: `Reading the ${label} stage only.`,
    points: [
      `This scope covers what is on screen in ${label} and the evidence that stage cites.`,
      "Widen to Case Workspace or Entire Case for anything spanning several stages.",
    ],
    citations: [],
  };
}

// Route a question to an answer within the chosen scope.
export function answer(q: string, ctx: ContextId, loc: AssistantLocation): AssistantAnswer {
  if (ctx === "global") return globalAnswer(q);

  if (/contradict|conflict|discrepan|inconsisten/i.test(q)) return contradictions();
  if (/gap|missing|outstanding/i.test(q)) return evidenceGaps();
  if (/negligence.*violation|violation.*negligence|compare/i.test(q)) return negligenceVsViolations();
  // Asking for a summary that also calls out weaknesses wants the summary — it
  // already ends on the defense weaknesses. Only a pure weakness question goes
  // to the exposure list.
  if (/summar|overview|brief|complete|whole case/i.test(q)) return caseSummary(loc);
  if (/weakness|risk|defense|defence|opposing/i.test(q)) return exposures(loc);
  if (/liabilit/i.test(q)) return strongestLiabilityEvidence();
  if (/damage|valuation|quantum|demand|settle|negotiat/i.test(q)) return damagesFromEvidence();

  if (ctx === "stage") return stageAnswer(loc, q);
  if (ctx === "intake") {
    return {
      headline: `Reading the Case Intake Pipeline${loc.pipelineStage ? ` — currently at ${loc.pipelineStage}` : ""}.`,
      points: [
        "Intake covers Collection, Analysis, Valuation and Case Ready.",
        "Ask what has been collected, what analysis has run, or what still blocks the case from moving forward.",
      ],
      citations: [],
    };
  }
  return caseSummary(loc);
}
