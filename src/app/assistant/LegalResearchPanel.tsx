import { useState } from "react";
import {
  Library, ChevronDown, Check, ExternalLink, Loader2, AlertTriangle, X,
} from "lucide-react";
import {
  LEGAL_SOURCES, STATUS_LABEL, AUTH_LABEL, CAPABILITY_LABEL, canSearchInProduct,
  type LegalSource, type SourceConnection, type SourceId,
} from "./legalSources";

// ── Legal research sources ────────────────────────────────────────────────────
// One compact row in the assistant toolbar that opens into the platform list, so
// four providers do not occupy the panel permanently. Deliberately separate from
// Documents: those are the case's own evidence, these are outside platforms.
//
// No credential is shown or asked for here. Connecting hands off to the
// platform's own sign-in; the product only ever holds a status.

function StatusPill({ c }: { c: SourceConnection }) {
  if (c.status === "connected") {
    return (
      <span className="pill pill-complete shrink-0">
        <Check className="w-3 h-3" strokeWidth={2.5} /> Connected
      </span>
    );
  }
  if (c.status === "connecting") {
    return (
      <span className="pill pill-neutral shrink-0">
        <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} /> Connecting…
      </span>
    );
  }
  if (c.status === "error" || c.status === "unavailable") {
    return (
      <span className="pill pill-risk shrink-0">
        <AlertTriangle className="w-3 h-3" strokeWidth={2} /> {STATUS_LABEL[c.status]}
      </span>
    );
  }
  return null;
}

// One platform: its state, whether it is armed for this chat, and the actions
// its state allows.
function SourceRow({
  source, connection, onConnect, onDisconnect, onToggle, onRetry,
}: {
  source: LegalSource;
  connection: SourceConnection;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const [manage, setManage] = useState(false);
  const connected = connection.status === "connected";

  return (
    <div className="py-2 border-t border-line first:border-t-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          {/* Armed for this conversation. Only a connected source can be. */}
          <button
            onClick={onToggle}
            disabled={!connected}
            aria-label={`Use ${source.name} in this chat`}
            aria-pressed={connected && connection.enabled}
            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
              !connected ? "border-line bg-wash cursor-not-allowed"
                : connection.enabled ? "bg-brand border-brand" : "border-line bg-white hover:border-brand"
            }`}
          >
            {connected && connection.enabled && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          </button>
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink truncate">{source.name}</div>
            <p className="text-[11px] text-[#8A98A3] leading-snug">{source.blurb}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusPill c={connection} />
          {!connected && connection.status !== "connecting" && (
            <button
              onClick={connection.status === "error" ? onRetry : onConnect}
              className="px-2 py-1 rounded-lg border border-line bg-white text-xs font-semibold text-deep hover:border-brand transition-colors"
            >
              {connection.status === "error" ? "Retry" : "Connect"}
            </button>
          )}
          {connected && (
            <button
              onClick={() => setManage((m) => !m)}
              className="px-2 py-1 rounded-lg text-xs font-semibold text-[#5B6B78] hover:bg-wash hover:text-ink transition-colors"
            >
              Manage
            </button>
          )}
        </div>
      </div>

      {connection.message && connection.status !== "connected" && (
        <p className="text-[11px] text-[#B42318] leading-snug mt-1 ml-6">{connection.message}</p>
      )}

      {/* What this platform can do, and where its results are read. Stated so
          the attorney is never surprised by a hand-off. */}
      {connected && manage && (
        <div className="ml-6 mt-2 rounded-lg border border-line bg-offwhite p-2.5 space-y-2">
          {connection.account && (
            <div>
              <div className="eyebrow mb-0.5">Account</div>
              <p className="text-xs text-ink">{connection.account}</p>
            </div>
          )}
          {connection.connectedAt && (
            <div>
              <div className="eyebrow mb-0.5">Connected</div>
              <p className="text-xs text-[#5B6B78]">{connection.connectedAt}</p>
            </div>
          )}
          <div>
            <div className="eyebrow mb-1">Capabilities</div>
            <div className="flex flex-wrap gap-1">
              {source.capabilities.map((cap) => (
                <span key={cap} className="pill pill-neutral">{CAPABILITY_LABEL[cap]}</span>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-[#8A98A3] leading-relaxed">
            {canSearchInProduct(source)
              ? "Results can appear here once this platform's API adapter is connected."
              : source.externalOnlyReason ?? "Results are read on this platform's own site."}
          </p>
          <div className="flex items-center gap-2 pt-0.5">
            <a
              href={source.externalSearch("")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-deep hover:text-ink transition-colors"
            >
              <ExternalLink className="w-3 h-3" strokeWidth={1.75} /> Open {source.name}
            </a>
            <button
              onClick={() => { setManage(false); onDisconnect(); }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#B42318] hover:text-[#96200F] transition-colors"
            >
              <X className="w-3 h-3" strokeWidth={2} /> Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function LegalSourcesPanel({
  connections, onConnect, onDisconnect, onToggle, onRetry,
}: {
  connections: Record<SourceId, SourceConnection>;
  onConnect: (id: SourceId) => void;
  onDisconnect: (id: SourceId) => void;
  onToggle: (id: SourceId) => void;
  onRetry: (id: SourceId) => void;
}) {
  const [open, setOpen] = useState(false);
  const connectedCount = LEGAL_SOURCES.filter((s) => connections[s.id]?.status === "connected").length;
  const armed = LEGAL_SOURCES.filter((s) => connections[s.id]?.status === "connected" && connections[s.id]?.enabled).length;

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-ink hover:bg-wash transition-colors"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <Library className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
          <span className="truncate">
            Legal Research Sources · {connectedCount} connected
            {armed > 0 && <span className="text-[#8A98A3]"> · {armed} in this chat</span>}
          </span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[#5B6B78] shrink-0 transition-transform ${open ? "rotate-180" : ""}`} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="mt-1.5 rounded-xl border border-line bg-white px-3 py-1.5">
          <p className="text-[11px] text-[#8A98A3] leading-relaxed py-1.5">
            External research platforms. Separate from the case's own documents — tick a connected
            source to let the assistant use it in this conversation.
          </p>
          {LEGAL_SOURCES.map((s) => (
            <SourceRow
              key={s.id}
              source={s}
              connection={connections[s.id]}
              onConnect={() => onConnect(s.id)}
              onDisconnect={() => onDisconnect(s.id)}
              onToggle={() => onToggle(s.id)}
              onRetry={() => onRetry(s.id)}
            />
          ))}
          <p className="text-[11px] text-[#8A98A3] leading-relaxed py-2 border-t border-line">
            Sign-in happens on each platform. No keys or credentials are held here.
          </p>
        </div>
      )}
    </div>
  );
}

// The sign-in hand-off. A stand-in for each platform's own flow: it states which
// platform is being authorised and how, and never asks for a credential here.
export function ConnectDialog({
  source, onCancel, onAuthorise,
}: { source: LegalSource; onCancel: () => void; onAuthorise: () => void }) {
  return (
    <>
      <div className="fixed inset-0 bg-ink/40 z-[90]" onClick={onCancel} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] w-[420px] max-w-[92vw] rounded-2xl border border-line bg-white shadow-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Library className="w-4 h-4 text-deep shrink-0" strokeWidth={1.75} />
          <h3 className="card-title">Connect {source.name}</h3>
        </div>
        <p className="secondary-text leading-relaxed">{source.blurb}</p>

        <div className="rounded-xl border border-line bg-offwhite p-3 mt-3 space-y-2">
          <div>
            <div className="eyebrow mb-0.5">How you sign in</div>
            <p className="text-xs text-ink">{AUTH_LABEL[source.auth]}</p>
          </div>
          <div>
            <div className="eyebrow mb-1">What this connection allows</div>
            <div className="flex flex-wrap gap-1">
              {source.capabilities.map((cap) => (
                <span key={cap} className="pill pill-neutral">{CAPABILITY_LABEL[cap]}</span>
              ))}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-[#8A98A3] leading-relaxed mt-2.5">
          You will sign in on {source.name}. Your credentials are never entered into or stored by this
          product — it holds only whether the connection is live.
        </p>

        <div className="flex items-center justify-end gap-2 mt-4">
          <button onClick={onCancel} className="btn btn-secondary px-3 py-2 text-sm">Cancel</button>
          <button onClick={onAuthorise} className="btn btn-primary px-3 py-2 text-sm">
            <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} /> Continue to {source.name}
          </button>
        </div>
      </div>
    </>
  );
}


// ── A research answer in the conversation ─────────────────────────────────────
// Every result names where it came from. A result read from the case's own
// precedent data says so; a platform that could not be searched from inside the
// product hands over a link rather than appearing to have answered.

export function ResearchBlock({ answer }: { answer: import("./legalSources").ResearchAnswer }) {
  return (
    <div className="rounded-xl border border-line bg-offwhite p-3.5 mt-3 space-y-3">
      <div className="flex items-center gap-2">
        <Library className="w-3.5 h-3.5 text-deep shrink-0" strokeWidth={1.75} />
        <span className="eyebrow text-deep">Legal Research</span>
      </div>

      {answer.results.length > 0 && (
        <div className="space-y-2">
          <div className="eyebrow">Relevant precedent cases</div>
          {answer.results.map((r) => (
            <div key={`${r.sourceName}-${r.title}`} className="rounded-lg border border-line bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="card-title min-w-0">{r.title}</span>
                {r.match !== undefined && <span className="pill pill-neutral shrink-0">{r.match}% match</span>}
              </div>
              <div className="mono-ref mt-0.5">Source: {r.sourceName}</div>
              {r.reasons.length > 0 && (
                <>
                  <div className="eyebrow mt-2 mb-1">Why this case is relevant</div>
                  <ul className="space-y-0.5">
                    {r.reasons.map((x, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-deep mt-[7px] shrink-0" />
                        <span className="text-xs text-[#5B6B78] leading-relaxed">{x}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {r.outcome && (
                <>
                  <div className="eyebrow mt-2 mb-0.5">Settlement / outcome</div>
                  <p className="text-sm font-bold text-ink tabular-nums">{r.outcome}</p>
                </>
              )}
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-deep hover:text-ink transition-colors mt-2">
                  View source <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Platforms that finish the search on their own site. */}
      {answer.handoffs.length > 0 && (
        <div className="space-y-1.5">
          <div className="eyebrow">Continue on these platforms</div>
          {answer.handoffs.map((h) => (
            <div key={h.sourceId} className="rounded-lg border border-line bg-white p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{h.sourceName}</span>
                <a
                  href={h.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-line text-xs font-semibold text-deep hover:border-brand transition-colors shrink-0"
                >
                  Open in {h.sourceName} <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
                </a>
              </div>
              <p className="text-[11px] text-[#8A98A3] leading-relaxed mt-1">{h.reason}</p>
            </div>
          ))}
        </div>
      )}

      {answer.unavailable.length > 0 && (
        <div className="rounded-lg border border-[#FDE6C8] bg-[#FFF7ED] p-2.5">
          {answer.unavailable.map((u) => (
            <p key={u.sourceName} className="text-[11px] text-[#B45309] leading-relaxed">
              {u.sourceName}: {u.reason}
            </p>
          ))}
        </div>
      )}

      {answer.results.length === 0 && answer.handoffs.length === 0 && (
        <p className="secondary-text">
          No research source is switched on for this conversation. Open Legal Research Sources above to
          connect a platform and tick it for this chat.
        </p>
      )}
    </div>
  );
}

// A quiet marker on a turn that used outside platforms.
export function ResearchIndicator({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-2">
      <span className="pill pill-neutral">
        <Library className="w-3 h-3" strokeWidth={1.75} /> Legal Research
      </span>
      <span className="text-[11px] text-[#8A98A3]">{names.join(" · ")}</span>
    </div>
  );
}
