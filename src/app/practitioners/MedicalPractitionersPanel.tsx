import { useState } from "react";
import { createPortal } from "react-dom";
import {
  Stethoscope, Building2, ChevronLeft, ChevronRight, ChevronDown, X, Search, UserRound, MapPin,
  Clock, Layers, Landmark, Network, Map as MapIcon, ArrowRight,
} from "lucide-react";
import {
  PRACTITIONERS, HOSPITALS, TREATING_PRACTITIONERS, HOSPITAL_SIZES, HOSPITAL_OWNERSHIPS,
  HOSPITAL_STRUCTURES, LOCATION_TYPES, hospitalById, practitionerById, formatExperience, hospitalSummary,
  type Practitioner, type Hospital,
} from "./practitionerData";

// ── Medical Practitioners ─────────────────────────────────────────────────────
// Who treated the plaintiff, where they work, and — through Find Similar — the
// comparable practitioners and hospitals on record. Every value comes from the
// shared practitioner record; anything it does not hold reads "Not available".

const NA = "Not available";

// A labelled value; the record's value, or "Not available".
function Fact({ label, value }: { label: string; value?: string }) {
  return (
    <div className="py-2.5 border-b border-line last:border-b-0">
      <div className="eyebrow mb-0.5">{label}</div>
      {value
        ? <p className="text-sm font-medium text-ink leading-snug">{value}</p>
        : <p className="text-sm text-[#8A98A3] leading-snug">{NA}</p>}
    </div>
  );
}

// The workplace facts, in the order the attorney reads them. Hospital type is
// the ownership class (Non-Profit / For-Profit / Government); organization is
// Independent / System Affiliated / Network Hospital, and a system-affiliated
// hospital also names its health system.
function WorkplaceFacts({ hospital }: { hospital?: Hospital }) {
  return (
    <div>
      <Fact label="Hospital / Workplace" value={hospital?.name} />
      <Fact label="Hospital Location" value={hospital?.location} />
      <Fact label="Hospital Size" value={hospital?.size} />
      <Fact label="Hospital Type" value={hospital?.ownership} />
      <Fact label="Organization" value={hospital?.structure} />
      {(hospital?.structure === "System Affiliated" || hospital?.healthSystem) && (
        <Fact label="System Affiliation" value={hospital?.healthSystem} />
      )}
      <Fact label="Network" value={hospital?.network} />
      <Fact label="Location Type" value={hospital?.locationType} />
      {hospital?.services && hospital.services.length > 0 && (
        <Fact label="Specialties & Services" value={hospital.services.join(" · ")} />
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
        <h3 className="card-title">{title}</h3>
      </div>
      {children}
    </section>
  );
}

// ── Search ────────────────────────────────────────────────────────────────────

const ANY = "";
type PractitionerFilters = {
  role: string; specialization: string; minExperience: string; size: string; structure: string;
  ownership: string; healthSystem: string; network: string; locationType: string; location: string;
};
type HospitalFilters = {
  size: string; structure: string; ownership: string; healthSystem: string;
  locationType: string; location: string; service: string;
};
const NO_PRACTITIONER_FILTERS: PractitionerFilters = {
  role: ANY, specialization: ANY, minExperience: ANY, size: ANY, structure: ANY,
  ownership: ANY, healthSystem: ANY, network: ANY, locationType: ANY, location: ANY,
};
const NO_HOSPITAL_FILTERS: HospitalFilters = {
  size: ANY, structure: ANY, ownership: ANY, healthSystem: ANY, locationType: ANY, location: ANY, service: ANY,
};

// Option lists are the fixed classifications, or the values the record holds.
const uniq = (xs: (string | undefined)[]) => Array.from(new Set(xs.filter(Boolean) as string[])).sort();
const ROLE_OPTIONS = uniq(PRACTITIONERS.map((p) => p.role));
const SPECIALIZATION_OPTIONS = uniq(PRACTITIONERS.flatMap((p) => p.specializations));
const SYSTEM_OPTIONS = uniq(HOSPITALS.map((h) => h.healthSystem));
const NETWORK_OPTIONS = uniq(HOSPITALS.map((h) => h.network));
const LOCATION_OPTIONS = uniq(HOSPITALS.map((h) => h.location));
const SERVICE_OPTIONS = uniq(HOSPITALS.flatMap((h) => h.services ?? []));
const EXPERIENCE_OPTIONS = ["5", "10", "15", "20"];

// A value filters only when chosen; a record without that value cannot be
// shown to match it, so it is left out rather than assumed.
const passes = (chosen: string, actual?: string) => chosen === ANY || actual === chosen;

function matchPractitioner(p: Practitioner, f: PractitionerFilters) {
  const h = hospitalById(p.hospitalId);
  return (
    passes(f.role, p.role) &&
    (f.specialization === ANY || p.specializations.includes(f.specialization)) &&
    (f.minExperience === ANY || (p.experienceYears != null && p.experienceYears >= Number(f.minExperience))) &&
    passes(f.size, h?.size) && passes(f.structure, h?.structure) && passes(f.ownership, h?.ownership) &&
    passes(f.healthSystem, h?.healthSystem) && passes(f.network, h?.network) &&
    passes(f.locationType, h?.locationType) && passes(f.location, h?.location)
  );
}

function matchHospital(h: Hospital, f: HospitalFilters) {
  return (
    passes(f.size, h.size) && passes(f.structure, h.structure) && passes(f.ownership, h.ownership) &&
    passes(f.healthSystem, h.healthSystem) && passes(f.locationType, h.locationType) && passes(f.location, h.location) &&
    (f.service === ANY || (h.services ?? []).includes(f.service))
  );
}

function FilterSelect({
  label, value, onChange, options, anyLabel = "All",
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; anyLabel?: string }) {
  return (
    <div>
      <label className="eyebrow block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink focus:outline-none focus:border-brand transition-colors"
      >
        <option value={ANY}>{anyLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {options.length === 0 && <p className="text-[11px] text-[#8A98A3] mt-1">None recorded yet</p>}
    </div>
  );
}

const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

function SimilarSearch({
  fromId, onViewPractitioner, onViewHospital,
}: { fromId: string; onViewPractitioner: (id: string) => void; onViewHospital: (id: string) => void }) {
  const from = practitionerById(fromId);
  const [searchType, setSearchType] = useState<"practitioners" | "hospitals">("practitioners");
  // Filters are edited as a draft and take effect on Search.
  const [pDraft, setPDraft] = useState<PractitionerFilters>(NO_PRACTITIONER_FILTERS);
  const [pApplied, setPApplied] = useState<PractitionerFilters>(NO_PRACTITIONER_FILTERS);
  const [hDraft, setHDraft] = useState<HospitalFilters>(NO_HOSPITAL_FILTERS);
  const [hApplied, setHApplied] = useState<HospitalFilters>(NO_HOSPITAL_FILTERS);
  const setP = (k: keyof PractitionerFilters) => (v: string) => setPDraft({ ...pDraft, [k]: v });
  const setH = (k: keyof HospitalFilters) => (v: string) => setHDraft({ ...hDraft, [k]: v });

  const score = (p: Practitioner) => p.similarity?.[fromId];
  const practitionerResults = PRACTITIONERS
    .filter((p) => p.id !== fromId && matchPractitioner(p, pApplied))
    .sort((a, b) => (score(b) ?? -1) - (score(a) ?? -1) || a.name.localeCompare(b.name));
  const hospitalResults = HOSPITALS
    .filter((h) => h.id !== from?.hospitalId && matchHospital(h, hApplied))
    .sort((a, b) => a.name.localeCompare(b.name));

  const search = () => (searchType === "practitioners" ? setPApplied(pDraft) : setHApplied(hDraft));
  const clear = () => {
    if (searchType === "practitioners") { setPDraft(NO_PRACTITIONER_FILTERS); setPApplied(NO_PRACTITIONER_FILTERS); }
    else { setHDraft(NO_HOSPITAL_FILTERS); setHApplied(NO_HOSPITAL_FILTERS); }
  };

  return (
    <div className="space-y-5">
      {/* Search type */}
      <div className="flex items-center gap-2">
        {([
          { key: "practitioners", label: "Similar Practitioners" },
          { key: "hospitals", label: "Similar Hospitals" },
        ] as const).map((t) => {
          const active = searchType === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setSearchType(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                active ? "bg-tint border-brand text-deep" : "bg-white border-line text-[#5B6B78] hover:border-soft hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-line bg-offwhite p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {searchType === "practitioners" ? (
            <>
              <FilterSelect label="Practitioner Type" value={pDraft.role} onChange={setP("role")} options={opts(ROLE_OPTIONS)} />
              <FilterSelect label="Specialization" value={pDraft.specialization} onChange={setP("specialization")} options={opts(SPECIALIZATION_OPTIONS)} />
              <FilterSelect label="Experience" value={pDraft.minExperience} onChange={setP("minExperience")} options={EXPERIENCE_OPTIONS.map((y) => ({ value: y, label: `${y}+ years` }))} anyLabel="Any" />
              <FilterSelect label="Hospital Type" value={pDraft.ownership} onChange={setP("ownership")} options={opts(HOSPITAL_OWNERSHIPS)} />
              <FilterSelect label="Hospital Size" value={pDraft.size} onChange={setP("size")} options={opts(HOSPITAL_SIZES)} />
              <FilterSelect label="Organization" value={pDraft.structure} onChange={setP("structure")} options={opts(HOSPITAL_STRUCTURES)} />
              <FilterSelect label="System Affiliation" value={pDraft.healthSystem} onChange={setP("healthSystem")} options={opts(SYSTEM_OPTIONS)} />
              <FilterSelect label="Network" value={pDraft.network} onChange={setP("network")} options={opts(NETWORK_OPTIONS)} />
              <FilterSelect label="Location" value={pDraft.location} onChange={setP("location")} options={opts(LOCATION_OPTIONS)} />
              <FilterSelect label="Location Type" value={pDraft.locationType} onChange={setP("locationType")} options={opts(LOCATION_TYPES)} />
            </>
          ) : (
            <>
              <FilterSelect label="Hospital Type / Ownership" value={hDraft.ownership} onChange={setH("ownership")} options={opts(HOSPITAL_OWNERSHIPS)} />
              <FilterSelect label="Hospital Size" value={hDraft.size} onChange={setH("size")} options={opts(HOSPITAL_SIZES)} />
              <FilterSelect label="Organization" value={hDraft.structure} onChange={setH("structure")} options={opts(HOSPITAL_STRUCTURES)} />
              <FilterSelect label="Health System" value={hDraft.healthSystem} onChange={setH("healthSystem")} options={opts(SYSTEM_OPTIONS)} />
              <FilterSelect label="Location" value={hDraft.location} onChange={setH("location")} options={opts(LOCATION_OPTIONS)} />
              <FilterSelect label="Location Type" value={hDraft.locationType} onChange={setH("locationType")} options={opts(LOCATION_TYPES)} />
              <FilterSelect label="Specialties & Services" value={hDraft.service} onChange={setH("service")} options={opts(SERVICE_OPTIONS)} />
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 mt-4">
          <button onClick={clear} className="btn btn-secondary px-3 py-2 text-sm">Clear Filters</button>
          <button onClick={search} className="btn btn-primary gap-1.5 px-3 py-2 text-sm">
            <Search className="w-4 h-4" strokeWidth={1.75} /> Search
          </button>
        </div>
        <p className="text-[11px] text-[#8A98A3] mt-2">
          A record with no value for a chosen filter is left out, since it cannot be shown to match.
        </p>
      </div>

      {/* Results */}
      {searchType === "practitioners" ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="card-title">Similar Practitioners</h3>
            <span className="secondary-text">{practitionerResults.length} {practitionerResults.length === 1 ? "result" : "results"}</span>
          </div>
          {practitionerResults.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-white p-5 secondary-text">No practitioners match the selected filters.</p>
          ) : practitionerResults.map((p) => {
            const h = hospitalById(p.hospitalId);
            const s = score(p);
            return (
              <div key={p.id} className="rounded-xl border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="card-title leading-snug">{p.name}</div>
                    <div className="secondary-text">{p.role}</div>
                  </div>
                  {s != null && <span className="text-xs font-bold text-deep shrink-0">{s}% Match</span>}
                </div>
                <div className="mt-2.5 space-y-1 text-sm">
                  <div className="text-ink">{p.specializations.join(" · ") || NA}</div>
                  <div className="text-[#5B6B78]">{formatExperience(p.experienceYears) ?? `Experience ${NA.toLowerCase()}`}</div>
                  <div className="text-ink font-medium">{h?.name ?? NA}</div>
                  <div className="text-[#5B6B78]">{hospitalSummary(h) ?? `Hospital size & type ${NA.toLowerCase()}`}</div>
                  <div className="text-[#5B6B78]">{h?.location ?? `Location ${NA.toLowerCase()}`}</div>
                </div>
                <button onClick={() => onViewPractitioner(p.id)} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-deep hover:text-ink transition-colors">
                  View Profile <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="card-title">Similar Hospitals</h3>
            <span className="secondary-text">{hospitalResults.length} {hospitalResults.length === 1 ? "result" : "results"}</span>
          </div>
          {hospitalResults.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-white p-5 secondary-text">No hospitals match the selected filters.</p>
          ) : hospitalResults.map((h) => (
            <div key={h.id} className="rounded-xl border border-line bg-white p-4">
              <div className="card-title leading-snug">{h.name}</div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {([
                  ["Size", h.size], ["Type", h.structure], ["Ownership", h.ownership], ["System", h.healthSystem],
                  ["Network", h.network], ["Location", h.location],
                ] as const).map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <span className="text-[#5B6B78]">{k}: </span>
                    {v ? <span className="text-ink">{v}</span> : <span className="text-[#8A98A3]">{NA}</span>}
                  </div>
                ))}
              </div>
              {h.services && h.services.length > 0 && <p className="secondary-text mt-1.5">{h.services.join(" · ")}</p>}
              <button onClick={() => onViewHospital(h.id)} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-deep hover:text-ink transition-colors">
                View Hospital <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

type View =
  | { kind: "practitioner"; id: string }
  | { kind: "hospital"; id: string }
  | { kind: "search"; fromId: string };

function PractitionerProfile({ p, onHospital, onFindSimilar }: { p: Practitioner; onHospital: (id: string) => void; onFindSimilar: () => void }) {
  const h = hospitalById(p.hospitalId);
  const comparedTo = Object.entries(p.similarity ?? {})
    .map(([id, s]) => ({ other: practitionerById(id), s }))
    .filter((x) => x.other);
  return (
    <div className="space-y-4">
      <Section icon={UserRound} title="Practitioner Information">
        <Fact label="Medical Practitioner Name" value={p.name} />
        <Fact label="Practitioner Type / Role" value={p.role} />
        <Fact label="Specialization" value={p.specializations.join(" · ") || undefined} />
        <Fact label="Experience" value={formatExperience(p.experienceYears)} />
        <div className="py-2.5 border-b border-line last:border-b-0">
          <div className="eyebrow mb-0.5">Medical Practitioner Biography</div>
          {p.biography
            ? <p className="body-text leading-relaxed">{p.biography}</p>
            : <p className="text-sm text-[#8A98A3]">Biography not available</p>}
        </div>
        {p.involvement === "treating"
          ? <Fact label="Role in This Case" value={p.caseRole} />
          : (
            <div className="py-2.5">
              <div className="eyebrow mb-0.5">Role in This Case</div>
              <p className="text-sm text-ink leading-snug">Comparable practitioner — did not treat the plaintiff.</p>
              {comparedTo.map(({ other, s }) => (
                <p key={other!.id} className="secondary-text mt-0.5">{s}% match to {other!.name}</p>
              ))}
            </div>
          )}
      </Section>

      <Section icon={Building2} title="Workplace Information">
        <WorkplaceFacts hospital={h} />
        {h && (
          <button onClick={() => onHospital(h.id)} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-deep hover:text-ink transition-colors">
            View Hospital <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
          </button>
        )}
      </Section>

      <button onClick={onFindSimilar} className="btn btn-primary w-full gap-2">
        <Search className="w-4 h-4" strokeWidth={1.75} /> Find Similar Practitioners & Hospitals
      </button>
    </div>
  );
}

function HospitalProfile({ h, onPractitioner }: { h: Hospital; onPractitioner: (id: string) => void }) {
  const staff = PRACTITIONERS.filter((p) => p.hospitalId === h.id);
  return (
    <div className="space-y-4">
      <Section icon={Building2} title="Workplace Information">
        <WorkplaceFacts hospital={h} />
      </Section>
      <Section icon={Stethoscope} title="Practitioners on Record">
        {staff.length === 0 ? (
          <p className="text-sm text-[#8A98A3] py-2">No practitioner is recorded at this hospital.</p>
        ) : staff.map((p) => (
          <button key={p.id} onClick={() => onPractitioner(p.id)} className="w-full flex items-center justify-between gap-3 py-2.5 border-b border-line last:border-b-0 text-left group">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink group-hover:text-deep transition-colors">{p.name}</span>
              <span className="block secondary-text">{p.role}</span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#8A98A3] shrink-0" strokeWidth={1.75} />
          </button>
        ))}
      </Section>
    </div>
  );
}

function PractitionerDrawer({ stack, setStack, onClose }: { stack: View[]; setStack: (s: View[]) => void; onClose: () => void }) {
  const view = stack[stack.length - 1];
  const push = (v: View) => setStack([...stack, v]);
  const back = () => setStack(stack.slice(0, -1));
  const p = view.kind === "practitioner" ? practitionerById(view.id) : undefined;
  const h = view.kind === "hospital" ? hospitalById(view.id) : undefined;
  const from = view.kind === "search" ? practitionerById(view.fromId) : undefined;
  const eyebrow = view.kind === "practitioner" ? "Practitioner Profile" : view.kind === "hospital" ? "Hospital" : "Find Similar";
  const title = p?.name ?? h?.name ?? (from ? `Similar to ${from.name}` : "");

  return (
    <>
      <div className="fixed inset-0 bg-ink/40 z-[70]" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[560px] max-w-[94vw] bg-offwhite shadow-xl z-[70] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line bg-white shrink-0">
          <div className="flex items-start gap-2 min-w-0">
            {stack.length > 1 && (
              <button onClick={back} title="Back" className="p-1.5 -ml-1.5 hover:bg-tint rounded-lg transition-colors shrink-0">
                <ChevronLeft className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} />
              </button>
            )}
            <div className="min-w-0">
              <div className="eyebrow mb-1">{eyebrow}</div>
              <h2 className="card-title truncate">{title}</h2>
            </div>
          </div>
          <button onClick={onClose} title="Close" className="p-1.5 hover:bg-tint rounded-lg transition-colors shrink-0">
            <X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {p && (
            <PractitionerProfile
              p={p}
              onHospital={(id) => push({ kind: "hospital", id })}
              onFindSimilar={() => push({ kind: "search", fromId: p.id })}
            />
          )}
          {h && <HospitalProfile h={h} onPractitioner={(id) => push({ kind: "practitioner", id })} />}
          {view.kind === "search" && (
            <SimilarSearch
              key={view.fromId}
              fromId={view.fromId}
              onViewPractitioner={(id) => push({ kind: "practitioner", id })}
              onViewHospital={(id) => push({ kind: "hospital", id })}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ── The Chronology sidebar: Medical Practitioner ─────────────────────────────
// The Case Snapshot card adapted for the practitioners who treated the
// plaintiff: the same white card, the same light-gray information tiles in a
// two-column grid, the same biography toggle on the lead tile and the same
// full-width primary button. One practitioner is shown at a time; with more
// than one, the name becomes a selector.

// A Case Snapshot information tile. A value the record does not hold reads
// "Not available" in the muted tone.
function SnapshotTile({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  return (
    <div className="rounded-xl border border-line bg-offwhite p-3 min-w-0">
      {/* The sidebar is narrower than Case Overview's, so a long label wraps
          rather than being cut short. */}
      <div className="flex items-start gap-1.5 mb-1.5">
        <Icon className="w-3.5 h-3.5 text-deep shrink-0 mt-px" strokeWidth={1.75} />
        <span className="eyebrow leading-tight">{label}</span>
      </div>
      {value
        ? <div className="text-sm font-semibold text-ink leading-snug break-words">{value}</div>
        : <div className="text-sm text-[#8A98A3] leading-snug">{NA}</div>}
    </div>
  );
}

export function PractitionerSnapshotCard() {
  const [selectedId, setSelectedId] = useState(TREATING_PRACTITIONERS[0]?.id);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);
  const [stack, setStack] = useState<View[]>([]);

  const p = TREATING_PRACTITIONERS.find((x) => x.id === selectedId) ?? TREATING_PRACTITIONERS[0];
  const h = hospitalById(p?.hospitalId);
  const several = TREATING_PRACTITIONERS.length > 1;
  const pick = (id: string) => { setSelectedId(id); setPickerOpen(false); setBioOpen(false); };

  return (
    <>
      <div className="lg-card p-6">
        <h3 className="card-title mb-4">Medical Practitioner</h3>

        {!p ? (
          <p className="secondary-text">No practitioners are named in the case record.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Lead tile — the practitioner, with the biography toggle */}
              <div className="col-span-2 rounded-xl border border-line bg-offwhite p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <UserRound className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
                    <span className="eyebrow truncate">Medical Practitioner</span>
                  </div>
                  <button
                    onClick={() => setBioOpen((o) => !o)}
                    className="flex items-center gap-1 text-xs font-medium text-deep hover:text-ink transition-colors shrink-0"
                  >
                    {bioOpen ? "Hide biography" : "View biography"}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${bioOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
                  </button>
                </div>

                {/* The name — a selector when the case has more than one */}
                {several ? (
                  <div className="relative">
                    <button
                      onClick={() => setPickerOpen((o) => !o)}
                      aria-expanded={pickerOpen}
                      className="w-full flex items-center justify-between gap-2 text-left text-sm font-semibold text-ink leading-snug hover:text-deep transition-colors"
                    >
                      <span className="truncate">{p.name}</span>
                      <ChevronDown className={`w-4 h-4 text-deep shrink-0 transition-transform ${pickerOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
                    </button>
                    {pickerOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
                        <div className="absolute left-0 right-0 mt-1.5 z-20 rounded-lg border border-line bg-white shadow-lg p-1">
                          {TREATING_PRACTITIONERS.map((x) => (
                            <button
                              key={x.id}
                              onClick={() => pick(x.id)}
                              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                                x.id === p.id ? "bg-tint text-deep font-medium" : "text-ink hover:bg-wash"
                              }`}
                            >
                              {x.name}
                              <span className="block text-xs text-[#5B6B78]">{x.role}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-sm font-semibold text-ink leading-snug break-words">{p.name}</div>
                )}
                <div className="text-xs text-[#5B6B78] mt-0.5">{p.role}</div>

                {bioOpen && (
                  <p className="secondary-text leading-relaxed mt-2.5 pt-2.5 border-t border-line">
                    {p.biography ?? "Biography not available."}
                  </p>
                )}
              </div>

              <SnapshotTile icon={Stethoscope} label="Specialization" value={p.specializations.join(" · ") || undefined} />
              <SnapshotTile icon={Clock} label="Experience" value={formatExperience(p.experienceYears)} />
              <SnapshotTile icon={Building2} label="Hospital / Workplace" value={h?.name} />
              <SnapshotTile icon={MapPin} label="Hospital Location" value={h?.location} />
              <SnapshotTile icon={Layers} label="Hospital Size" value={h?.size} />
              <SnapshotTile icon={Landmark} label="Hospital Type" value={h?.ownership} />
              <SnapshotTile
                icon={Network}
                label="Organization"
                value={h?.structure && h.healthSystem ? `${h.structure} — ${h.healthSystem}` : h?.structure}
              />
              <SnapshotTile icon={MapIcon} label="Location Type" value={h?.locationType} />
            </div>

            {/* Find Similar Doctors — styled as Case Snapshot's View Chronology */}
            <button
              onClick={() => setStack([{ kind: "search", fromId: p.id }])}
              className="btn btn-primary w-full gap-2 mt-4"
            >
              Find Similar Doctors <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>

      {/* Rendered at the page root, above the workspace header. */}
      {stack.length > 0 && createPortal(
        <PractitionerDrawer stack={stack} setStack={setStack} onClose={() => setStack([])} />,
        document.body,
      )}
    </>
  );
}
