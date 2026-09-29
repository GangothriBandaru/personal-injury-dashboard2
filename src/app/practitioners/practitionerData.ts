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
}

export const HOSPITALS: Hospital[] = [
  // Workplace of the treating neurologist (Injury Intelligence).
  { id: "northwestern-memorial", name: "Northwestern Memorial Hospital", location: "Chicago, Illinois", locationType: "City" },
  // Workplaces of the comparable specialists, both recorded as metro hospitals.
  { id: "rush-university", name: "Rush University Medical Center", locationType: "Metro" },
  { id: "university-medical-center", name: "University Medical Center", locationType: "Metro" },
  // Treating facilities named in the case evidence.
  { id: "cook-county-medical-center", name: "Cook County Medical Center" },
  { id: "physical-therapy-associates", name: "Physical Therapy Associates" },
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
];

export const hospitalById = (id?: string) => HOSPITALS.find((h) => h.id === id);
export const practitionerById = (id: string) => PRACTITIONERS.find((p) => p.id === id);
/** The practitioners in this case's own medical record. */
export const TREATING_PRACTITIONERS = PRACTITIONERS.filter((p) => p.involvement === "treating");

export const formatExperience = (years?: number) => (years == null ? undefined : `${years} years`);

/** "Large · System Affiliated", or undefined when neither is recorded. */
export const hospitalSummary = (h?: Hospital) =>
  h ? ([h.size, h.structure].filter(Boolean).join(" · ") || undefined) : undefined;
