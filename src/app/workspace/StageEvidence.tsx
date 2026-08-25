import { useState } from "react";
import { ChevronDown, ArrowRight, FileText, X } from "lucide-react";
import type { CaseDocument } from "../types/case";
import { classifyDocuments } from "../types/case";
import { DocActions } from "../components/DocumentWorkspace";

// ── Stage Evidence ────────────────────────────────────────────────────────────
// Closes every Case Workspace stage with the documents supporting THAT stage —
// not the whole case file. Deliberately reuses the Collection → Documents
// language (collapsible category header, File Name / Source / Date / Actions
// table, DocActions) so it reads as the same surface in a new context.

export interface StageEvidenceHandlers {
  onPreview: (doc: CaseDocument) => void;
  onInsights: (doc: CaseDocument) => void;
  onDownload: (doc: CaseDocument) => void;
}

interface Props extends StageEvidenceHandlers {
  stageLabel: string;      // "Chronology" — names the View All drawer
  docs: CaseDocument[];    // already narrowed to this stage
  narrow?: boolean;        // match stages laid out at max-w-4xl
}

// One collapsible category — same markup as Collection → Documents.
function CategoryBlock({
  name, docs, expanded, onToggle, onPreview, onInsights, onDownload,
}: { name: string; docs: CaseDocument[]; expanded: boolean; onToggle: () => void } & StageEvidenceHandlers) {
  return (
    <div className="border border-line rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3 bg-wash hover:bg-tint transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink">{name}</span>
          <span className="text-xs font-medium text-[#5B6B78] bg-white border border-line px-2 py-0.5 rounded-full">{docs.length}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#5B6B78] transition-transform ${expanded ? "" : "-rotate-90"}`} strokeWidth={1.75} />
      </button>

      {expanded && (
        <>
          {/* Desktop / tablet — full table; tablet tightens the middle columns */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white border-b border-line">
                <tr>
                  <th className="text-left px-5 py-2.5 eyebrow">File Name</th>
                  <th className="text-left px-3 lg:px-5 py-2.5 eyebrow">Source</th>
                  <th className="text-left px-3 lg:px-5 py-2.5 eyebrow">Date</th>
                  <th className="text-right px-5 py-2.5 eyebrow">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-white">
                {docs.map((doc) => (
                  <tr key={doc.id} className="transition-all hover:bg-wash">
                    <td className="px-5 py-3 mono-ref text-ink">{doc.name}</td>
                    <td className="px-3 lg:px-5 py-3 text-sm text-[#5B6B78] whitespace-nowrap">{doc.source}</td>
                    <td className="px-3 lg:px-5 py-3 text-sm text-[#5B6B78] whitespace-nowrap">{doc.date}</td>
                    <td className="px-5 py-3 text-right">
                      <DocActions
                        size="sm"
                        onPreview={() => onPreview(doc)}
                        onInsights={() => onInsights(doc)}
                        onDownload={() => onDownload(doc)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Smaller screens — the same fields stacked as document cards */}
          <div className="md:hidden divide-y divide-line bg-white">
            {docs.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onPreview={onPreview} onInsights={onInsights} onDownload={onDownload} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Stacked row — used on small screens and inside the View All drawer.
function DocumentCard({ doc, onPreview, onInsights, onDownload }: { doc: CaseDocument } & StageEvidenceHandlers) {
  return (
    <div className="px-5 py-3.5">
      <div className="flex items-start gap-2.5">
        <FileText className="w-4 h-4 text-deep shrink-0 mt-0.5" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <div className="mono-ref text-ink break-all">{doc.name}</div>
          <div className="text-sm text-[#5B6B78] mt-0.5">{doc.source} · {doc.date}</div>
        </div>
      </div>
      <div className="mt-2.5">
        <DocActions
          size="sm"
          onPreview={() => onPreview(doc)}
          onInsights={() => onInsights(doc)}
          onDownload={() => onDownload(doc)}
        />
      </div>
    </div>
  );
}

// Group a stage's documents with the same classifier Collection uses, so a
// category means the same thing on both screens.
function groupForStage(docs: CaseDocument[]) {
  return classifyDocuments(docs);
}

export function StageEvidenceSection({ stageLabel, docs, narrow, onPreview, onInsights, onDownload }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [viewAll, setViewAll] = useState(false);
  const categories = groupForStage(docs);
  const handlers = { onPreview, onInsights, onDownload };

  return (
    <>
      <section className={`mt-10 pt-10 border-t border-line space-y-5 ${narrow ? "max-w-4xl" : ""}`}>
        {/* Header — heading + live count + optional View All */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="section-header">Evidence</h2>
            <p className="secondary-text mt-1">Supporting documents and evidence used in this stage.</p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="secondary-text">{docs.length} {docs.length === 1 ? "document" : "documents"}</span>
            {docs.length > 0 && (
              <button
                onClick={() => setViewAll(true)}
                className="inline-flex items-center gap-1 text-sm font-semibold text-deep hover:text-ink transition-colors"
              >
                View All <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>

        {docs.length === 0 ? (
          <div className="lg-card flex flex-col items-center justify-center py-14 text-center px-6">
            <FileText className="w-8 h-8 text-soft mb-3" strokeWidth={1.75} />
            <p className="text-sm font-medium text-ink">No stage-specific evidence yet.</p>
            <p className="secondary-text mt-1 max-w-md">
              Documents added to the case will appear here when they become relevant to this stage.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map((c) => (
              <CategoryBlock
                key={c.name}
                name={c.name}
                docs={c.docs}
                expanded={!collapsed[c.name]}
                onToggle={() => setCollapsed((p) => ({ ...p, [c.name]: !p[c.name] }))}
                {...handlers}
              />
            ))}
          </div>
        )}
      </section>

      {/* View All — stays inside the workspace rather than jumping to Collection */}
      {viewAll && (
        <>
          <div className="fixed inset-0 bg-ink/40 z-[70]" onClick={() => setViewAll(false)} />
          <div className="fixed top-0 right-0 h-full w-[460px] max-w-[92vw] bg-white shadow-xl z-[70] flex flex-col">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-line shrink-0">
              <div className="min-w-0">
                <div className="eyebrow mb-1">Stage Evidence</div>
                <h2 className="card-title">{stageLabel} Evidence</h2>
                <p className="secondary-text mt-1">
                  {docs.length} {docs.length === 1 ? "document" : "documents"} supporting the {stageLabel.toLowerCase()} stage.
                </p>
              </div>
              <button onClick={() => setViewAll(false)} title="Close" className="p-1.5 hover:bg-tint rounded-lg transition-colors shrink-0">
                <X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {categories.map((c) => (
                <div key={c.name} className="border border-line rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-wash">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{c.name}</span>
                      <span className="text-xs font-medium text-[#5B6B78] bg-white border border-line px-2 py-0.5 rounded-full">{c.docs.length}</span>
                    </div>
                  </div>
                  <div className="divide-y divide-line bg-white">
                    {c.docs.map((doc) => (
                      <DocumentCard key={doc.id} doc={doc} {...handlers} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
