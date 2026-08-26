import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { NotebookPen, X, Tag, Flag, Layers, FileText, Plus, ChevronLeft, CheckCircle, MoreVertical, Pencil, Trash2, Lock, Maximize2, Minimize2, Search, SlidersHorizontal } from "lucide-react";
import { useNotes, STAGES } from "../notes/NotesContext";
import type { Note } from "../notes/NotesContext";
import { useAssistantPanelMode } from "../assistant/AssistantContext";

const CATEGORIES = ["Liability", "Medical", "Damages", "Strategy", "General"];
const PRIORITIES = ["Low", "Medium", "High"];

const priorityColor: Record<string, string> = {
  Low: "bg-track text-ink",
  Medium: "bg-tint text-deep",
  High: "bg-red-50 text-red-700",
};

// Parse our display timestamps ("Jun 22, 2026 · 9:14 AM") back to a sortable value.
const parseTs = (s: string) => {
  const t = Date.parse(s.replace(" · ", " "));
  return Number.isNaN(t) ? 0 : t;
};

export function FloatingNotes() {
  // Step aside for the assistant drawer, and stand down entirely while the
  // assistant occupies the whole dashboard area.
  const assistant = useAssistantPanelMode();
  const { notes, caseName, stage, docContext, addNote, updateNote, deleteNote } = useNotes();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<"list" | "create">("list");
  const [filter, setFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"Newest" | "Oldest">("Newest");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("General");
  const [priority, setPriority] = useState("Medium");
  const [saved, setSaved] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  // The note being edited (its captured context is locked while editing).
  const editingNote = editingId ? notes.find((n) => n.id === editingId) : undefined;

  // Only show inside the intake pipeline stages.
  const isStagePage = (STAGES as readonly string[]).includes(stage);

  // Notes for the current case only.
  const caseNotes = useMemo(() => notes.filter((n) => n.caseName === caseName), [notes, caseName]);

  // When opening, land on Saved Notes and default the filter to the current stage.
  useEffect(() => {
    if (open) {
      setView("list");
      setFilter(stage || "All");
    }
  }, [open, stage]);

  // Auto-dismiss the success state.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  if (!isStagePage) return null;

  const byStage = filter === "All" ? caseNotes : caseNotes.filter((n) => n.stage === filter);
  const countFor = (s: string) => (s === "All" ? caseNotes.length : caseNotes.filter((n) => n.stage === s).length);
  const hasDraft = content.trim().length > 0 || editingId !== null;

  // Right-panel list: stage filter → free-text search → sort.
  const q = search.trim().toLowerCase();
  const visibleNotes = [...byStage]
    .filter((n) =>
      !q ||
      [n.content, n.category, n.priority, n.stage, n.author, n.reference, n.contextType]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    )
    .sort((a, b) => (sort === "Newest" ? parseTs(b.timestamp) - parseTs(a.timestamp) : parseTs(a.timestamp) - parseTs(b.timestamp)));

  const resetForm = () => {
    setContent("");
    setCategory("General");
    setPriority("Medium");
    setEditingId(null);
  };

  const startCreate = () => {
    setSaved(false);
    resetForm();
    setView("create");
  };

  const startEdit = (note: Note) => {
    setMenuId(null);
    setSaved(false);
    setEditingId(note.id);
    setContent(note.content);
    setCategory(note.category);
    setPriority(note.priority);
    setView("create");
  };

  const handleSave = () => {
    if (!content.trim()) return;
    if (editingId) {
      updateNote(editingId, { content, category, priority });
    } else {
      addNote({ content, category, priority });
      setFilter(stage || "All");
    }
    resetForm();
    // The compact panel returns to the list; the expanded workspace keeps the
    // composer in place (now back to "Add New Note") beside the notes history.
    if (!expanded) setView("list");
    setSaved(true);
  };

  const handleCancel = () => {
    resetForm();
    if (!expanded) setView("list");
  };

  // Expand/collapse keeps the same component — the draft and form state persist
  // across the transition. On collapse, surface any in-progress draft.
  const toggleExpand = () => {
    setMenuId(null);
    setExpanded((wasExpanded) => {
      const next = !wasExpanded;
      if (!next) setView(hasDraft ? "create" : "list");
      return next;
    });
  };

  const closePanel = () => {
    setMenuId(null);
    setOpen(false);
  };

  // Title block shown on the left of the panel header.
  const titleBlock = (
    <>
      <div className="w-8 h-8 rounded-lg bg-tint flex items-center justify-center shrink-0">
        <NotebookPen className="w-4 h-4 text-deep" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink leading-tight" style={{ fontFamily: "var(--font-display)" }}>Case Notes</h2>
        <p className="text-xs text-[#5B6B78] truncate">{caseName || "—"}</p>
      </div>
    </>
  );

  const header = (left: ReactNode) => (
    <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">{left}</div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={toggleExpand} title={expanded ? "Collapse" : "Expand"} className="p-1.5 hover:bg-tint rounded-lg transition-colors">
          {expanded
            ? <Minimize2 className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} />
            : <Maximize2 className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} />}
        </button>
        <button onClick={closePanel} title="Close" className="p-1.5 hover:bg-tint rounded-lg transition-colors">
          <X className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );

  const stageFilters = (
    <div className="flex items-center gap-1.5 px-4 py-3 border-b border-line overflow-x-auto shrink-0">
      {["All", ...STAGES].map((s) => {
        const active = filter === s;
        return (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${
              active ? "bg-tint border-brand text-deep" : "bg-white border-line text-[#5B6B78] hover:border-soft hover:text-ink"
            }`}
          >
            {s === "All" ? "All" : s} ({countFor(s)})
          </button>
        );
      })}
    </div>
  );

  // Search + sort row (expanded right panel only).
  const searchSortRow = (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-line shrink-0">
      <div className="relative flex-1 min-w-0">
        <Search className="w-4 h-4 text-[#5B6B78] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes…"
          className="w-full pl-9 pr-3 py-2 border border-line rounded-lg text-sm text-ink placeholder:text-[#5B6B78] focus:outline-none focus:border-brand bg-white transition-colors"
        />
      </div>
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value as "Newest" | "Oldest")}
        title="Sort by"
        className="border border-line rounded-lg px-2.5 py-2 text-sm text-ink focus:outline-none focus:border-brand bg-white shrink-0"
      >
        <option value="Newest">Newest</option>
        <option value="Oldest">Oldest</option>
      </select>
      <button
        onClick={() => { setSearch(""); setFilter("All"); }}
        title="Reset filters"
        className="p-2 border border-line rounded-lg text-[#5B6B78] hover:text-ink hover:border-soft transition-colors shrink-0"
      >
        <SlidersHorizontal className="w-4 h-4" strokeWidth={1.75} />
      </button>
    </div>
  );

  const savedBanner = saved && (
    <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border-b border-green-200 text-green-800 text-sm shrink-0">
      <CheckCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
      Note saved successfully.
    </div>
  );

  const renderNotes = (items: Note[]) => (
    <div className="flex-1 overflow-auto p-4 space-y-3">
      <div className="eyebrow">Saved Notes ({caseNotes.length})</div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <NotebookPen className="w-8 h-8 text-[#9BDAEC] mb-3" strokeWidth={1.75} />
          <p className="text-sm font-medium text-ink">{q ? "No matching notes" : "No notes yet"}</p>
          <p className="text-xs text-[#5B6B78] mt-1">
            {q ? "Try a different search or clear your filters." : `Capture a thought for this ${filter === "All" ? "case" : "stage"}.`}
          </p>
        </div>
      ) : (
        items.map((n) => (
          <NoteCard
            key={n.id}
            note={n}
            active={editingId === n.id}
            menuOpen={menuId === n.id}
            onToggleMenu={() => setMenuId(menuId === n.id ? null : n.id)}
            onCloseMenu={() => setMenuId(null)}
            onEdit={() => startEdit(n)}
            onDelete={() => { deleteNote(n.id); setMenuId(null); if (editingId === n.id) resetForm(); }}
          />
        ))
      )}
    </div>
  );

  const newNoteButton = (
    <div className="px-4 py-3 border-t border-line shrink-0">
      <button
        onClick={startCreate}
        className="w-full flex items-center justify-center gap-2 bg-ink hover:bg-deep text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
      >
        <Plus className="w-4 h-4" strokeWidth={1.75} /> New Note
      </button>
    </div>
  );

  // Captured context card — shared by compact and composer editors.
  const contextCard = (
    <div className="rounded-lg border border-line bg-offwhite p-3 space-y-1.5 shrink-0">
      <div className="flex items-center justify-between mb-1">
        <div className="eyebrow">Captured Context</div>
        {editingNote && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-[#5B6B78] uppercase tracking-wide">
            <Lock className="w-3 h-3" strokeWidth={1.75} /> Locked
          </span>
        )}
      </div>
      <ContextRow icon={Layers} label="Current Stage" value={editingNote ? editingNote.stage : stage} />
      <ContextRow icon={FileText} label="Current Case" value={(editingNote ? editingNote.caseName : caseName) || "—"} />
      {editingNote
        ? editingNote.reference && <ContextRow icon={Tag} label={editingNote.contextType ?? "Context"} value={editingNote.reference} />
        : docContext && <ContextRow icon={Tag} label={docContext.contextType} value={docContext.reference} />}
    </div>
  );

  const attributeInputs = (
    <div className="grid grid-cols-2 gap-3 shrink-0">
      <div>
        <label className="text-xs font-medium text-[#5B6B78] mb-1.5 block">Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand bg-white">
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-[#5B6B78] mb-1.5 block">Priority</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-brand bg-white">
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
    </div>
  );

  // Compact create/edit editor (single-column panel).
  const compactEditor = (
    <div className="flex-1 overflow-auto p-4 space-y-3">
      {contextCard}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Enter your note…"
        rows={4}
        className="w-full border border-line rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-[#5B6B78] focus:outline-none focus:border-brand resize-none transition-colors"
      />
      {attributeInputs}
      <div className="flex items-center gap-2 pt-1 shrink-0">
        <button onClick={handleSave} disabled={!content.trim()} className="flex-1 bg-ink hover:bg-deep text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {editingId ? "Update Note" : "Save Note"}
        </button>
        <button onClick={handleCancel} className="px-4 py-2.5 bg-white border border-line text-ink rounded-lg text-sm font-medium hover:bg-wash transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );

  // The assistant fills the whole dashboard area when expanded, so a floating
  // notes button has nothing to float over and stands down.
  if (assistant.mode === "expanded") return null;

  return (
    <>
      {/* Floating action button */}
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notes"
        style={{ right: assistant.mode === "drawer" ? assistant.width + 16 : undefined }}
        className="fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-ink hover:bg-deep text-white shadow-lg flex items-center justify-center transition-all"
      >
        <NotebookPen className="w-6 h-6" strokeWidth={1.75} />
        {caseNotes.length > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-brand text-white text-xs font-semibold flex items-center justify-center border-2 border-white">
            {caseNotes.length}
          </span>
        )}
      </button>

      {open && !expanded && (
        <>
          {/* Transparent click-catcher — closes the panel, page stays visible */}
          <div className="fixed inset-0 z-[59]" onClick={closePanel} />

          {/* Compact panel anchored above the button */}
          <div style={{ right: assistant.mode === "drawer" ? assistant.width + 16 : undefined }}
            className="fixed bottom-24 right-6 z-[60] w-[380px] max-w-[calc(100vw-3rem)] max-h-[72vh] bg-white border border-line rounded-xl shadow-xl flex flex-col overflow-hidden">
            {header(
              view === "create" ? (
                <button onClick={() => { resetForm(); setView("list"); }} className="flex items-center gap-1 text-sm font-medium text-deep hover:text-ink transition-colors">
                  <ChevronLeft className="w-4 h-4" strokeWidth={1.75} /> Back to Notes
                </button>
              ) : titleBlock,
            )}

            {view === "list" ? (
              <>
                {stageFilters}
                {savedBanner}
                {renderNotes(byStage)}
                {newNoteButton}
              </>
            ) : (
              compactEditor
            )}
          </div>
        </>
      )}

      {open && expanded && (
        /* Expanded workspace — 30% composer / 70% saved notes. Page stays visible behind. */
        <div className="fixed right-6 top-1/2 -translate-y-1/2 z-[60] w-[60vw] min-w-[820px] max-w-[1100px] h-[88vh] bg-white border border-line rounded-xl shadow-xl flex flex-col overflow-hidden">
          {header(titleBlock)}

          <div className="flex-1 flex min-h-0">
            {/* Left — Note Composer (secondary utility, fixed) */}
            <div className="w-[30%] min-w-[300px] max-w-[380px] border-r border-line flex flex-col min-h-0 bg-wash">
              <div className="px-4 py-3 border-b border-line shrink-0">
                <h3 className="text-sm font-semibold text-ink leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                  {editingId ? "Edit Note" : "Add New Note"}
                </h3>
                <p className="text-xs text-[#5B6B78] mt-0.5">
                  {editingId ? "Update this note while browsing the others." : "Capture a thought or strategy for the current stage."}
                </p>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-3">
                {contextCard}
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter your note…"
                  rows={6}
                  className="w-full border border-line rounded-lg px-3 py-2.5 text-sm text-ink placeholder:text-[#5B6B78] focus:outline-none focus:border-brand resize-none transition-colors bg-white"
                />
                {attributeInputs}
                <div className="flex items-center gap-2 pt-1 shrink-0">
                  <button onClick={handleSave} disabled={!content.trim()} className="flex-1 bg-ink hover:bg-deep text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {editingId ? "Update Note" : "Save Note"}
                  </button>
                  <button onClick={resetForm} disabled={!hasDraft} className="px-4 py-2.5 bg-white border border-line text-ink rounded-lg text-sm font-medium hover:bg-wash transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Right — Saved Notes (primary workspace) */}
            <div className="flex-1 flex flex-col min-h-0">
              {stageFilters}
              {searchSortRow}
              {savedBanner}
              {renderNotes(visibleNotes)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NoteCard({
  note: n,
  active,
  menuOpen,
  onToggleMenu,
  onCloseMenu,
  onEdit,
  onDelete,
}: {
  note: Note;
  active: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`lg-zone rounded-xl p-4 ${active ? "ring-1 ring-brand" : ""}`}>
      <div className="flex items-start gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-xs text-[#5B6B78] bg-white border border-line px-2 py-0.5 rounded-md">{n.category}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${priorityColor[n.priority] ?? "bg-track text-ink"}`}>
            <Flag className="w-3 h-3 inline -mt-0.5 mr-1" strokeWidth={1.75} />{n.priority}
          </span>
          <span className="text-xs text-deep bg-tint px-2 py-0.5 rounded-md">{n.stage}</span>
        </div>
        {/* Overflow menu */}
        <div className="relative ml-auto shrink-0">
          <button onClick={onToggleMenu} className="p-1 -mr-1 hover:bg-tint rounded-lg transition-colors" title="Note actions">
            <MoreVertical className="w-4 h-4 text-[#5B6B78]" strokeWidth={1.75} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={onCloseMenu} />
              <div className="absolute right-0 mt-1 w-36 bg-white border border-line rounded-lg shadow-md z-20 overflow-hidden">
                <button onClick={onEdit} className="w-full px-3 py-2 text-sm text-left text-ink hover:bg-wash flex items-center gap-2">
                  <Pencil className="w-3.5 h-3.5 text-[#5B6B78]" strokeWidth={1.75} /> Edit Note
                </button>
                <button onClick={onDelete} className="w-full px-3 py-2 text-sm text-left text-[#B91C1C] hover:bg-[#FEF2F2] flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} /> Delete Note
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {n.reference && (
        <div className="flex items-center gap-1.5 text-xs text-[#5B6B78] mb-1.5">
          <Tag className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
          <span className="truncate">{n.contextType}: <span className="text-ink font-medium">{n.reference}</span></span>
        </div>
      )}
      <p className="body-text leading-relaxed whitespace-pre-wrap break-words">{n.content}</p>
      <p className="mono-ref mt-1.5">{n.author} · {n.timestamp}</p>
      {n.editedAt && <p className="mono-ref text-[#9BA8B4]">Edited: {n.editedAt}</p>}
    </div>
  );
}

function ContextRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
      <span className="text-[#5B6B78]">{label}</span>
      <span className="text-ink font-medium truncate ml-auto text-right">{value}</span>
    </div>
  );
}
