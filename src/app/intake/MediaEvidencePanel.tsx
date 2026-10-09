import { useEffect, useState } from "react";
import {
  Camera, ChevronDown, Download, Eye, Loader2, Play, RotateCcw, ScanLine, Video, Image as ImageIcon,
  AlertTriangle, CheckCircle, X, Info, Upload,
} from "lucide-react";
import type { CaseDocument } from "../types/case";
import { classifyDocuments } from "../types/case";
import {
  useMediaEvidence, fileStatus, setStatus, STALLED_AFTER_MS,
  type MediaFile, type MediaStatus, type PhotoSetEvidence, type VideoEvidence,
} from "./mediaEvidenceStore";
import { analyseVideo, analyseSet } from "./mediaAnalysis";
import { getMediaFile, downloadMediaFile } from "./mediaFileStore";

// ── Media evidence ───────────────────────────────────────────────────────────
// A case's videos, photo sets and medical image studies, apart from its
// documents. Everything here — counts, statuses, warnings, the actions on offer
// — is read from the case's media records. Run analysis performs the real file
// check (mediaAnalysis); Preview and Download use the stored original file.

const NEW_BADGE = <span className="pill pill-neutral shrink-0 text-[10px] font-bold tracking-[0.06em]">NEW</span>;
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const extOf = (name: string) => (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toLowerCase();
const minutesSince = (iso?: string) => (iso ? Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000)) : 0);

// ── Status ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MediaStatus }) {
  switch (status) {
    case "processing":
      return <span className="pill bg-tint text-deep border-[#D6F2F7] shrink-0"><Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} /> Processing</span>;
    case "stalled":
      return <span className="pill pill-progress shrink-0"><AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.75} /> Stalled</span>;
    case "ready":
      return <span className="pill pill-complete shrink-0"><CheckCircle className="w-3.5 h-3.5" strokeWidth={1.75} /> Ready</span>;
    case "partly-ready":
      return <span className="pill pill-progress shrink-0">Partly ready</span>;
    case "failed":
      return <span className="pill pill-risk shrink-0"><X className="w-3.5 h-3.5" strokeWidth={1.75} /> Failed</span>;
    default:
      return <span className="pill pill-neutral shrink-0">Not analysed</span>;
  }
}

/** The line under a file name: what the check found, why it failed, or that it stalled. */
function fileNote(f: MediaFile): { text: string; tone: "muted" | "amber" | "red"; spin?: boolean } | null {
  const s = fileStatus(f);
  if (s === "processing") return { text: "Analysing…", tone: "muted", spin: true };
  if (s === "stalled") return { text: `No progress for ${minutesSince(f.analysisStartedAt)} minutes — the analysis stopped. Retry to run it again.`, tone: "amber" };
  if (s === "failed") return { text: f.analysisError ?? "The check failed.", tone: "red" };
  if (s === "ready") return { text: f.analysisResult ?? "Checked.", tone: "muted" };
  return null;
}

const NOTE_TONE = { muted: "text-[#5B6B78]", amber: "text-[#B45309]", red: "text-[#B91C1C]" };

// ── Actions ──────────────────────────────────────────────────────────────────

const outline = "inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-line rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
const primary = "inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-brand hover:bg-deep text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

function FileActions({ file, onPreview, children }: { file: MediaFile; onPreview: () => void; children?: React.ReactNode }) {
  const [failed, setFailed] = useState(false);
  const stored = !!file.storageKey;
  return (
    <>
      <button onClick={onPreview} disabled={!stored} title={stored ? "Preview" : "The original file is not stored on this device"} className={`${outline} text-ink hover:bg-wash`}>
        <Eye className="w-3.5 h-3.5" strokeWidth={1.75} /> Preview
      </button>
      {children}
      <button
        onClick={async () => setFailed(!(await downloadMediaFile(file.storageKey, file.name)))}
        disabled={!stored}
        title={failed ? "The original file could not be found on this device" : stored ? "Download the original file" : "The original file is not stored on this device"}
        aria-label={`Download ${file.name}`}
        className={`${outline} ${failed ? "text-[#B91C1C] border-[#FBD5D5]" : "text-ink hover:bg-wash"}`}
      >
        <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
      </button>
    </>
  );
}

const needsRetry = (s: MediaStatus) => s === "stalled" || s === "failed";

/** Retry — only where the last run stalled or failed. */
function RetryAction({ status, onRun }: { status: MediaStatus; onRun: () => void }) {
  if (!needsRetry(status)) return null;
  return (
    <button onClick={onRun} className={`${outline} text-[#B45309] border-[#FDE6C8] hover:bg-[#FFF7ED]`}>
      <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} /> Retry
    </button>
  );
}

/** Run analysis — or Run limited analysis, said plainly, when the case has
 *  nothing to compare the media with. Disabled while a run is in progress, and
 *  after a stall or failure, where Retry is the action. */
function RunAction({ status, limited, onRun }: { status: MediaStatus; limited?: boolean; onRun: () => void }) {
  const disabled = status === "processing" || needsRetry(status);
  return (
    <button
      onClick={onRun}
      disabled={disabled}
      title={status === "processing" ? "Available when the files are ready" : needsRetry(status) ? "Retry the last run first" : limited ? "Nothing on this case to compare with — the analysis would be limited" : undefined}
      className={primary}
    >
      <Play className="w-3.5 h-3.5" strokeWidth={1.75} /> {limited ? "Run limited analysis" : "Run analysis"}
    </button>
  );
}

// ── Preview ──────────────────────────────────────────────────────────────────

function PreviewModal({ file, kind, onClose }: { file: MediaFile; kind: "video" | "image"; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const ext = extOf(file.name);
  const viewable = kind === "video" ? ["mp4", "mov", "webm", "m4v"].includes(ext) : ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  useEffect(() => {
    let objectUrl: string | null = null;
    getMediaFile(file.storageKey).then((blob) => {
      if (!blob) { setMissing(true); return; }
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [file.storageKey]);
  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line">
          <span className="mono-ref text-ink truncate">{file.name}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => downloadMediaFile(file.storageKey, file.name)} className={`${outline} text-ink hover:bg-wash`}>
              <Download className="w-3.5 h-3.5" strokeWidth={1.75} /> Download
            </button>
            <button onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-tint rounded-lg transition-colors">
              <X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-[320px] bg-[#F1F3F5] flex items-center justify-center p-6 overflow-auto">
          {missing ? (
            <p className="secondary-text text-center">The original file is not stored on this device, so it cannot be previewed.</p>
          ) : !viewable ? (
            <p className="secondary-text text-center max-w-md">
              {ext === "heic" || ext === "heif" ? "HEIC" : ext === "dcm" || ext === "dicom" ? "DICOM" : ext.toUpperCase()} files can't be shown in the browser. Download the original to open it in a suitable viewer.
            </p>
          ) : !url ? (
            <Loader2 className="w-6 h-6 text-brand animate-spin" strokeWidth={1.75} />
          ) : kind === "video" ? (
            <video src={url} controls className="max-w-full max-h-[70vh] rounded-lg bg-ink" />
          ) : (
            <img src={url} alt={file.name} className="max-w-full max-h-[70vh] rounded-lg shadow-sm" />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Layout pieces ────────────────────────────────────────────────────────────

const TH = "text-left px-4 py-2.5 eyebrow";

function Category({
  title, icon: Icon, count, children,
}: { title: string; icon: any; count: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-line rounded-xl overflow-hidden bg-white">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center justify-between px-5 py-3 bg-[#F6FDFF] hover:bg-tint transition-colors text-left">
        <span className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-deep" strokeWidth={1.75} />
          <span className="text-sm font-semibold text-ink">{title}</span>
          <span className="text-xs font-medium text-[#5B6B78] bg-white border border-line px-2 py-0.5 rounded-full">{count}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-[#5B6B78] transition-transform ${open ? "" : "-rotate-90"}`} strokeWidth={1.75} />
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[760px] table-fixed">
            {/* The same column widths in every category, so they line up. */}
            <colgroup>
              <col className="w-[29%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[35%]" />
            </colgroup>
            <thead className="bg-white border-b border-line">
              <tr>
                <th className={TH}>File Name</th>
                <th className={TH}>Source</th>
                <th className={TH}>Date</th>
                <th className={TH}>Status</th>
                <th className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">{children}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NameCell({ label, file }: { label: string; file: MediaFile }) {
  const note = fileNote(file);
  return (
    <td className="px-4 py-3 align-top">
      <div className="text-sm font-semibold text-ink">{label}</div>
      <div className="mono-ref truncate max-w-[280px]" title={file.name}>{file.name}</div>
      {note && (
        <div className={`text-xs mt-0.5 flex items-center gap-1 ${NOTE_TONE[note.tone]}`}>
          {note.spin && <Loader2 className="w-3 h-3 animate-spin shrink-0" strokeWidth={1.75} />}
          <span className="min-w-0">{note.text}</span>
        </div>
      )}
    </td>
  );
}

function SetBand({
  set, word, comparison, onPreview,
}: {
  set: PhotoSetEvidence;
  word: string;
  /** The case documents the set can be compared with, or the reason there are none. */
  comparison: { docs: string[]; missing?: string };
  onPreview: (f: MediaFile) => void;
}) {
  const [open, setOpen] = useState(true);
  const status = setStatus(set.files);
  const first = set.files[0]?.number;
  const last = set.files[set.files.length - 1]?.number;
  const study = set.study;
  const limited = !!comparison.missing;
  const things = set.kind === "scene" ? "photos" : "images";
  const unit = set.files.length === 1 ? things.slice(0, -1) : things;
  // Study type and body part in the title, the rest beneath — only what was entered.
  const titleBits = study ? [study.scanType && study.scanType !== "Not sure" ? study.scanType : null, study.bodyPart || null].filter(Boolean) : [];
  const detailBits = study ? [study.view || null, study.side && study.side !== "Not sure" ? study.side : null, study.studyDate ? `study date ${study.studyDate}` : null].filter(Boolean) : [];
  return (
    <>
      <tr className="bg-[#F6FDFF]">
        <td colSpan={3} className="px-4 py-3 align-top">
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-start gap-2 text-left min-w-0 w-full">
            <ChevronDown className={`w-4 h-4 text-[#5B6B78] mt-0.5 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} strokeWidth={1.75} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink">
                {[`${word} ${first === last ? first : `${first}–${last}`}`, `${set.files.length} ${unit}`, ...titleBits].join(" · ")}
              </span>
              {detailBits.length > 0 && <span className="block text-xs text-[#5B6B78]">{detailBits.join(" · ")}</span>}
              {status === "processing" && (
                <span className="block text-xs text-[#5B6B78] mt-0.5">The {things} are being analysed. You can run the analysis again when they are ready.</span>
              )}
              {status === "stalled" && (
                <span className="block text-xs text-[#B45309] mt-0.5">The analysis has made no progress for over {Math.round(STALLED_AFTER_MS / 60000)} minutes. Retry to run it again.</span>
              )}
              {comparison.missing ? (
                <span className="text-xs text-[#B45309] mt-0.5 flex items-start gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" strokeWidth={1.75} /> {comparison.missing}
                </span>
              ) : (
                <span className="block text-xs text-[#5B6B78] mt-0.5">Will be compared with: {comparison.docs.join(", ")} (found on this case)</span>
              )}
            </span>
          </button>
        </td>
        <td className="px-4 py-3 align-top"><StatusBadge status={status} /></td>
        <td className="px-4 py-3 align-top">
          <div className="flex items-center justify-end gap-1.5 flex-wrap">
            <RetryAction status={status} onRun={() => analyseSet(set)} />
            <RunAction status={status} limited={limited} onRun={() => analyseSet(set)} />
          </div>
        </td>
      </tr>
      {open && set.files.map((f) => (
        <tr key={f.number} className="bg-white">
          <NameCell label={`${word} ${f.number}`} file={f} />
          <td className="px-4 py-3 align-top text-sm text-[#5B6B78]">{set.source ?? "Attorney"}</td>
          <td className="px-4 py-3 align-top text-sm text-[#5B6B78] whitespace-nowrap">{formatDate(set.uploadedAt)}</td>
          <td className="px-4 py-3 align-top"><StatusBadge status={fileStatus(f)} /></td>
          <td className="px-4 py-3 align-top">
            <div className="flex items-center justify-end gap-1.5"><FileActions file={f} onPreview={() => onPreview(f)} /></div>
          </td>
        </tr>
      ))}
    </>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

export function MediaEvidencePanel({
  caseId, documents = [], onUpload,
}: { caseId: string; documents?: CaseDocument[]; onUpload?: () => void }) {
  const { videos, sets } = useMediaEvidence(caseId);
  const [preview, setPreview] = useState<{ file: MediaFile; kind: "video" | "image" } | null>(null);
  // Re-read the clock so a check that stops making progress shows as stalled.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const scene = sets.filter((s) => s.kind === "scene");
  const medical = sets.filter((s) => s.kind === "medical");

  // What each kind of set can be compared with, from the case's own documents.
  const categories = classifyDocuments(documents);
  const docsIn = (name: string) => categories.find((c) => c.name === name)?.docs.map((d) => d.name) ?? [];
  // Shown by name, without the file extension or underscores.
  const readable = (n: string) => n.replace(/\.[a-z0-9]+$/i, "").replace(/_+/g, " ").trim();
  const sceneDocs = docsIn("Police Reports").map(readable);
  const medicalDocs = [...docsIn("Medical Records"), ...documents.filter((d) => /expert|letter/i.test(d.name)).map((d) => d.name)].map(readable);
  const sceneComparison = sceneDocs.length
    ? { docs: sceneDocs }
    : { docs: [], missing: "No crash report, incident report or witness statement is on this case. The analysis would be limited: nothing can be compared." };
  const medicalComparison = medicalDocs.length
    ? { docs: Array.from(new Set(medicalDocs)) }
    : { docs: [], missing: "No medical record, bill or expert letter is on this case. The analysis would be limited: nothing can be compared." };

  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const imagesIn = (xs: PhotoSetEvidence[]) => xs.reduce((t, x) => t + x.files.length, 0);

  // Summary — from the records.
  const allFiles: MediaFile[] = [...videos.map((v) => v.file), ...sets.flatMap((s) => s.files)];
  const statuses = allFiles.map((f) => fileStatus(f));
  const processing = statuses.filter((s) => s === "processing").length;
  const attention = statuses.filter((s) => s === "stalled" || s === "failed").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {processing > 0 && <span className="pill bg-tint text-deep border-[#D6F2F7]"><Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} /> In Progress</span>}
          <span className="secondary-text">
            {[processing > 0 && `${processing} processing`, attention > 0 && `${attention} need attention`, `${allFiles.length} ${allFiles.length === 1 ? "file" : "files"}`].filter(Boolean).join(" · ")}
          </span>
        </div>
        {onUpload && (
          <button onClick={onUpload} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-deep text-white rounded-lg text-xs font-semibold transition-all">
            <Upload className="w-3.5 h-3.5" strokeWidth={1.75} /> Upload Video &amp; Photos
          </button>
        )}
      </div>

      {allFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-line rounded-xl bg-white">
          <Camera className="w-8 h-8 text-[#9BDAEC] mb-3" strokeWidth={1.75} />
          <p className="text-sm text-[#5B6B78]">No video or photos on this case yet.</p>
          <p className="text-xs text-[#5B6B78] mt-1">Media evidence is analysed on its own, not read as documents.</p>
        </div>
      ) : (
        <>
          <Category title="Video" icon={Video} count={n(videos.length, "video", "videos")}>
            {videos.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-4 text-sm text-[#8A98A3]">No videos.</td></tr>
            ) : videos.map((v: VideoEvidence) => {
              const status = fileStatus(v.file);
              return (
                <tr key={v.id} className="bg-white">
                  <NameCell label={`Video ${v.number}`} file={v.file} />
                  <td className="px-4 py-3 align-top text-sm text-[#5B6B78]">{v.source ?? "Attorney"}</td>
                  <td className="px-4 py-3 align-top text-sm text-[#5B6B78] whitespace-nowrap">{formatDate(v.uploadedAt)}</td>
                  <td className="px-4 py-3 align-top"><StatusBadge status={status} /></td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      <RetryAction status={status} onRun={() => analyseVideo(v)} />
                      <FileActions file={v.file} onPreview={() => setPreview({ file: v.file, kind: "video" })}>
                        <RunAction status={status} onRun={() => analyseVideo(v)} />
                      </FileActions>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Category>

          <Category title="Photos" icon={ImageIcon} count={`${n(imagesIn(scene), "photo", "photos")} · ${n(scene.length, "set", "sets")}`}>
            {scene.length === 0
              ? <tr><td colSpan={5} className="px-4 py-4 text-sm text-[#8A98A3]">No scene photo sets.</td></tr>
              : scene.map((s) => <SetBand key={s.id} set={s} word="Scene Image" comparison={sceneComparison} onPreview={(f) => setPreview({ file: f, kind: "image" })} />)}
          </Category>

          <Category title="Medical images" icon={ScanLine} count={`${n(imagesIn(medical), "image", "images")} · ${n(medical.length, "study", "studies")}`}>
            {medical.length === 0
              ? <tr><td colSpan={5} className="px-4 py-4 text-sm text-[#8A98A3]">No medical image studies.</td></tr>
              : medical.map((s) => <SetBand key={s.id} set={s} word="Medical Image" comparison={medicalComparison} onPreview={(f) => setPreview({ file: f, kind: "image" })} />)}
          </Category>

          <p className="text-xs text-[#5B6B78] leading-relaxed flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" strokeWidth={1.75} />
            Run analysis checks that each file opens and records what can be measured from it (a video's resolution and length, an image's dimensions, a DICOM header). Comparing media with the case's documents needs the evidence-analysis service, which is not connected yet.
          </p>
        </>
      )}

      {preview && <PreviewModal file={preview.file} kind={preview.kind} onClose={() => setPreview(null)} />}
    </div>
  );
}

export { NEW_BADGE };
