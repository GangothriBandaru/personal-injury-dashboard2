import { useState } from "react";
import {
  Shield, ArrowUpRight, ArrowRight, CheckCircle, AlertTriangle, AlertCircle, Info, ChevronDown,
  DollarSign, FileText, Building2, ClipboardCheck,
} from "lucide-react";
import { INSURANCE_ANALYSIS as IA, type Tone } from "../insurance/insuranceData";
import { resolveCasePolicy, POLICY_UNAVAILABLE } from "../insurance/casePolicy";
import type { CaseDocument } from "../types/case";
import {
  InsuranceBreadcrumb, InsuranceSummaryCards, AttorneyInsight, TONE_PILL, TONE_TEXT, TONE_PANEL,
} from "../insurance/InsuranceShared";

// ── Insurance Policy Analysis — summary ───────────────────────────────────────
// The attorney-decision view, in the reference's order: the policy it was read
// from, five headline figures, the policy checks, where the money comes from
// and goes, what has to happen now, and the conclusion. The six-panel analysis
// is the separate Full Detailed Analysis page.

const TONE_ICON: Record<Tone, any> = {
  positive: CheckCircle,
  warning: AlertTriangle,
  critical: AlertCircle,
  info: Info,
};

// A policy fact, or the product's unavailable state when the case lacks it.
function Fact({ value }: { value?: string }) {
  return value
    ? <p className="text-sm font-semibold text-ink leading-snug">{value}</p>
    : <p className="text-sm text-[#8A98A3] italic leading-snug">{POLICY_UNAVAILABLE}</p>;
}

export function InsuranceSummaryPage({
  caseName, caseData, documents, backLabel = "Back to Analysis", onBack, onOpenDetail,
}: {
  caseName: string;
  /** Names the stage the page was opened from (Analysis or Case Ready). */
  backLabel?: string;
  /** The case being viewed — the policy header is resolved from it. */
  caseData?: { caseType?: string; caseSubType?: string } | null;
  /** The case's documents, where its insurance policy lives. */
  documents?: CaseDocument[];
  /** Back to the stage the page was opened from. */
  onBack: () => void;
  onOpenDetail: () => void;
}) {
  // "How the $820K–$1.1M is calculated" opens the working in place.
  const [showWorking, setShowWorking] = useState(false);
  const policy = resolveCasePolicy(caseData, documents);
  const [validity, ...otherChecks] = IA.checks;
  const ValidityIcon = TONE_ICON[validity.tone];

  return (
    <div className="min-h-screen bg-wash">
      <InsuranceBreadcrumb
        backLabel={backLabel}
        onBack={onBack}
        trail={[
          { label: "Case Intake" },
          { label: caseName, onClick: onBack },
          { label: IA.title },
        ]}
      />

      <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="eyebrow flex items-center gap-1.5 mb-2">
              <Shield className="w-4 h-4 text-deep" strokeWidth={1.75} /> Insurance
            </div>
            <h1 className="page-title">{IA.title}</h1>
            <p className="secondary-text mt-1">{IA.subtitle}</p>
          </div>
          <button onClick={onOpenDetail} className="btn btn-primary gap-2 shrink-0">
            View Full Detailed Analysis <ArrowUpRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* ── The policy document ── */}
        <div id="insurance-document" className="lg-card p-6">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2.5 rounded-lg bg-tint text-deep shrink-0">
              <FileText className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              {policy.fileName ? (
                <>
                  <div className="mono-ref text-ink font-medium break-all">{policy.fileName}</div>
                  <p className="secondary-text mt-1">
                    Policy No. {policy.policyNo ?? "—"} · {policy.period ?? "—"} · {policy.namedInsured ?? "—"}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-sm font-semibold text-ink">Insurance policy document</div>
                  <p className="text-sm text-[#8A98A3] italic mt-1">{POLICY_UNAVAILABLE}</p>
                </>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_1fr] gap-3 items-stretch">
            <div className="lg-zone lg-zone-grey p-4">
              <div className="eyebrow mb-1.5">Policy type</div>
              <Fact value={policy.policyType} />
            </div>
            <div className="hidden md:flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-deep" strokeWidth={1.75} />
            </div>
            <div className="lg-zone lg-zone-grey p-4">
              <div className="eyebrow mb-1.5">Case type</div>
              <Fact value={policy.caseType} />
              {policy.caseType && policy.caseSubType && (
                <p className="secondary-text mt-0.5">{policy.caseSubType}</p>
              )}
            </div>
            <div className="lg-zone lg-zone-grey p-4">
              <div className="eyebrow flex items-center gap-1.5 mb-1.5">
                <Building2 className="w-4 h-4 text-deep" strokeWidth={1.75} /> Insurer
              </div>
              <Fact value={policy.insurer} />
            </div>
          </div>
        </div>

        {/* ── Five figures ── */}
        <InsuranceSummaryCards metrics={IA.summaryCards} />

        {/* ── Policy checks ── */}
        <div id="policy-checks" className="lg-card !p-0 overflow-hidden">
          <div className="px-6 py-5 border-b border-line">
            <h2 className="section-header flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} /> Policy Checks
            </h2>
          </div>

          <div className="p-6 space-y-4">
            {/* Policy valid — shown in full: the check everything else rests on. */}
            <div className="lg-zone lg-zone-grey p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                <div className="flex items-center gap-2">
                  <ValidityIcon className={`w-4 h-4 ${TONE_TEXT[validity.tone]}`} strokeWidth={1.75} />
                  <span className="card-title">{validity.label}</span>
                </div>
                <span className={TONE_PILL[validity.tone]}>{validity.status}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(validity.fields ?? []).map((f) => (
                  <div key={f.label}>
                    <div className="eyebrow mb-1">{f.label}</div>
                    <p className={`text-sm font-semibold leading-snug ${f.label === "Status" ? TONE_TEXT[validity.tone] : "text-ink"}`}>
                      {f.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* The remaining checks, as a grid of status tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {otherChecks.map((c) => {
                const Icon = TONE_ICON[c.tone];
                return (
                  <div key={c.label} className="lg-zone lg-zone-grey p-4 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${TONE_TEXT[c.tone]}`} strokeWidth={1.75} />
                        <span className="card-title leading-snug">{c.label}</span>
                      </div>
                      <span className={`${TONE_PILL[c.tone]} shrink-0`}>{c.status}</span>
                    </div>
                    {c.detail.map((d) => (
                      <p key={d} className="secondary-text mt-2 leading-relaxed">{d}</p>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Net recovery ──
            One vertical flow: what is available, what comes out of it, and —
            as the last line of the same card — what reaches the client. */}
        <div id="net-recovery" className="lg-card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <h2 className="section-header flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} /> Net Recovery Breakdown
            </h2>
            <button
              onClick={() => setShowWorking((s) => !s)}
              aria-expanded={showWorking}
              className="inline-flex items-center gap-1 text-sm font-semibold text-deep hover:text-ink transition-colors"
            >
              How the {IA.recovery.net.replace(/ /g, "")} is calculated
              <ChevronDown className={`w-4 h-4 transition-transform ${showWorking ? "rotate-180" : ""}`} strokeWidth={1.75} />
            </button>
          </div>

          {showWorking && (
            <div className="rounded-xl bg-tint border border-[#D6F2F7] p-4 mb-5">
              <p className="body-text leading-relaxed">
                The estimate starts from the coverage available across the policy layers, then subtracts what is
                expected to come out of it before the client is paid: defense costs that erode the limits during
                litigation, the liens held against any recovery, and the deductible. Ranges carry through, so the
                estimate is a range too. It is stated before attorney fees.
              </p>
            </div>
          )}

          <div className="eyebrow mb-2">Sources of Recovery</div>
          <div className="divide-y divide-line">
            {IA.recovery.sources.map((l) => (
              <div key={l.label} className="py-2.5 flex items-baseline justify-between gap-4">
                <span className="body-text">
                  {l.label}
                  {l.note && <span className="text-[#8A98A3]"> — {l.note}</span>}
                </span>
                <span className="text-sm font-semibold text-ink tabular-nums shrink-0">{l.amount}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-3 border-t-2 border-line flex items-baseline justify-between gap-4">
            <span className="text-sm font-semibold text-ink">Total available</span>
            <span className="text-lg font-bold text-ink tabular-nums">{IA.recovery.totalAvailable}</span>
          </div>

          <div className="eyebrow mt-6 mb-2">Estimated Deductions</div>
          <div className="divide-y divide-line">
            {IA.recovery.deductions.map((l) => (
              <div key={l.label} className="py-2.5 flex items-baseline justify-between gap-4">
                <span className="body-text">
                  {l.label}
                  {l.note && <span className="text-[#8A98A3]"> — {l.note}</span>}
                </span>
                <span className="text-sm font-semibold text-[#B91C1C] tabular-nums shrink-0">{l.amount}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-3 border-t-2 border-line flex items-baseline justify-between gap-4">
            <span className="text-sm font-semibold text-ink">Total estimated deductions</span>
            <span className="text-lg font-bold text-[#B91C1C] tabular-nums">{IA.recovery.totalDeductions}</span>
          </div>

          {/* The figure the breakdown arrives at */}
          <div id="net-recovery-result" className="mt-5 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" strokeWidth={1.75} />
              <div>
                <p className="text-sm font-semibold text-green-800">Estimated net recovery to client</p>
                <p className="secondary-text mt-0.5">After all deductions · Before attorney fees</p>
              </div>
            </div>
            <div className="kpi-value !text-green-700 tabular-nums">{IA.recovery.net}</div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div id="insurance-actions" className="lg-card p-6">
          <h2 className="section-header flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-[#B45309]" strokeWidth={1.75} /> Actions Required Now
          </h2>
          <div className="space-y-3">
            {IA.actions.map((a, i) => (
              <div key={a.title} className={`rounded-xl border p-4 flex items-start gap-3 ${TONE_PANEL[a.tone]}`}>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 bg-white border ${
                  a.tone === "critical" ? "border-[#FBD5D5] text-[#B91C1C]" : "border-[#FDE6C8] text-[#B45309]"
                }`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div className="card-title leading-snug">{a.title}</div>
                  <p className="secondary-text mt-1 leading-relaxed">{a.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Attorney insight ── */}
        <AttorneyInsight>{IA.attorneySummary}</AttorneyInsight>
      </div>
    </div>
  );
}
