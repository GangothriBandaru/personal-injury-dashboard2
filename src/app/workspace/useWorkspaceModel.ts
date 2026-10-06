import { useDamagesOptional } from "../damages/DamagesContext";
import type { WorkspaceModel } from "./WorkspaceTabs";

// ── The case model every workspace surface reads ─────────────────────────────
// Built in one place so the Case Workspace and the Case Ready deliverables
// (Medical Chronology, Evidence Structure, Case Summary, Valuation Analysis)
// describe the case identically — a change to the damage record shows in both.

// Canonical valuation baseline (kept consistent with the Valuation stage).
const BASE_ECONOMIC = 161450;
const MULTIPLIER = 9;

export function useWorkspaceModel(caseData?: any): WorkspaceModel {
  const damages = useDamagesOptional();
  // Economic damages are read from the damages store, not from the baseline
  // constant, so every tab that quotes a total reflects the record as it stands
  // after an edit — the baseline is only the fallback outside the provider.
  const economicTotal = damages?.economicTotal ?? BASE_ECONOMIC;
  const nonEconomicItems = damages?.nonEconomicItemsTotal ?? 0;
  const nonEconomic = economicTotal * MULTIPLIER + nonEconomicItems;
  return {
    caseName: caseData?.caseName ?? "Estate of Miller vs Logistics Co.",
    caseId: caseData?.id ?? caseData?.caseId ?? "CASE-94101",
    plaintiff: caseData?.plaintiff ?? "Evelyn Miller",
    defendant: caseData?.defendant ?? "Midwest Logistics Co.",
    insuranceCarrier: caseData?.insuranceCarrier ?? "ABC Professional Liability Insurance",
    caseType: caseData?.caseType ?? "Motor Vehicle Accident",
    jurisdiction: caseData?.jurisdiction ?? "Cook County, IL",
    incidentDate: caseData?.dateOfIncident ?? "Feb 14, 2026",
    status: "Ready for Review",
    recommendedSettlement: economicTotal + nonEconomic,
    confidence: 94,
    multiplier: MULTIPLIER,
    economicTotal,
    nonEconomicTotal: nonEconomic,
    estimatedLow: caseData?.estimatedLow ?? 968700,
    estimatedHigh: caseData?.estimatedHigh ?? 1372325,
  };
}
