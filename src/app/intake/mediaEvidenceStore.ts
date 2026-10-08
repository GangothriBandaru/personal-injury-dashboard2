import { useSyncExternalStore } from "react";

// ── Media evidence ───────────────────────────────────────────────────────────
// Videos and photo sets uploaded for a case. They are media evidence, analysed
// on their own — never document records. Each video is its own item; photos
// arrive in sets (one scene, or one medical study), and a set is one item, so
// a photo is always credited to its set. Every video and every set is stored
// independently: one failing never loses the others.

export type SetKind = "scene" | "medical";

export interface StudyDetails {
  scanType: "Not sure" | "MRI" | "CT" | "X-ray" | "Ultrasound" | "Other";
  bodyPart: string;
  view: string;
  studyDate: string;
  side: "Not sure" | "Left" | "Right" | "Both" | "Not applicable";
}

export interface MediaFile {
  name: string;
  size: number;
  type: string;
}

/** Who added the media: the attorney, or the client through a request link. */
export interface MediaOrigin { source: "Attorney" | "Client"; requestId?: string }

export interface VideoEvidence extends Partial<MediaOrigin> {
  id: string;
  caseId: string;
  /** Video 1, 2, … in upload order for the case. */
  number: number;
  file: MediaFile;
  uploadedAt: string;
  uploadedBy: string;
}

export interface PhotoSetEvidence extends Partial<MediaOrigin> {
  id: string;
  caseId: string;
  kind: SetKind;
  /** Each image numbered within its kind, in upload order — Scene Image 1, 2 … */
  files: (MediaFile & { number: number })[];
  /** Medical sets only, all optional: the images are read as one study. */
  study?: Partial<StudyDetails>;
  uploadedAt: string;
  uploadedBy: string;
}

interface MediaState {
  videos: VideoEvidence[];
  sets: PhotoSetEvidence[];
}

const STORAGE_KEY = "leco.media.evidence.v1";

function load(): MediaState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && Array.isArray(parsed.videos) && Array.isArray(parsed.sets) ? parsed : { videos: [], sets: [] };
  } catch {
    return { videos: [], sets: [] };
  }
}

let state: MediaState = typeof window === "undefined" ? { videos: [], sets: [] } : load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Saves, or throws so the caller can mark just that item as failed. */
function save(next: MediaState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  state = next;
  emit();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) { state = load(); emit(); }
  });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => state;

export function useMediaEvidence(caseId: string) {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  return {
    videos: s.videos.filter((v) => v.caseId === caseId),
    sets: s.sets.filter((x) => x.caseId === caseId),
  };
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** One video, one upload — numbered after the case's existing videos. */
export function addVideoEvidence(caseId: string, file: MediaFile, uploadedBy: string, origin?: MediaOrigin): VideoEvidence {
  const number = state.videos.filter((v) => v.caseId === caseId).length + 1;
  const video: VideoEvidence = { id: newId(), caseId, number, file, uploadedAt: new Date().toISOString(), uploadedBy, ...origin };
  save({ ...state, videos: [...state.videos, video] });
  return video;
}

/** One photo set, one upload — its images numbered after the case's existing
 *  images of the same kind. */
export function addPhotoSetEvidence(
  caseId: string, kind: SetKind, files: MediaFile[], uploadedBy: string, study?: Partial<StudyDetails>, origin?: MediaOrigin,
): PhotoSetEvidence {
  const already = state.sets.filter((x) => x.caseId === caseId && x.kind === kind).reduce((n, x) => n + x.files.length, 0);
  const set: PhotoSetEvidence = {
    id: newId(),
    caseId,
    kind,
    files: files.map((f, i) => ({ ...f, number: already + i + 1 })),
    ...(kind === "medical" && study ? { study } : {}),
    uploadedAt: new Date().toISOString(),
    uploadedBy,
    ...origin,
  };
  save({ ...state, sets: [...state.sets, set] });
  return set;
}
