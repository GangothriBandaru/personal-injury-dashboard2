import { useState } from "react";
import {
  Sparkles, ChevronDown, ChevronRight, Gavel, Scale, FileText, TrendingUp, ShieldCheck, Info,
  MessageSquare, Send, Check,
} from "lucide-react";
import type { FactorItem } from "../damages/FactorsContext";
import {
  summarisePrecedents, patternsAcross, compareToPrecedents, recommendationFor,
  settlementInfluence, whyItMatches, relevanceOf, positionAgainstPrecedents,
  caseOverview, mapToCurrentCase, mappingNote, settlementContext, answerAboutPrecedent,
  OVERVIEW_UNRECORDED, CLINICAL_UNAVAILABLE,
  type PrecedentCase, type CurrentCaseProfile,
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

// One precedent, expandable. Collapsed it is a name, a match and a number;
// opened it reads as a short case brief — identity, why it was picked, what
// happened, and what it means here — in that order.
//
// The card is one container. Inside it the sections are separated by hairlines
// and section headings rather than by nested boxes, so the drawer stays compact
// and the eye can run down a single column.

// A heading inside the precedent card. Small, spaced, and the only thing that
// separates one section from the next besides a hairline.
function Part({
  label, children, first = false,
}: { label: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div className={first ? "" : "pt-3 mt-3 border-t border-line"}>
      <div className="eyebrow mb-1.5">{label}</div>
      {children}
    </div>
  );
}

// Tighter bullets than the drawer's default — a precedent lists findings, and
// they should read as a list rather than as spaced paragraphs.
function TightBullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-0.5">
      {items.map((t, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="w-1 h-1 rounded-full bg-deep mt-[7px] shrink-0" />
          <span className="text-xs text-[#5B6B78] leading-relaxed">{t}</span>
        </li>
      ))}
    </ul>
  );
}

// The clinical dimensions say "not available in case record"; the legal ones
// say the precedent data does not record them. Same meaning, the wording each
// section warrants.
const CLINICAL_LABELS = new Set(["Treatment Profile", "Injury Impact", "Duration", "Treating Providers"]);

function PrecedentCard({
  c, s, current, defaultOpen,
}: { c: PrecedentCase; s: ReturnType<typeof summarisePrecedents>; current: CurrentCaseProfile; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const overview = caseOverview(c);
  const rows = mapToCurrentCase(c, current);
  const ctx = settlementContext(c, s);
  const high = relevanceOf(c.matchScore) === "high";

  return (
    <div className="rounded-xl border border-line overflow-hidden bg-white">
      {/* Identity first: the name is the strongest thing on the card, the match
          sits opposite it, and the settlement is a labelled figure rather than
          another line of prose. */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full p-3.5 text-left hover:bg-wash transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            {open
              ? <ChevronDown className="w-4 h-4 text-deep shrink-0 mt-1" strokeWidth={1.75} />
              : <ChevronRight className="w-4 h-4 text-[#5B6B78] shrink-0 mt-1" strokeWidth={1.75} />}
            <h4 className="card-title leading-snug min-w-0">{c.caseName}</h4>
          </div>
          <span className={`pill shrink-0 ${high ? "pill-complete" : "pill-neutral"}`}>{c.matchScore}% match</span>
        </div>
        <div className="flex items-baseline gap-2 mt-1.5 pl-6">
          <span className="eyebrow">Settlement</span>
          <span className="text-sm font-bold text-ink tabular-nums">{money(c.amount)}</span>
        </div>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5">
          {/* Why the AI picked it */}
          <Part label="Why it matches" first>
            <TightBullets items={whyItMatches(c)} />
          </Part>

          {/* What actually happened — one bordered disclosure, nothing nested
              inside it but headings and hairlines. */}
          <div className="pt-3 mt-3 border-t border-line">
            <button
              onClick={() => setOverviewOpen((o) => !o)}
              aria-expanded={overviewOpen}
              className="w-full flex items-center justify-between gap-2 text-left group"
            >
              <span className="eyebrow">Case overview</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[#5B6B78] shrink-0 transition-transform ${overviewOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
            </button>
            {overviewOpen && (
              <div className="mt-2 rounded-lg bg-offwhite border border-line px-3 py-2.5 space-y-2.5">
                {overview.map((o, i) => (
                  <div key={o.label} className={i === 0 ? "" : "pt-2.5 border-t border-line"}>
                    <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#5B6B78] mb-1">{o.label}</div>
                    {o.body && <p className="text-xs text-[#5B6B78] leading-relaxed">{o.body}</p>}
                    {/* Single-value dimensions read as label/value; findings
                        stay bullets. Injury and severity are not findings. */}
                    {o.facts.length > 0 && (
                      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 mb-1">
                        {o.facts.map((f) => (
                          <div key={f.label} className="contents">
                            <span className="text-xs text-[#8A98A3]">{f.label}</span>
                            <span className="text-xs text-ink font-medium">{f.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {o.facts.length > 0 && o.items.length > 0 && (
                      <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A98A3] mb-0.5">Key impact</div>
                    )}
                    {o.items.length > 0 && <TightBullets items={o.items} />}
                    {o.empty && (
                      <p className="text-[11px] text-[#8A98A3] italic">
                        {CLINICAL_LABELS.has(o.label) ? CLINICAL_UNAVAILABLE : OVERVIEW_UNRECORDED}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* What the case settled at, and the attributes behind it. Outside the
              disclosure because it is the figure the attorney compares against. */}
          <Part label="Settlement outcome">
            <p className="text-lg font-bold text-ink tabular-nums leading-none">{money(ctx.amount)}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {ctx.factors.map((f) => <span key={f} className="pill pill-neutral">{f}</span>)}
            </div>
            <p className="text-xs text-[#5B6B78] leading-relaxed mt-2">{ctx.why}</p>
          </Part>

          {/* How it lines up here — the raw comparison, kept compact */}
          <Part label="How it maps to the current case">
            {rows.length === 0 ? (
              <p className="text-[11px] text-[#8A98A3] italic">
                The record carries no dimension for this case that can be set against the current one.
              </p>
            ) : (
              <div className="rounded-lg border border-line overflow-hidden">
                <div className="grid grid-cols-[minmax(64px,0.8fr)_1fr_1fr] gap-x-2 px-2.5 py-1.5 bg-wash border-b border-line">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5B6B78]">Dimension</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5B6B78]">Precedent</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5B6B78]">This case</span>
                </div>
                {rows.map((r, i) => (
                  <div
                    key={r.attribute}
                    className={`grid grid-cols-[minmax(64px,0.8fr)_1fr_1fr] gap-x-2 px-2.5 py-1.5 items-start ${i > 0 ? "border-t border-line" : ""}`}
                  >
                    <span className="text-[11px] text-[#8A98A3] leading-snug break-words">{r.attribute}</span>
                    <span className="text-[11px] text-[#5B6B78] leading-snug break-words">{r.precedent}</span>
                    <span className={`text-[11px] leading-snug break-words flex items-start gap-1 ${r.aligned ? "text-ink font-semibold" : "text-[#5B6B78]"}`}>
                      {r.aligned && <Check className="w-3 h-3 text-[#15803D] shrink-0 mt-[3px]" strokeWidth={2.5} />}
                      <span className="min-w-0">{r.current}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Part>

          {/* What the AI concludes from it — deliberately separate from the
              comparison above, so reading is not mistaken for reasoning. */}
          <Part label="AI interpretation">
            <div className="rounded-lg bg-[#F6FDFF] border border-[#D6F2F7] px-3 py-2">
              <p className="text-xs text-ink leading-relaxed">{mappingNote(c, current, s)}</p>
            </div>
          </Part>

          {/* Where this precedent sits in the range — the line the attorney
              carries away, so it closes the card. */}
          <Part label="Settlement influence">
            <div className="rounded-lg bg-tint border border-[#D6F2F7] px-3 py-2">
              <p className="text-xs text-ink leading-relaxed">{settlementInfluence(c.amount, s)}</p>
            </div>
          </Part>
        </div>
      )}
    </div>
  );
}

// A question about one precedent, answered from that case's record alone. The
// context is named above the box so it is never ambiguous which case is being
// asked about.
function PrecedentChat({
  cases, s,
}: { cases: PrecedentCase[]; s: ReturnType<typeof summarisePrecedents> }) {
  const [subject, setSubject] = useState(cases[0]?.caseName ?? "");
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<{ q: string; a: ReturnType<typeof answerAboutPrecedent> }[]>([]);
  const c = cases.find((x) => x.caseName === subject) ?? cases[0];
  if (!c) return null;

  const ask = () => {
    const q = question.trim();
    if (!q) return;
    setThread((prev) => [...prev, { q, a: answerAboutPrecedent(q, c, s) }]);
    setQuestion("");
  };

  return (
    <div className="rounded-xl border border-[#D6F2F7] bg-[#F6FDFF] p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
        <span className="eyebrow text-deep">Ask about this precedent case</span>
      </div>
      <div className="eyebrow mb-1">Chat context</div>
      <select
        value={subject}
        onChange={(e) => { setSubject(e.target.value); setThread([]); }}
        className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-brand transition-colors"
      >
        {cases.map((x) => <option key={x.caseName} value={x.caseName}>{x.caseName}</option>)}
      </select>

      {thread.length > 0 && (
        <div className="space-y-2.5 mt-3">
          {thread.map((t, i) => (
            <div key={i}>
              <div className="flex justify-end">
                <span className="rounded-xl rounded-tr-sm bg-tint border border-[#D6F2F7] px-3 py-1.5 text-xs text-ink max-w-[85%]">{t.q}</span>
              </div>
              <div className="rounded-xl border border-line bg-white p-2.5 mt-1.5">
                <p className="secondary-text leading-relaxed">{t.a.headline}</p>
                {t.a.points.length > 0 && <Bullets items={t.a.points} />}
                <p className="text-[11px] text-[#8A98A3] mt-1.5 leading-relaxed">{t.a.caveat}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 mt-2.5">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ask(); } }}
          placeholder={`Ask a question about ${c.caseName}…`}
          className="flex-1 min-w-0 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink placeholder:text-[#9BA8B4] focus:outline-none focus:border-brand transition-colors"
        />
        <button onClick={ask} disabled={!question.trim()} className="btn btn-primary px-3 py-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          <Send className="w-3.5 h-3.5" strokeWidth={1.75} /> Send
        </button>
      </div>
    </div>
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
  const currentProfile: CurrentCaseProfile = {
    severity: factor.severity,
    caseType,
    jurisdiction,
    evidenceStrength: factor.evidence.strength,
    docCount: factor.docCount,
    estimate: rec.estimate,
  };
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

        {/* Only the closest match opens by default, so the section stays
            scannable however many cases are on file. */}
        <div className="space-y-2.5 mt-3">
          {s.cases.map((c, i) => (
            <PrecedentCard
              key={c.caseName}
              c={c}
              s={s}
              current={currentProfile}
              defaultOpen={i === 0 && s.cases.length <= 4}
            />
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

      {/* 10 — a question about one precedent, scoped to that case alone */}
      {s.cases.length > 0 && <PrecedentChat cases={s.cases} s={s} />}
    </div>
  );
}
