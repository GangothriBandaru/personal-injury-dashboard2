import { CaseDescription } from "./CaseDescription";

interface CaseSnapshotProps {
  caseName: string;
  caseType?: string;
  caseSubType?: string;
  plaintiff: string;
  plaintiffEmail?: string;
  plaintiffPhone?: string;
  jurisdiction?: string;
  caseId: string;
  dateOfIncident?: string;
  summary: string;
}

export function CaseSnapshot({
  caseName,
  caseType,
  caseSubType,
  plaintiff,
  plaintiffEmail,
  plaintiffPhone,
  jurisdiction,
  caseId,
  dateOfIncident,
  summary,
}: CaseSnapshotProps) {
  const fields = [
    { label: "Plaintiff", value: plaintiff, mono: false },
    plaintiffEmail ? { label: "Email", value: plaintiffEmail, mono: false } : null,
    plaintiffPhone ? { label: "Phone", value: plaintiffPhone, mono: false } : null,
    caseType ? { label: "Case Type", value: caseType, mono: false } : null,
    caseSubType ? { label: "Sub-Type", value: caseSubType, mono: false } : null,
    jurisdiction ? { label: "Jurisdiction", value: jurisdiction, mono: false } : null,
    { label: "Case ID", value: caseId, mono: false },
    dateOfIncident ? { label: "Date of Incident", value: dateOfIncident, mono: false } : null,
  ].filter(Boolean) as { label: string; value: string; mono: boolean }[];

  return (
    <div className="lg-card overflow-hidden">
      {/* Title row — summary fills the empty space on the right */}
      <div className="flex items-center gap-8 px-6 pt-6 pb-5 border-b border-line">
        <div className="shrink-0">
          <h2 className="section-header">{caseName}</h2>
        </div>
        <CaseDescription text={summary} />
      </div>

      {/* Metadata strip */}
      <div className="flex flex-wrap divide-x divide-[#EEF3F6]">
        {fields.map(({ label, value, mono }) => (
          <div key={label} className="flex flex-col px-5 py-4 min-w-0">
            <span className="eyebrow mb-1.5 whitespace-nowrap">{label}</span>
            <span
              className={`whitespace-nowrap ${
                mono ? "mono-ref" : "text-sm font-semibold text-ink"
              }`}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
