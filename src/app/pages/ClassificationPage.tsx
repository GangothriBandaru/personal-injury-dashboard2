import { useState } from "react";
import { FileTypeIcon, FileTypeTag } from "../components/fileType";
import { StageNavigator } from "../components/StageNavigator";
import { CheckCircle, ChevronRight, ArrowRight, AlertCircle, ChevronLeft, FileText, Eye } from "lucide-react";
import { Button } from "../components/ui/button";
import { DocumentWorkspaceModal } from "../components/DocumentWorkspace";

import { CaseDocument, classifyDocuments } from "../types/case";

interface ClassificationPageProps {
  caseData?: {
    caseName: string;
    caseId: string;
    plaintiff: string;
    summary: string;
    jurisdiction?: string;
  };
  documents?: CaseDocument[];
  onStageClick?: (stageName: string) => void;
  onBackToIntake?: () => void;
  onProceedToAnalysis?: () => void;
}

const documentCategories = [
  {
    name: "Medical Records",
    count: 8,
    summary: ["3 MRI Reports", "2 Hospital Admissions", "2 Physical Therapy Records", "1 Medication History"],
    files: [
      { name: "MRI Report.pdf", source: "Plaintiff", date: "Jun 1, 2026", status: "Processed" },
      { name: "ER Admission.pdf", source: "Plaintiff", date: "Jun 1, 2026", status: "Processed" },
      { name: "Surgery Notes.pdf", source: "Plaintiff", date: "Jun 2, 2026", status: "Processed" },
      { name: "Physical Therapy.pdf", source: "Plaintiff", date: "Jun 2, 2026", status: "Processed" },
      { name: "Medication List.pdf", source: "Plaintiff", date: "Jun 3, 2026", status: "Processed" },
      { name: "Treatment Plan.pdf", source: "Attorney", date: "Jun 3, 2026", status: "Processed" },
      { name: "Follow-up Notes.pdf", source: "Plaintiff", date: "Jun 4, 2026", status: "Processed" },
      { name: "Discharge Summary.pdf", source: "Plaintiff", date: "Jun 4, 2026", status: "Processed" },
    ]
  },
  {
    name: "Police Reports",
    count: 1,
    summary: ["1 Accident Report"],
    files: [
      { name: "Accident Report 2024-001.pdf", source: "Plaintiff", date: "Jun 1, 2026", status: "Processed" },
    ]
  },
  {
    name: "Insurance Documents",
    count: 2,
    summary: ["1 Policy Document", "1 Claim Form"],
    files: [
      { name: "Policy Coverage.pdf", source: "Attorney", date: "Jun 2, 2026", status: "Processed" },
      { name: "Claim Form.pdf", source: "Plaintiff", date: "Jun 3, 2026", status: "Processed" },
    ]
  },
  {
    name: "Wage Loss Records",
    count: 1,
    summary: ["1 Employment Verification"],
    files: [
      { name: "Employment Verification.pdf", source: "Plaintiff", date: "Jun 2, 2026", status: "Processed" },
    ]
  },
  {
    name: "Photos & Evidence",
    count: 2,
    summary: ["2 Accident Scene Photos"],
    files: [
      { name: "Accident Scene Photo 1.jpg", source: "Plaintiff", date: "Jun 1, 2026", status: "Processed" },
      { name: "Accident Scene Photo 2.jpg", source: "Plaintiff", date: "Jun 1, 2026", status: "Processed" },
    ]
  },
];

export function ClassificationPage({ caseData, documents = [], onStageClick, onBackToIntake, onProceedToAnalysis }: ClassificationPageProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);

  const defaultCaseData = {
    caseName: "Estate of Miller vs Logistics Co.",
    caseId: "PI-2024-001",
    plaintiff: "Evelyn Miller",
    summary: "Motor vehicle accident resulting in cervical disc herniation and ongoing physical therapy.",
    jurisdiction: "Cook County, IL",
  };

  const data = { ...defaultCaseData, ...caseData };

  // Derive categories from shared documents
  const derivedCategories = classifyDocuments(documents);
  const hasDocuments = documents.length > 0;
  const needsReview = derivedCategories.some((c) => c.name === "General Documents" && c.docs.length > 0);
  const totalDocuments = documents.length;

  const handleDocumentClick = (document: any, category: string) => {
    setSelectedDocument({ ...document, category });
    setShowDocumentPreview(true);
  };

  return (
    <div className="min-h-screen bg-wash">
      {/* Context Header */}
      <div className="bg-white">
        <div className="max-w-[1400px] mx-auto px-8 py-4">
          <div className="flex items-center gap-4">
            {/* Back Navigation */}
            <button
              onClick={onBackToIntake}
              className="flex items-center gap-2 secondary-text hover:text-ink transition-colors"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
              Back to Case Intake
            </button>

            {/* Breadcrumb */}
            <div className="secondary-text ml-auto">
              Case Intake <span className="mx-2">›</span> <span className="text-ink font-medium">{data.caseName}</span>
            </div>
          </div>
        </div>
      </div>

      <StageNavigator currentStage="Classification" onStageClick={onStageClick} />

      <div className="max-w-[1400px] mx-auto p-8">
        {!hasDocuments ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-tint rounded-xl flex items-center justify-center mb-6">
              <FileText className="w-8 h-8 text-[#5B6B78]" strokeWidth={1.75} />
            </div>
            <h2 className="section-header mb-2">No documents available for classification</h2>
            <p className="secondary-text mb-6 max-w-sm">
              LECO will organize evidence automatically once documents are received in the Collection stage.
            </p>
            <button
              onClick={() => onStageClick?.("Client Intake")}
              className="btn btn-primary"
            >
              Back to Collection
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-8">
              <div className="eyebrow inline-flex items-center px-3 py-1 bg-tint border border-line rounded-md text-deep mb-3">
                STAGE 02 ACTIVE
              </div>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h1 className="page-title mb-2">Document Organization & Classification</h1>
                  <p className="body-text">
                    LECO has automatically categorized and indexed all received documents for downstream case intelligence.
                  </p>
                </div>
                <div className="ml-6">
                  <span className="pill pill-complete">
                    <CheckCircle className="w-4 h-4" strokeWidth={1.75} />
                    Documents Organized
                  </span>
                </div>
              </div>
            </div>

            {/* Case Classification Summary */}
            <div className="lg-card p-6 mb-8">
              <h2 className="section-header mb-6">Case Classification Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                <div>
                  <div className="eyebrow mb-1">Case Type</div>
                  <div className="text-sm font-medium text-ink">Medical Malpractice</div>
                </div>
                <div>
                  <div className="eyebrow mb-1">Sub-Type</div>
                  <div className="text-sm font-medium text-ink">Delayed Treatment</div>
                </div>
                <div>
                  <div className="eyebrow mb-1">Incident Date</div>
                  <div className="text-sm font-medium text-ink">Feb 14, 2026</div>
                </div>
                <div>
                  <div className="eyebrow mb-1">Plaintiff</div>
                  <div className="text-sm font-medium text-ink">{data.plaintiff}</div>
                </div>
                <div>
                  <div className="eyebrow mb-1">Classification Confidence</div>
                  <div className="text-sm font-medium text-deep">98%</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2">
                <div className="lg-card p-6">
                  <h2 className="section-header mb-6">Document Categories</h2>

                  <div className="space-y-3">
                    {derivedCategories.map((category) => (
                      <div key={category.name} className="border border-line rounded-xl overflow-hidden">
                        <button
                          onClick={() =>
                            setExpandedCategory(expandedCategory === category.name ? null : category.name)
                          }
                          className="w-full px-6 py-4 flex items-center justify-between hover:bg-wash transition-colors"
                        >
                          <div>
                            <div className="card-title">{category.name}</div>
                            <div className="secondary-text mt-0.5">
                              {category.docs.length} {category.docs.length === 1 ? "Document" : "Documents"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-deep">
                            <span className="text-sm font-medium">
                              {expandedCategory === category.name ? "Hide" : "View"}
                            </span>
                            <ChevronRight
                              strokeWidth={1.75}
                              className={`w-4 h-4 transition-transform ${
                                expandedCategory === category.name ? "rotate-90" : ""
                              }`}
                            />
                          </div>
                        </button>

                        {expandedCategory === category.name && (
                          <div className="px-6 py-4 bg-wash border-t border-line">
                            <ul className="space-y-2">
                              {category.docs.map((file) => (
                                <li key={file.id} className="lg-row flex items-center justify-between px-3 py-2 rounded-lg transition-colors group">
                                  <div className="flex items-center gap-2 flex-1">
                                    <FileTypeIcon name={file.name} className="w-4 h-4 text-[#5B6B78]" />
                                    <span className="text-sm text-ink">{file.name}</span>
                                    <FileTypeTag name={file.name} />
                                    <span className="mono-ref">({file.date})</span>
                                  </div>
                                  <button
                                    onClick={() => handleDocumentClick(file, category.name)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-line rounded-lg text-sm text-deep hover:bg-tint hover:border-soft transition-colors"
                                  >
                                    <Eye className="w-4 h-4" strokeWidth={1.75} />
                                    Preview
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Classification Summary */}
              <div className="lg:col-span-1">
                <div className="sticky top-8">
                {needsReview ? (
                  <div className="lg-card p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <AlertCircle className="w-5 h-5 text-deep mt-0.5" strokeWidth={1.75} />
                      <div>
                        <h3 className="card-title mb-1">Needs Attention</h3>
                        <span className="pill pill-risk">1 Document Requires Review</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="eyebrow mb-1">Filename</div>
                      <div className="mono-ref text-ink">IMG_4458.pdf</div>
                    </div>

                    <button className="btn btn-primary w-full">
                      Review
                    </button>
                  </div>
                ) : (
                  <div className="lg-card p-6">
                    <div className="flex items-start gap-3 mb-6">
                      <CheckCircle className="w-5 h-5 text-deep mt-0.5" strokeWidth={1.75} />
                      <div>
                        <h3 className="card-title mb-1">Classification Complete</h3>
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div>
                        <div className="eyebrow mb-1">Documents Processed</div>
                        <div className="kpi-value">{totalDocuments}</div>
                      </div>

                      <div>
                        <div className="eyebrow mb-1">Successfully Classified</div>
                        <div className="kpi-value">{totalDocuments}</div>
                      </div>

                      <div>
                        <div className="eyebrow mb-1">Require Review</div>
                        <div className="kpi-value">0</div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-line">
                      <div className="eyebrow mb-1">Status</div>
                      <span className="pill pill-complete">Ready For Analysis</span>
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="mt-8 lg-card p-6 flex items-center justify-between">
              <div>
                <h3 className="section-header mb-1">Classification Complete</h3>
                <p className="body-text">
                  All received documents have been organized and verified.
                </p>
              </div>
              <Button
                onClick={onProceedToAnalysis}
                className="btn btn-primary gap-2"
              >
                Continue to Analysis
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Document Workspace — unified Preview (80/20 doc + action rail) modal */}
      <DocumentWorkspaceModal
        docs={showDocumentPreview && selectedDocument ? [selectedDocument] : null}
        initialView="preview"
        onClose={() => { setShowDocumentPreview(false); setSelectedDocument(null); }}
        onDownload={() => {}}
      />
    </div>
  );
}
