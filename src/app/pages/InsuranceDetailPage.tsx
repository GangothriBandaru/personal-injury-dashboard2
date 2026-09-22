import {
  Shield, AlertCircle, AlertTriangle, ArrowRight, CheckCircle, Scale, DollarSign, Users, Building2,
} from "lucide-react";
import { INSURANCE_ANALYSIS as IA, type Panel, type Flag, type Tone } from "../insurance/insuranceData";
import {
  InsuranceBreadcrumb, InsuranceSummaryCards, AttorneyInsight, AttorneyDisclaimer,
  TONE_PILL, TONE_TEXT, TONE_PANEL,
} from "../insurance/InsuranceShared";

// ── Insurance Policy Analysis — full detailed analysis ────────────────────────
// The six panels behind the summary, in the order an attorney works through a
// policy: is it valid, does it apply, how much, what could go wrong, who else
// has a claim on it, and who is paying. Each panel closes with its insight.
//
// Built from the product's own parts: section cards with a header strip (as
// Evidence Verification), the dashboard's tinted icon container, status pills,
// and divided label/value rows.

const PANEL_ICON: Record<number, any> = {
  1: Scale,
  2: Shield,
  3: DollarSign,
  4: AlertTriangle,
  5: Users,
  6: Building2,
};

// A panel's status is read off its own content — the most severe tone among its
// fields and flags — so the badge never says more than the panel does.
function panelStatus(panel: Panel): { label: string; tone: Tone } {
  const tones = [
    ...panel.fields.map((f) => f.tone),
    ...(panel.flags ?? []).map((f) => (f.severity === "Critical" ? "critical" : "warning")),
  ];
  if (tones.includes("critical")) return { label: "Critical", tone: "critical" };
  if (tones.includes("warning")) return { label: "Review Required", tone: "warning" };
  return { label: "Clear", tone: "positive" };
}

// One labelled value: eyebrow label over the value, divided like the rest of
// the product's detail lists.
function FieldRow({ label, value, tone }: Panel["fields"][number]) {
  return (
    <div className="py-3 border-b border-line">
      <div className="eyebrow mb-1">{label}</div>
      <p className={`text-sm font-medium leading-snug ${tone ? TONE_TEXT[tone] : "text-ink"}`}>{value}</p>
    </div>
  );
}

function FlagCard({ flag }: { flag: Flag }) {
  const critical = flag.severity === "Critical";
  const tone = critical ? "critical" : "warning";
  const Icon = critical ? AlertCircle : AlertTriangle;
  return (
    <div className={`rounded-xl border p-4 ${TONE_PANEL[tone]}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2 min-w-0">
          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${TONE_TEXT[tone]}`} strokeWidth={1.75} />
          <div className="card-title leading-snug">{flag.title}</div>
        </div>
        <span className={`${TONE_PILL[tone]} shrink-0`}>{flag.severity}</span>
      </div>
      <p className="body-text mt-2 leading-relaxed">{flag.detail}</p>
      <p className={`text-sm font-semibold mt-2 flex items-start gap-1.5 ${TONE_TEXT[tone]}`}>
        <ArrowRight className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={2} /> {flag.action}
      </p>
    </div>
  );
}

function PanelCard({ panel }: { panel: Panel }) {
  const Icon = PANEL_ICON[panel.no] ?? Shield;
  const status = panelStatus(panel);
  return (
    <section id={`insurance-panel-${panel.no}`} className="lg-card !p-0 overflow-hidden scroll-mt-[90px]">
      <div className="px-6 py-5 border-b border-line flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-lg bg-tint text-deep shrink-0">
            <Icon className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <div className="eyebrow">Panel {panel.no}</div>
            <h2 className="section-header">{panel.title}</h2>
          </div>
        </div>
        <span className={`${TONE_PILL[status.tone]} shrink-0`}>{status.label}</span>
      </div>

      <div className="p-6 space-y-4">
        {panel.fields.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 -mt-3">
            {panel.fields.map((f) => <FieldRow key={f.label} {...f} />)}
          </div>
        )}

        {panel.total && (
          <div className="lg-zone px-4 py-3 flex items-baseline justify-between gap-4">
            <span className="text-sm font-semibold text-ink">{panel.total.label}</span>
            <span className="kpi-value !text-[22px] tabular-nums">{panel.total.value}</span>
          </div>
        )}

        {panel.flags && panel.flags.length > 0 && (
          <div className="space-y-3">
            {panel.flags.map((f) => <FlagCard key={f.title} flag={f} />)}
          </div>
        )}

        <AttorneyInsight>{panel.insight}</AttorneyInsight>
      </div>
    </section>
  );
}

export function InsuranceDetailPage({
  caseName, onBack, onBackToAnalysis,
}: {
  caseName: string;
  /** Back to the insurance summary. */
  onBack: () => void;
  onBackToAnalysis: () => void;
}) {
  return (
    <div className="min-h-screen bg-wash">
      <InsuranceBreadcrumb
        backLabel="Back to Insurance Summary"
        onBack={onBack}
        trail={[
          { label: "Case Intake" },
          { label: caseName, onClick: onBackToAnalysis },
          { label: IA.title, onClick: onBack },
          { label: "Full Detailed Analysis" },
        ]}
      />

      <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-6">
        {/* ── Header ── */}
        <div>
          <div className="eyebrow flex items-center gap-1.5 mb-2">
            <Shield className="w-4 h-4 text-deep" strokeWidth={1.75} /> Insurance · Full Detailed Analysis
          </div>
          <h1 className="page-title">{IA.title}</h1>
          <p className="secondary-text mt-1">Analysed {IA.analysedOn} · Six panels, each with an attorney insight.</p>
        </div>

        {/* ── Five figures ── */}
        <InsuranceSummaryCards />

        {/* ── Six panels ── */}
        {IA.panels.map((p) => <PanelCard key={p.no} panel={p} />)}

        {/* ── Case intake summary ── */}
        <section id="insurance-intake-summary" className="lg-card !p-0 overflow-hidden">
          <div className="px-6 py-5 border-b border-line">
            <h2 className="section-header">Case Intake Summary</h2>
          </div>
          <ul className="p-6 space-y-2">
            {IA.intakeSummary.map((s) => (
              <li key={s} className="flex items-start gap-2 body-text leading-relaxed">
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-deep" strokeWidth={1.75} /> {s}
              </li>
            ))}
          </ul>
        </section>

        <div className="flex justify-start pt-2">
          <button onClick={onBack} className="btn btn-secondary">Back to Insurance Summary</button>
        </div>

        <AttorneyDisclaimer />
      </div>
    </div>
  );
}
