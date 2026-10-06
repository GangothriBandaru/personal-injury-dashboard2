import React, { useState, useRef } from "react";
import { FileTypeIcon, FileTypeTag } from "../components/fileType";
import { StageNavigator } from "../components/StageNavigator";
import { CaseSnapshot } from "../components/CaseSnapshot";
import { Send, Upload, CheckCircle, Circle, ArrowRight, Check, X, FileText, Copy, Download, Eye, Search, ChevronLeft, ChevronDown, Mail, MessageSquare, AlertCircle, AlertTriangle, ListChecks, Bot, Pencil, RefreshCw, Plus, Clock, Info } from "lucide-react";
import { Button } from "../components/ui/button";
import { DocActions, DocumentWorkspaceModal } from "../components/DocumentWorkspace";
import { PipelineState, CaseDocument, classifyDocuments, detectMissingEvidence } from "../types/case";

interface IntakeWorkflowPageProps {
  caseData?: {
    caseName: string;
    caseId: string;
    caseType?: string;
    plaintiff: string;
    summary: string;
    plaintiffEmail?: string;
    plaintiffPhone?: string;
    jurisdiction?: string;
    dateOfIncident?: string;
  };
  pipeline: PipelineState;
  onPipelineUpdate: (updates: Partial<PipelineState>) => void;
  onContinue?: () => void;
  onStageClick?: (stageName: string) => void;
  onBackToIntake?: () => void;
}

const documentCategories = [
  { name: "Medical Records", required: true, enabled: true },
  { name: "Police Report", required: true, enabled: true },
  { name: "Insurance Documents", required: true, enabled: true },
  { name: "Wage Loss Records", required: true, enabled: true },
  { name: "Property Damage Photos", required: false, enabled: false },
  { name: "Employment Records", required: false, enabled: false },
];

const allRetainerDocuments = [
  { name: "PI_Retainer_Agreement.pdf", date: "Jun 8, 2026", status: "Sent", source: "Attorney" },
  { name: "Signed_PI_Retainer_Agreement.pdf", date: "Jun 10, 2026", status: "Signed", source: "Plaintiff" },
];

const intakeDocuments = [
  { name: "prakash_medical_records.pdf", source: "Plaintiff", status: "Processed" },
  { name: "MRI_Report_2026.pdf", source: "Plaintiff", status: "Processed" },
  { name: "hospital_invoice.pdf", source: "Plaintiff", status: "Processed" },
  { name: "ER_Bills.pdf", source: "Plaintiff", status: "Processed" },
  { name: "physical_therapy_notes.pdf", source: "Plaintiff", status: "Processed" },
  { name: "medication_list.pdf", source: "Plaintiff", status: "Processing" },
  { name: "police_report_final.pdf", source: "Plaintiff", status: "Processed" },
  { name: "accident_scene_photo_1.jpg", source: "Plaintiff", status: "Processed" },
  { name: "accident_scene_photo_2.jpg", source: "Plaintiff", status: "Processed" },
  { name: "insurance_policy_v2.pdf", source: "Attorney", status: "Processing" },
  { name: "Insurance_Claim_Form.pdf", source: "Attorney", status: "Processed" },
  { name: "employment_verification.pdf", source: "Plaintiff", status: "Processed" },
  { name: "wage_loss_statement.pdf", source: "Plaintiff", status: "Processed" },
  { name: "witness_statement.pdf", source: "Attorney", status: "Processed" },
];

const documentProgress = [
  { name: "Medical Records", complete: true },
  { name: "Insurance Documents", complete: true },
  { name: "Police Report", complete: false },
  { name: "Wage Loss Records", complete: false },
];

const activityLog = [
  { date: "Jun 8", event: "Intake Request Sent" },
  { date: "Jun 20", event: "Follow-up Request Sent" },
];

const retainerTemplates = [
  {
    id: "standard-pi",
    name: "Standard Personal Injury Retainer",
    lastUpdated: "May 15, 2026",
    createdBy: "Legal Team",
  },
  {
    id: "medical-malpractice",
    name: "Medical Malpractice Retainer",
    lastUpdated: "Apr 22, 2026",
    createdBy: "Jennifer Davis",
  },
  {
    id: "wrongful-death",
    name: "Wrongful Death Retainer",
    lastUpdated: "Mar 10, 2026",
    createdBy: "Legal Team",
  },
  {
    id: "truck-accident",
    name: "Truck Accident Retainer",
    lastUpdated: "Feb 5, 2026",
    createdBy: "Michael Chen",
  },
  {
    id: "custom",
    name: "Custom Retainer Agreement",
    lastUpdated: "Jan 12, 2026",
    createdBy: "Legal Team",
  },
];

// Bottom-of-tab navigation: a short "what's next" line + a primary CTA that
// advances to the next tab (or the next stage on the final tab).
function NextStepBox({ text, ctaLabel, onClick }: { text: string; ctaLabel: string; onClick?: () => void }) {
  return (
    <div className="lg-card flex items-center justify-between gap-4 px-6 py-5">
      <div className="min-w-0">
        <div className="eyebrow mb-1">Next</div>
        <p className="body-text">{text}</p>
      </div>
      <button
        onClick={onClick}
        className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand hover:bg-deep text-white text-sm font-semibold transition-all"
      >
        {ctaLabel} <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

export function IntakeWorkflowPage({ caseData, pipeline, onPipelineUpdate, onContinue, onStageClick, onBackToIntake }: IntakeWorkflowPageProps) {
  // Default case data if none provided
  const defaultCaseData = {
    caseName: "Estate of Miller vs Logistics Co.",
    caseId: "PI-2024-001",
    caseType: "Medical Malpractice",
    caseSubType: "Delayed Treatment",
    plaintiff: "Evelyn Miller",
    summary: "Delayed stroke response and negligent medication management at a memory care facility resulting in severe neurological injury.",
    plaintiffEmail: "evelyn.miller@gmail.com",
    plaintiffPhone: "(555) 123-4567",
    jurisdiction: "Cook County, IL",
    dateOfIncident: "Feb 14, 2026",
  };

  const data = { ...defaultCaseData, ...caseData };

  // Default expansion reflects the active blocker: open the Retainer while it is
  // unsigned, otherwise focus the Documents once the case has files. Intake stays
  // collapsed to a single-row summary by default.
  const [accordionOpen, setAccordionOpen] = useState({
    retainer: pipeline.retainerStatus !== "signed",
    request: false,
    documents: pipeline.retainerStatus === "signed" && pipeline.documents.length > 0,
  });
  const toggleAccordion = (key: "retainer" | "request" | "documents") =>
    setAccordionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  // Workspace tabs: the three collection sections are shown one at a time via a
  // top tab bar instead of stacked accordions, so switching the tab swaps the
  // panel below rather than forcing a long vertical scroll.
  const [activeTab, setActiveTab] = useState<"retainer" | "request" | "documents">(
    pipeline.retainerStatus !== "signed"
      ? "retainer"
      : pipeline.documents.length > 0
        ? "documents"
        : "retainer"
  );
  const [documents, setDocuments] = useState(documentCategories);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [recipientEmail, setRecipientEmail] = useState(data.plaintiffEmail || "");
  const [secureLink] = useState(pipeline.intakeLink);
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"email" | "sms">(
    data.plaintiffEmail ? "email" : "sms"
  );
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [editableEmail, setEditableEmail] = useState(data.plaintiffEmail || "");
  const [editablePhone, setEditablePhone] = useState(data.plaintiffPhone || "(555) 123-4567");

  const clientPhone = editablePhone;
  const hasEmail = !!data.plaintiffEmail;
  const hasPhone = !!clientPhone;
  const hasContact = hasEmail || hasPhone;

  // Pipeline-derived state (shared)
  const intakeCreated = pipeline.intakeCreated;
  const intakeSent = pipeline.intakeSent;
  const retainerStatus = pipeline.retainerStatus;

  const setIntakeCreated = (v: boolean) => onPipelineUpdate({ intakeCreated: v });
  const setIntakeSent = (v: boolean) => onPipelineUpdate({ intakeSent: v });
  const setRetainerStatus = (v: "not-sent" | "sent" | "signed") => onPipelineUpdate({ retainerStatus: v });

  // Local retainer UI state
  const [retainerEmail, setRetainerEmail] = useState(data.plaintiffEmail || "");
  const [retainerPhone, setRetainerPhone] = useState("");
  const [retainerSentDate, setRetainerSentDate] = useState("Jun 8, 2026");
  const [retainerSignedDate, setRetainerSignedDate] = useState("");
  const [retainerLink] = useState("https://leco.ai/retainer/RET29...");
  const [showMarkSignedModal, setShowMarkSignedModal] = useState(false);
  const [showSendRetainerModal, setShowSendRetainerModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [agreementUploaded, setAgreementUploaded] = useState(false);
  const [showUploadAgreementModal, setShowUploadAgreementModal] = useState(false);
  const [showGenerateNewRetainerModal, setShowGenerateNewRetainerModal] = useState(false);
  const [demoRetainerState, setDemoRetainerState] = useState<"sent" | "signed">(pipeline.retainerStatus === "signed" ? "signed" : "sent");
  // Retainer versioning — each generated retainer is its own version, newest first.
  type RetainerVersion = { id: number; status: "Awaiting Signature" | "Signed"; recipient: string; template: string; sentDate: string; signedDate?: string; signedDocName?: string; sentDocName?: string };
  const [retainerVersions, setRetainerVersions] = useState<RetainerVersion[]>([]);
  // Status filter for the multi-retainer view (header control). Single retainer keeps the demo toggle.
  const [retainerFilter, setRetainerFilter] = useState<"all" | "Awaiting Signature" | "Signed">("all");
  const [retainerModalMode, setRetainerModalMode] = useState<"initial" | "new-version">("initial");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [retainerMessage, setRetainerMessage] = useState("");
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  // Which view the Document Workspace opens into: "preview" (80/20 doc + action rail)
  // or "insights" (60/40 doc + AI panel).
  const [workspaceView, setWorkspaceView] = useState<"preview" | "insights">("preview");
  const [editingDocName, setEditingDocName] = useState(false);
  const [editDocNameValue, setEditDocNameValue] = useState("");

  // Intake request multi-request state
  type IntakeStatus = "Draft" | "Sent" | "Opened" | "In Progress" | "Partially Completed" | "Completed" | "Expired" | "Cancelled";
  interface IntakeRequestRecord {
    id: string;
    status: IntakeStatus;
    version: number;
    recipient: string;
    deliveryMethod: "email" | "sms";
    requestedDocs: string[];
    created: string;
    lastSent: string;
    lastModified?: string;
    docsReceived?: number;
    missingDocs?: number;
  }
  const [intakeRequests, setIntakeRequests] = useState<IntakeRequestRecord[]>([]);
  // Captured once at mount: an existing/progressed case arrives with the intake
  // already sent AND its documents already on file, so its intake response is
  // treated as already received. A brand-new case (no documents yet) starts false
  // and only advances through the real send flow.
  const [intakeAlreadySent] = useState(pipeline.intakeSent && pipeline.documents.length > 0);
  const [intakeOverflowOpen, setIntakeOverflowOpen] = useState<string | null>(null);
  const [intakeModalMode, setIntakeModalMode] = useState<"create" | "modify" | "additional">("create");
  const [activeModifyId, setActiveModifyId] = useState<string | null>(null);
  const [showResendModal, setShowResendModal] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [showViewSubmissionModal, setShowViewSubmissionModal] = useState(false);
  const [viewingSubmissionId, setViewingSubmissionId] = useState<string | null>(null);

  // plaintiffActivityDetected is derived after sharedDocs — see below
  const [documentsSubTab, setDocumentsSubTab] = useState<"retainer" | "intake">("intake");
  const [documentSearch, setDocumentSearch] = useState("");
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);

  const toggleDocument = (index: number) => {
    const newDocs = [...documents];
    if (!newDocs[index].required) {
      newDocs[index].enabled = !newDocs[index].enabled;
      setDocuments(newDocs);
    }
  };

  const buildNewRequest = (overrides: Partial<IntakeRequestRecord> = {}): IntakeRequestRecord => ({
    id: `REQ-${String((intakeRequests.length + 1)).padStart(3, "0")}`,
    status: "Sent",
    version: 1,
    recipient: recipientEmail || data.plaintiffEmail || data.plaintiff,
    deliveryMethod: deliveryMethod,
    requestedDocs: documents.filter((d) => d.enabled).map((d) => d.name),
    created: "Jun 8, 2026",
    lastSent: "Jun 8, 2026",
    ...overrides,
  });

  const handleSendRequestFromCard = () => {
    if (!hasContact) { setShowIntakeModal(true); return; }
    setIntakeSent(true);
    setEmailError(false);
    if (intakeRequests.length === 0) {
      setIntakeRequests([buildNewRequest()]);
    }
  };

  const handleSendRequest = () => {
    if (!hasContact) return;
    setIntakeCreated(true);
    setIntakeSent(true);
    setShowIntakeModal(false);
    setEmailError(false);
    if (intakeModalMode === "create") {
      setIntakeRequests([buildNewRequest()]);
    } else if (intakeModalMode === "modify" && activeModifyId) {
      setIntakeRequests((prev) => prev.map((r) =>
        r.id === activeModifyId
          ? { ...r, requestedDocs: documents.filter((d) => d.enabled).map((d) => d.name), recipient: recipientEmail || r.recipient, deliveryMethod, version: r.version + 1, lastModified: "Jun 10, 2026", lastSent: "Jun 10, 2026" }
          : r
      ));
    } else if (intakeModalMode === "additional") {
      const additionalDocs = ["Wage Loss Records", "Employment Records", "Pharmacy Records"];
      const nextId = `REQ-${String(intakeRequests.length + 1).padStart(3, "0")}`;
      setIntakeRequests((prev) => [...prev, {
        id: nextId, status: "Sent", version: 1,
        recipient: recipientEmail || data.plaintiffEmail || data.plaintiff,
        deliveryMethod, requestedDocs: additionalDocs,
        created: "Jun 9, 2026", lastSent: "Jun 9, 2026",
      }]);
    }
    setIntakeModalMode("create");
    setActiveModifyId(null);
  };

  const handleCreateForm = () => {
    setIntakeCreated(true);
    setIntakeSent(false);
    setShowIntakeModal(false);
    setEmailError(false);
  };

  const handleModifyRequest = (id: string) => {
    setIntakeModalMode("modify");
    setActiveModifyId(id);
    setEmailError(false);
    setShowIntakeModal(true);
  };

  const handleOpenAdditionalRequest = () => {
    setIntakeModalMode("additional");
    setActiveModifyId(null);
    setShowIntakeModal(true);
  };

  const handleMarkCompleted = (id: string) => {
    setIntakeRequests((prev) => prev.map((r) =>
      r.id === id ? { ...r, status: "Completed", docsReceived: 8, missingDocs: 1 } : r
    ));
  };

  const handleOpenResend = (id: string) => {
    setResendingId(id);
    setShowResendModal(true);
  };

  const handleConfirmResend = () => {
    if (resendingId) {
      setIntakeRequests((prev) => prev.map((r) =>
        r.id === resendingId ? { ...r, lastSent: "Jun 10, 2026" } : r
      ));
    }
    setShowResendModal(false);
    setResendingId(null);
  };

  const handleCreateAdditionalRequest = () => {
    handleOpenAdditionalRequest();
  };

  const handleCopyLink = () => {
    // Fallback method for when Clipboard API is blocked
    const textArea = document.createElement("textarea");
    textArea.value = secureLink;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
    textArea.remove();
  };

  const handleOpenFollowUp = () => {
    const missing = missingDocuments.join("\n• ");
    setFollowUpMessage(
      `Hello ${data.plaintiff},\n\nWe're still waiting for the following documents to continue processing your case:\n\n• ${missing}\n\nPlease upload them using your secure intake link.\n\nThank you.`
    );
    setShowFollowUpModal(true);
  };

  const handleSendFollowUp = () => {
    setShowFollowUpModal(false);
  };

  const handleOpenSendRetainerModal = () => {
    setRetainerModalMode("initial");
    setRetainerMessage(
      `Hello ${data.plaintiff},\n\nPlease review and sign the attached retainer agreement to begin representation.\n\nThank you.`
    );
    setShowSendRetainerModal(true);
  };

  // Generate New Retainer → opens the same creation flow used during initial setup.
  // Nothing is created until the attorney explicitly clicks "Send Retainer".
  const handleGenerateNewRetainer = () => {
    setRetainerModalMode("new-version");
    setSelectedTemplate("");
    setRetainerMessage(
      `Hello ${data.plaintiff},\n\nPlease review and sign the attached retainer agreement to begin representation.\n\nThank you.`
    );
    setShowSendRetainerModal(true);
  };

  const handleSendRetainer = () => {
    const template = retainerTemplates.find((t) => t.id === selectedTemplate);
    const templateName = template ? template.name : (selectedTemplateName || "Personal Injury Retainer Agreement v1");
    setSelectedTemplateName(templateName);
    const recipient = retainerEmail || data.plaintiffEmail || data.plaintiff;

    if (retainerModalMode === "new-version") {
      // Preserve the existing signed retainer as version #1 and add a new
      // "Awaiting Signature" version above it.
      setRetainerVersions((prev) => {
        const base: RetainerVersion[] = prev.length > 0 ? prev : [{
          id: 1,
          status: "Signed",
          recipient: retainerEmail || data.plaintiffEmail || data.plaintiff,
          template: selectedTemplateName || "Personal Injury Retainer Agreement v1",
          sentDate: retainerSentDate || "Jun 9, 2026",
          signedDate: retainerSignedDate || "Jun 11, 2026",
          signedDocName: "Signed_PI_Retainer.pdf",
          sentDocName: "PI_Retainer_Agreement.pdf",
        }];
        const nextId = Math.max(...base.map((r) => r.id)) + 1;
        return [...base, { id: nextId, status: "Awaiting Signature", recipient, template: templateName, sentDate: "Jun 12, 2026", sentDocName: "PI_Retainer_Agreement.pdf" }];
      });
      setRetainerStatus("signed");
    } else {
      setRetainerStatus("sent");
      setDemoRetainerState("sent");
      setRetainerSentDate("Jun 9, 2026");
    }
    setRetainerModalMode("initial");
    setShowSendRetainerModal(false);
  };

  const handlePreviewTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    setShowPreviewModal(true);
  };

  const handleMarkAsSigned = () => {
    setShowMarkSignedModal(true);
  };

  const handleConfirmSigned = () => {
    setRetainerStatus("signed");
    setDemoRetainerState("signed");
    setRetainerSignedDate("Jun 9, 2026");
    setAgreementUploaded(true);
    setShowMarkSignedModal(false);
  };

  const handleAddLater = () => {
    setRetainerStatus("signed");
    setDemoRetainerState("signed");
    setRetainerSignedDate("Jun 9, 2026");
    setAgreementUploaded(false);
    setShowMarkSignedModal(false);
  };

  const handleUploadAgreement = () => {
    setAgreementUploaded(true);
  };

  const handleResendRetainer = () => {
    setRetainerSentDate("Jun 9, 2026");
  };

  // Preview and Insights open the same unified Document Workspace into different views:
  // Preview = 80/20 document + action rail; Insights = 60/40 document + AI panel.
  const openDocumentWorkspace = (document: any, view: "preview" | "insights" = "preview") => {
    setSelectedDocument(document);
    setWorkspaceView(view);
    setShowDocumentPreview(true);
    setOpenActionMenu(null);
  };
  const handlePreviewDocument = (document: any) => openDocumentWorkspace(document, "preview");
  const handleOpenInsights = (document: any) => openDocumentWorkspace(document, "insights");

  const handleDownloadDocument = (_document: any) => {
    // Prototype: direct download is a no-op stand-in for the real file export.
    setOpenActionMenu(null);
  };

  // Shared uploaded documents (pipeline state)
  const sharedDocs = pipeline.documents;
  const plaintiffActivityDetected = sharedDocs.length > 0;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFileNames, setUploadedFileNames] = useState<string[]>([]);
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const existing = new Set(sharedDocs.map((d) => d.name));
    const newDocs: typeof sharedDocs = files
      .filter((f) => !existing.has(f.name))
      .map((f) => ({
        id: `${Date.now()}-${f.name}`,
        name: f.name,
        source: "Attorney" as const,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        status: "Processed" as const,
      }));
    if (newDocs.length > 0) {
      onPipelineUpdate({ documents: [...sharedDocs, ...newDocs] });
      setUploadedFileNames(newDocs.map((d) => d.name));
      setShowUploadSuccess(true);
    }
    e.target.value = "";
  };

  const handleSimulateUpload = (source: "Plaintiff" | "Attorney") => {
    const simulatedBatch: CaseDocument[] = [
      { id: `${Date.now()}-1`, name: "MRI_Report_2026.pdf", source, date: "Jun 9, 2026", status: "Processed" },
      { id: `${Date.now()}-2`, name: "ER_Bills.pdf", source, date: "Jun 9, 2026", status: "Processed" },
      { id: `${Date.now()}-3`, name: "police_report_final.pdf", source, date: "Jun 9, 2026", status: "Processed" },
      { id: `${Date.now()}-4`, name: "physical_therapy_notes.pdf", source, date: "Jun 9, 2026", status: "Processed" },
      { id: `${Date.now()}-5`, name: "insurance_policy_v2.pdf", source: "Attorney", date: "Jun 9, 2026", status: "Processed" },
      { id: `${Date.now()}-6`, name: "witness_statement.pdf", source: "Attorney", date: "Jun 9, 2026", status: "Processed" },
    ];
    const existing = new Set(sharedDocs.map((d) => d.name));
    const newDocs = simulatedBatch.filter((d) => !existing.has(d.name));
    if (newDocs.length > 0) onPipelineUpdate({ documents: [...sharedDocs, ...newDocs] });
  };

  const filteredIntakeDocuments = sharedDocs.filter((doc) =>
    doc.name.toLowerCase().includes(documentSearch.toLowerCase())
  );

  // Classification derived from shared docs
  const classifiedCategories = classifyDocuments(sharedDocs);
  const classifiedCount = classifiedCategories.reduce((n, c) => n + c.docs.length, 0);
  const missingEvidence = detectMissingEvidence(classifiedCategories);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const toggleCategory = (name: string) =>
    setExpandedCategories((prev) => ({ ...prev, [name]: prev[name] === false ? true : false }));
  const isCategoryExpanded = (name: string) => expandedCategories[name] !== false;

  // Missing evidence request modal
  const [showMissingRequestModal, setShowMissingRequestModal] = useState(false);
  const [missingCheckedDocs, setMissingCheckedDocs] = useState<Record<string, boolean>>({});
  const [missingDeliveryMethod, setMissingDeliveryMethod] = useState<"email" | "sms">("email");
  const [missingMessageText, setMissingMessageText] = useState("");

  const generateMissingMessage = (docs: string[]) =>
    `Hello ${data.plaintiff},\n\nWe are currently reviewing your case and require additional documents to continue our evaluation.\n\nRequested Documents:\n${docs.map((d) => `• ${d}`).join("\n")}\n\nPlease upload the requested documents using your secure intake link.\n\nIf you have any questions or are unable to obtain a document, please contact our office.\n\nThank you,\nJennifer Davis\nLexGuard Injury Intel`;

  const openMissingRequestModal = () => {
    const allTitles = missingEvidence.map((m) => m.title);
    setMissingCheckedDocs(Object.fromEntries(allTitles.map((t) => [t, true])));
    setMissingMessageText(generateMissingMessage(allTitles));
    setShowMissingRequestModal(true);
  };

  const handleMissingDocCheck = (title: string, checked: boolean) => {
    const next = { ...missingCheckedDocs, [title]: checked };
    setMissingCheckedDocs(next);
    const selected = missingEvidence.filter((m) => next[m.title]).map((m) => m.title);
    setMissingMessageText(generateMissingMessage(selected));
  };

  const selectedMissingTitles = missingEvidence.filter((m) => missingCheckedDocs[m.title]).map((m) => m.title);

  const handleCopyRetainerLink = () => {
    const textArea = document.createElement("textarea");
    textArea.value = retainerLink;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand("copy");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
    textArea.remove();
  };

  const missingDocuments = documentProgress
    .filter((doc) => !doc.complete)
    .map((doc) => doc.name);

  const allRequiredReceived = documentProgress.every((doc) => doc.complete);

  const requestedDocumentsCount = documents.filter((doc) => doc.enabled).length;

  // ── Retainer versions (effective list drives the section + checklist) ──
  const synthRetainer: RetainerVersion = {
    id: 1,
    status: retainerStatus === "signed" ? "Signed" : "Awaiting Signature",
    recipient: retainerEmail || data.plaintiffEmail || data.plaintiff,
    template: selectedTemplateName || "Personal Injury Retainer Agreement v1",
    sentDate: retainerSentDate || "Jun 9, 2026",
    signedDate: retainerSignedDate || "Jun 11, 2026",
    signedDocName: "Signed_PI_Retainer.pdf",
    sentDocName: "PI_Retainer_Agreement.pdf",
  };
  const effectiveRetainers: RetainerVersion[] = retainerVersions.length > 0
    ? retainerVersions
    : retainerStatus !== "not-sent" ? [synthRetainer] : [];
  const newestRetainer = effectiveRetainers.reduce<RetainerVersion | null>((a, b) => (a && a.id > b.id ? a : b), null);

  // ── Collection status — derived entirely from real pipeline/intake state ──
  const retainerSigned = effectiveRetainers.some((r) => r.status === "Signed");
  const intakeResponseReceived = intakeRequests.some((r) => r.status === "Completed")
    || (intakeRequests.length === 0 && intakeAlreadySent);
  const documentsReceived = sharedDocs.length > 0;
  const processingComplete = documentsReceived && sharedDocs.every((d) => d.status === "Processed");
  const missingDocCount = missingEvidence.length;
  const missingDocNames = missingEvidence.map((m) => m.title);

  const collectionTasks = [retainerSigned, intakeResponseReceived, processingComplete];
  const completeCount = collectionTasks.filter(Boolean).length;
  const totalTasks = collectionTasks.length;

  const canProceed = retainerSigned && documentsReceived && processingComplete;


  // Sidebar task navigation: expand + scroll to the matching workspace section
  const focusSection = (key: "retainer" | "request" | "documents") => {
    setActiveTab(key);
    setAccordionOpen((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      document.getElementById("workspace-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  // Demo handlers — flip all dependent UI from the per-section header toggles
  const applyDemoRetainer = (state: "sent" | "signed") => {
    setDemoRetainerState(state);
    setRetainerStatus(state === "signed" ? "signed" : "sent");
    if (state === "signed" && !retainerSignedDate) setRetainerSignedDate("Jun 11, 2026");
    // When explicit versions exist, flip the newest version's status.
    setRetainerVersions((prev) => {
      if (prev.length === 0) return prev;
      const maxId = Math.max(...prev.map((r) => r.id));
      return prev.map((r) => r.id === maxId
        ? { ...r, status: state === "signed" ? "Signed" : "Awaiting Signature", signedDate: state === "signed" ? (r.signedDate || "Jun 12, 2026") : r.signedDate, signedDocName: state === "signed" ? (r.signedDocName || "Signed_PI_Retainer.pdf") : r.signedDocName }
        : r);
    });
  };

  const intakeReqCount = intakeRequests[0]?.requestedDocs?.length ?? 0;
  const docsTotal = sharedDocs.length + missingDocCount;

  const collectionTaskList = [
    {
      key: "retainer" as const,
      name: "Retainer",
      Icon: retainerSigned ? CheckCircle : Clock,
      iconColor: retainerSigned ? "text-brand" : "text-amber-600",
      status: retainerSigned ? "Agreement signed" : retainerStatus === "not-sent" ? "Not yet sent" : "Awaiting signature",
      statusColor: retainerSigned ? "text-deep" : "text-amber-700",
      CtaIcon: retainerSigned ? Eye : Mail,
      cta: retainerSigned ? "Preview agreement" : "Send reminder",
      primary: !retainerSigned,
    },
    {
      key: "request" as const,
      name: "Intake request",
      Icon: intakeResponseReceived || intakeSent ? CheckCircle : Circle,
      iconColor: intakeResponseReceived || intakeSent ? "text-brand" : "text-[#9BDAEC]",
      status: intakeResponseReceived ? "Response received" : intakeSent ? `Sent${intakeReqCount ? ` · ${intakeReqCount} requested` : ""}` : "Not yet sent",
      statusColor: intakeResponseReceived || intakeSent ? "text-deep" : "text-[#5B6B78]",
      CtaIcon: Eye,
      cta: intakeResponseReceived ? "View submission" : "View request",
      primary: false,
    },
    {
      key: "documents" as const,
      name: "Documents",
      Icon: processingComplete ? CheckCircle : documentsReceived ? AlertTriangle : Circle,
      iconColor: processingComplete ? "text-brand" : documentsReceived ? "text-amber-600" : "text-[#9BDAEC]",
      status: !documentsReceived ? "Awaiting documents" : missingDocCount > 0 ? `${sharedDocs.length} processed · ${missingDocCount} missing` : `${sharedDocs.length} processed`,
      statusColor: processingComplete ? "text-deep" : documentsReceived ? "text-amber-700" : "text-[#5B6B78]",
      CtaIcon: ListChecks,
      cta: missingDocCount > 0 ? "Check missing docs" : "Review documents",
      primary: false,
    },
  ];

  const blockedParts: string[] = [];
  if (!retainerSigned) blockedParts.push("retainer unsigned");
  if (!documentsReceived) blockedParts.push("no documents");
  else if (missingDocCount > 0) blockedParts.push(`${missingDocCount} docs missing`);
  else if (!processingComplete) blockedParts.push("processing incomplete");
  const blockedSummary = blockedParts.length ? `Blocked: ${blockedParts.join(" · ")}` : "";

  return (
    <div className="min-h-screen bg-wash">
      {/* Context Header */}
      <div className="sticky top-0 z-40 bg-white">
        <div className="max-w-[1400px] mx-auto px-8 py-4">
          <div className="flex items-center gap-4">
            {/* Back Navigation */}
            <button
              onClick={onBackToIntake}
              className="flex items-center gap-2 text-sm text-deep hover:text-ink transition-colors"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
              Back to Case Intake
            </button>

            {/* Breadcrumb */}
            <div className="text-sm text-[#5B6B78] ml-auto">
              Case Intake <span className="mx-2">›</span> <span className="text-ink font-medium">{data.caseName}</span>
            </div>
          </div>
        </div>
      </div>

      <StageNavigator currentStage="Client Intake" onStageClick={onStageClick} />

      <div className="max-w-[1400px] mx-auto p-8 space-y-8">
        {/* Page Header + Global Presenter Control */}
        {/* SECTION 1 — Case Snapshot */}
        <div>
          <h1 className="text-[24px] font-semibold text-ink leading-tight tracking-tight mb-4">Stage 1 · Collection</h1>
          <CaseSnapshot
            caseName={data.caseName}
            caseType={data.caseType}
            caseSubType={(data as any).caseSubType}
            plaintiff={data.plaintiff}
            plaintiffEmail={data.plaintiffEmail}
            plaintiffPhone={data.plaintiffPhone}
            jurisdiction={data.jurisdiction}
            caseId={data.caseId}
            dateOfIncident={data.dateOfIncident}
            summary={data.summary}
          />
        </div>

        {/* SECTION 2 — Main Workspace */}
        {/* flex-row-reverse renders the checklist on the right and the tabs +
            content on the left, while keeping the checklist first in the DOM. */}
        <div className="flex flex-row-reverse gap-6 items-start">
          {/* ── RIGHT SIDEBAR ── */}
          <aside className="w-[320px] shrink-0 sticky top-[150px] space-y-4">
            {/* Collection Checklist */}
            <div className="lg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="card-title">Collection checklist</h3>
                <span className={`pill ${completeCount === totalTasks ? "pill-complete" : "pill-progress"}`}>
                  {completeCount} of {totalTasks}
                </span>
              </div>

              <div className="space-y-3">
                {collectionTaskList.map((t) => (
                  <div key={t.key} className="border border-line rounded-xl p-4">
                    <div className="flex items-start gap-2.5 mb-3">
                      <t.Icon className={`w-[18px] h-[18px] shrink-0 mt-0.5 ${t.iconColor}`} strokeWidth={1.75} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink leading-tight">{t.name}</div>
                        <div className={`text-xs mt-0.5 ${t.statusColor}`}>{t.status}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => (t.onClick ? t.onClick() : focusSection(t.key))}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all bg-tint hover:bg-soft text-deep"
                    >
                      <t.CtaIcon className="w-4 h-4" strokeWidth={1.75} />
                      {t.cta}
                    </button>
                  </div>
                ))}
              </div>

              <div className="border-t border-line my-4" />

              <button
                onClick={canProceed ? onContinue : undefined}
                disabled={!canProceed}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  canProceed
                    ? "bg-brand hover:bg-deep text-white"
                    : "bg-track text-[#8A98A3] cursor-not-allowed"
                }`}
              >
                Proceed to Analysis
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </button>
              {!canProceed && blockedSummary && (
                <p className="text-xs text-[#5B6B78] mt-2.5 text-center">{blockedSummary}</p>
              )}
            </div>
          </aside>

          {/* ── RIGHT WORKSPACE ── */}
          <div className="flex-1 min-w-0 space-y-3">

          {/* ── Workspace tab bar ── */}
          <div id="workspace-tabs" className="lg-card p-1.5 flex items-center gap-1.5 scroll-mt-[150px]">
            {([
              { key: "retainer" as const, label: "Retainer" },
              { key: "request" as const, label: "Intake Request" },
              { key: "documents" as const, label: "Documents" },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? "bg-brand text-white shadow-sm"
                    : "text-[#5B6B78] hover:text-ink hover:bg-wash"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Retainer ── */}
          {activeTab === "retainer" && (<>
          <div id="retainer-section" className="lg-card overflow-hidden scroll-mt-[150px]">
            {/* Section header */}
            <div className="flex items-center justify-between gap-4 px-6 py-5">
              <span className="card-title">Retainer</span>
              <div className="flex items-center gap-3 shrink-0">
                {effectiveRetainers.length > 1 ? (
                  /* Status filter — multiple retainers */
                  <div className="inline-flex items-center bg-track border border-line rounded-lg p-0.5">
                    {([["Awaiting Signature", "Awaiting Signature"], ["Signed", "Signed"], ["all", "All"]] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setRetainerFilter(val)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${retainerFilter === val ? "bg-white text-ink shadow-sm" : "text-[#5B6B78] hover:text-ink"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-line">
                {effectiveRetainers.length === 0 ? (
                  /* ── EMPTY: no retainer sent ── */
                  <div className="text-center py-10 px-6">
                    <div className="inline-flex p-4 bg-tint rounded-full mb-4">
                      <FileText className="w-8 h-8 text-[#5B6B78]" strokeWidth={1.75} />
                    </div>
                    <h3 className="card-title mb-1">No Retainer Agreement Sent</h3>
                    <p className="secondary-text mb-6">Send a retainer agreement to the plaintiff to begin the representation.</p>
                    <div className="flex items-center justify-center gap-3">
                      <Button onClick={handleOpenSendRetainerModal} className="bg-brand hover:bg-deep text-white border-0 gap-2">
                        Send Retainer
                      </Button>
                      <Button onClick={handleMarkAsSigned} className="bg-white border border-line text-ink hover:bg-wash">
                        Upload a Signed doc
                      </Button>
                    </div>
                  </div>

                ) : effectiveRetainers.length === 1 ? (
                  /* ── SINGLE retainer — compact, content directly in the section ── */
                  (() => {
                    const r = effectiveRetainers[0];
                    const signed = r.status === "Signed";
                    const fields = signed
                      ? [
                          { label: "Status", value: "Signed" },
                          { label: "Signed Date", value: r.signedDate || "Jun 11, 2026" },
                          { label: "Recipient", value: r.recipient },
                          { label: "Template", value: r.template },
                        ]
                      : [
                          { label: "Status", value: "Sent" },
                          { label: "Date Sent", value: r.sentDate },
                          { label: "Recipient", value: r.recipient },
                          { label: "Template", value: r.template },
                        ];
                    const docName = signed
                      ? (r.signedDocName || "Signed_PI_Retainer.pdf")
                      : (r.sentDocName || "PI_Retainer_Agreement.pdf");
                    const retainerDoc = { name: docName, source: "Retainer", date: signed ? (r.signedDate || "Jun 11, 2026") : r.sentDate, status: signed ? "Signed" : "Sent" };
                    return (
                      <>
                      <div className="bg-offwhite p-4 space-y-3">
                        {/* Box 1 — info grid */}
                        <div className="bg-white border border-line rounded-xl overflow-hidden">
                          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-line">
                            {fields.map(({ label, value }) => (
                              <div key={label} className="px-5 py-3.5">
                                <div className="eyebrow mb-1">{label}</div>
                                <div className="text-sm font-semibold text-ink truncate">{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Box 2 — document (sent doc while awaiting, signed doc once signed) */}
                        <div className="bg-white border border-line rounded-xl px-5 py-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 bg-tint border border-line rounded-lg flex items-center justify-center shrink-0">
                              <FileTypeIcon name={docName} className="w-4 h-4 text-deep" />
                            </div>
                            <div className="min-w-0">
                              <div className="eyebrow mb-0.5">{signed ? "Signed Document" : "Sent Document"}</div>
                              <div className="mono-ref text-ink flex items-center gap-2">{docName}<FileTypeTag name={docName} /></div>
                            </div>
                          </div>
                          {signed && (
                            <DocActions
                              onPreview={() => handlePreviewDocument(retainerDoc)}
                              onInsights={() => handleOpenInsights(retainerDoc)}
                              onDownload={() => handleDownloadDocument(retainerDoc)}
                            />
                          )}
                        </div>
                      </div>

                        {/* Bottom bar — actions on a white bar */}
                        <div className="flex items-center justify-end gap-3 bg-white border-t border-line px-4 py-3">
                          {signed ? (
                            <button onClick={handleGenerateNewRetainer} className="px-4 py-2 bg-ink hover:bg-deep text-white rounded-lg text-sm font-medium transition-all flex items-center gap-1.5">
                              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} /> Generate New Retainer
                            </button>
                          ) : (
                            <>
                              <button onClick={handleOpenSendRetainerModal} className="px-4 py-2 bg-white border border-line text-ink rounded-lg text-sm font-medium hover:bg-wash transition-all flex items-center gap-1.5">
                                <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} /> Resend
                              </button>
                              <button onClick={() => setShowUploadAgreementModal(true)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-deep transition-all flex items-center gap-1.5">
                                <Upload className="w-3.5 h-3.5" strokeWidth={1.75} /> Upload Agreement
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    );
                  })()

                ) : (
                  /* ── MULTIPLE retainers — each repeats the exact single-retainer card ── */
                  (() => {
                    const sorted = [...effectiveRetainers].sort((a, b) => b.id - a.id);
                    const shown = retainerFilter === "all" ? sorted : sorted.filter((r) => r.status === retainerFilter);
                    return (
                      <div className="bg-wash p-4 space-y-4">
                        {shown.length === 0 ? (
                          <div className="text-center py-8 secondary-text">No retainers match this filter.</div>
                        ) : (
                          shown.map((r) => {
                            const signed = r.status === "Signed";
                            const fields = signed
                              ? [
                                  { label: "Status", value: "Signed" },
                                  { label: "Signed Date", value: r.signedDate || "Jun 11, 2026" },
                                  { label: "Recipient", value: r.recipient },
                                  { label: "Template", value: r.template },
                                ]
                              : [
                                  { label: "Status", value: "Awaiting Signature" },
                                  { label: "Date Sent", value: r.sentDate },
                                  { label: "Recipient", value: r.recipient },
                                  { label: "Template", value: r.template },
                                ];
                            const docName = signed
                              ? (r.signedDocName || "Signed_PI_Retainer.pdf")
                              : (r.sentDocName || "PI_Retainer_Agreement.pdf");
                            const retainerDoc = { name: docName, source: "Retainer", date: signed ? (r.signedDate || r.sentDate) : r.sentDate, status: r.status };
                            return (
                              <div key={r.id} className="border border-line rounded-xl overflow-hidden">
                                <div className="bg-offwhite p-4 space-y-3">
                                  {/* Box 1 — info grid */}
                                  <div className="bg-white border border-line rounded-xl overflow-hidden">
                                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-line">
                                      {fields.map(({ label, value }) => (
                                        <div key={label} className="px-5 py-3.5">
                                          <div className="eyebrow mb-1">{label}</div>
                                          <div className="text-sm font-semibold text-ink truncate">{value}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Box 2 — document (sent doc while awaiting, signed doc once signed) */}
                                  <div className="bg-white border border-line rounded-xl px-5 py-3.5 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="w-8 h-8 bg-tint border border-line rounded-lg flex items-center justify-center shrink-0">
                                        <FileTypeIcon name={docName} className="w-4 h-4 text-deep" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="eyebrow mb-0.5">{signed ? "Signed Document" : "Sent Document"}</div>
                                        <div className="mono-ref text-ink flex items-center gap-2">{docName}<FileTypeTag name={docName} /></div>
                                      </div>
                                    </div>
                                    {signed && (
                                      <DocActions
                                        onPreview={() => handlePreviewDocument(retainerDoc)}
                                        onInsights={() => handleOpenInsights(retainerDoc)}
                                        onDownload={() => handleDownloadDocument(retainerDoc)}
                                      />
                                    )}
                                  </div>
                                </div>

                                {/* Bottom bar — actions only while awaiting signature */}
                                {!signed && (
                                  <div className="flex items-center justify-end gap-3 bg-white border-t border-line px-4 py-3">
                                    <button onClick={handleOpenSendRetainerModal} className="px-4 py-2 bg-white border border-line text-ink rounded-lg text-sm font-medium hover:bg-wash transition-all flex items-center gap-1.5">
                                      <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} /> Resend
                                    </button>
                                    <button onClick={() => setShowUploadAgreementModal(true)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-deep transition-all flex items-center gap-1.5">
                                      <Upload className="w-3.5 h-3.5" strokeWidth={1.75} /> Upload Agreement
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}

                        {/* Section-level action — not attached to any single card */}
                        <div className="flex justify-end pt-1">
                          <button onClick={handleGenerateNewRetainer} className="px-4 py-2 bg-ink hover:bg-deep text-white rounded-lg text-sm font-medium transition-all flex items-center gap-1.5">
                            <Plus className="w-3.5 h-3.5" strokeWidth={1.75} /> Generate New Retainer
                          </button>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
          </div>
          <NextStepBox
            text="Create your intake request to receive the required documents from the plaintiff."
            ctaLabel="Proceed to Intake Request"
            onClick={() => setActiveTab("request")}
          />
          </>
          )}

          {/* ── Intake Request ── */}
          {activeTab === "request" && (<>
          <div id="request-section" className="lg-card overflow-hidden scroll-mt-[150px]">
            <div className="flex items-center justify-between gap-4 px-6 py-5">
              <span className="card-title">Intake Request</span>
              <div className="flex items-center gap-3 shrink-0">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-deep text-white rounded-lg text-xs font-semibold transition-all cursor-pointer">
                  <Upload className="w-3.5 h-3.5" strokeWidth={1.75} />
                  Upload Docs
                  <input type="file" multiple className="hidden" onChange={handleFileInputChange} />
                </label>
              </div>
            </div>
            <div className="border-t border-line p-6 bg-offwhite">
              <div className="space-y-6">
                {!intakeCreated ? (
                  <>
                    {/* Action Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <button
                        onClick={() => setShowIntakeModal(true)}
                        className="lg-card lg-card-i p-8 group text-left"
                      >
                        <div className="space-y-4">
                          <div className="p-4 bg-tint rounded-xl inline-flex">
                            <Send className="w-6 h-6 text-deep" strokeWidth={1.75} />
                          </div>
                          <div>
                            <h3 className="card-title mb-2">Create Intake Form</h3>
                            <p className="secondary-text mb-4">
                              Create a secure intake form that the plaintiff can use to upload documents.
                            </p>
                            <div className="flex items-center gap-2 text-deep font-medium text-sm group-hover:gap-3 transition-all">
                              Create Intake Form
                              <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
                            </div>
                          </div>
                        </div>
                      </button>

                      <label className="lg-card lg-card-i p-8 group text-left cursor-pointer block">
                        <div className="space-y-4">
                          <div className="p-4 bg-tint rounded-xl inline-flex">
                            <Upload className="w-6 h-6 text-deep" strokeWidth={1.75} />
                          </div>
                          <div>
                            <h3 className="card-title mb-2">Upload Existing Files</h3>
                            <p className="secondary-text mb-4">
                              Upload documents already received outside LECO.
                            </p>
                            <p className="text-xs text-[#5B6B78] mb-3">
                              Examples: Email attachments • Physical paperwork • Police reports • Hospital records
                            </p>
                            <div className="flex items-center gap-2 text-deep font-medium text-sm group-hover:gap-3 transition-all">
                              Upload Files
                              <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
                            </div>
                          </div>
                        </div>
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => { handleFileInputChange(e); focusSection("documents"); }}
                        />
                      </label>
                    </div>
                  </>
                ) : (
<>
                    <div className="space-y-4">
                      {(intakeRequests.length > 0 ? intakeRequests : [buildNewRequest(intakeAlreadySent ? { id: "REQ-001", status: "Completed", docsReceived: 8, missingDocs: 1 } : { id: "REQ-001", status: intakeSent ? "Sent" : "Draft" as any })]).map((req) => {
                        const isCompleted = req.status === "Completed";
                        const isSent = req.status === "Sent" || req.status === "Draft";
                        const statusColors: Record<string, string> = {
                          Draft: "pill pill-neutral",
                          Sent: "pill pill-progress",
                          Completed: "pill pill-complete",
                          Expired: "pill pill-risk",
                          Cancelled: "pill pill-neutral",
                        };

                        return (
                          <div key={req.id} className="bg-white border border-line rounded-xl overflow-hidden" onClick={() => intakeOverflowOpen && setIntakeOverflowOpen(null)}>

                            {/* Card header */}
                            <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-line">
                              <div className="flex items-center gap-2.5">
                                <span className="mono-ref font-bold">{req.id}</span>
                                {req.version > 1 && <span className="text-xs text-[#5B6B78] bg-white border border-line px-1.5 py-0.5 rounded font-mono">v{req.version}</span>}
                                {!isCompleted && (
                                  <span className={`inline-flex items-center gap-1 ${statusColors[req.status] ?? "pill pill-neutral"}`}>
                                    <Clock className="w-3 h-3" strokeWidth={1.75} />
                                    {req.status}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                {isCompleted ? (
                                  <>
                                    <span className={`inline-flex items-center gap-1 ${statusColors[req.status] ?? "pill pill-neutral"}`}>
                                      <CheckCircle className="w-3 h-3" strokeWidth={1.75} />
                                      {req.status}
                                    </span>
                                    <button
                                      onClick={() => {
                                        // Redirect to the Documents → Case Evidence tab instead of opening the modal.
                                        setDocumentsSubTab("intake");
                                        setActiveTab("documents");
                                        setTimeout(() => {
                                          document.getElementById("workspace-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
                                        }, 50);
                                      }}
                                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand hover:bg-deep text-white rounded-lg text-sm font-semibold transition-all"
                                    >
                                      <Eye className="w-3.5 h-3.5" strokeWidth={1.75} /> View Submission
                                    </button>
                                  </>
                                ) : isSent ? (
                                  <>
                                    <span className="mono-ref">{req.lastSent}</span>
                                    <button onClick={() => handleModifyRequest(req.id)} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-line text-ink rounded-lg text-sm font-medium hover:bg-wash transition-all">
                                      <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} /> Modify Request
                                    </button>
                                    <button onClick={() => handleOpenResend(req.id)} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-line text-ink rounded-lg text-sm font-medium hover:bg-wash transition-all">
                                      <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} /> Resend
                                    </button>
                                  </>
                                ) : (
                                  <span className="mono-ref">{req.lastSent}</span>
                                )}
                              </div>
                            </div>

                            {isSent ? (
                              /* ── SENT STATE ── */
                              <>
                                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-line border-b border-line">
                                  <div className="px-5 py-4">
                                    <div className="eyebrow mb-1">Recipient</div>
                                    <div className="text-sm font-semibold text-ink truncate">{req.recipient}</div>
                                  </div>
                                  <div className="px-5 py-4">
                                    <div className="eyebrow mb-1">Delivery</div>
                                    <div className="text-sm font-semibold text-ink capitalize">{req.deliveryMethod}</div>
                                  </div>
                                  <div className="px-5 py-4">
                                    <div className="eyebrow mb-1">Documents Requested</div>
                                    <div className="text-sm font-semibold text-ink">{req.requestedDocs.length}</div>
                                  </div>
                                  <div className="px-5 py-4">
                                    <div className="eyebrow mb-1">Documents</div>
                                    <div className="space-y-0.5">
                                      {req.requestedDocs.slice(0, 3).map((d) => <div key={d} className="text-xs text-[#5B6B78] truncate">• {d}</div>)}
                                      {req.requestedDocs.length > 3 && <div className="text-xs text-[#5B6B78]">+{req.requestedDocs.length - 3} more</div>}
                                    </div>
                                  </div>
                                </div>
                                {req.lastModified && (
                                  <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
                                    Last modified {req.lastModified}
                                  </div>
                                )}
                              </>
                            ) : (
                              /* ── COMPLETED STATE ── */
                              <>
                                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-line border-b border-line">
                                  <div className="px-5 py-4">
                                    <div className="eyebrow mb-1">Status</div>
                                    <div className="text-sm font-semibold text-ink">Completed</div>
                                  </div>
                                  <div className="px-5 py-4">
                                    <div className="eyebrow mb-1">Recipient</div>
                                    <div className="text-sm font-semibold text-ink truncate">{req.recipient}</div>
                                  </div>
                                  <div className="px-5 py-4">
                                    <div className="eyebrow mb-1">Documents Received</div>
                                    <div className="kpi-value">{req.docsReceived ?? 8}</div>
                                  </div>
                                  <div className="px-5 py-4">
                                    <div className="eyebrow mb-1">Missing Documents</div>
                                    <div className="kpi-value text-amber-600">{req.missingDocs ?? 1}</div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* In the response-received state: Create Additional Request (left) + Upload (right), equal halves. */}
                    <div className={`grid gap-6 items-start ${intakeResponseReceived ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                    {intakeResponseReceived && (() => {
                      const disableAdditional = intakeRequests.some((r) => r.id !== "REQ-001");
                      return (
                        <div className="lg-card p-6">
                          <h3 className="card-title mb-2">Create Additional Request</h3>
                          <p className="secondary-text mb-4">
                            Send another document request to the plaintiff for additional records.
                          </p>
                          <button
                            onClick={handleOpenAdditionalRequest}
                            disabled={disableAdditional}
                            title={disableAdditional ? "An additional request has already been created" : undefined}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${disableAdditional ? "bg-white border border-line text-gray-300 cursor-not-allowed" : "bg-white border border-line text-deep hover:bg-wash"}`}
                          >
                            <Plus className="w-4 h-4" strokeWidth={1.75} />
                            Create Additional Request
                          </button>
                        </div>
                      );
                    })()}

                    {/* Attorney Upload Section */}
                    <div className="lg-card p-6">
                      <h3 className="card-title mb-2">Upload Existing Files</h3>
                      <p className="secondary-text mb-4">
                        Add documents already received outside the LECO intake process.
                      </p>

                      {showUploadSuccess && (
                        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" strokeWidth={1.75} />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-green-800 mb-1">
                                {uploadedFileNames.length} file{uploadedFileNames.length > 1 ? "s" : ""} uploaded successfully
                              </p>
                              <ul className="space-y-0.5">
                                {uploadedFileNames.map((name) => (
                                  <li key={name} className="text-xs text-green-700 font-mono">{name}</li>
                                ))}
                              </ul>
                              <button
                                onClick={() => focusSection("documents")}
                                className="mt-2 text-xs font-medium text-green-700 underline hover:text-green-900 transition-colors"
                              >
                                View in Documents tab →
                              </button>
                            </div>
                            <button
                              onClick={() => setShowUploadSuccess(false)}
                              className="text-green-400 hover:text-green-600 transition-colors"
                            >
                              <X className="w-4 h-4" strokeWidth={1.75} />
                            </button>
                          </div>
                        </div>
                      )}

                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileInputChange}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-line text-deep rounded-lg text-sm font-medium hover:bg-wash transition-all"
                      >
                        <Upload className="w-4 h-4" strokeWidth={1.75} />
                        Upload Files
                      </button>
                    </div>
                    </div>
                  </>
                )}
              </div>
              </div>
          </div>
          <NextStepBox
            text="Review and verify the collected documents, then continue to evidence analysis."
            ctaLabel="Proceed to Documents"
            onClick={() => setActiveTab("documents")}
          />
          </>
          )}

          {/* ── Documents ── */}
          {activeTab === "documents" && (<>
          <div id="documents-section" className="lg-card overflow-hidden scroll-mt-[150px]">
            <div className="w-full flex items-center justify-between gap-4 px-6 py-5">
              <div className="flex items-center gap-3">
                <span className="card-title">Documents</span>
              </div>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-deep text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0">
                <Upload className="w-3.5 h-3.5" strokeWidth={1.75} />
                Upload Documents
                <input type="file" multiple className="hidden" onChange={handleFileInputChange} />
              </label>
            </div>
            <div className="border-t border-line p-6 bg-offwhite">
              <div className="space-y-6">
                {/* UPLOAD SUCCESS FEEDBACK */}
                {showUploadSuccess && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" strokeWidth={1.75} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-green-800 mb-1">
                          {uploadedFileNames.length} file{uploadedFileNames.length > 1 ? "s" : ""} uploaded successfully
                        </p>
                        <ul className="space-y-0.5">
                          {uploadedFileNames.map((name) => (
                            <li key={name} className="text-xs text-green-700 font-mono truncate">{name}</li>
                          ))}
                        </ul>
                      </div>
                      <button
                        onClick={() => setShowUploadSuccess(false)}
                        className="text-green-400 hover:text-green-600 transition-colors"
                      >
                        <X className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                )}

                {/* MISSING DOCUMENTS BLOCK */}
                {documentsReceived && missingDocCount > 0 && (
                  <div className="rounded-xl p-5" style={{ background: "#FAEEDA", border: "1px solid #FAC775" }}>
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#854F0B" }} strokeWidth={1.75} />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold mb-1" style={{ color: "#854F0B" }}>
                          {missingDocCount} Document{missingDocCount === 1 ? "" : "s"} Still Missing
                        </h3>
                        <ul className="space-y-0.5 mb-4">
                          {missingDocNames.map((name) => (
                            <li key={name} className="text-sm" style={{ color: "#854F0B" }}>• {name}</li>
                          ))}
                        </ul>
                        <button
                          onClick={openMissingRequestModal}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                          style={{ background: "#B45309" }}
                        >
                          <Send className="w-3.5 h-3.5" strokeWidth={1.75} /> Request All Missing
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Documents Sub-Tabs */}
                <div>
                  <div className="flex items-center gap-1 mb-4">
                    {([["intake", "Case evidence"], ["retainer", "Retainer documents"]] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setDocumentsSubTab(val)}
                        className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          documentsSubTab === val
                            ? "bg-tint text-deep"
                            : "text-[#5B6B78] hover:text-ink hover:bg-wash"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div>
                    {documentsSubTab === "retainer" ? (
                      retainerStatus !== "signed" ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <FileText className="w-8 h-8 text-[#9BDAEC] mb-3" strokeWidth={1.75} />
                          <p className="text-sm text-[#5B6B78]">No retainer documents yet.</p>
                          <p className="text-xs text-[#5B6B78] mt-1">Send and sign a retainer agreement to see documents here.</p>
                        </div>
                      ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-wash">
                            <tr className="border-b border-line">
                              <th className="text-left py-3 px-4 eyebrow">
                                Document Name
                              </th>
                              <th className="text-left py-3 px-4 eyebrow">
                                Status
                              </th>
                              <th className="text-left py-3 px-4 eyebrow">
                                Date
                              </th>
                              <th className="text-right py-3 px-4 eyebrow">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line bg-white">
                            {allRetainerDocuments.map((doc, index) => {
                              return (
                              <React.Fragment key={index}>
                              <tr
                                onClick={() => handlePreviewDocument(doc)}
                                className="cursor-pointer hover:bg-wash"
                              >
                                <td className="py-3 px-4 mono-ref text-ink">
                                  <span className="inline-flex items-center gap-2">
                                    <FileTypeIcon name={doc.name} />
                                    {doc.name}
                                    <FileTypeTag name={doc.name} />
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`pill ${
                                      doc.status === "Signed"
                                        ? "pill-complete"
                                        : "pill-progress"
                                    }`}
                                  >
                                    {doc.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-sm text-[#5B6B78]">{doc.date}</td>
                                <td className="py-3 px-4 text-right">
                                  <DocActions
                                    size="sm"
                                    onPreview={() => handlePreviewDocument(doc)}
                                    onInsights={() => handleOpenInsights(doc)}
                                    onDownload={() => handleDownloadDocument(doc)}
                                  />
                                </td>
                              </tr>
                              </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      )
                    ) : (
                      <div className="space-y-4">
                        {sharedDocs.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-14 text-center">
                            <Upload className="w-8 h-8 text-[#9BDAEC] mb-3" strokeWidth={1.75} />
                            <p className="text-sm font-medium text-ink mb-1">No evidence has been received yet.</p>
                            <p className="text-xs text-[#5B6B78] mb-4">Upload documents manually or wait for the plaintiff to complete the intake request.</p>
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="px-4 py-2 bg-brand hover:bg-deep text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              Upload Documents
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* Classification Summary Bar */}
                            <div className="flex items-center justify-between gap-4 bg-tint border border-[#9BDAEC] rounded-xl px-5 py-3">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
                                <span className="text-sm font-semibold text-deep">Document Processing Complete</span>
                              </div>
                              <div className="flex items-center gap-6 text-xs">
                                <div className="text-center">
                                  <div className="font-bold text-ink">{sharedDocs.length}</div>
                                  <div className="text-[#5B6B78]">Processed</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-bold text-ink">{classifiedCount}</div>
                                  <div className="text-[#5B6B78]">Organized</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-bold text-ink">{sharedDocs.length - classifiedCount}</div>
                                  <div className="text-[#5B6B78]">Review</div>
                                </div>
                                <span className="pill pill-neutral">Ready For Analysis</span>
                              </div>
                            </div>

                            {/* Categorized document sections */}
                            {classifiedCategories.map((category) => (
                              <div key={category.name} className="border border-line rounded-xl overflow-hidden">
                                <button
                                  onClick={() => toggleCategory(category.name)}
                                  className="w-full flex items-center justify-between px-5 py-3 bg-wash hover:bg-tint transition-colors text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-ink">{category.name}</span>
                                    <span className="text-xs font-medium text-[#5B6B78] bg-white border border-line px-2 py-0.5 rounded-full">{category.docs.length}</span>
                                  </div>
                                  <ChevronDown className={`w-4 h-4 text-[#5B6B78] transition-transform ${isCategoryExpanded(category.name) ? "" : "-rotate-90"}`} strokeWidth={1.75} />
                                </button>
                                {isCategoryExpanded(category.name) && (
                                  <table className="w-full">
                                    <thead className="bg-white border-b border-line">
                                      <tr>
                                        <th className="text-left px-5 py-2.5 eyebrow">File Name</th>
                                        <th className="text-left px-5 py-2.5 eyebrow">Type</th>
                                        <th className="text-left px-5 py-2.5 eyebrow">Source</th>
                                        <th className="text-left px-5 py-2.5 eyebrow">Date</th>
                                        <th className="text-right px-5 py-2.5 eyebrow">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line bg-white">
                                      {category.docs.map((doc) => {
                                        return (
                                          <tr
                                            key={doc.id}
                                            className="transition-all hover:bg-wash"
                                          >
                                            <td className="px-5 py-3 mono-ref text-ink">
                                              <span className="inline-flex items-center gap-2">
                                                <FileTypeIcon name={doc.name} />
                                                {doc.name}
                                              </span>
                                            </td>
                                            <td className="px-5 py-3"><FileTypeTag name={doc.name} /></td>
                                            <td className="px-5 py-3 text-sm text-[#5B6B78]">{doc.source}</td>
                                            <td className="px-5 py-3 text-sm text-[#5B6B78]">{doc.date}</td>
                                            <td className="px-5 py-3 text-right">
                                              <DocActions
                                                size="sm"
                                                onPreview={() => handlePreviewDocument(doc)}
                                                onInsights={() => handleOpenInsights(doc)}
                                                onDownload={() => handleDownloadDocument(doc)}
                                              />
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Evidence completeness confirmation (gaps are surfaced by the alert above) */}
                {documentsSubTab === "intake" && sharedDocs.length > 0 && missingEvidence.length === 0 && (
                  <div className="lg-card p-6">
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-3" strokeWidth={1.75} />
                      <p className="text-sm font-semibold text-ink mb-1">No Missing Evidence Identified</p>
                      <p className="text-xs text-[#5B6B78]">All expected evidence has been received and processed.</p>
                      <span className="mt-3 pill pill-complete">
                        <CheckCircle className="w-3.5 h-3.5" strokeWidth={1.75} /> Evidence Collection Complete
                      </span>
                    </div>
                  </div>
                )}
              </div>
              </div>
          </div>
          <NextStepBox
            text="Documents collected. Continue to Stage 2 to analyze the evidence and build the case."
            ctaLabel="Proceed to Analysis"
            onClick={onContinue}
          />
          </>
          )}

          </div>{/* end right workspace */}
        </div>{/* end section 2 — main workspace */}
      </div>{/* end page container */}

      {/* Intake Form Modal */}
      {showIntakeModal && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-sm">
            <div className="sticky top-0 bg-white border-b border-line px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="section-header">
                  {intakeModalMode === "modify" ? "Modify Intake Request" : intakeModalMode === "additional" ? "Create Additional Document Request" : "Create Intake Request"}
                </h2>
                <button
                  onClick={() => setShowIntakeModal(false)}
                  className="p-2 hover:bg-tint rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Delivery Method */}
              <div>
                <h3 className="card-title mb-3">Send To</h3>
                {!hasContact ? (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" strokeWidth={1.75} />
                    <p className="text-sm text-amber-700">
                      No contact information is available for this client. Please update client contact information before sending an intake request.
                    </p>
                  </div>
                ) : (
                  <div className="border border-line rounded-xl divide-y divide-line">
                    {hasEmail && (
                      <div className="flex items-center gap-3 px-4 py-3 hover:bg-wash transition-colors">
                        <input
                          type="radio"
                          name="intakeDelivery"
                          value="email"
                          checked={deliveryMethod === "email"}
                          onChange={() => setDeliveryMethod("email")}
                          className="w-4 h-4 accent-brand cursor-pointer"
                        />
                        <Mail className="w-4 h-4 text-[#5B6B78] shrink-0" strokeWidth={1.75} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-ink mb-0.5">Email</div>
                          {editingEmail ? (
                            <input
                              type="email"
                              value={editableEmail}
                              onChange={(e) => setEditableEmail(e.target.value)}
                              autoFocus
                              className="w-full text-xs border border-brand rounded-md px-2 py-1 text-ink focus:outline-none"
                            />
                          ) : (
                            <div className="text-xs text-[#5B6B78]">{editableEmail}</div>
                          )}
                        </div>
                        {editingEmail ? (
                          <button
                            onClick={() => setEditingEmail(false)}
                            className="text-xs font-medium text-deep hover:text-ink shrink-0 transition-colors"
                          >
                            Done
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingEmail(true)}
                            className="text-xs font-medium text-deep hover:text-ink shrink-0 transition-colors"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    )}
                    {hasPhone && (
                      <div className="flex items-center gap-3 px-4 py-3 hover:bg-wash transition-colors">
                        <input
                          type="radio"
                          name="intakeDelivery"
                          value="sms"
                          checked={deliveryMethod === "sms"}
                          onChange={() => setDeliveryMethod("sms")}
                          className="w-4 h-4 accent-brand cursor-pointer"
                        />
                        <MessageSquare className="w-4 h-4 text-[#5B6B78] shrink-0" strokeWidth={1.75} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-ink mb-0.5">SMS</div>
                          {editingPhone ? (
                            <input
                              type="tel"
                              value={editablePhone}
                              onChange={(e) => setEditablePhone(e.target.value)}
                              autoFocus
                              className="w-full text-xs border border-brand rounded-md px-2 py-1 text-ink focus:outline-none"
                            />
                          ) : (
                            <div className="text-xs text-[#5B6B78]">{editablePhone}</div>
                          )}
                        </div>
                        {editingPhone ? (
                          <button
                            onClick={() => setEditingPhone(false)}
                            className="text-xs font-medium text-deep hover:text-ink shrink-0 transition-colors"
                          >
                            Done
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingPhone(true)}
                            className="text-xs font-medium text-deep hover:text-ink shrink-0 transition-colors"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Previously Requested — only for additional mode */}
              {intakeModalMode === "additional" && (
                <div className="lg-zone p-4">
                  <h3 className="text-sm font-semibold text-ink mb-3">Previously Requested</h3>
                  <div className="space-y-1.5">
                    {(intakeRequests[0]?.requestedDocs ?? documents.filter((d) => d.enabled).map((d) => d.name)).map((doc) => (
                      <div key={doc} className="flex items-center gap-2 text-sm text-[#5B6B78]">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" strokeWidth={1.75} /> {doc}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Required Documents */}
              <div>
                <h3 className="card-title mb-4">
                  {intakeModalMode === "additional" ? "Additional Documents to Request" : "Required Documents"}
                </h3>
                <div className="space-y-3">
                  {documents.map((doc, index) => (
                    <div key={doc.name} className="flex items-center gap-3">
                      <button
                        onClick={() => toggleDocument(index)}
                        disabled={doc.required}
                        className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                          doc.enabled
                            ? "bg-brand border-brand"
                            : "bg-white border-line hover:border-soft"
                        } ${doc.required ? "cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {doc.enabled && <Check className="w-3 h-3 text-white" strokeWidth={1.75} />}
                      </button>
                      <span className={`text-sm ${doc.enabled ? "text-ink" : "text-[#5B6B78]"}`}>
                        {doc.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Additional Instructions */}
              <div>
                <h3 className="card-title mb-4">Additional Instructions</h3>
                <textarea
                  rows={4}
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  placeholder="Provide any additional information or supporting documents that may help evaluate your claim."
                  className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm text-ink placeholder:text-[#5B6B78] focus:outline-none focus:border-brand resize-none transition-all"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-line px-6 py-4 rounded-b-xl flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowIntakeModal(false); setEmailError(false); setIntakeModalMode("create"); setActiveModifyId(null); }}
                className="px-4 py-2 text-ink hover:bg-tint rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              {intakeModalMode === "create" && (
                <button onClick={handleCreateForm} className="px-4 py-2 bg-white border border-line text-ink rounded-lg text-sm font-medium hover:bg-wash transition-all">
                  Create Form
                </button>
              )}
              <Button
                onClick={handleSendRequest}
                disabled={!hasContact}
                className="bg-brand hover:bg-deep text-white border-0 gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {intakeModalMode === "modify" ? "Save Changes" : intakeModalMode === "additional" ? "Send Request" : "Send Request"}
                <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Resend Confirmation Modal */}
      {showResendModal && (() => {
        const req = intakeRequests.find((r) => r.id === resendingId) ?? intakeRequests[0];
        return (
          <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-line">
                <h2 className="card-title">Resend Intake Request</h2>
                <button onClick={() => setShowResendModal(false)} className="p-1.5 hover:bg-tint rounded-lg transition-colors">
                  <X className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} />
                </button>
              </div>
              {req && (
                <div className="p-6 space-y-4">
                  <p className="secondary-text">This will resend the existing intake request to the recipient below.</p>
                  <div className="lg-zone divide-y divide-line">
                    <div className="px-4 py-3"><div className="eyebrow mb-0.5">Recipient</div><div className="text-sm font-semibold text-ink">{req.recipient}</div></div>
                    <div className="px-4 py-3"><div className="eyebrow mb-0.5">Delivery Method</div><div className="text-sm font-semibold text-ink capitalize">{req.deliveryMethod}</div></div>
                    <div className="px-4 py-3"><div className="eyebrow mb-0.5">Requested Documents</div><div className="text-sm font-semibold text-ink">{req.requestedDocs.join(", ")}</div></div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 px-6 py-4 bg-wash border-t border-line">
                <button onClick={() => setShowResendModal(false)} className="px-4 py-2 bg-white border border-line text-ink rounded-lg text-sm font-medium hover:bg-wash transition-all">Cancel</button>
                <button onClick={handleConfirmResend} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-deep transition-all flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} /> Resend Request
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* View Submission Modal */}
      {showViewSubmissionModal && (() => {
        const req = intakeRequests.find((r) => r.id === viewingSubmissionId);
        const submittedDocs = ["MRI_Report_2026.pdf", "ER_Bills.pdf", "hospital_medical_records.pdf", "police_report_final.pdf", "physical_therapy_notes.pdf", "insurance_policy_v2.pdf", "witness_statement.pdf", "wage_loss_statement.pdf"];
        return (
          <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl shadow-sm overflow-hidden max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-5 border-b border-line shrink-0">
                <div>
                  <h2 className="card-title">Submission Details</h2>
                  <p className="mono-ref mt-0.5">{req?.id} · Submitted Jun 12, 2026</p>
                </div>
                <button onClick={() => setShowViewSubmissionModal(false)} className="p-1.5 hover:bg-tint rounded-lg transition-colors">
                  <X className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6 space-y-5">
                <div className="grid grid-cols-3 gap-4">
                  {[{ label: "Documents Received", value: "8", color: "text-ink" }, { label: "Missing Documents", value: "1", color: "text-amber-600" }, { label: "Completion", value: "100%", color: "text-green-600" }].map(({ label, value, color }) => (
                    <div key={label} className="bg-wash border border-line rounded-xl p-4 text-center">
                      <div className={`kpi-value ${color} mb-1`}>{value}</div>
                      <div className="text-xs text-[#5B6B78]">{label}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-ink mb-3">Received Documents</h3>
                  <div className="border border-line rounded-xl divide-y divide-line">
                    {submittedDocs.map((doc) => (
                      <div key={doc} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <FileTypeIcon name={doc} className="w-4 h-4 text-[#5B6B78] shrink-0" />
                          <span className="mono-ref text-ink">{doc}</span>
                          <FileTypeTag name={doc} />
                        </div>
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" strokeWidth={1.75} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-4 bg-wash border-t border-line shrink-0">
                <button onClick={() => setShowViewSubmissionModal(false)} className="px-4 py-2 bg-white border border-line text-ink rounded-lg text-sm font-medium hover:bg-wash transition-all">Close</button>
                <button onClick={handleOpenAdditionalRequest} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-deep transition-all flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.75} /> Create Additional Request
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Follow-up Modal */}
      {showFollowUpModal && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-sm">
            <div className="sticky top-0 bg-white border-b border-line px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="section-header">Send Follow-up Request</h2>
                <button
                  onClick={() => setShowFollowUpModal(false)}
                  className="p-2 hover:bg-tint rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Recipient */}
              <div>
                <h3 className="card-title mb-2">Recipient</h3>
                <div className="text-sm text-ink">{recipientEmail}</div>
              </div>

              {/* Missing Documents */}
              <div>
                <h3 className="card-title mb-3">Missing Documents</h3>
                <div className="space-y-2">
                  {missingDocuments.map((doc) => (
                    <div key={doc} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded border bg-brand border-brand flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" strokeWidth={1.75} />
                      </div>
                      <span className="text-sm text-ink">{doc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <h3 className="card-title mb-3">Message</h3>
                <textarea
                  rows={8}
                  value={followUpMessage}
                  onChange={(e) => setFollowUpMessage(e.target.value)}
                  className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm text-ink focus:outline-none focus:border-brand resize-none transition-all"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-line px-6 py-4 rounded-b-xl flex items-center justify-end gap-3">
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="px-4 py-2 text-ink hover:bg-tint rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <Button
                onClick={handleSendFollowUp}
                className="bg-brand hover:bg-deep text-white border-0"
              >
                Send Follow-up
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Send Retainer Modal */}
      {showSendRetainerModal && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-sm">
            <div className="sticky top-0 bg-white border-b border-line px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="section-header">Send Retainer Agreement</h2>
                  <p className="secondary-text mt-1">
                    Select a retainer template and send it to the plaintiff for signature.
                  </p>
                </div>
                <button
                  onClick={() => setShowSendRetainerModal(false)}
                  className="p-2 hover:bg-tint rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Recipient Information */}
              <div>
                <h3 className="card-title mb-4">Recipient Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink mb-2">Plaintiff Name</label>
                    <input
                      type="text"
                      value={data.plaintiff}
                      disabled
                      className="w-full bg-wash border border-line rounded-lg px-4 py-3 text-sm text-[#5B6B78] cursor-not-allowed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink mb-2">Recipient Email</label>
                      <input
                        type="email"
                        value={retainerEmail}
                        onChange={(e) => setRetainerEmail(e.target.value)}
                        className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm text-ink focus:outline-none focus:border-brand transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-ink mb-2">Recipient Phone</label>
                      <input
                        type="tel"
                        value={retainerPhone}
                        onChange={(e) => setRetainerPhone(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm text-ink placeholder:text-[#5B6B78] focus:outline-none focus:border-brand transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Retainer Template */}
              <div>
                <h3 className="card-title mb-4">Retainer Template</h3>
                <div className="space-y-3">
                  {retainerTemplates.map((template) => (
                    <div
                      key={template.id}
                      className={`border rounded-xl p-4 transition-all cursor-pointer ${
                        selectedTemplate === template.id
                          ? "border-brand bg-tint"
                          : "border-line hover:border-soft bg-white"
                      }`}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                selectedTemplate === template.id
                                  ? "border-brand bg-brand"
                                  : "border-line bg-white"
                              }`}
                            >
                              {selectedTemplate === template.id && (
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-ink mb-1">{template.name}</div>
                            <div className="flex items-center gap-4 text-xs text-[#5B6B78]">
                              <span>Last Updated: {template.lastUpdated}</span>
                              <span>•</span>
                              <span>Created By: {template.createdBy}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewTemplate(template.id);
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-deep hover:bg-tint rounded-lg transition-colors"
                        >
                          Preview
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optional Message */}
              <div>
                <h3 className="card-title mb-2">
                  Message to Plaintiff <span className="text-[#5B6B78] font-normal">(Optional)</span>
                </h3>
                <textarea
                  rows={5}
                  value={retainerMessage}
                  onChange={(e) => setRetainerMessage(e.target.value)}
                  placeholder={`Hello ${data.plaintiff},\n\nPlease review and sign the attached retainer agreement to begin representation.\n\nThank you.`}
                  className="w-full bg-white border border-line rounded-lg px-4 py-3 text-sm text-ink placeholder:text-[#5B6B78] focus:outline-none focus:border-brand resize-none transition-all"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-line px-6 py-4 rounded-b-xl flex items-center justify-end gap-3">
              <button
                onClick={() => setShowSendRetainerModal(false)}
                className="px-4 py-2 text-ink hover:bg-tint rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <Button
                onClick={handleSendRetainer}
                disabled={!selectedTemplate || !retainerEmail}
                className="bg-brand hover:bg-deep text-white border-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send Retainer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-sm">
            <div className="sticky top-0 bg-white border-b border-line px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="section-header">Preview Retainer Agreement</h2>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 hover:bg-tint rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} />
                </button>
              </div>
            </div>

            <div className="p-8">
              <div className="bg-white border border-line rounded-lg p-8 max-w-3xl mx-auto">
                {/* Firm Branding */}
                <div className="text-center mb-8">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-10 h-10 bg-ink rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">LG</span>
                    </div>
                    <div className="text-left">
                      <div className="text-lg font-bold text-ink">LexGuard</div>
                      <div className="text-xs text-deep">Injury Intel</div>
                    </div>
                  </div>
                  <div className="text-sm text-[#5B6B78]">123 Legal Ave, Suite 100</div>
                  <div className="text-sm text-[#5B6B78]">Chicago, IL 60601</div>
                  <div className="text-sm text-[#5B6B78]">contact@lexguard.law</div>
                </div>

                {/* Agreement Content */}
                <div className="mb-8">
                  <h3 className="text-xl font-bold text-ink mb-4 text-center">
                    RETAINER AGREEMENT FOR LEGAL SERVICES
                  </h3>
                  <div className="space-y-4 text-sm text-ink">
                    <p>
                      This Retainer Agreement ("Agreement") is entered into on{" "}
                      <span className="font-semibold">[Date]</span> by and between{" "}
                      <span className="font-semibold">LexGuard Legal Group</span> ("Attorney") and{" "}
                      <span className="font-semibold">{data.plaintiff}</span> ("Client").
                    </p>
                    <p className="font-semibold">1. SCOPE OF REPRESENTATION</p>
                    <p>
                      Attorney agrees to represent Client in connection with a personal injury claim arising from
                      incidents described in the case summary. Attorney will provide legal advice, investigate the
                      claim, negotiate with insurance companies, and if necessary, file a lawsuit.
                    </p>
                    <p className="font-semibold">2. ATTORNEY'S FEES</p>
                    <p>
                      Client agrees to pay Attorney a contingency fee equal to 33.33% (one-third) of any recovery
                      obtained through settlement or judgment. If no recovery is obtained, Client owes no attorney
                      fees.
                    </p>
                    <p className="font-semibold">3. COSTS AND EXPENSES</p>
                    <p>
                      Client is responsible for all case-related costs and expenses, including filing fees, expert
                      witness fees, deposition costs, and investigation expenses. These costs will be deducted from
                      any recovery before calculating attorney's fees.
                    </p>
                    <p className="text-[#5B6B78] italic">[Additional terms and conditions...]</p>
                  </div>
                </div>

                {/* Signature Section */}
                <div className="border-t border-line pt-6 mt-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <div className="text-sm font-semibold text-ink mb-4">CLIENT SIGNATURE</div>
                      <div className="border-b-2 border-line mb-2 h-12"></div>
                      <div className="text-xs text-[#5B6B78]">Signature</div>
                      <div className="mt-4">
                        <div className="border-b border-line mb-1 h-8"></div>
                        <div className="text-xs text-[#5B6B78]">Date</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink mb-4">ATTORNEY SIGNATURE</div>
                      <div className="border-b-2 border-line mb-2 h-12"></div>
                      <div className="text-xs text-[#5B6B78]">Signature</div>
                      <div className="mt-4">
                        <div className="border-b border-line mb-1 h-8"></div>
                        <div className="text-xs text-[#5B6B78]">Date</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-line px-6 py-4 rounded-b-xl flex items-center justify-end">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 bg-white border border-line hover:bg-wash text-ink rounded-lg text-sm font-medium transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Missing Document Request Modal */}
      {showMissingRequestModal && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-6 py-5 border-b border-line shrink-0">
              <div>
                <h2 className="section-header">Missing Document Request</h2>
                <p className="text-xs text-[#5B6B78] mt-0.5">Review and approve before sending to client</p>
              </div>
              <button onClick={() => setShowMissingRequestModal(false)} className="p-2 hover:bg-tint rounded-lg transition-colors">
                <X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">
              {/* Missing Documents */}
              <div>
                <h3 className="text-sm font-semibold text-ink mb-1">Missing Documents</h3>
                <p className="text-xs text-[#5B6B78] mb-3">Uncheck any document you do not want to request.</p>
                <div className="border border-line rounded-xl divide-y divide-line">
                  {missingEvidence.map((item) => (
                    <label key={item.title} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-wash transition-colors">
                      <input
                        type="checkbox"
                        checked={!!missingCheckedDocs[item.title]}
                        onChange={(e) => handleMissingDocCheck(item.title, e.target.checked)}
                        className="w-4 h-4 rounded border-line accent-brand"
                      />
                      <div>
                        <div className="text-sm text-ink">{item.title}</div>
                        <div className="text-xs text-[#5B6B78] font-mono">{item.expected}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedMissingTitles.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">Select at least one document to send a request.</p>
                )}
              </div>

              {/* Contact Method */}
              <div>
                <h3 className="text-sm font-semibold text-ink mb-3">Send To</h3>
                <div className="border border-line rounded-xl divide-y divide-line">
                  {data.plaintiffEmail && (
                    <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-wash transition-colors">
                      <input type="radio" name="missingDelivery" value="email" checked={missingDeliveryMethod === "email"} onChange={() => setMissingDeliveryMethod("email")} className="w-4 h-4 accent-brand" />
                      <Mail className="w-4 h-4 text-[#5B6B78] shrink-0" strokeWidth={1.75} />
                      <div>
                        <div className="text-sm text-ink">Email</div>
                        <div className="text-xs text-[#5B6B78]">{data.plaintiffEmail}</div>
                      </div>
                    </label>
                  )}
                  <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-wash transition-colors">
                    <input type="radio" name="missingDelivery" value="sms" checked={missingDeliveryMethod === "sms"} onChange={() => setMissingDeliveryMethod("sms")} className="w-4 h-4 accent-brand" />
                    <MessageSquare className="w-4 h-4 text-[#5B6B78] shrink-0" strokeWidth={1.75} />
                    <div>
                      <div className="text-sm text-ink">SMS</div>
                      <div className="text-xs text-[#5B6B78]">{data.plaintiffPhone || editablePhone}</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Message Preview */}
              <div>
                <h3 className="text-sm font-semibold text-ink mb-1">Message Preview</h3>
                <p className="text-xs text-[#5B6B78] mb-3">This message was generated automatically. You may edit it before sending.</p>
                <textarea
                  value={missingMessageText}
                  onChange={(e) => setMissingMessageText(e.target.value)}
                  rows={10}
                  className="w-full border border-line rounded-xl px-4 py-3 text-sm text-ink leading-relaxed focus:outline-none focus:border-brand transition-colors resize-none bg-wash"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-line shrink-0">
              <Button onClick={() => setShowMissingRequestModal(false)} className="bg-white border border-line text-ink hover:bg-wash">
                Cancel
              </Button>
              <Button
                disabled={selectedMissingTitles.length === 0}
                onClick={() => setShowMissingRequestModal(false)}
                className="bg-brand hover:bg-deep text-white border-0 gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" strokeWidth={1.75} />
                Send Request
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Document Workspace — unified Preview + Insights modal */}
      <DocumentWorkspaceModal
        docs={showDocumentPreview && selectedDocument ? [selectedDocument] : null}
        initialView={workspaceView}
        onClose={() => { setShowDocumentPreview(false); setSelectedDocument(null); }}
        onDownload={() => handleDownloadDocument(selectedDocument)}
      />

      {/* Upload Agreement Modal */}
      {showUploadAgreementModal && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-line">
              <h2 className="card-title">Upload Signed Agreement</h2>
              <button onClick={() => setShowUploadAgreementModal(false)} className="p-1.5 hover:bg-tint rounded-lg transition-colors">
                <X className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="secondary-text">Upload a signed copy of the retainer agreement to attach it to this case.</p>
              <div className="border-2 border-dashed border-line rounded-xl p-8 text-center hover:border-soft transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-[#9BDAEC] mx-auto mb-3" strokeWidth={1.75} />
                <p className="text-sm font-medium text-ink mb-1">Drop file here or click to upload</p>
                <p className="text-xs text-[#5B6B78]">PDF, JPG, PNG up to 20MB</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 bg-wash border-t border-line">
              <button
                onClick={() => { setShowUploadAgreementModal(false); }}
                className="text-sm text-deep hover:text-ink transition-colors"
              >
                Add Later
              </button>
              <div className="flex gap-2">
                <button onClick={() => setShowUploadAgreementModal(false)} className="px-4 py-2 bg-white border border-line text-ink rounded-lg text-sm font-medium hover:bg-wash transition-all">
                  Cancel
                </button>
                <button
                  onClick={() => { setAgreementUploaded(true); applyDemoRetainer("signed"); setShowUploadAgreementModal(false); }}
                  className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-deep transition-all"
                >
                  Upload File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate New Retainer Confirmation Modal */}
      {showGenerateNewRetainerModal && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-line">
              <h2 className="card-title">Generate New Retainer</h2>
              <button onClick={() => setShowGenerateNewRetainerModal(false)} className="p-1.5 hover:bg-tint rounded-lg transition-colors">
                <X className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" strokeWidth={1.75} />
                <p className="text-sm text-amber-800">A signed retainer agreement already exists for this case.</p>
              </div>
              <p className="text-sm text-[#5B6B78]">Generating a new retainer will <strong>not</strong> replace or modify the signed agreement. A new retainer request will be created and tracked separately.</p>
              <p className="text-sm text-[#5B6B78]">The original signed agreement will remain preserved.</p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 bg-wash border-t border-line">
              <button onClick={() => setShowGenerateNewRetainerModal(false)} className="px-4 py-2 bg-white border border-line text-ink rounded-lg text-sm font-medium hover:bg-wash transition-all">
                Cancel
              </button>
              <button
                onClick={() => { setShowGenerateNewRetainerModal(false); handleOpenSendRetainerModal(); }}
                className="px-4 py-2 bg-ink hover:bg-deep text-white rounded-lg text-sm font-medium transition-all"
              >
                Generate New Retainer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark as Signed Modal */}
      {showMarkSignedModal && (
        <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-sm">
            <div className="sticky top-0 bg-white border-b border-line px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="section-header">Mark Retainer as Signed</h2>
                  <p className="secondary-text mt-1">
                    Use this option if the retainer agreement was completed outside LECO.
                  </p>
                </div>
                <button
                  onClick={() => setShowMarkSignedModal(false)}
                  className="p-2 hover:bg-tint rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-[#5B6B78]" strokeWidth={1.75} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div>
                <h3 className="card-title mb-2">
                  Upload Agreement <span className="text-[#5B6B78] font-normal">(Optional)</span>
                </h3>
                <div className="border-2 border-dashed border-line rounded-xl p-8 text-center hover:border-soft hover:bg-tint/50 transition-all cursor-pointer">
                  <Upload className="w-12 h-12 text-[#5B6B78] mx-auto mb-4" strokeWidth={1.75} />
                  <div className="mb-2">
                    <span className="text-sm font-medium text-ink">Drag & Drop</span>
                    <span className="text-sm text-[#5B6B78]"> or </span>
                    <button className="text-sm font-medium text-deep hover:text-ink">
                      Browse Files
                    </button>
                  </div>
                  <p className="text-xs text-[#5B6B78]">
                    Supported: PDF, DOCX, JPG, PNG
                  </p>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-line px-6 py-4 rounded-b-xl flex items-center justify-end gap-3">
              <button
                onClick={handleAddLater}
                className="px-4 py-2 text-ink hover:bg-tint rounded-lg text-sm font-medium transition-colors"
              >
                Add Later
              </button>
              <Button
                onClick={handleConfirmSigned}
                className="bg-brand hover:bg-deep text-white border-0"
              >
                Confirm Signed
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
