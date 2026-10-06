import { FileText, FileImage, FileVideo, FileAudio, FileSpreadsheet } from "lucide-react";

// ── Evidence media / document type ───────────────────────────────────────────
// One reading of a file's type, from its name, shared by every surface that
// shows evidence — Stage Evidence, the Evidence workspace, the Document
// Workspace viewer and each inline evidence chip — so a file is identified the
// same way wherever it appears. The type sits alongside the evidence category,
// never in place of it.

export type FileKind = "document" | "image" | "video" | "audio";

const KIND_EXTENSIONS: Record<Exclude<FileKind, "document">, string[]> = {
  image: ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "bmp", "tif", "tiff", "svg"],
  video: ["mp4", "mov", "avi", "webm", "mkv", "m4v", "wmv"],
  audio: ["mp3", "wav", "m4a", "aac", "ogg", "flac", "wma"],
};

const SPREADSHEET = ["xls", "xlsx", "csv", "ods"];

/** Lower-case extension without the dot — "" when the name has none. */
export function fileExtension(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

export function fileKind(name: string): FileKind {
  const ext = fileExtension(name);
  for (const kind of ["image", "video", "audio"] as const) {
    if (KIND_EXTENSIONS[kind].includes(ext)) return kind;
  }
  return "document";
}

export const FILE_KIND_LABEL: Record<FileKind, string> = {
  document: "Document",
  image: "Image",
  video: "Video",
  audio: "Audio",
};

/** The type as the attorney reads it: the format for a document ("PDF",
 *  "DOCX"), the media kind with its format for media ("Image · JPG"). */
export function fileTypeLabel(name: string): string {
  const kind = fileKind(name);
  const ext = fileExtension(name).toUpperCase();
  if (kind === "document") return ext || "DOC";
  return ext ? `${FILE_KIND_LABEL[kind]} · ${ext}` : FILE_KIND_LABEL[kind];
}

export function fileTypeIcon(name: string) {
  const kind = fileKind(name);
  if (kind === "image") return FileImage;
  if (kind === "video") return FileVideo;
  if (kind === "audio") return FileAudio;
  return SPREADSHEET.includes(fileExtension(name)) ? FileSpreadsheet : FileText;
}

/** The type-aware file icon — drop-in for the FileText icon beside a file name. */
export function FileTypeIcon({ name, className = "w-3.5 h-3.5 text-deep shrink-0" }: { name: string; className?: string }) {
  const Icon = fileTypeIcon(name);
  return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
}

/** A compact type tag — "PDF", "DOCX", "IMAGE · JPG", "VIDEO · MP4". */
export function FileTypeTag({ name, icon = false, className = "" }: { name: string; icon?: boolean; className?: string }) {
  const Icon = fileTypeIcon(name);
  return (
    <span
      title={`${FILE_KIND_LABEL[fileKind(name)]} file`}
      className={`inline-flex items-center gap-1 shrink-0 rounded-md border border-line bg-offwhite px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] leading-none text-[#5B6B78] whitespace-nowrap ${className}`}
    >
      {icon && <Icon className="w-3 h-3" strokeWidth={1.75} aria-hidden="true" />}
      {fileTypeLabel(name)}
    </span>
  );
}

/** The pill form, for card headers that already carry pills. */
export function FileTypeBadge({ name }: { name: string }) {
  const Icon = fileTypeIcon(name);
  return (
    <span className="pill pill-neutral shrink-0 uppercase">
      <Icon className="w-3.5 h-3.5" strokeWidth={1.75} /> {fileTypeLabel(name)}
    </span>
  );
}
