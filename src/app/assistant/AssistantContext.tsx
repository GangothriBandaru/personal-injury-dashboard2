import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// ── Assistant location ────────────────────────────────────────────────────────
// ONE assistant, many contexts. It needs to know where the attorney currently
// is so "Current Stage" can follow the page without being told twice. Pages
// report upward; nothing reads the DOM.

export interface AssistantLocation {
  page: string;        // active dashboard page id
  pageLabel: string;   // "Case Workspace", "Case Intake" …
  caseName: string;
  stageId?: string;    // workspace stage id, when inside the workspace
  stageLabel?: string; // "Chronology", "Violations" …
  pipelineStage?: string; // intake pipeline stage: Collection | Analysis | …
}

interface Value {
  location: AssistantLocation;
  reportStage: (stageId?: string, stageLabel?: string) => void;
}

const Ctx = createContext<Value | null>(null);

export function AssistantProvider({
  page, pageLabel, caseName, pipelineStage, children,
}: { page: string; pageLabel: string; caseName: string; pipelineStage?: string; children: ReactNode }) {
  const [stage, setStage] = useState<{ id?: string; label?: string }>({});

  // Leaving the page clears any stage the workspace had reported.
  useEffect(() => { setStage({}); }, [page]);

  const value: Value = {
    location: {
      page, pageLabel, caseName, pipelineStage,
      stageId: stage.id, stageLabel: stage.label,
    },
    reportStage: (id, label) => setStage((p) => (p.id === id && p.label === label ? p : { id, label })),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAssistant(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAssistant must be used inside AssistantProvider");
  return v;
}

// Called by a page that has its own sub-stage, so "Current Stage" tracks it.
// Safe to call outside the provider — it simply does nothing.
export function useReportAssistantStage(stageId?: string, stageLabel?: string) {
  const v = useContext(Ctx);
  const report = v?.reportStage;
  useEffect(() => { report?.(stageId, stageLabel); }, [report, stageId, stageLabel]);
}
