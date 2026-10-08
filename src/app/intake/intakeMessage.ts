// ── The intake request message ───────────────────────────────────────────────
// One source for what the client is asked: the attorney's Message Preview and
// the client's request page are both built from it, so they cannot disagree.
// Requested video & photos are appended to the existing document message; with
// none requested, the message is exactly the document-only message.

export interface RequestedMedia {
  videos: boolean;
  scenePhotos: boolean;
  medicalImages: boolean;
}

export const NO_MEDIA: RequestedMedia = { videos: false, scenePhotos: false, medicalImages: false };

export const MEDIA_OPTIONS = [
  {
    key: "videos",
    title: "Videos of the incident",
    description: "Dashcam, phone or security footage (MP4, MOV)",
    sentence: "Please upload any videos of the incident, such as dashcam, phone or security footage.",
  },
  {
    key: "scenePhotos",
    title: "Photos of the scene",
    description: "Location, vehicles and visible injuries (JPG, PNG, HEIC, WebP)",
    sentence: "Please upload photos of the scene, including the location, vehicles and visible injuries.",
  },
  {
    key: "medicalImages",
    title: "Medical images",
    description: "X-ray, MRI or CT images you were given (images only)",
    sentence: "Please upload any medical images you were given, such as X-ray, MRI or CT images.",
  },
] as const;

export type MediaKey = (typeof MEDIA_OPTIONS)[number]["key"];

export const selectedMediaOptions = (media?: RequestedMedia) => MEDIA_OPTIONS.filter((o) => media?.[o.key]);

/** One medium asked for → its sentence; several → "Please also upload:" and a list. */
export function mediaRequest(media?: RequestedMedia): { sentence?: string; list?: string[] } {
  const chosen = selectedMediaOptions(media);
  if (chosen.length === 0) return {};
  if (chosen.length === 1) return { sentence: chosen[0].sentence };
  return { list: chosen.map((o) => o.title) };
}

export function intakeMessageText(m: {
  plaintiff: string;
  senderName: string;
  senderFirm?: string;
  docs: string[];
  media?: RequestedMedia;
  instructions?: string;
}): string {
  const media = mediaRequest(m.media);
  return [
    `Hello ${m.plaintiff},`,
    "To begin evaluating your case, we need you to provide the following documents.",
    ["Requested Documents:", ...m.docs.map((d) => `• ${d}`)].join("\n"),
    media.sentence,
    media.list && ["Please also upload:", ...media.list.map((t) => `• ${t}`)].join("\n"),
    m.instructions?.trim() || undefined,
    "If you have any questions or are unable to obtain a document, please contact our office.",
    ["Thank you,", m.senderName, m.senderFirm].filter(Boolean).join("\n"),
  ].filter(Boolean).join("\n\n");
}
