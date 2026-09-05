import { useState } from "react";
import {
  Sparkles, ChevronDown, Gavel, Scale, FileText, TrendingUp, ShieldCheck, Info,
} from "lucide-react";
import type { FactorItem } from "../damages/FactorsContext";
import {
  summarisePrecedents, patternsAcross, compareToPrecedents, recommendationFor,
  settlementInfluence, whyItMatches, relevanceOf, positionAgainstPrecedents,
  type PrecedentCase,
} from "../damages/precedentAnalysis";

// ── Why the AI recommends this band ───────────────────────────────────────────
// The reasoning behind one non-economic factor, read from the case record and
// the comparable verdicts on file. Sections after the first are collapsed, so
// the card opens on the answer and the working is there when it is wanted.
//
// Every number here is computed: the counts are counts of the dataset, the
// range is its range, and the money is the factor's band applied to the economic
// damages currently on file. Nothing is asserted that the data does not carry.

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const compact = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}K`;
const mult = (m: number) => `${Number(m.toFixed(2))}×`;

function Section({
  title, icon: Icon, children, defaultOpen = false,
}: { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-line rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-wash transition-colors"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
          <span className="eyebrow text-ink">{title}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-[#5B6B78] shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} strokeWidth={1.75} />
      </button>
      {open && <div className="border-t border-line p-4">{children}</div>}
    </div>
  );
}

// A label/value pair, the shape the rest of the workspace uses for facts.
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-[#5B6B78] shrink-0">{label}</span>
      <span className="text-sm text-ink text-right font-medium">{value}</span>
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1">
      {items.map((t, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="w-1 h-1 rounded-full bg-deep mt-[7px] shrink-0" />
          <span className="secondary-text leading-relaxed">{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function FactorReasoning({
  factor, precedents, economicTotal, caseType, jurisdiction, matchedByCorridor,
}: {
  factor: FactorItem;
  precedents: PrecedentCase[];
  /** The economic damages currently on file — what the band is applied to. */
  economicTotal: number;
  caseType: string;
  jurisdiction: string;
  /** How many cases the corridor simulation matched, where that is recorded. */
  matchedByCorridor?: number;
}) {
  const s = summarisePrecedents(precedents);
  const patterns = patternsAcross(precedents);
  const rec = recommendationFor(factor.range, economicTotal);
  const comparison = compareToPrecedents(precedents, {
    severity: factor.severity,
    evidenceStrength: factor.evidence.strength,
    docCount: factor.docCount,
    caseType,
    jurisdiction,
  });
  const standing = positionAgainstPrecedents(rec.estimate, s);
  const strongestPattern = patterns[0];

  return (
    <div className="space-y-2.5">
      {/* 1 — the answer, always open */}
      <div className="rounded-xl border border-[#D6F2F7] bg-[#F6FDFF] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
          <span className="eyebrow text-deep">AI Multiplier Reasoning</span>
        </div>
        <h4 className="card-title mb-1.5">Why {mult(factor.range[0])}–{mult(factor.range[1])}?</h4>
        <p className="secondary-text leading-relaxed">{factor.aiReasoning}</p>
        <p className="secondary-text leading-relaxed mt-2">
          The record places <span className="font-semibold text-ink">{factor.category}</span> in the{" "}
          <span className="font-semibold text-ink">{factor.severity}</span> band, supported by{" "}
          <span className="font-semibold text-ink tabular-nums">{factor.docCount}</span> documents and{" "}
          {factor.evidence.strength.toLowerCase()} evidence, which is what puts it within{" "}
          <span className="font-semibold text-ink">{mult(factor.range[0])}–{mult(factor.range[1])}</span>.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {factor.drivers.map((d) => (
            <span key={d} className="pill pill-neutral">{d}</span>
          ))}
        </div>
      </div>

      {/* 2 — the case itself */}
      <Section title="Current Case Profile" icon={Scale} defaultOpen>
        <div className="divide-y divide-line">
          <Fact label="Case type" value={caseType} />
          <Fact label="Jurisdiction" value={jurisdiction} />
          <Fact label="Factor severity" value={factor.severity} />
          <Fact label="Evidence strength" value={factor.evidence.strength} />
          <Fact label="Medical record quality" value={factor.evidence.medicalQuality} />
          <Fact label="Supporting evidence" value={`${factor.docCount} documents`} />
          <Fact label="Primary records" value={String(factor.evidence.primaryRecords)} />
          <Fact label="Expert opinions" value={String(factor.evidence.expertOpinions)} />
          <Fact label="Witness statements" value={String(factor.evidence.witnessStatements)} />
          <Fact label="AI confidence" value={`${factor.confidence}%`} />
        </div>
        <p className="secondary-text leading-relaxed mt-3">{factor.rationale}</p>
      </Section>

      {/* 3 — the comparable cases */}
      <Section title="Precedent Case Analysis" icon={Gavel}>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl font-bold text-ink tabular-nums">{s.total}</span>
          <span className="body-text">comparable case{s.total === 1 ? "" : "s"} on file</span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {s.byRelevance.map((b) => (
            <span key={b.key} className="pill pill-neutral">{b.count} {b.label}</span>
          ))}
        </div>
        {matchedByCorridor !== undefined && matchedByCorridor > s.total && (
          <p className="text-[11px] text-[#8A98A3] leading-relaxed mt-2">
            The corridor simulation matched {matchedByCorridor} cases in total; {s.total} are on file here in
            full detail. Only those {s.total} are analysed below.
          </p>
        )}
        <p className="text-[11px] text-[#8A98A3] leading-relaxed mt-2">
          Relevance bands are the recorded match scores grouped: 90%+ high, 75–89% moderate.
        </p>

        <div className="space-y-2.5 mt-3">
          {s.cases.map((c) => (
            <div key={c.caseName} className="rounded-xl border border-line p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="card-title">{c.caseName}</div>
                  <div className="mono-ref mt-0.5">{money(c.amount)}</div>
                </div>
                <span className={`pill shrink-0 ${relevanceOf(c.matchScore) === "high" ? "pill-complete" : "pill-neutral"}`}>
                  {c.matchScore}% match
                </span>
              </div>
              <div className="eyebrow mt-2.5 mb-1">Why it matches</div>
              <Bullets items={whyItMatches(c)} />
              <div className="eyebrow mt-2.5 mb-1">Settlement influence</div>
              <p className="secondary-text leading-relaxed">{settlementInfluence(c.amount, s)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 4 — what each settlement rested on */}
      <Section title="Settlement & Valuation Context" icon={FileText}>
        <div className="space-y-2.5">
          {s.cases.map((c) => (
            <div key={c.caseName} className="rounded-xl border border-line p-3.5">
              <div className="flex items-start justify-between gap-3">
                <span className="card-title">{c.caseName}</span>
                <span className="text-sm font-bold text-ink tabular-nums shrink-0">{money(c.amount)}</span>
              </div>
              <div className="eyebrow mt-2.5 mb-1">Relevant factors</div>
              <Bullets items={c.tags} />
              <div className="eyebrow mt-2.5 mb-1">Why it matters to this case</div>
              <p className="secondary-text leading-relaxed">{c.whyThisMatters}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 5 — what recurs across them */}
      <Section title="Pattern Analysis" icon={TrendingUp}>
        <p className="secondary-text mb-2.5">
          Precedent cases reviewed: <span className="font-semibold text-ink tabular-nums">{s.total}</span>
        </p>
        <div className="space-y-1.5">
          {patterns.map((p) => (
            <div key={p.label} className="flex items-center justify-between gap-3">
              <span className="secondary-text min-w-0">{p.label}</span>
              <span className="text-xs font-semibold text-ink tabular-nums shrink-0">{p.count} of {p.total}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[#8A98A3] leading-relaxed mt-2.5">
          Counted by searching each case's recorded summary, tags and similarity breakdown.
        </p>
      </Section>

      {/* 6 — the money those cases actually settled at */}
      <Section title="Historical Settlement Range" icon={ShieldCheck}>
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <span className="text-sm font-bold text-ink tabular-nums">{compact(s.lowest)}</span>
          <div className="flex-1 h-1 rounded-full bg-tint relative">
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand"
              style={{ left: `${s.highest === s.lowest ? 50 : ((s.median - s.lowest) / (s.highest - s.lowest)) * 100}%` }}
            />
          </div>
          <span className="text-sm font-bold text-ink tabular-nums">{compact(s.highest)}</span>
        </div>
        <div className="divide-y divide-line mt-2">
          <Fact label="Lowest comparable" value={money(s.lowest)} />
          <Fact label="Median comparable" value={money(s.median)} />
          <Fact label="Highest comparable" value={money(s.highest)} />
        </div>
        <p className="secondary-text leading-relaxed mt-2.5">
          The comparable settlements establish a historical reference range for cases with similar
          severity, permanence and functional impact.
        </p>
      </Section>

      {/* 7 — the comparison, attribute by attribute */}
      <Section title="Current Case vs. Precedents" icon={Info}>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 items-baseline">
          <span className="eyebrow">Attribute</span>
          <span className="eyebrow text-right">This case</span>
          <span className="eyebrow text-right">Precedents</span>
          {comparison.map((r) => (
            <div key={r.attribute} className="contents">
              <span className="secondary-text">{r.attribute}</span>
              <span className="text-xs font-medium text-ink text-right">{r.current}</span>
              <span className="text-xs text-[#5B6B78] text-right tabular-nums whitespace-nowrap">{r.precedent}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 8 — the recommendation, in money */}
      <div className="rounded-xl border border-[#D6F2F7] bg-tint p-4">
        <div className="eyebrow text-deep mb-2.5">AI Recommendation</div>
        <div className="divide-y divide-[#D6F2F7]">
          <Fact label="Recommended range" value={`${mult(rec.low)}–${mult(rec.high)}`} />
          <Fact label="Approximate recommended value" value={`${money(rec.valueLow)} – ${money(rec.valueHigh)}`} />
          <Fact label="Recommended position" value={mult(rec.position)} />
          <Fact label="Estimated non-economic damages" value={money(rec.estimate)} />
        </div>
        <p className="text-[11px] text-[#8A98A3] leading-relaxed mt-2.5">
          The band applied to the {money(economicTotal)} in economic damages currently on file. These
          figures move when the damages do.
        </p>
      </div>

      {/* 9 — the closing sentence */}
      <div className="rounded-xl border border-line bg-offwhite p-4">
        <div className="eyebrow mb-2">Why this recommendation?</div>
        <p className="secondary-text leading-relaxed">
          {factor.category} carries {factor.severity.toLowerCase()} severity on this case, with{" "}
          {factor.evidence.strength.toLowerCase()} evidence across {factor.docCount} documents and{" "}
          {factor.evidence.medicalQuality.toLowerCase()} medical records.
          {strongestPattern && s.total > 0 && (
            <> {strongestPattern.label.toLowerCase()} appears in {strongestPattern.count} of the {strongestPattern.total} comparable
            case{strongestPattern.total === 1 ? "" : "s"}, which is what makes them relevant here.</>
          )}
          {s.total > 0 && (
            <> At {mult(rec.position)}, the estimate of {money(rec.estimate)} for this factor sits{" "}
            {standing === "outside"
              ? `outside the ${compact(s.lowest)}–${compact(s.highest)} comparable range, which is worth weighing before relying on it`
              : `in the ${standing} part of the ${compact(s.lowest)}–${compact(s.highest)} comparable range`}.</>
          )}
        </p>
        <p className="secondary-text leading-relaxed mt-2">
          <span className="font-semibold text-ink">The defense will argue:</span> {factor.defense.argument}
        </p>
        <p className="secondary-text leading-relaxed mt-1.5">
          <span className="font-semibold text-ink">Rebuttal:</span> {factor.defense.rebuttal}
        </p>
      </div>
    </div>
  );
}
