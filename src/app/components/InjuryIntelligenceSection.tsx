import { useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  PRACTITIONERS, TREATING_PRACTITIONERS, hospitalById, formatExperience,
} from "../practitioners/practitionerData";

// The treating physician and the comparable specialists come from the shared
// practitioner record, which the Case Overview's Medical Practitioners panel
// reads too. Shaped here as this section has always displayed them.
const physician = TREATING_PRACTITIONERS[0];
const physicianHospital = hospitalById(physician?.hospitalId);
const treatingPhysician = {
  name: physician?.name ?? "",
  title: physician?.role ?? "",
  specialization: physician?.specializations.join(" · ") ?? "",
  experience: formatExperience(physician?.experienceYears) ?? "Not available",
  hospital: physicianHospital?.name ?? "Not available",
  hospitalLocation: physicianHospital?.location ?? "Not available",
  role: physician?.caseRole ?? "Not available",
};
const similarExperts = PRACTITIONERS
  .filter((p) => physician && p.similarity?.[physician.id] != null)
  .sort((a, b) => b.similarity![physician!.id] - a.similarity![physician!.id])
  .map((p) => {
    const h = hospitalById(p.hospitalId);
    return {
      name: p.name,
      matchPercentage: p.similarity![physician!.id],
      title: p.role,
      experience: formatExperience(p.experienceYears) ?? "Not available",
      hospital: h?.name ?? "Not available",
      expertise: [...p.specializations, ...(h?.locationType === "Metro" ? ["Metro Hospital"] : [])],
    };
  });

const injuryIntelligenceData = {
  summary: "Severe neurological injury with permanent functional impairment",
  injuryProfile: {
    affectedArea: "Brain / Neurological System",
    injury: "Ischemic stroke",
    condition: "Permanent neurological damage with right-sided hemiplegia",
  },
  severityImpact: {
    intensity: "Severe",
    condition: "Permanent neurological impairment",
    shortTermImpact: ["Acute neurological deterioration", "Emergency hospitalization", "Intensive medical treatment"],
    longTermImpact: ["Permanent functional limitations", "Ongoing medical care", "Significant loss of independence"],
  },
  treatingPhysician,
  similarExperts,
};

export function InjuryIntelligenceSection() {
  const [expandedInjuryDetails, setExpandedInjuryDetails] = useState(false);
  const [expandedSimilarDoctors, setExpandedSimilarDoctors] = useState(false);

  return (
    <div className="lg-card p-6">
      <div>
        <h2 className="section-header mb-1">Injury Intelligence</h2>
        <p className="secondary-text mb-4">Medical evidence and injury characteristics supporting the case valuation.</p>

        {!expandedInjuryDetails && !expandedSimilarDoctors && (
          <>
            <p className="text-sm text-ink font-semibold mb-3">{injuryIntelligenceData.summary}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="pill pill-neutral">Severe</span>
              <span className="pill pill-neutral">Neurological Injury</span>
              <span className="pill pill-neutral">Permanent Impairment</span>
            </div>
            <button onClick={() => setExpandedInjuryDetails(true)} className="text-sm text-deep hover:text-ink transition-colors inline-flex items-center gap-1 group">
              <span className="font-semibold">View injury details</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2} />
            </button>
          </>
        )}

        {expandedInjuryDetails && !expandedSimilarDoctors && (
          <div className="mt-4 pt-4 border-t border-line space-y-6">
            <div>
              <h3 className="card-title mb-3">Injury Profile</h3>
              <div className="space-y-2 text-sm">
                <div className="flex gap-4"><span className="font-semibold text-[#5B6B78] w-24 shrink-0">Affected Area</span><span className="text-ink">{injuryIntelligenceData.injuryProfile.affectedArea}</span></div>
                <div className="flex gap-4"><span className="font-semibold text-[#5B6B78] w-24 shrink-0">Injury</span><span className="text-ink">{injuryIntelligenceData.injuryProfile.injury}</span></div>
                <div className="flex gap-4"><span className="font-semibold text-[#5B6B78] w-24 shrink-0">Condition</span><span className="text-ink">{injuryIntelligenceData.injuryProfile.condition}</span></div>
              </div>
            </div>

            <div className="border-t border-line pt-6">
              <h3 className="card-title mb-3">Severity & Impact</h3>
              <div className="space-y-3 text-sm">
                <div className="flex gap-4"><span className="font-semibold text-[#5B6B78] w-24 shrink-0">Intensity</span><span className="text-ink">{injuryIntelligenceData.severityImpact.intensity}</span></div>
                <div className="flex gap-4"><span className="font-semibold text-[#5B6B78] w-24 shrink-0">Condition</span><span className="text-ink">{injuryIntelligenceData.severityImpact.condition}</span></div>
                <div><span className="font-semibold text-[#5B6B78] block mb-2">Short-Term Impact</span><ul className="space-y-1 ml-2">{injuryIntelligenceData.severityImpact.shortTermImpact.map((item) => <li key={item} className="text-ink flex gap-2"><span className="text-deep shrink-0">•</span><span>{item}</span></li>)}</ul></div>
                <div><span className="font-semibold text-[#5B6B78] block mb-2">Long-Term Impact</span><ul className="space-y-1 ml-2">{injuryIntelligenceData.severityImpact.longTermImpact.map((item) => <li key={item} className="text-ink flex gap-2"><span className="text-deep shrink-0">•</span><span>{item}</span></li>)}</ul></div>
              </div>
            </div>

            <div className="border-t border-line pt-6">
              <h3 className="card-title mb-3">Treating Physician</h3>
              <div className="space-y-2 text-sm">
                <div><div className="font-bold text-ink">{injuryIntelligenceData.treatingPhysician.name}</div><div className="text-xs text-[#5B6B78]">{injuryIntelligenceData.treatingPhysician.title} · {injuryIntelligenceData.treatingPhysician.specialization}</div></div>
                <div className="flex gap-4"><span className="font-semibold text-[#5B6B78] w-24 shrink-0">Experience</span><span className="text-ink">{injuryIntelligenceData.treatingPhysician.experience}</span></div>
                <div className="flex gap-4"><span className="font-semibold text-[#5B6B78] w-24 shrink-0">Hospital</span><span className="text-ink">{injuryIntelligenceData.treatingPhysician.hospital}</span></div>
                <div className="flex gap-4"><span className="font-semibold text-[#5B6B78] w-24 shrink-0">Location</span><span className="text-ink">{injuryIntelligenceData.treatingPhysician.hospitalLocation}</span></div>
                <div className="flex gap-4"><span className="font-semibold text-[#5B6B78] w-24 shrink-0">Role</span><span className="text-ink">{injuryIntelligenceData.treatingPhysician.role}</span></div>
              </div>
            </div>

            <div className="border-t border-line pt-6">
              <button onClick={() => setExpandedSimilarDoctors(true)} className="text-sm text-deep hover:text-ink transition-colors inline-flex items-center gap-1 group">
                <span className="font-semibold">Find similar doctors</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" strokeWidth={2} />
              </button>
            </div>
          </div>
        )}

        {expandedSimilarDoctors && (
          <div className="mt-4 pt-4 border-t border-line space-y-4">
            {expandedInjuryDetails && <div className="mb-4 pb-4 border-b border-line"><button onClick={() => setExpandedInjuryDetails(false)} className="text-sm text-deep hover:text-ink transition-colors inline-flex items-center gap-1 group"><ArrowRight className="w-3.5 h-3.5 rotate-180 group-hover:-translate-x-0.5 transition-transform" strokeWidth={2} /><span className="font-semibold">Back to injury details</span></button></div>}
            <h3 className="card-title">Similar Medical Experts</h3>
            <p className="secondary-text text-xs">Specialists identified based on specialization, clinical experience, injury expertise, hospital type, and hospital location.</p>
            <div className="space-y-3">
              {injuryIntelligenceData.similarExperts.map((expert) => (
                <div key={expert.name} className="rounded-lg border border-line bg-offwhite p-3 text-sm">
                  <div className="flex items-start justify-between gap-2 mb-2"><div><div className="font-bold text-ink">{expert.name}</div><div className="text-xs text-[#5B6B78]">{expert.title}</div></div><div className="text-xs font-bold text-deep shrink-0">{expert.matchPercentage}% Match</div></div>
                  <div className="flex gap-4 text-xs mb-2"><span className="font-semibold text-[#5B6B78]">{expert.experience}</span><span className="text-[#5B6B78]">{expert.hospital}</span></div>
                  <div className="flex flex-wrap gap-1">{expert.expertise.map((tag) => <span key={tag} className="inline-flex px-2 py-0.5 rounded-full bg-tint border border-[#D6F2F7] text-xs font-medium text-deep">{tag}</span>)}</div>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-[#F6FDFF] border border-[#D6F2F7] p-3"><p className="text-xs text-[#5B6B78] italic">Supporting medical intelligence — does not affect the multiplier calculation.</p></div>
            {(expandedInjuryDetails || expandedSimilarDoctors) && <div className="pt-4 border-t border-line"><button onClick={() => { setExpandedInjuryDetails(false); setExpandedSimilarDoctors(false); }} className="inline-flex items-center gap-1 text-sm font-semibold text-deep hover:text-ink transition-colors"><span>Collapse section</span><span aria-hidden="true">⌃</span></button></div>}
          </div>
        )}
      </div>
    </div>
  );
}
