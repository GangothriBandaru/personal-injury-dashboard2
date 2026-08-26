import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { AnalysisFinding, CaseDocument } from "../types/case";
import type { ContextSel, AssistantAnswer } from "./assistantEngine";

// ── Assistant store ───────────────────────────────────────────────────────────
// ONE assistant. The launcher lives in the top bar and the panel lives in the
// shell layout, so both read the same store and conversations survive closing
// the panel. Two independent selections:
//   context  — how wide the AI may reason
//   workWith — which stage's documents the attorney is handling right now
// Neither ever navigates the dashboard.

export interface AssistantLocation {
  page: string;
  pageLabel: string;
  caseName: string;
  stageId?: string;       // workspace stage id, when inside the workspace
  stageLabel?: string;    // "Chronology", "Evidence" …
  pipelineStage?: string; // intake pipeline stage: Collection | Analysis | …
}

// A stage the attorney can pull documents from, in either pipeline.
export interface WorkStage {
  key: string;            // "intake:Analysis" | "workspace:medical"
  pipeline: "intake" | "workspace";
  id: string;
  label: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  text?: string;
  answer?: AssistantAnswer;
  context: string;
  /** Heading for a system notice — "Context changed" vs "Working with". */
  noticeLabel?: string;
  /** Documents this turn was asked to work with. */
  usingDocs?: string[];
  /** A change the assistant proposes; never applied without confirmation. */
  proposal?: { doc: string; section: string; current: string; proposed: string; state: "pending" | "applied" };
}

export interface Conversation {
  id: string;
  title: string;
  contextLabel: string;
  createdAt: string;
  messages: Message[];
}

interface Value {
  location: AssistantLocation;
  reportStage: (stageId?: string, stageLabel?: string) => void;

  documents: CaseDocument[];
  findings: AnalysisFinding[];

  open: boolean;
  setOpen: (o: boolean) => void;
  expanded: boolean;
  setExpanded: (e: boolean) => void;
  /** Drawer width in px. The dashboard reflows around it. */
  width: number;
  setWidth: (w: number) => void;

  context: ContextSel;
  setContext: (c: ContextSel) => void;
  workWith: WorkStage | null;
  setWorkWith: (w: WorkStage | null) => void;

  selectedDocs: string[];
  setSelectedDocs: (d: string[]) => void;

  conversations: Conversation[];
  activeId: string;
  setActiveId: (id: string) => void;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  newConversation: (contextLabel: string) => void;
}

// Drawer sizing. Dragging past the expand threshold hands over to the full
// workspace, so resizing and expanding are one continuous gesture.
export const DRAWER_MIN = 380;
export const DRAWER_DEFAULT = 440;
export const drawerMax = () => Math.round(window.innerWidth * 0.75);
export const expandThreshold = () => Math.round(window.innerWidth * 0.72);

const Ctx = createContext<Value | null>(null);

const stamp = () => new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

const blank = (contextLabel: string): Conversation => ({
  id: `c-${Math.round(performance.now())}-${Math.random().toString(36).slice(2, 7)}`,
  title: "New Chat",
  contextLabel,
  createdAt: stamp(),
  messages: [],
});

export function AssistantProvider({
  page, pageLabel, caseName, pipelineStage, documents, findings, children,
}: {
  page: string; pageLabel: string; caseName: string; pipelineStage?: string;
  documents: CaseDocument[]; findings: AnalysisFinding[]; children: ReactNode;
}) {
  const [stage, setStage] = useState<{ id?: string; label?: string }>({});
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState(DRAWER_DEFAULT);
  const [context, setContext] = useState<ContextSel>({ kind: "current" });
  const [workWith, setWorkWith] = useState<WorkStage | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([blank("Current Stage")]);
  const [activeId, setActiveId] = useState<string>("");

  // Leaving a page clears any stage the workspace had reported.
  useEffect(() => { setStage({}); }, [page]);
  useEffect(() => { if (!activeId && conversations[0]) setActiveId(conversations[0].id); }, [conversations, activeId]);

  const location: AssistantLocation = useMemo(
    () => ({ page, pageLabel, caseName, pipelineStage, stageId: stage.id, stageLabel: stage.label }),
    [page, pageLabel, caseName, pipelineStage, stage.id, stage.label],
  );

  const value: Value = {
    location,
    reportStage: (id, label) => setStage((p) => (p.id === id && p.label === label ? p : { id, label })),
    documents, findings,
    open, setOpen, expanded, setExpanded, width, setWidth,
    context, setContext, workWith, setWorkWith,
    selectedDocs, setSelectedDocs,
    conversations, activeId, setActiveId, setConversations,
    newConversation: (contextLabel) => {
      const c = blank(contextLabel);
      setConversations((p) => [c, ...p]);
      setActiveId(c.id);
      setSelectedDocs([]);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAssistant(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAssistant must be used inside AssistantProvider");
  return v;
}

// Called by a page that has its own sub-stage, so Current Stage tracks it.
// Safe outside the provider — it simply does nothing.
export function useReportAssistantStage(stageId?: string, stageLabel?: string) {
  const v = useContext(Ctx);
  const report = v?.reportStage;
  useEffect(() => { report?.(stageId, stageLabel); }, [report, stageId, stageLabel]);
}

// How much room the assistant panel is taking. Safe outside the provider, so
// other floating UI can step aside without depending on it.
export function useAssistantPanelMode(): { mode: "closed" | "drawer" | "expanded"; width: number } {
  const v = useContext(Ctx);
  if (!v?.open) return { mode: "closed", width: 0 };
  return { mode: v.expanded ? "expanded" : "drawer", width: v.width };
}
