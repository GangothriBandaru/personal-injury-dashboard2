import { useState, useEffect } from "react";
import { DashboardSidebar } from "./components/DashboardSidebar";
import { DashboardTopbar } from "./components/DashboardTopbar";
import { GlobalCaseRepoPage } from "./pages/GlobalCaseRepoPage";
import { ClientsPage } from "./pages/ClientsPage";
import { CommunicationPage } from "./pages/CommunicationPage";
import { DemandLibraryPage } from "./pages/DemandLibraryPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { CaseIntakePage } from "./pages/CaseIntakePage";
import { IntakeWorkflowPage } from "./pages/IntakeWorkflowPage";
import { ClassificationPage } from "./pages/ClassificationPage";
import { AnalysisPage } from "./pages/AnalysisPage";
import { InsuranceSummaryPage } from "./pages/InsuranceSummaryPage";
import { InsuranceDetailPage } from "./pages/InsuranceDetailPage";
import { ValuationPage } from "./pages/ValuationPage";
import { CaseReadyPage } from "./pages/CaseReadyPage";
import { CaseWorkspacePage } from "./pages/CaseWorkspacePage";
import { NotesProvider } from "./notes/NotesContext";
import { FloatingNotes } from "./components/FloatingNotes";
import { AssistantProvider } from "./assistant/AssistantContext";
import { ChronologyProvider } from "./chronology/ChronologyContext";
import { DamagesProvider } from "./damages/DamagesContext";
import { FactorsProvider } from "./damages/FactorsContext";
import { PillarsProvider } from "./workspace/PillarsContext";
import { ViolationsProvider } from "./workspace/ViolationsContext";
import { AssistantLauncher, AssistantPanel, AssistantMain } from "./assistant/AiAssistant";
import {
  PipelineState, CaseDocument, AttorneyNote,
  classifyDocuments, generateAnalysisFindings
} from "./types/case";

const INITIAL_PIPELINE: PipelineState = {
  retainerStatus: "not-sent",
  intakeCreated: false,
  intakeSent: false,
  intakeLink: "https://leco.ai/intake/ABX29...",
  documents: [],
  analysisDone: false,
  valuationDone: false,
  notes: [],
};

const EXISTING_CASE_DOCUMENTS: CaseDocument[] = [
  { id: "ec-1", name: "MRI_Report_2026.pdf", source: "Plaintiff", date: "Jun 1, 2026", status: "Processed" },
  { id: "ec-2", name: "ER_Bills.pdf", source: "Plaintiff", date: "Jun 1, 2026", status: "Processed" },
  { id: "ec-3", name: "hospital_medical_records.pdf", source: "Plaintiff", date: "Jun 1, 2026", status: "Processed" },
  { id: "ec-4", name: "police_report_final.pdf", source: "Plaintiff", date: "Jun 2, 2026", status: "Processed" },
  { id: "ec-5", name: "physical_therapy_notes.pdf", source: "Plaintiff", date: "Jun 3, 2026", status: "Processed" },
  { id: "ec-6", name: "insurance_policy_v2.pdf", source: "Attorney", date: "Jun 2, 2026", status: "Processed" },
  { id: "ec-7", name: "witness_statement.pdf", source: "Attorney", date: "Jun 3, 2026", status: "Processed" },
  { id: "ec-8", name: "wage_loss_statement.pdf", source: "Plaintiff", date: "Jun 4, 2026", status: "Processed" },
];

function buildPipelineForCase(caseData: any): PipelineState {
  const stage: string = caseData?.stage ?? "";
  const isNew = !stage || stage === "New" || stage === "Client Intake";

  if (isNew) return INITIAL_PIPELINE;

  // Any case that has progressed past the initial stage already has retainer + intake sent
  const hasDocs = ["Classification", "Analysis", "Valuation", "Ready For Review"].includes(stage);
  const analysisDone = ["Valuation", "Ready For Review"].includes(stage);
  const valuationDone = stage === "Ready For Review";

  return {
    retainerStatus: "signed",
    intakeCreated: true,
    intakeSent: true,
    intakeLink: "https://leco.ai/intake/ABX29...",
    documents: hasDocs ? EXISTING_CASE_DOCUMENTS : [],
    analysisDone,
    valuationDone,
    notes: [],
  };
}

export default function App() {
  const [activePage, setActivePage] = useState("intake");
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [pipeline, setPipeline] = useState<PipelineState>(INITIAL_PIPELINE);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Section of the stage page to land on when returning from a sub-page.
  const [returnToSection, setReturnToSection] = useState<string | undefined>(undefined);
  // The insurance pages are shared by Analysis and Case Ready; this is the
  // stage they were opened from, and the one they return to.
  const [insuranceOrigin, setInsuranceOrigin] = useState<"analysis" | "case-ready" | "workspace">("analysis");
  const openInsurancePage = (page: "insurance" | "insurance-detail") => setActivePage(page);
  const openInsuranceFrom = (origin: "analysis" | "case-ready" | "workspace") => {
    setInsuranceOrigin(origin);
    setActivePage("insurance");
  };
  const backToInsuranceOrigin = () => {
    if (insuranceOrigin === "workspace") {
      // The workspace reopens on Case Overview, where the carrier tile sits at the top.
      setActivePage("workspace");
      setTimeout(() => document.querySelector("main")?.scrollTo(0, 0), 0);
      return;
    }
    setReturnToSection(insuranceOrigin === "case-ready" ? "insurance-deliverable" : "insurance-analysis");
    setActivePage(insuranceOrigin);
  };
  const INSURANCE_BACK_LABEL = {
    analysis: "Back to Analysis",
    "case-ready": "Back to Case Ready",
    workspace: "Back to Case Overview",
  } as const;
  // A return target applies to that one return only.
  useEffect(() => {
    if (activePage !== "analysis" && activePage !== "case-ready") setReturnToSection(undefined);
    // The insurance pages are full pages, so each opens at the top of the
    // scrolling main area rather than wherever the previous page was left.
    if (activePage === "insurance" || activePage === "insurance-detail") {
      document.querySelector("main")?.scrollTo(0, 0);
    }
  }, [activePage]);

  const updatePipeline = (updates: Partial<PipelineState>) => {
    setPipeline((prev) => ({ ...prev, ...updates }));
  };

  // Derived state used across stages
  const categories = classifyDocuments(pipeline.documents);
  const analysisFindings = generateAnalysisFindings(categories);

  const handleOpenWorkflow = (caseData: any) => {
    setSelectedCase(caseData);
    setPipeline(buildPipelineForCase(caseData));
    setActivePage("workflow");
    setSidebarCollapsed(true);
  };

  // Opening the Case Workspace (from the Global Cases page) always lands on a
  // fully-processed, review-ready case so every tab has populated content.
  const handleOpenWorkspace = (caseData: any) => {
    setSelectedCase(caseData);
    setPipeline(buildPipelineForCase({ stage: "Ready For Review" }));
    setActivePage("workspace");
    setSidebarCollapsed(true);
  };

  // Navigating via the sidebar always returns to a top-level page, so expand it.
  const handleNavigate = (page: string) => {
    setActivePage(page);
    setSidebarCollapsed(false);
  };

  const handleStageNavigation = (stageName: string) => {
    const map: Record<string, string> = {
      "Client Intake": "workflow",
      Analysis: "analysis",
      Valuation: "valuation",
      "Case Ready": "case-ready",
    };
    if (map[stageName]) setActivePage(map[stageName]);
  };

  const renderPage = () => {
    switch (activePage) {
      case "workflow":
        return (
          <IntakeWorkflowPage
            caseData={selectedCase}
            pipeline={pipeline}
            onPipelineUpdate={updatePipeline}
            onContinue={() => setActivePage("analysis")}
            onStageClick={handleStageNavigation}
            onBackToIntake={() => setActivePage("intake")}
          />
        );
      case "classification":
        return (
          <ClassificationPage
            caseData={selectedCase}
            documents={pipeline.documents}
            onStageClick={handleStageNavigation}
            onBackToIntake={() => setActivePage("intake")}
            onProceedToAnalysis={() => setActivePage("analysis")}
          />
        );
      case "analysis":
        return (
          <AnalysisPage
            caseData={selectedCase}
            documents={pipeline.documents}
            onStageClick={handleStageNavigation}
            onBackToIntake={() => setActivePage("intake")}
            onProceedToValuation={() => {
              updatePipeline({ analysisDone: true });
              setActivePage("valuation");
            }}
            onOpenInsurance={() => openInsuranceFrom("analysis")}
            scrollToSection={returnToSection}
          />
        );
      case "insurance":
        return (
          <InsuranceSummaryPage
            caseName={selectedCase?.caseName ?? "Case"}
            caseData={selectedCase}
            documents={pipeline.documents}
            backLabel={INSURANCE_BACK_LABEL[insuranceOrigin]}
            onBack={backToInsuranceOrigin}
            onOpenDetail={() => openInsurancePage("insurance-detail")}
          />
        );
      case "insurance-detail":
        return (
          <InsuranceDetailPage
            caseName={selectedCase?.caseName ?? "Case"}
            onBack={() => openInsurancePage("insurance")}
            onBackToAnalysis={backToInsuranceOrigin}
          />
        );
      case "valuation":
        return (
          <ValuationPage
            caseData={selectedCase}
            analysisFindings={analysisFindings}
            onStageClick={handleStageNavigation}
            onBackToIntake={() => setActivePage("intake")}
            onReturnToAnalysis={() => setActivePage("analysis")}
            onProceedToCaseReady={() => {
              updatePipeline({ valuationDone: true });
              setActivePage("case-ready");
            }}
          />
        );
      case "case-ready":
        return (
          <CaseReadyPage
            caseData={selectedCase}
            pipeline={pipeline}
            onPipelineUpdate={updatePipeline}
            onStageClick={handleStageNavigation}
            onBackToIntake={() => setActivePage("intake")}
            onOpenWorkspace={() => { setActivePage("workspace"); setSidebarCollapsed(true); }}
            onOpenInsurance={() => openInsuranceFrom("case-ready")}
            scrollToSection={returnToSection}
          />
        );
      case "workspace":
        return (
          <CaseWorkspacePage
            caseData={selectedCase}
            analysisFindings={analysisFindings}
            documents={pipeline.documents}
            onBackToIntake={() => setActivePage("intake")}
            onNavigateToValuation={() => setActivePage("valuation")}
            onOpenInsurance={() => openInsuranceFrom("workspace")}
          />
        );
      case "intake":
        return <CaseIntakePage onOpenWorkflow={handleOpenWorkflow} />;
      case "cases":
        return <GlobalCaseRepoPage onOpenWorkspace={handleOpenWorkspace} />;
      case "clients":
        return <ClientsPage />;
      case "communication":
        return <CommunicationPage />;
      case "demands":
        return <DemandLibraryPage />;
      case "templates":
        return <TemplatesPage />;
      default:
        return <CaseIntakePage onOpenWorkflow={handleOpenWorkflow} />;
    }
  };

  // Map the active page to the intake-pipeline stage the Notes button reports.
  const STAGE_BY_PAGE: Record<string, string> = {
    workflow: "Collection",
    classification: "Collection",
    analysis: "Analysis",
    insurance: insuranceOrigin === "analysis" ? "Analysis" : "Case Ready",
    "insurance-detail": insuranceOrigin === "analysis" ? "Analysis" : "Case Ready",
    valuation: "Valuation",
    "case-ready": "Case Ready",
    workspace: "Case Ready",
  };
  const currentStage = STAGE_BY_PAGE[activePage] ?? "";
  const currentCaseName = selectedCase?.caseName ?? "";
  // Human label for wherever the attorney currently is, for the assistant.
  const PAGE_LABEL: Record<string, string> = {
    intake: "Case Intake", workflow: "Case Intake", classification: "Classification",
    analysis: "Analysis", valuation: "Valuation", "case-ready": "Case Ready",
    workspace: "Case Workspace", cases: "Case Workspace", clients: "Clients",
    communication: "Communication", demands: "Demand Letters", templates: "Templates",
  };

  return (
    <ChronologyProvider>
    <DamagesProvider>
    <FactorsProvider>
    <PillarsProvider>
    <ViolationsProvider>
    <NotesProvider caseName={currentCaseName} stage={currentStage}>
      <AssistantProvider
        page={activePage}
        pageLabel={PAGE_LABEL[activePage] ?? "Dashboard"}
        caseName={currentCaseName}
        pipelineStage={currentStage}
        documents={pipeline.documents}
        findings={analysisFindings}
      >
      <div className="h-screen bg-gray-50 flex overflow-hidden">
        <DashboardSidebar
          activePage={activePage}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          <DashboardTopbar assistant={<AssistantLauncher />} />
          <div className="flex-1 flex min-h-0 overflow-hidden">
            <AssistantMain>{renderPage()}</AssistantMain>
            <AssistantPanel />
          </div>
        </div>
      </div>
      <FloatingNotes />
      </AssistantProvider>
    </NotesProvider>
    </ViolationsProvider>
    </PillarsProvider>
    </FactorsProvider>
    </DamagesProvider>
    </ChronologyProvider>
  );
}
