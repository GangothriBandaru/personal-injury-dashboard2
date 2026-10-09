import { getMediaFile } from "./mediaFileStore";
import {
  updateVideoAnalysis, updateSetFileAnalysis, type VideoEvidence, type PhotoSetEvidence, type MediaFile,
} from "./mediaEvidenceStore";

// ── Media analysis ───────────────────────────────────────────────────────────
// What "Run analysis" actually does in this prototype: a file check on the
// stored original — it is opened and decoded, and what can be measured from it
// is recorded (a video's resolution and length, an image's dimensions, a DICOM
// file's header). It does not judge the evidence or compare it with the case's
// documents: no evidence-analysis service is connected yet. Every status shown
// comes from this check actually running, finishing or failing.

const TIMEOUT_MS = 30_000;

const extOf = (name: string) => (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toLowerCase();

function withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${what} did not finish within 30 seconds`)), TIMEOUT_MS);
    p.then((v) => { window.clearTimeout(t); resolve(v); }, (e) => { window.clearTimeout(t); reject(e); });
  });
}

const duration = (s: number) => {
  if (!Number.isFinite(s)) return "unknown length";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`;
};

function checkVideo(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      const out = `Video opens · ${v.videoWidth}×${v.videoHeight} · ${duration(v.duration)}`;
      URL.revokeObjectURL(url);
      resolve(out);
    };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This video cannot be decoded — the file may be damaged or use an unsupported codec")); };
    v.src = url;
  });
}

function checkImage(blob: Blob, name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(`Image opens · ${img.naturalWidth}×${img.naturalHeight}`); };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(["heic", "heif"].includes(extOf(name))
        ? "HEIC images cannot be decoded in this browser, so the image could not be checked"
        : "This image cannot be decoded — the file may be damaged"));
    };
    img.src = url;
  });
}

/** A DICOM file carries "DICM" after a 128-byte preamble. */
async function checkDicom(blob: Blob): Promise<string> {
  const head = new Uint8Array(await blob.slice(0, 132).arrayBuffer());
  const magic = String.fromCharCode(...head.slice(128, 132));
  if (magic !== "DICM") throw new Error("This is not a valid DICOM file — its header is missing");
  return "DICOM header valid";
}

async function checkFile(f: MediaFile, kind: "video" | "image"): Promise<string> {
  const blob = await getMediaFile(f.storageKey);
  if (!blob) throw new Error("The original file is not stored on this device, so it cannot be checked");
  if (kind === "video") return withTimeout(checkVideo(blob), "The video check");
  if (["dcm", "dicom"].includes(extOf(f.name))) return withTimeout(checkDicom(blob), "The DICOM check");
  return withTimeout(checkImage(blob, f.name), "The image check");
}

const now = () => new Date().toISOString();

/** Runs the check on one video and records each step. */
export async function analyseVideo(video: VideoEvidence) {
  updateVideoAnalysis(video.id, { analysisStatus: "processing", analysisStartedAt: now(), analysisError: undefined, analysisResult: undefined });
  try {
    const result = await checkFile(video.file, "video");
    updateVideoAnalysis(video.id, { analysisStatus: "complete", analysisCompletedAt: now(), analysisResult: result });
  } catch (e) {
    updateVideoAnalysis(video.id, { analysisStatus: "failed", analysisCompletedAt: now(), analysisError: (e as Error).message });
  }
}

/** Runs the check on every image of a set — the set is analysed as a whole. */
export async function analyseSet(set: PhotoSetEvidence) {
  set.files.forEach((_, i) => updateSetFileAnalysis(set.id, i, { analysisStatus: "processing", analysisStartedAt: now(), analysisError: undefined, analysisResult: undefined }));
  for (let i = 0; i < set.files.length; i++) {
    try {
      const result = await checkFile(set.files[i], "image");
      updateSetFileAnalysis(set.id, i, { analysisStatus: "complete", analysisCompletedAt: now(), analysisResult: result });
    } catch (e) {
      updateSetFileAnalysis(set.id, i, { analysisStatus: "failed", analysisCompletedAt: now(), analysisError: (e as Error).message });
    }
  }
}
