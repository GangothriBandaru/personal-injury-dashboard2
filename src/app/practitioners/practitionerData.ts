// ── Medical practitioners and their workplaces ───────────────────────────────
// One record of the practitioners the case knows about and the hospitals they
// work at, read by the Case Overview's Medical Practitioners panel and by the
// Chronology's Injury Intelligence section alike, so the two cannot disagree.
//
// Only what the case record states is held here. A field the record does not
// establish is left undefined and shown as "Not available" — nothing is
// estimated or filled in, and nothing is looked up from an outside source.

export type HospitalSize = "Small" | "Medium" | "Large";
export type HospitalOwnership = "Non-Profit" | "For-Profit" | "Government";
export type HospitalStructure = "Independent" | "System Affiliated" | "Network Hospital";
export type LocationType = "County" | "City" | "State" | "Metro" | "Other";

export const HOSPITAL_SIZES: HospitalSize[] = ["Small", "Medium", "Large"];
export const HOSPITAL_OWNERSHIPS: HospitalOwnership[] = ["Non-Profit", "For-Profit", "Government"];
export const HOSPITAL_STRUCTURES: HospitalStructure[] = ["Independent", "System Affiliated", "Network Hospital"];
export const LOCATION_TYPES: LocationType[] = ["County", "City", "State", "Metro", "Other"];

export interface Hospital {
  id: string;
  name: string;
  /** "Chicago, Illinois" */
  location?: string;
  locationType?: LocationType;
  size?: HospitalSize;
  ownership?: HospitalOwnership;
  /** Independent, part of a health system, or a network hospital. */
  structure?: HospitalStructure;
  /** The health system, when system affiliated. */
  healthSystem?: string;
  network?: string;
  services?: string[];
  /** Set when the attributes above are demo values for the prototype, not
   *  facts from the case record. */
  demo?: boolean;
}

export interface Practitioner {
  id: string;
  name: string;
  /** Practitioner type / role — "Neurologist", "Physical Therapist" … */
  role: string;
  specializations: string[];
  experienceYears?: number;
  biography?: string;
  hospitalId?: string;
  /** "treating": in this case's medical record. "reference": a comparable
   *  practitioner the case analysis identified, not one who saw the plaintiff. */
  involvement: "treating" | "reference";
  /** What the practitioner did in this case, as the record describes it. */
  caseRole?: string;
  /** Similarity scores the case analysis calculated, keyed by the practitioner
   *  compared against. Absent pairs have no score and none is shown. */
  similarity?: Record<string, number>;
  /** Set on a fictional practitioner added to demonstrate the prototype —
   *  never presented as verified case data. */
  demo?: boolean;
}

export const HOSPITALS: Hospital[] = [
  // Workplace of the treating neurologist (Injury Intelligence).
  { id: "northwestern-memorial", name: "Northwestern Memorial Hospital", location: "Chicago, Illinois", locationType: "City" },
  // Workplaces of the comparable specialists, both recorded as metro hospitals.
  { id: "rush-university", name: "Rush University Medical Center", locationType: "Metro" },
  { id: "university-medical-center", name: "University Medical Center", locationType: "Metro" },
  // Treating facilities named in the case evidence.
  { id: "cook-county-medical-center", name: "Cook County Medical Center" },
  // Its attributes are DEMO values, so the prototype can show a complete
  // provider; the case record does not give them.
  {
    id: "physical-therapy-associates", name: "Physical Therapy Associates",
    location: "Chicago, Illinois", locationType: "City", size: "Medium",
    ownership: "For-Profit", structure: "Independent", demo: true,
  },
];

export const PRACTITIONERS: Practitioner[] = [
  {
    id: "sarah-mitchell",
    name: "Dr. Sarah Mitchell",
    role: "Neurologist",
    specializations: ["Vascular Neurology"],
    experienceYears: 18,
    hospitalId: "northwestern-memorial",
    involvement: "treating",
    caseRole: "Treated the plaintiff following the ischemic stroke",
  },
  {
    id: "michael-chen",
    name: "Dr. Michael Chen",
    role: "Vascular Neurologist",
    specializations: ["Vascular Neurology", "Stroke Care"],
    experienceYears: 17,
    hospitalId: "rush-university",
    involvement: "reference",
    similarity: { "sarah-mitchell": 92 },
  },
  {
    id: "emily-carter",
    name: "Dr. Emily Carter",
    role: "Neurologist",
    specializations: ["Neurology", "Stroke Expertise"],
    experienceYears: 20,
    hospitalId: "university-medical-center",
    involvement: "reference",
    similarity: { "sarah-mitchell": 88 },
  },
  // DEMO — a fictional practitioner, so the prototype shows a practitioner at
  // each of the case's providers. Not from the case record.
  {
    id: "demo-pt-dana-whitfield",
    name: "Dr. Dana Whitfield, DPT",
    role: "Physical Therapist",
    specializations: ["Orthopedic Physical Therapy"],
    experienceYears: 12,
    biography: "Experienced physical therapist specializing in musculoskeletal rehabilitation and post-injury recovery.",
    hospitalId: "physical-therapy-associates",
    involvement: "treating",
    demo: true,
  },
];

export const hospitalById = (id?: string) => HOSPITALS.find((h) => h.id === id);
export const practitionerById = (id: string) => PRACTITIONERS.find((p) => p.id === id);

// ── Which providers belong to which case ─────────────────────────────────────
// Case → medical providers (facilities) → the practitioners the record names
// as treating the plaintiff at each. A provider is a facility, never a person;
// a practitioner is always reached through the provider they treated at, and
// a provider can carry any number of them — or none. The Chronology's Medical
// Practitioners card reads this for whichever case is open, so it shows that
// case's practitioners and nothing from any other case.

export interface CaseProvider {
  facilityId: string;
  /** The practitioners the record names as treating the plaintiff here. */
  practitionerIds: string[];
}

export interface CaseMedicalProviders {
  /** Every reference the case goes by: its intake number and its workspace number. */
  caseRefs: string[];
  providers: CaseProvider[];
}

export const CASE_MEDICAL_PROVIDERS: CaseMedicalProviders[] = [
  {
    // Estate of Miller vs Logistics Co.
    caseRefs: ["CASE-94101", "PI-2024-001"],
    providers: [
      // The Case Intelligence Summary's Primary Medical Providers, each with
      // the practitioner(s) who treated the plaintiff there.
      { facilityId: "cook-county-medical-center", practitionerIds: ["sarah-mitchell"] },
      { facilityId: "physical-therapy-associates", practitionerIds: ["demo-pt-dana-whitfield"] }, // DEMO practitioner
    ],
  },
];

/** One provider of a case, with the practitioners who treated the plaintiff there. */
export interface ProviderGroup {
  provider: Hospital;
  practitioners: Practitioner[];
}

/** A case's providers, each grouped with its own practitioners, and the count
 *  of named practitioners across them. */
export function medicalProvidersForCase(caseRef?: string): {
  groups: ProviderGroup[];
  practitionerCount: number;
} {
  const entry = CASE_MEDICAL_PROVIDERS.find((c) => !!caseRef && c.caseRefs.includes(caseRef));
  const groups = (entry?.providers ?? [])
    .map((p) => ({
      provider: hospitalById(p.facilityId),
      practitioners: p.practitionerIds.map((id) => practitionerById(id)).filter((x): x is Practitioner => !!x),
    }))
    .filter((g): g is ProviderGroup => !!g.provider);
  const practitionerCount = new Set(groups.flatMap((g) => g.practitioners.map((p) => p.id))).size;
  return { groups, practitionerCount };
}

/** The practitioners at one provider. For a provider of the open case, those
 *  the case links to it — the same relationship the Medical Practitioners card
 *  shows. For any other hospital (one reached through Find Similar), those
 *  whose own record names it as their workplace. */
export function practitionersAtProvider(hospitalId: string, caseRef?: string): Practitioner[] {
  const group = medicalProvidersForCase(caseRef).groups.find((g) => g.provider.id === hospitalId);
  return group ? group.practitioners : PRACTITIONERS.filter((p) => p.hospitalId === hospitalId);
}
/** The practitioners in this case's own medical record. */
export const TREATING_PRACTITIONERS = PRACTITIONERS.filter((p) => p.involvement === "treating");

export const formatExperience = (years?: number) => (years == null ? undefined : `${years} years`);

/** "Large · System Affiliated", or undefined when neither is recorded. */
export const hospitalSummary = (h?: Hospital) =>
  h ? ([h.size, h.structure].filter(Boolean).join(" · ") || undefined) : undefined;
