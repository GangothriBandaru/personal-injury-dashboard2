import type { StageId } from "./WorkspaceTabs";

// ── Evidence intelligence ─────────────────────────────────────────────────────
// The Evidence stage does not own files. It reads the case's ONE document
// repository plus the files the other stages already cite, and layers analysis
// on top. Everything here is keyed by lowercased filename, so a document cited
// by Chronology, Negligence and Violations stays a single underlying record.

export type EvidenceFormat = "document" | "image" | "video";
export type Confidence = "High" | "Moderate" | "Low";

export interface EvidenceViolation {
  name: string;
  why: string;
  confidence: Confidence;
  docs: string[];
}

export interface EvidenceFact {
  text: string;
  verified: boolean; // false = AI interpretation, labelled as such in the UI
}

export interface EvidenceImpact {
  liability: string;
  causation: string;
  damages: string;
  violations: string;
  settlement: string;
  overall: "High" | "Moderate" | "Low";
}

export interface EvidenceIntel {
  title: string;
  summary: string;
  keyFacts: EvidenceFact[];
  parties: { role: string; name: string }[];
  liability: string;
  // Only present where the evidence actually supports an estimate (§20).
  allocation?: { defendant: string; plaintiff: string; confidence: Confidence };
  violations: EvidenceViolation[];
  causation: string;
  damages: string;
  impact: EvidenceImpact;
  related: string[];
  contradictions: { source: string; text: string; against: string; againstText: string }[];
  gaps: string[];
  confidence: { level: Confidence; score: number };
  supports: StageId[];
  keywords?: string[];              // extra search terms not present in the filename
  observations?: string[];          // images: what is actually visible
  inferences?: string[];            // images: what it may suggest
  moments?: { time: string; text: string }[]; // videos: important moments
}

// Case-referenced media. These are not uploads — they are referenced the same
// way the workspace already references Traffic_Camera_Still.png and
// Dashcam_Footage.mp4, and resolve through the shared document resolver.
export const EVIDENCE_MEDIA: { name: string; source: string; date: string }[] = [
  { name: "intersection_scene.jpg", source: "Plaintiff", date: "Feb 14, 2026" },
  { name: "vehicle_damage.jpg", source: "Plaintiff", date: "Feb 14, 2026" },
  { name: "cervical_xray.jpg", source: "Plaintiff", date: "Feb 16, 2026" },
  { name: "traffic_camera.mp4", source: "Attorney", date: "Feb 18, 2026" },
];

// ── Buckets ───────────────────────────────────────────────────────────────────
// Ordered — first match wins, so "Texas_Nursing_Standards" reads as a legal
// standard rather than a nursing record.

export const EVIDENCE_BUCKETS: { name: string; match: RegExp }[] = [
  { name: "Witness Evidence", match: /witness/ },
  { name: "Police & Official Reports", match: /police|officer|citation|dispatch|patrol|fmcsa|ems_/ },
  { name: "Accident / Scene Evidence", match: /scene|reconstruction|skid|intersection|traffic_camera|signal_timing|dashcam|crash/ },
  { name: "Vehicle / Physical Evidence", match: /vehicle|edr_|carrier_records|inspection/ },
  { name: "Legal & Case Documents", match: /demand|letter|agreement|standards|custodial|statute|motion|filing|court|pleading/ },
  { name: "Medical Evidence", match: /mri|xray|x-ray|(?:^|[_-])er_|hospital|medical|therapy|treatment|physician|nursing|pharmacy|medication|neurology|stroke|prescription|life_care|admission|death_certificate|discharge|radiology|imaging|clinical|cervical/ },
  { name: "Financial & Wage Loss Evidence", match: /wage|payroll|receipt|mileage|income|salary|employer|estimate/ },
  { name: "Insurance Evidence", match: /insurance|policy|claim|coverage/ },
  { name: "Communications", match: /correspondence|email|communication|call_log|message/ },
  { name: "Other Evidence", match: /.*/ },
];

export function bucketFor(name: string): string {
  const n = name.toLowerCase();
  return EVIDENCE_BUCKETS.find((b) => b.match.test(n))!.name;
}

export function formatFor(name: string): EvidenceFormat {
  const n = name.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|heic)$/.test(n)) return "image";
  if (/\.(mp4|mov|avi|webm|mkv)$/.test(n)) return "video";
  return "document";
}

export const FORMAT_LABEL: Record<EvidenceFormat, string> = {
  document: "PDF",
  image: "IMAGE",
  video: "VIDEO",
};

// ── Authored analysis ─────────────────────────────────────────────────────────
// Analysis exists for the evidence that carries the case. Everything else is
// reported honestly as Pending Analysis rather than given invented findings.

export const EVIDENCE_INTEL: Record<string, EvidenceIntel> = {
  "police_report_final.pdf": {
    title: "Police Report",
    summary:
      "The police report documents a collision between the plaintiff's vehicle and a commercial vehicle operated by Midwest Logistics Co. at a controlled intersection, and records the responding officer's fault determination.",
    keyFacts: [
      { text: "Commercial vehicle entered a controlled intersection", verified: true },
      { text: "Report records a failure to yield right-of-way", verified: true },
      { text: "Responding officer cited the commercial driver", verified: true },
      { text: "Emergency services were contacted at the scene", verified: true },
      { text: "Signal state at entry is consistent with a red-light entry", verified: false },
    ],
    parties: [
      { role: "Plaintiff", name: "Evelyn Miller" },
      { role: "Defendant", name: "Midwest Logistics Co." },
      { role: "Potential Responsible Party", name: "Commercial Vehicle Operator" },
    ],
    liability:
      "The report supports a finding that the commercial vehicle operator may have failed to yield or entered the intersection against the traffic signal. On the evidence currently available, this supports primary responsibility resting with the commercial vehicle operator.",
    allocation: { defendant: "80–100%", plaintiff: "0–20%", confidence: "High" },
    violations: [
      { name: "Failure to Yield", why: "The officer's narrative records the commercial vehicle entering against the plaintiff's right-of-way.", confidence: "High", docs: ["police_report_final.pdf", "witness_statement.pdf"] },
      { name: "Traffic Signal Violation", why: "The recorded sequence is consistent with entry after the signal changed.", confidence: "High", docs: ["traffic_camera.mp4", "Signal_Timing_Log.pdf"] },
      { name: "Commercial Vehicle Operating Violation", why: "Operation of a commercial vehicle in the manner recorded may engage carrier-specific duties.", confidence: "Moderate", docs: ["FMCSA_Profile.pdf", "Carrier_Records.pdf"] },
    ],
    causation:
      "The report supports the reported sequence of the collision and provides the contemporaneous context for the plaintiff's subsequent cervical injury. It establishes the incident; the medical record establishes the injury.",
    damages:
      "Indirect. The report does not quantify damages, but it anchors the date and mechanism of injury that the medical and wage-loss evidence is measured against.",
    impact: {
      liability: "Strongly supports the plaintiff's liability theory.",
      causation: "Supports the connection between the collision and the injury.",
      damages: "Provides the anchor date for the damages record.",
      violations: "May support traffic-control and commercial-driver violations.",
      settlement: "Strengthens the plaintiff's negotiating position.",
      overall: "High",
    },
    related: ["traffic_camera.mp4", "witness_statement.pdf", "vehicle_damage.jpg", "Scene_Reconstruction.pdf", "emergency_dispatch_record.pdf"],
    contradictions: [
      {
        source: "Police Report",
        text: "Vehicle entered the intersection at approximately 9:04 AM.",
        against: "Witness Statement",
        againstText: "Witness recalls the collision occurring closer to 9:05 AM.",
      },
    ],
    gaps: [
      "No independent witness statement confirming the traffic signal sequence.",
      "Vehicle inspection report has not been provided.",
    ],
    confidence: { level: "High", score: 92 },
    supports: ["medical", "noneconomic", "liability", "evidence"],
    keywords: ["red light", "failure to yield", "intersection", "signal", "fault", "citation", "right-of-way"],
  },

  "traffic_camera.mp4": {
    title: "Traffic Camera Footage",
    summary:
      "Intersection camera footage covering the approach and impact. The recording shows the commercial vehicle entering the intersection after the signal phase changed.",
    keyFacts: [
      { text: "Commercial vehicle is visible approaching the intersection", verified: true },
      { text: "Signal phase change is visible before entry", verified: true },
      { text: "Impact is captured within the frame", verified: true },
      { text: "Entry occurred after the signal changed against the commercial vehicle", verified: false },
    ],
    parties: [
      { role: "Defendant", name: "Midwest Logistics Co." },
      { role: "Potential Responsible Party", name: "Commercial Vehicle Operator" },
    ],
    liability:
      "The footage is the strongest available support for the signal-violation theory. It supports a finding that the commercial vehicle entered against the signal, though the camera angle does not resolve the plaintiff's own signal phase.",
    allocation: { defendant: "80–100%", plaintiff: "0–20%", confidence: "High" },
    violations: [
      { name: "Traffic Signal Violation", why: "The recording shows entry after the visible signal change.", confidence: "High", docs: ["traffic_camera.mp4", "Signal_Timing_Log.pdf"] },
      { name: "Failure to Yield", why: "Entry occurred while the plaintiff's vehicle was already within the intersection.", confidence: "High", docs: ["traffic_camera.mp4", "police_report_final.pdf"] },
    ],
    causation:
      "Establishes the mechanism and force direction of the collision, which the treating records tie to the cervical injury.",
    damages:
      "Supports the severity of the impact, which is relevant to the claimed injury severity and treatment course.",
    impact: {
      liability: "Direct visual support for the signal-violation theory.",
      causation: "Establishes the collision mechanism.",
      damages: "Supports impact severity.",
      violations: "Directly supports the traffic-signal violation.",
      settlement: "High-value exhibit for negotiation.",
      overall: "High",
    },
    related: ["police_report_final.pdf", "Traffic_Camera_Still.png", "Signal_Timing_Log.pdf", "witness_statement.pdf", "Dashcam_Footage.mp4"],
    contradictions: [],
    gaps: [
      "Footage is incomplete — the recording begins four seconds before impact.",
      "Camera angle does not capture the plaintiff's signal head.",
    ],
    confidence: { level: "High", score: 90 },
    supports: ["medical", "noneconomic", "liability", "negotiation"],
    keywords: ["red light", "signal", "intersection", "footage", "video", "camera"],
    moments: [
      { time: "00:04", text: "Commercial vehicle approaches the intersection" },
      { time: "00:07", text: "Traffic signal changes" },
      { time: "00:09", text: "Commercial vehicle enters the intersection" },
      { time: "00:11", text: "Impact occurs" },
      { time: "00:15", text: "Vehicles come to rest; bystanders approach" },
    ],
  },

  "dashcam_footage.mp4": {
    title: "Dashcam Footage",
    summary:
      "Forward-facing dashcam recording from a third-party vehicle travelling on the cross street, capturing the approach of the commercial vehicle.",
    keyFacts: [
      { text: "Commercial vehicle is visible in the seconds before impact", verified: true },
      { text: "Audio records braking prior to collision", verified: true },
      { text: "Approach speed appears inconsistent with the posted limit", verified: false },
    ],
    parties: [{ role: "Potential Responsible Party", name: "Commercial Vehicle Operator" }],
    liability:
      "Corroborates the approach recorded by the intersection camera. It adds support on speed and braking, but the recording vehicle's angle limits what can be concluded about the signal.",
    violations: [
      { name: "Traffic Signal Violation", why: "Consistent with the sequence recorded by the intersection camera.", confidence: "Moderate", docs: ["traffic_camera.mp4"] },
    ],
    causation: "Corroborative. Supports the collision sequence rather than establishing it independently.",
    damages: "Supports the force of impact relevant to injury severity.",
    impact: {
      liability: "Corroborates the primary footage.",
      causation: "Supports the recorded sequence.",
      damages: "Secondary support for impact severity.",
      violations: "Secondary support for the signal violation.",
      settlement: "Useful corroboration in negotiation.",
      overall: "Moderate",
    },
    related: ["traffic_camera.mp4", "police_report_final.pdf", "EDR_Download.pdf"],
    contradictions: [],
    gaps: ["The recording vehicle's angle does not capture the signal head."],
    confidence: { level: "Moderate", score: 74 },
    supports: ["noneconomic", "liability"],
    keywords: ["dashcam", "speed", "braking", "red light", "approach"],
    moments: [
      { time: "00:02", text: "Commercial vehicle enters frame on the cross street" },
      { time: "00:06", text: "Audible braking begins" },
      { time: "00:08", text: "Impact audible; vehicle passes out of frame" },
    ],
  },

  "traffic_camera_still.png": {
    title: "Traffic Camera Still",
    summary:
      "Single extracted frame from the intersection camera at the moment of entry, used as a still exhibit alongside the footage.",
    keyFacts: [
      { text: "Frame captures the commercial vehicle within the intersection", verified: true },
      { text: "Signal head is visible in the frame", verified: true },
      { text: "Frame is consistent with the 00:09 mark of the footage", verified: false },
    ],
    parties: [{ role: "Potential Responsible Party", name: "Commercial Vehicle Operator" }],
    liability: "Supports the signal-violation theory as a still exhibit. Its evidentiary weight derives from the underlying footage.",
    violations: [
      { name: "Traffic Signal Violation", why: "The frame shows the vehicle in the intersection with the signal visible.", confidence: "High", docs: ["traffic_camera.mp4"] },
    ],
    causation: "Supports the position of the vehicles at entry.",
    damages: "Not directly relevant to damages.",
    impact: {
      liability: "Supports the signal-violation theory.",
      causation: "Fixes vehicle position at entry.",
      damages: "Limited relevance.",
      violations: "Supports the traffic-signal violation.",
      settlement: "Presentable still exhibit.",
      overall: "Moderate",
    },
    related: ["traffic_camera.mp4", "intersection_scene.jpg", "police_report_final.pdf"],
    contradictions: [],
    gaps: [],
    confidence: { level: "High", score: 88 },
    supports: ["liability", "noneconomic"],
    keywords: ["red light", "signal", "still", "frame", "intersection"],
    observations: [
      "Commercial vehicle occupies the near lane of the intersection",
      "Signal head is visible at the top right of the frame",
      "Plaintiff's vehicle is partially visible entering from the left",
      "Dry road surface; daytime lighting",
    ],
    inferences: [
      "Vehicle position suggests entry had already begun when the frame was captured",
      "Lighting and surface conditions do not indicate a visibility or traction factor",
    ],
  },

  "intersection_scene.jpg": {
    title: "Intersection Scene",
    summary:
      "Post-collision scene photograph showing final vehicle positions, debris distribution and the intersection layout.",
    keyFacts: [
      { text: "Final rest positions of both vehicles are visible", verified: true },
      { text: "Debris field is concentrated in the intersection", verified: true },
      { text: "Lane markings and signal placement are visible", verified: true },
      { text: "Debris distribution is consistent with a front-end impact", verified: false },
    ],
    parties: [
      { role: "Plaintiff", name: "Evelyn Miller" },
      { role: "Defendant", name: "Midwest Logistics Co." },
    ],
    liability:
      "Scene markings and vehicle positions are consistent with the commercial vehicle entering the intersection before impact. The photograph records the aftermath and does not itself establish the signal state.",
    violations: [
      { name: "Failure to Yield", why: "Rest positions are consistent with the plaintiff holding the right-of-way.", confidence: "Moderate", docs: ["police_report_final.pdf", "Scene_Reconstruction.pdf"] },
    ],
    causation: "Supports the collision mechanism the medical evidence attributes the cervical injury to.",
    damages: "Supports impact severity relevant to the claimed injury.",
    impact: {
      liability: "Supports the recorded collision geometry.",
      causation: "Supports the impact mechanism.",
      damages: "Supports impact severity.",
      violations: "Secondary support for failure to yield.",
      settlement: "Useful demonstrative exhibit.",
      overall: "Moderate",
    },
    related: ["Scene_Reconstruction.pdf", "vehicle_damage.jpg", "police_report_final.pdf", "Skid_Analysis.pdf"],
    contradictions: [],
    gaps: ["Photograph was taken after vehicles were moved to the shoulder; original rest position is inferred."],
    confidence: { level: "Moderate", score: 78 },
    supports: ["medical", "noneconomic", "liability"],
    keywords: ["scene", "debris", "intersection", "photo", "layout", "skid"],
    observations: [
      "Two vehicles at rest within the intersection",
      "Debris concentrated near the centre of the intersection",
      "Lane markings and stop line clearly visible",
      "Traffic signal mast visible at the corner",
      "Dry surface, clear daytime conditions",
    ],
    inferences: [
      "Debris concentration suggests the point of impact was inside the intersection",
      "Vehicle angles are consistent with a front-end collision from the cross street",
      "The photograph cannot establish which signal was showing at entry",
    ],
  },

  "vehicle_damage.jpg": {
    title: "Vehicle Damage",
    summary:
      "Close photographs of the plaintiff's vehicle showing front-end and driver-side deformation consistent with the reported collision.",
    keyFacts: [
      { text: "Front-end deformation is visible on the plaintiff's vehicle", verified: true },
      { text: "Driver-side intrusion is visible", verified: true },
      { text: "Airbag deployment is visible", verified: true },
      { text: "Damage pattern is consistent with a significant-force impact", verified: false },
    ],
    parties: [{ role: "Plaintiff", name: "Evelyn Miller" }],
    liability: "Limited direct liability value. The damage pattern corroborates the direction of impact recorded elsewhere.",
    violations: [],
    causation:
      "Supports the mechanism of the cervical injury — the deformation and airbag deployment are consistent with the forces described in the treating records.",
    damages:
      "Supports the documented severity of the cervical injury and the plausibility of the treatment course that followed.",
    impact: {
      liability: "Corroborates impact direction.",
      causation: "Supports the injury mechanism.",
      damages: "Supports claimed injury severity.",
      violations: "Not directly relevant.",
      settlement: "Persuasive severity exhibit.",
      overall: "Moderate",
    },
    related: ["intersection_scene.jpg", "EDR_Download.pdf", "MRI_Report_2026.pdf", "hospital_medical_records.pdf"],
    contradictions: [],
    gaps: ["No independent repair estimate or vehicle inspection report has been provided."],
    confidence: { level: "High", score: 85 },
    supports: ["medical", "economic", "noneconomic"],
    keywords: ["damage", "airbag", "deformation", "impact", "severity", "photo"],
    observations: [
      "Front bumper and hood crumpled rearward",
      "Driver-side door shows inward intrusion",
      "Deployed front airbag visible through the windscreen",
      "Windscreen cracked on the driver side",
    ],
    inferences: [
      "Deformation depth is consistent with a moderate-to-high closing speed",
      "Airbag deployment indicates forces above the deployment threshold",
      "The photograph alone cannot establish the exact speed of either vehicle",
    ],
  },

  "cervical_xray.jpg": {
    title: "Cervical Spine X-Ray",
    summary:
      "Cervical spine radiograph taken during the emergency admission, used as the initial imaging prior to the MRI.",
    keyFacts: [
      { text: "Cervical spine imaged at the C4–C7 levels", verified: true },
      { text: "Loss of normal cervical lordosis is visible", verified: true },
      { text: "No acute fracture identified on plain film", verified: true },
      { text: "Findings are consistent with acute muscular guarding after trauma", verified: false },
    ],
    parties: [{ role: "Plaintiff", name: "Evelyn Miller" }],
    liability: "Not relevant to liability.",
    violations: [],
    causation:
      "Contemporaneous imaging taken hours after the collision. Supports the timeline linking the collision to the cervical presentation, and precedes the MRI that identified the disc herniations.",
    damages:
      "Supports the documented severity of the cervical injury and the clinical basis for the treatment that followed.",
    impact: {
      liability: "Not relevant.",
      causation: "Strong — contemporaneous with the collision.",
      damages: "Supports injury severity and treatment necessity.",
      violations: "Not relevant.",
      settlement: "Supports the medical damages position.",
      overall: "Moderate",
    },
    related: ["MRI_Report_2026.pdf", "hospital_medical_records.pdf", "ER_Bills.pdf"],
    contradictions: [],
    gaps: ["Plain film cannot exclude disc injury; the MRI is the controlling imaging."],
    confidence: { level: "High", score: 86 },
    supports: ["medical", "economic"],
    keywords: ["x-ray", "cervical", "spine", "imaging", "lordosis", "injury"],
    observations: [
      "Lateral cervical spine view covering C4–C7",
      "Straightening of the normal cervical curve",
      "Vertebral body heights preserved",
      "No visible fracture line",
    ],
    inferences: [
      "Loss of lordosis commonly accompanies acute muscular spasm following trauma",
      "Absence of fracture on plain film does not exclude soft-tissue or disc injury",
    ],
  },

  "witness_statement.pdf": {
    title: "Witness Statement",
    summary:
      "Signed statement from an independent witness present at the intersection, describing the approach of the commercial vehicle and the collision.",
    keyFacts: [
      { text: "Witness was present at the intersection at the time of the collision", verified: true },
      { text: "Witness describes the commercial vehicle entering against the signal", verified: true },
      { text: "Witness contacted emergency services", verified: true },
      { text: "Recalled timing differs slightly from the police report", verified: false },
    ],
    parties: [
      { role: "Independent Witness", name: "Named in statement" },
      { role: "Potential Responsible Party", name: "Commercial Vehicle Operator" },
    ],
    liability:
      "Independent corroboration of the signal-violation account. As lay recollection it carries less weight than the camera footage but materially reduces the room for a contributory-fault argument.",
    violations: [
      { name: "Traffic Signal Violation", why: "The witness describes entry against the signal.", confidence: "Moderate", docs: ["witness_statement.pdf", "traffic_camera.mp4"] },
      { name: "Failure to Yield", why: "The account places the plaintiff lawfully within the intersection.", confidence: "High", docs: ["witness_statement.pdf", "police_report_final.pdf"] },
    ],
    causation: "Supports the collision sequence rather than the injury itself.",
    damages: "Indirect. Supports the incident the damages record is built on.",
    impact: {
      liability: "Independent corroboration of the liability theory.",
      causation: "Supports the collision sequence.",
      damages: "Indirect support.",
      violations: "Supports signal and yield violations.",
      settlement: "Reduces contributory-fault exposure.",
      overall: "High",
    },
    related: ["police_report_final.pdf", "traffic_camera.mp4", "Witness_Statement_A.pdf", "emergency_dispatch_record.pdf"],
    contradictions: [
      {
        source: "Witness Statement",
        text: "Witness recalls the collision occurring closer to 9:05 AM.",
        against: "Police Report",
        againstText: "Vehicle entered the intersection at approximately 9:04 AM.",
      },
    ],
    gaps: ["Only one independent witness has provided a signed statement."],
    confidence: { level: "Moderate", score: 79 },
    supports: ["medical", "noneconomic", "liability", "evidence"],
    keywords: ["red light", "witness", "signal", "account", "statement", "corroboration"],
  },

  "mri_report_2026.pdf": {
    title: "MRI Report",
    summary:
      "Diagnostic MRI of the cervical spine confirming C5–C6 and C6–C7 disc herniations with nerve-root compression.",
    keyFacts: [
      { text: "C5–C6 and C6–C7 disc herniations identified", verified: true },
      { text: "Nerve-root compression documented", verified: true },
      { text: "Imaging performed two days after the collision", verified: true },
      { text: "Findings are consistent with traumatic rather than degenerative origin", verified: false },
    ],
    parties: [{ role: "Plaintiff", name: "Evelyn Miller" }],
    liability: "Not relevant to liability.",
    violations: [],
    causation:
      "This is the objective anchor of the causation argument. Imaging performed within 48 hours of the collision documents a diagnosable injury consistent with the reported mechanism.",
    damages:
      "Supports the documented severity of the cervical injury and provides the medical evidence underpinning ongoing treatment, functional limitations and future-care projections.",
    impact: {
      liability: "Not relevant.",
      causation: "Cornerstone of the causation argument.",
      damages: "Primary support for injury severity and future care.",
      violations: "Not relevant.",
      settlement: "Central to the damages position.",
      overall: "High",
    },
    related: ["cervical_xray.jpg", "hospital_medical_records.pdf", "physical_therapy_notes.pdf", "Neurology_Consultation_Report.pdf"],
    contradictions: [],
    gaps: ["No pre-incident cervical imaging is on file to exclude prior degeneration."],
    confidence: { level: "High", score: 94 },
    supports: ["medical", "economic", "demand", "negotiation"],
    keywords: ["herniation", "disc", "cervical", "nerve root", "imaging", "C5-C6", "diagnosis"],
  },

  "hospital_medical_records.pdf": {
    title: "Hospital Medical Records",
    summary:
      "Complete treatment record from the emergency admission through discharge, including intake observations, assessments and the treating plan.",
    keyFacts: [
      { text: "Plaintiff arrived by ambulance within the hour after the collision", verified: true },
      { text: "Acute neck pain and neurological symptoms documented at intake", verified: true },
      { text: "Cervical immobilisation performed on arrival", verified: true },
      { text: "Discharge plan recorded ongoing conservative management", verified: true },
    ],
    parties: [
      { role: "Plaintiff", name: "Evelyn Miller" },
      { role: "Treating Facility", name: "Cook County Medical Center" },
    ],
    liability: "Not relevant to liability.",
    violations: [],
    causation:
      "Establishes documented treatment beginning within hours of the collision, closing the gap between the incident and the diagnosed injury.",
    damages:
      "Supports the diagnosis, treatment course, severity and functional limitations underpinning both the economic and non-economic damages.",
    impact: {
      liability: "Not relevant.",
      causation: "Establishes immediate post-incident treatment.",
      damages: "Primary support for the treatment record.",
      violations: "Not relevant.",
      settlement: "Core damages documentation.",
      overall: "High",
    },
    related: ["ER_Bills.pdf", "MRI_Report_2026.pdf", "cervical_xray.jpg", "physical_therapy_notes.pdf"],
    contradictions: [],
    gaps: [],
    confidence: { level: "High", score: 93 },
    supports: ["medical", "economic", "demand", "negotiation"],
    keywords: ["emergency", "admission", "treatment", "intake", "immobilisation", "discharge"],
  },

  "er_bills.pdf": {
    title: "Emergency Room Billing",
    summary:
      "Itemised emergency department charges for the admission following the collision.",
    keyFacts: [
      { text: "Charges are itemised by service line", verified: true },
      { text: "Billing period matches the admission date", verified: true },
      { text: "Charges reconcile to the provider ledger without duplicates", verified: true },
    ],
    parties: [
      { role: "Plaintiff", name: "Evelyn Miller" },
      { role: "Treating Facility", name: "Cook County Medical Center" },
    ],
    liability: "Not relevant to liability.",
    violations: [],
    causation: "Corroborates the timing and fact of emergency treatment following the collision.",
    damages:
      "Directly quantifies a component of the medical special damages, and the service lines corroborate the treatment recorded in the hospital records.",
    impact: {
      liability: "Not relevant.",
      causation: "Corroborates treatment timing.",
      damages: "Directly quantifies medical specials.",
      violations: "Not relevant.",
      settlement: "Hard number for the demand.",
      overall: "Moderate",
    },
    related: ["hospital_medical_records.pdf", "Hospital_Bill.pdf", "MRI_Report_2026.pdf"],
    contradictions: [],
    gaps: ["Insurer adjustment and write-off amounts are not reflected in the itemised charges."],
    confidence: { level: "High", score: 89 },
    supports: ["medical", "economic", "negotiation"],
    keywords: ["billing", "charges", "specials", "cost", "emergency", "itemised"],
  },

  "physical_therapy_notes.pdf": {
    title: "Physical Therapy Notes",
    summary:
      "Session-by-session therapy record documenting the treatment programme, progress and persistent range-of-motion deficits.",
    keyFacts: [
      { text: "Structured multi-modal therapy programme documented", verified: true },
      { text: "Persistent range-of-motion deficits recorded across sessions", verified: true },
      { text: "Treatment continued beyond the initial recovery window", verified: true },
      { text: "Pattern is consistent with a guarded long-term prognosis", verified: false },
    ],
    parties: [{ role: "Plaintiff", name: "Evelyn Miller" }],
    liability: "Not relevant to liability.",
    violations: [],
    causation: "Documents a continuous treatment chain from the collision forward, with no material gap for the defence to exploit.",
    damages:
      "Supports functional limitation, treatment duration and the future-care projection. The absence of full recovery supports the permanence element of the claim.",
    impact: {
      liability: "Not relevant.",
      causation: "Closes treatment-gap arguments.",
      damages: "Supports functional limitation and future care.",
      violations: "Not relevant.",
      settlement: "Supports the non-economic multiplier.",
      overall: "High",
    },
    related: ["MRI_Report_2026.pdf", "hospital_medical_records.pdf", "PT_Treatment_Notes.pdf", "Life_Care_Plan.pdf"],
    contradictions: [],
    gaps: ["No functional capacity evaluation has been performed."],
    confidence: { level: "High", score: 88 },
    supports: ["medical", "economic", "demand"],
    keywords: ["therapy", "rehabilitation", "range of motion", "progress", "functional", "prognosis"],
  },

  "insurance_policy_v2.pdf": {
    title: "Commercial Liability Policy",
    summary:
      "The defendant's commercial liability policy, verified active on the date of loss, establishing the available coverage.",
    keyFacts: [
      { text: "Policy was active on the date of loss", verified: true },
      { text: "Commercial liability coverage confirmed", verified: true },
      { text: "Policy limits are stated in the declarations", verified: true },
    ],
    parties: [
      { role: "Defendant", name: "Midwest Logistics Co." },
      { role: "Carrier", name: "ABC Professional Liability Insurance" },
    ],
    liability: "Does not speak to fault. Establishes that an adequate source of recovery exists if liability is established.",
    violations: [
      { name: "Commercial Vehicle Operating Violation", why: "The policy identifies the commercial operating context in which carrier duties arise.", confidence: "Low", docs: ["FMCSA_Profile.pdf", "Carrier_Records.pdf"] },
    ],
    causation: "Not relevant to causation.",
    damages: "Sets the practical ceiling on recovery and frames the demand strategy.",
    impact: {
      liability: "Neutral on fault.",
      causation: "Not relevant.",
      damages: "Frames the recoverable ceiling.",
      violations: "Establishes the commercial operating context.",
      settlement: "Directly shapes the negotiation range.",
      overall: "Moderate",
    },
    related: ["Insurance_Policy.pdf", "Carrier_Records.pdf", "demand_letter_draft.pdf"],
    contradictions: [],
    gaps: ["No confirmation of excess or umbrella coverage above the stated limits."],
    confidence: { level: "High", score: 91 },
    supports: ["evidence", "demand", "negotiation"],
    keywords: ["coverage", "policy limits", "carrier", "commercial", "declarations"],
  },

  "wage_loss_statement.pdf": {
    title: "Wage Loss Statement",
    summary:
      "Employer verification of income lost during the treatment period, with pre-incident earnings history.",
    keyFacts: [
      { text: "Employer verified the absence period", verified: true },
      { text: "Pre-incident earnings history is stated", verified: true },
      { text: "Absence period aligns with the documented treatment window", verified: true },
    ],
    parties: [
      { role: "Plaintiff", name: "Evelyn Miller" },
      { role: "Employer", name: "Named in statement" },
    ],
    liability: "Not relevant to liability.",
    violations: [],
    causation: "The alignment between the absence period and the treatment record supports the economic consequence of the injury.",
    damages: "Directly quantifies the lost-wages component of the economic damages.",
    impact: {
      liability: "Not relevant.",
      causation: "Links the injury to economic loss.",
      damages: "Directly quantifies lost wages.",
      violations: "Not relevant.",
      settlement: "Hard number for the demand.",
      overall: "Moderate",
    },
    related: ["Employer_Payroll_Records.pdf", "hospital_medical_records.pdf", "physical_therapy_notes.pdf"],
    contradictions: [],
    gaps: ["No vocational assessment addressing reduced future earning capacity."],
    confidence: { level: "High", score: 87 },
    supports: ["economic", "demand", "negotiation"],
    keywords: ["wages", "income", "lost earnings", "employer", "payroll", "absence"],
  },

  "scene_reconstruction.pdf": {
    title: "Accident Reconstruction",
    summary:
      "Engineering reconstruction of the collision built from scene measurements, vehicle damage and the physical evidence.",
    keyFacts: [
      { text: "Point of impact located within the intersection", verified: true },
      { text: "Approach paths reconstructed from physical evidence", verified: true },
      { text: "Closing speeds estimated from deformation and rest positions", verified: false },
      { text: "Sequence is consistent with the camera footage", verified: false },
    ],
    parties: [
      { role: "Plaintiff", name: "Evelyn Miller" },
      { role: "Defendant", name: "Midwest Logistics Co." },
    ],
    liability:
      "Independent technical support for the plaintiff's account of the collision geometry. Reconstruction conclusions are expert opinion rather than direct observation.",
    allocation: { defendant: "75–95%", plaintiff: "5–25%", confidence: "Moderate" },
    violations: [
      { name: "Failure to Yield", why: "The reconstructed approach paths place the plaintiff lawfully within the intersection.", confidence: "Moderate", docs: ["Scene_Reconstruction.pdf", "police_report_final.pdf"] },
    ],
    causation: "Establishes the direction and magnitude of force relevant to the cervical injury mechanism.",
    damages: "Supports impact severity underpinning the claimed injury.",
    impact: {
      liability: "Independent technical support.",
      causation: "Establishes the force mechanism.",
      damages: "Supports impact severity.",
      violations: "Supports failure to yield.",
      settlement: "Credible expert exhibit.",
      overall: "High",
    },
    related: ["intersection_scene.jpg", "Skid_Analysis.pdf", "EDR_Download.pdf", "police_report_final.pdf", "vehicle_damage.jpg"],
    contradictions: [],
    gaps: ["Reconstruction relies on estimated closing speeds; the EDR download has not been fully incorporated."],
    confidence: { level: "Moderate", score: 81 },
    supports: ["noneconomic", "liability", "demand"],
    keywords: ["reconstruction", "impact", "speed", "geometry", "engineering", "skid"],
  },

  "edr_download.pdf": {
    title: "Event Data Recorder Download",
    summary:
      "Extracted event data recorder readout from the commercial vehicle covering the seconds before impact.",
    keyFacts: [
      { text: "Pre-impact speed data recorded", verified: true },
      { text: "Brake application timing recorded", verified: true },
      { text: "Throttle position captured in the pre-impact window", verified: true },
      { text: "Data is consistent with late braking on approach", verified: false },
    ],
    parties: [{ role: "Potential Responsible Party", name: "Commercial Vehicle Operator" }],
    liability:
      "Objective vehicle data on the defendant's approach. Where it corroborates the footage it is difficult evidence for the defence to contest.",
    violations: [
      { name: "Commercial Vehicle Operating Violation", why: "The recorded approach may engage commercial operating standards.", confidence: "Moderate", docs: ["FMCSA_Profile.pdf", "Carrier_Records.pdf"] },
    ],
    causation: "Supports the force of impact relevant to the injury mechanism.",
    damages: "Supports impact severity relevant to injury severity.",
    impact: {
      liability: "Objective support on approach and braking.",
      causation: "Supports the impact mechanism.",
      damages: "Supports impact severity.",
      violations: "May support commercial operating violations.",
      settlement: "Strong technical leverage.",
      overall: "High",
    },
    related: ["Dashcam_Footage.mp4", "Scene_Reconstruction.pdf", "vehicle_damage.jpg"],
    contradictions: [],
    gaps: ["Full readout has not been independently verified by the plaintiff's expert."],
    confidence: { level: "Moderate", score: 77 },
    supports: ["noneconomic", "liability"],
    keywords: ["EDR", "black box", "speed", "braking", "throttle", "vehicle data"],
  },
};
