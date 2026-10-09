import { useState } from "react";
import { X, Info, AlertCircle, CheckCircle, UploadCloud } from "lucide-react";
import type { SetKind, StudyDetails, MediaFile } from "./mediaEvidenceStore";
import { putMediaFile } from "./mediaFileStore";

// ── Video & photo upload parts ─────────────────────────────────────────────
// Shared by the attorney's Upload Video & Photos modal and the client's
// request page, so both check files by the same rules: videos MP4/MOV, scene
// photos JPEG/PNG/HEIC/WebP, medical images DICOM/JPEG/PNG, 50 MB each, and a
// file in the wrong place is named as such.

export const MAX_BYTES = 50 * 1024 * 1024;
const VIDEO_EXT = ["mp4", "mov"];
const SCENE_EXT = ["jpeg", "jpg", "png", "heic", "webp"];
const MEDICAL_EXT = ["dcm", "dicom", "jpeg", "jpg", "png"];
const ANY_VIDEO = ["mp4", "mov", "m4v", "avi", "webm", "mkv", "wmv"];
const ANY_IMAGE = ["jpeg", "jpg", "png", "heic", "heif", "webp", "gif", "bmp", "tif", "tiff", "dcm", "dicom"];

export type Context = "video" | SetKind;

export interface Draft { key: string; name: string; size: number; type: string; /** The chosen file itself. */ file?: File }
export interface DraftSet { key: string; kind: SetKind; files: Draft[]; study: StudyDetails }

export const EMPTY_STUDY: StudyDetails = { scanType: "Not sure", bodyPart: "", view: "", studyDate: "", side: "Not sure" };
const extOf = (name: string) => (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toLowerCase();
export const keyOf = () => Math.random().toString(36).slice(2, 10);
export const formatSize = (b: number) => (b >= 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const label = (ext: string) => (ext === "dcm" || ext === "dicom" ? "DICOM" : ext ? ext.toUpperCase() : "This file");

/** Why a file can't be uploaded where it is — null when it can. */
/** Where a misplaced file should go instead — the attorney modal names its
 *  tabs; the client page names its sections, and omits any not requested. */
export interface Places { video?: string; image?: string }
const TAB_PLACES: Places = { video: "the Video tab", image: "the Photos tab" };

export function problemWith(file: Draft, ctx: Context, places: Places = TAB_PLACES): string | null {
  const ext = extOf(file.name);
  const isVideo = ANY_VIDEO.includes(ext);
  const isImage = ANY_IMAGE.includes(ext);
  if (ctx === "video") {
    if (isImage) return places.image ? `This is an image. Add it in ${places.image}.` : "This is an image. Only videos are asked for here.";
    if (!VIDEO_EXT.includes(ext)) return `${label(ext)} is not accepted for video. Accepted: MP4, MOV.`;
    if (file.size > MAX_BYTES) return "Larger than 50 MB. Choose a shorter clip or a smaller file.";
    return null;
  }
  if (isVideo) return places.video ? `This is a video. Add it in ${places.video}.` : "This is a video. Only images are asked for here.";
  if (ctx === "scene" && !SCENE_EXT.includes(ext)) return `${label(ext)} is not accepted for scene photos. Accepted: JPEG, PNG, HEIC, WebP.`;
  if (ctx === "medical" && !MEDICAL_EXT.includes(ext)) return `${label(ext)} is not accepted for medical images. Accepted: DICOM, JPEG, PNG.`;
  if (file.size > MAX_BYTES) return "Larger than 50 MB. Choose a smaller file.";
  return null;
}

export const toDrafts = (files: FileList | File[]): Draft[] =>
  Array.from(files).map((f) => ({ key: keyOf(), name: f.name, size: f.size, type: f.type, file: f }));

/** Stores a draft's original file and returns its record, with the storage
 *  key. Throws if the file cannot be stored, so that upload fails honestly. */
export async function storeDraft(d: Draft): Promise<MediaFile> {
  const meta: MediaFile = { name: d.name, size: d.size, type: d.type };
  if (!d.file) return meta;
  return { ...meta, storageKey: await putMediaFile(d.file) };
}

export function DropZone({ accept, hint, onFiles }: { accept: string; hint: string; onFiles: (files: FileList) => void }) {
  const [over, setOver] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}
      className={`flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed px-4 py-6 cursor-pointer transition-colors ${
        over ? "border-brand bg-tint" : "border-line bg-offwhite hover:border-soft hover:bg-wash"
      }`}
    >
      <UploadCloud className="w-5 h-5 text-deep mb-1.5" strokeWidth={1.75} />
      <span className="text-sm text-ink"><span className="font-semibold text-deep">Browse Files</span> or drop them here</span>
      <span className="text-xs text-[#5B6B78] mt-0.5">{hint}</span>
      <input type="file" multiple accept={accept} className="hidden" onChange={(e) => { if (e.target.files) onFiles(e.target.files); e.target.value = ""; }} />
    </label>
  );
}

export function FileRow({ file, icon: Icon, problem, onRemove }: { file: Draft; icon: any; problem: string | null; onRemove: () => void }) {
  if (problem) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-[#FBD5D5] bg-[#FEF2F2] px-3.5 py-2.5">
        <AlertCircle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink truncate">{file.name}</div>
          <div className="text-xs text-[#B91C1C] mt-0.5">{problem}</div>
        </div>
        <button onClick={onRemove} className="text-xs font-semibold text-[#B91C1C] hover:underline shrink-0">Remove</button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-2.5">
      <Icon className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink truncate">{file.name}</div>
        <div className="text-xs text-[#5B6B78]">{formatSize(file.size)}</div>
      </div>
      <CheckCircle className="w-4 h-4 text-[#15803D] shrink-0" strokeWidth={1.75} />
      <button onClick={onRemove} aria-label={`Remove ${file.name}`} className="p-1 rounded hover:bg-wash transition-colors shrink-0">
        <X className="w-3.5 h-3.5 text-[#5B6B78]" strokeWidth={1.75} />
      </button>
    </div>
  );
}

export const Banner = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-start gap-2.5 rounded-xl bg-[#F6FDFF] border border-[#D6F2F7] px-4 py-3">
    <Info className="w-4 h-4 text-deep shrink-0 mt-0.5" strokeWidth={1.75} />
    <p className="text-sm text-ink leading-relaxed">{children}</p>
  </div>
);

export const input = "w-full bg-white border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-[#8A98A3] focus:outline-none focus:border-brand transition-colors";

/** The optional study details of a medical image set. */
export function StudyFields({ study, onChange }: { study: StudyDetails; onChange: (s: StudyDetails) => void }) {
  return (
    <div className="rounded-xl bg-[#F6FDFF] border border-[#D6F2F7] p-4">
      <div className="text-sm font-semibold text-ink">Study details</div>
      <div className="text-xs text-[#5B6B78] mb-3">optional · the images in this set are read as one study</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="eyebrow block mb-1">Type of scan</span>
          <select value={study.scanType} onChange={(e) => onChange({ ...study, scanType: e.target.value as StudyDetails["scanType"] })} className={input}>
            {["Not sure", "MRI", "CT", "X-ray", "Ultrasound", "Other"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow block mb-1">Body part</span>
          <input value={study.bodyPart} onChange={(e) => onChange({ ...study, bodyPart: e.target.value })} placeholder="lumbar spine" className={input} />
        </label>
        <label className="block">
          <span className="eyebrow block mb-1">View</span>
          <input value={study.view} onChange={(e) => onChange({ ...study, view: e.target.value })} placeholder="e.g. sagittal, AP" className={input} />
        </label>
        <label className="block">
          <span className="eyebrow block mb-1">Study date</span>
          <input value={study.studyDate} onChange={(e) => onChange({ ...study, studyDate: e.target.value })} placeholder="e.g. 2026-03-01" className={input} />
        </label>
        <label className="block">
          <span className="eyebrow block mb-1">Side</span>
          <select value={study.side} onChange={(e) => onChange({ ...study, side: e.target.value as StudyDetails["side"] })} className={input}>
            {["Not sure", "Left", "Right", "Both", "Not applicable"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
