import { Video, Image as ImageIcon, ScanLine, Camera } from "lucide-react";
import { useMediaEvidence, type PhotoSetEvidence } from "./mediaEvidenceStore";

// ── Media evidence ───────────────────────────────────────────────────────────
// The case's videos and photo sets, apart from its documents: Video 1, 2 …;
// scene photo sets as Scene Image ranges; medical sets as Medical Image ranges
// with their study details. A set is identified by its image range, date,
// uploader and kind — never by a typed name.

const formatSize = (b: number) => (b >= 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function SetBlock({ set, word }: { set: PhotoSetEvidence; word: string }) {
  const first = set.files[0]?.number;
  const last = set.files[set.files.length - 1]?.number;
  const Icon = set.kind === "medical" ? ScanLine : ImageIcon;
  const study = set.study;
  const studyBits = study
    ? [
        study.scanType && study.scanType !== "Not sure" ? study.scanType : null,
        study.bodyPart || null,
        study.view || null,
        study.side && study.side !== "Not sure" ? study.side : null,
        study.studyDate ? `study date ${study.studyDate}` : null,
      ].filter(Boolean)
    : [];
  return (
    <div className="border border-line rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-wash flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm font-semibold text-ink">
          {word} {first === last ? first : `${first}–${last}`}
        </span>
        <span className="text-xs text-[#5B6B78]">{formatDate(set.uploadedAt)} · {set.uploadedBy}</span>
      </div>
      {set.kind === "medical" && (
        <div className="px-4 py-2 border-t border-line bg-[#F6FDFF] text-xs text-ink">
          <span className="font-semibold">Study:</span> {studyBits.length ? studyBits.join(" · ") : "details not given"} — read as one study
        </div>
      )}
      <div className="divide-y divide-line bg-white border-t border-line">
        {set.files.map((f) => (
          <div key={f.number} className="flex items-center gap-3 px-4 py-2.5">
            <Icon className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
            <span className="text-sm font-medium text-ink shrink-0">{word} {f.number}</span>
            <span className="mono-ref truncate flex-1">{f.name}</span>
            <span className="text-xs text-[#5B6B78] shrink-0">{formatSize(f.size)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MediaEvidencePanel({ caseId, onUpload }: { caseId: string; onUpload?: () => void }) {
  const { videos, sets } = useMediaEvidence(caseId);
  const scene = sets.filter((s) => s.kind === "scene");
  const medical = sets.filter((s) => s.kind === "medical");

  if (videos.length === 0 && sets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Camera className="w-8 h-8 text-[#9BDAEC] mb-3" strokeWidth={1.75} />
        <p className="text-sm text-[#5B6B78]">No video or photos yet.</p>
        <p className="text-xs text-[#5B6B78] mt-1">Media evidence is analysed on its own, not read as documents.</p>
        {onUpload && (
          <button onClick={onUpload} className="mt-4 flex items-center gap-2 px-4 py-2 bg-white border border-line text-deep rounded-lg text-sm font-medium hover:bg-wash transition-all">
            <Camera className="w-4 h-4" strokeWidth={1.75} /> Upload Video &amp; Photos
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {videos.length > 0 && (
        <section>
          <div className="eyebrow mb-2">Videos · {videos.length}</div>
          <div className="border border-line rounded-xl divide-y divide-line bg-white overflow-hidden">
            {videos.map((v) => (
              <div key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                <Video className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
                <span className="text-sm font-medium text-ink shrink-0">Video {v.number}</span>
                <span className="mono-ref truncate flex-1">{v.file.name}</span>
                <span className="text-xs text-[#5B6B78] shrink-0">{formatSize(v.file.size)} · {formatDate(v.uploadedAt)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      {scene.length > 0 && (
        <section>
          <div className="eyebrow mb-2">Scene photo sets · {scene.length}</div>
          <div className="space-y-3">{scene.map((s) => <SetBlock key={s.id} set={s} word="Scene Image" />)}</div>
        </section>
      )}
      {medical.length > 0 && (
        <section>
          <div className="eyebrow mb-2">Medical image sets · {medical.length}</div>
          <div className="space-y-3">{medical.map((s) => <SetBlock key={s.id} set={s} word="Medical Image" />)}</div>
        </section>
      )}
      {onUpload && (
        <button onClick={onUpload} className="flex items-center gap-2 px-4 py-2 bg-white border border-line text-deep rounded-lg text-sm font-medium hover:bg-wash transition-all">
          <Camera className="w-4 h-4" strokeWidth={1.75} /> Upload Video &amp; Photos
        </button>
      )}
    </div>
  );
}
