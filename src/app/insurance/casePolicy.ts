import { classifyDocuments, type CaseDocument } from "../types/case";
import { getDocumentContent } from "../components/documentText";

// ── The policy behind a case's insurance analysis ─────────────────────────────
// Resolved from the case being viewed — never from a fixed example — so the
// summary shows whichever case is open. The policy facts come from the case's
// own insurance document (its declarations page, as the document viewer renders
// it); the case type comes from the case record. Anything the case does not
// hold stays undefined, and the page shows it as unavailable.

export interface CasePolicy {
  /** The insurance policy document on file for the case. */
  fileName?: string;
  policyNo?: string;
  period?: string;
  namedInsured?: string;
  policyType?: string;
  caseType?: string;
  caseSubType?: string;
  insurer?: string;
}

export const POLICY_UNAVAILABLE = "Not available in case record.";

// "COMMERCIAL GENERAL LIABILITY — DECLARATIONS" → "Commercial General Liability"
function policyTypeFrom(heading: string | undefined): string | undefined {
  if (!heading) return undefined;
  const name = heading.replace(/\s*[—-]\s*DECLARATIONS\s*$/i, "").trim();
  if (!name) return undefined;
  return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function resolveCasePolicy(
  caseData: { caseType?: string; caseSubType?: string } | null | undefined,
  documents: CaseDocument[] = [],
): CasePolicy {
  const caseType = caseData?.caseType || undefined;
  const caseSubType = caseData?.caseSubType || undefined;
  const doc = classifyDocuments(documents).find((c) => c.name === "Insurance Documents")?.docs[0];
  if (!doc) return { caseType, caseSubType };

  // Read the declarations off the document itself.
  const content = getDocumentContent(doc);
  const fields = new Map<string, string>();
  for (const b of content.blocks) {
    if (b.type === "fields") for (const [k, v] of b.pairs) if (!fields.has(k)) fields.set(k, v);
  }
  const firstHeading = content.blocks.find((b) => b.type === "heading") as { text: string } | undefined;

  return {
    fileName: doc.name,
    policyNo: fields.get("Policy No.") ?? fields.get("Policy Number"),
    period: fields.get("Policy Period"),
    namedInsured: fields.get("Named Insured"),
    policyType: policyTypeFrom(firstHeading?.text),
    caseType,
    caseSubType,
    insurer: fields.get("Carrier") ?? fields.get("Insurer"),
  };
}
