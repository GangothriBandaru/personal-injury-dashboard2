import {
  ChevronLeft, Sparkles, CheckCircle, Shield, AlertTriangle, DollarSign, Zap,
} from "lucide-react";
import { INSURANCE_ANALYSIS, type Tone, type Metric } from "./insuranceData";

// ── Shared pieces for the insurance pages ─────────────────────────────────────
// Everything here maps onto the product's existing classes — pills, cards,
// eyebrows, the AI callout — so the insurance pages read as part of Case Intake
// rather than as a separate tool. No colour is introduced that the rest of the
// app does not already use.

// Tone → the existing semantic pill. positive/warning/critical/info are the
// product's complete/progress/risk/neutral.
export const TONE_PILL: Record<Tone, string> = {
  positive: "pill pill-complete",
  warning: "pill pill-progress",
  critical: "pill pill-risk",
  info: "pill pill-neutral",
};

// Tone → the text colour those pills use, for a value shown without a pill.
export const TONE_TEXT: Record<Tone, string> = {
  positive: "text-[#15803D]",
  warning: "text-[#B45309]",
  critical: "text-[#B91C1C]",
  info: "text-ink",
};

// Tone → the icon container the dashboard's summary cards use.
export const TONE_ICON_WRAP: Record<Tone, string> = {
  positive: "bg-[#ECFDF3] text-[#15803D]",
  warning: "bg-[#FFF7ED] text-[#B45309]",
  critical: "bg-[#FEF2F2] text-[#B91C1C]",
  info: "bg-tint text-deep",
};

// Tone → the soft panel those pills use, for callouts and action rows.
export const TONE_PANEL: Record<Tone, string> = {
  positive: "bg-[#ECFDF3] border-[#D1FADF]",
  warning: "bg-[#FFF7ED] border-[#FDE6C8]",
  critical: "bg-[#FEF2F2] border-[#FBD5D5]",
  info: "bg-tint border-[#D6F2F7]",
};

// The breadcrumb bar every Case Intake page carries: a back action on the left,
// the trail on the right.
export function InsuranceBreadcrumb({
  backLabel, onBack, trail,
}: {
  backLabel: string;
  onBack: () => void;
  /** The trail, left to right. Every entry but the last is a link. */
  trail: { label: string; onClick?: () => void }[];
}) {
  return (
    <div className="bg-white sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto px-8 py-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 secondary-text hover:text-ink transition-colors">
            <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
            {backLabel}
          </button>
          <div className="secondary-text ml-auto flex items-center flex-wrap justify-end">
            {trail.map((t, i) => {
              const last = i === trail.length - 1;
              return (
                <span key={t.label} className="flex items-center">
                  {i > 0 && <span className="mx-2">›</span>}
                  {last ? (
                    <span className="text-ink font-medium">{t.label}</span>
                  ) : t.onClick ? (
                    <button onClick={t.onClick} className="secondary-text hover:text-ink transition-colors">{t.label}</button>
                  ) : (
                    <span>{t.label}</span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// The five headline figures, shared by the summary and the detailed analysis.
// Built on the dashboard's own summary card (components/SummaryCards): a card
// with a tone-tinted icon container, an eyebrow label and a KPI value.
const METRIC_ICON: Record<string, any> = {
  "Case Viability": CheckCircle,
  "Total Coverage": Shield,
  "Red Flags": AlertTriangle,
  "Net Recovery Est.": DollarSign,
  "First Action": Zap,
  "Net to Client": DollarSign,
  "Risk Level": AlertTriangle,
};

const GRID_COLS: Record<number, string> = {
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

export function InsuranceSummaryCards({ metrics = INSURANCE_ANALYSIS.metrics }: { metrics?: Metric[] }) {
  return (
    <div id="insurance-summary-cards" className={`grid grid-cols-1 sm:grid-cols-2 ${GRID_COLS[metrics.length] ?? "lg:grid-cols-5"} gap-4`}>
      {metrics.map((m) => {
        const Icon = METRIC_ICON[m.label] ?? Shield;
        return (
          <div key={m.label} className="lg-card p-5 flex flex-col">
            <div className={`p-2.5 rounded-lg self-start mb-4 ${TONE_ICON_WRAP[m.tone]}`}>
              <Icon className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div className="eyebrow mb-2">{m.label}</div>
            <div className={`kpi-value !text-[22px] leading-tight ${TONE_TEXT[m.tone]}`}>{m.value}</div>
            {m.note && <p className="secondary-text mt-1.5 leading-snug">{m.note}</p>}
          </div>
        );
      })}
    </div>
  );
}

// The attorney-facing reading of a panel. The product has no separate Attorney
// Insight component, so this uses its established AI callout — the same tint,
// border and eyebrow the AI summaries use elsewhere.
export function AttorneyInsight({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-tint border border-[#D6F2F7] p-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
        <span className="eyebrow text-deep">Attorney Insight</span>
      </div>
      <p className="body-text leading-relaxed">{children}</p>
    </div>
  );
}

// The disclaimer that closes an analysis meant for the attorney, not the client.
export function AttorneyDisclaimer() {
  return (
    <p className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8A98A3]">
      For attorney use only · Not legal advice
    </p>
  );
}
