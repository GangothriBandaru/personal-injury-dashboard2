// ── Legal research sources ────────────────────────────────────────────────────
// External research platforms the attorney can connect to the product, and the
// model the assistant uses to reach them.
//
// Nothing here knows about a particular vendor beyond its registry entry: a
// source declares what it can do, how it authenticates and how to reach it, and
// the assistant works from that. Adding a provider is adding an entry.
//
// This is the frontend half. No source returns third-party results until its
// adapter is wired to a backend — a source that cannot search from inside the
// product says so and hands the attorney a link, rather than presenting
// anything as though it came from that platform.

export type SourceId = "thomson-reuters" | "lexisnexis" | "google-scholar" | "courtlistener";

// What a source can do. The assistant reads these rather than special-casing a
// vendor, so a provider that only supports lookup is not asked to search.
export type SourceCapability =
  | "search"          // full-text research from inside the product
  | "case-lookup"
  | "statute-lookup"
  | "citation-lookup"
  | "open-external";  // hand off to the platform's own site

export const CAPABILITY_LABEL: Record<SourceCapability, string> = {
  search: "Search",
  "case-lookup": "Case lookup",
  "statute-lookup": "Statute lookup",
  "citation-lookup": "Citation lookup",
  "open-external": "Open external source",
};

// Where a connection stands. `error` and `unavailable` are distinct: the first
// is this attorney's connection, the second is the platform.
export type SourceStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "unavailable";

export const STATUS_LABEL: Record<SourceStatus, string> = {
  disconnected: "Connect",
  connecting: "Connecting…",
  connected: "Connected",
  error: "Connection error",
  unavailable: "Temporarily unavailable",
};

// How a source is reached once connected. Declared per source so the product
// never assumes every platform integrates the same way.
export type SourceAuth = "oauth" | "api-key" | "institutional" | "none";

export const AUTH_LABEL: Record<SourceAuth, string> = {
  oauth: "Sign in with your account",
  "api-key": "Authorise through your firm's subscription",
  institutional: "Sign in through your institution",
  none: "No sign-in required",
};

export interface LegalSource {
  id: SourceId;
  name: string;
  /** One line the attorney reads when deciding whether to connect. */
  blurb: string;
  auth: SourceAuth;
  capabilities: SourceCapability[];
  /** Whether results can be shown in-product once a backend is wired up. */
  rendersInProduct: boolean;
  /** A search on the platform's own site, for hand-off. */
  externalSearch: (query: string) => string;
  /** Why in-product results are unavailable, where that is the case. */
  externalOnlyReason?: string;
}

// ── The registry ──────────────────────────────────────────────────────────────
// Adding a provider means adding an entry here. Nothing else changes.

export const LEGAL_SOURCES: LegalSource[] = [
  {
    id: "thomson-reuters",
    name: "Thomson Reuters",
    blurb: "Westlaw case law, verdicts and secondary sources.",
    auth: "api-key",
    capabilities: ["search", "case-lookup", "statute-lookup", "citation-lookup", "open-external"],
    rendersInProduct: true,
    externalSearch: (q) => `https://1.next.westlaw.com/Search/Results.html?query=${encodeURIComponent(q)}`,
  },
  {
    id: "lexisnexis",
    name: "LexisNexis",
    blurb: "Lexis+ case law, jury verdicts and analytics.",
    auth: "api-key",
    capabilities: ["search", "case-lookup", "citation-lookup", "open-external"],
    rendersInProduct: true,
    externalSearch: (q) => `https://plus.lexis.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: "google-scholar",
    name: "Google Scholar",
    blurb: "Published opinions and scholarly articles.",
    auth: "none",
    capabilities: ["case-lookup", "citation-lookup", "open-external"],
    // Scholar has no licensed search API, so results are read on its own site.
    rendersInProduct: false,
    externalOnlyReason: "Google Scholar has no licensed search API, so results open on its own site.",
    externalSearch: (q) => `https://scholar.google.com/scholar?as_sdt=2006&q=${encodeURIComponent(q)}`,
  },
  {
    id: "courtlistener",
    name: "CourtListener",
    blurb: "Free federal and state opinions from the RECAP archive.",
    auth: "oauth",
    capabilities: ["search", "case-lookup", "citation-lookup", "open-external"],
    rendersInProduct: true,
    externalSearch: (q) => `https://www.courtlistener.com/?q=${encodeURIComponent(q)}`,
  },
];

export const sourceById = (id: SourceId): LegalSource =>
  LEGAL_SOURCES.find((s) => s.id === id)!;

export const canSearchInProduct = (s: LegalSource) =>
  s.rendersInProduct && s.capabilities.includes("search");

// ── Connection state ──────────────────────────────────────────────────────────
// Held per source. No credential, token or key is kept here or shown anywhere in
// the UI — a connection is a status and a display name, and the secret half
// belongs to the backend.

export interface SourceConnection {
  status: SourceStatus;
  /** The account the attorney connected, for display only. */
  account?: string;
  connectedAt?: string;
  /** Why a connection failed, in words the attorney can act on. */
  message?: string;
  /** Whether this source is armed for the current conversation. */
  enabled: boolean;
}

export const initialConnections = (): Record<SourceId, SourceConnection> =>
  Object.fromEntries(
    LEGAL_SOURCES.map((s) => [s.id, { status: "disconnected" as SourceStatus, enabled: false }]),
  ) as Record<SourceId, SourceConnection>;

// ── Results ───────────────────────────────────────────────────────────────────
// A result always names where it came from. An in-product result carries its
// own attribution; an external one carries the link and says why it is external.

export interface ResearchResult {
  sourceId: SourceId | "case-file";
  sourceName: string;
  title: string;
  /** Match against the current case, where the source records one. */
  match?: number;
  outcome?: string;
  reasons: string[];
  url?: string;
}

export interface ResearchAnswer {
  query: string;
  /** Sources that were asked and answered in-product. */
  results: ResearchResult[];
  /** Sources that can only be read on their own site, with the search link. */
  handoffs: { sourceId: SourceId; sourceName: string; url: string; reason: string }[];
  /** Sources armed for the chat that could not be reached. */
  unavailable: { sourceName: string; reason: string }[];
  /** True when no external platform is wired to a backend in this build. */
  noBackend: boolean;
}

// Whether a message is asking for legal research rather than about the case.
export function isResearchQuery(q: string): boolean {
  return /\b(precedent|case ?law|similar cases?|comparable cases?|statute|citation|cite|authority|authorities|jurisprudence|research|ruling|opinion|verdict)\b/i.test(q);
}

// ── Asking the sources ────────────────────────────────────────────────────────
// The dispatch. Each connected, enabled source is asked according to what it
// declares it can do. An external-only source is not asked — it is handed off.
//
// `inProduct` is supplied by the caller: today it is the case's own precedent
// data, which is real and attributed to the case file. When a platform adapter
// is wired to a backend it returns here alongside it, attributed to that
// platform. Nothing invents a third-party result in the meantime.

export function research(
  query: string,
  connections: Record<SourceId, SourceConnection>,
  inProduct: ResearchResult[],
): ResearchAnswer {
  const armed = LEGAL_SOURCES.filter((s) => {
    const c = connections[s.id];
    return c?.status === "connected" && c.enabled;
  });

  const handoffs = armed
    .filter((s) => !canSearchInProduct(s) && s.capabilities.includes("open-external"))
    .map((s) => ({
      sourceId: s.id,
      sourceName: s.name,
      url: s.externalSearch(query),
      reason: s.externalOnlyReason ?? "This platform completes the search on its own site.",
    }));

  // A source that could search in-product has no adapter behind it in this
  // build, so the attorney is handed the same search on the platform instead of
  // being shown results attributed to a platform that was never asked.
  const searchable = armed.filter(canSearchInProduct);
  const notWired = searchable.map((s) => ({
    sourceId: s.id,
    sourceName: s.name,
    url: s.externalSearch(query),
    reason: "No API adapter is wired to this platform in this build, so the search opens on its own site.",
  }));

  const unavailable = LEGAL_SOURCES
    .filter((s) => connections[s.id]?.enabled && connections[s.id]?.status === "unavailable")
    .map((s) => ({ sourceName: s.name, reason: connections[s.id]?.message ?? "The platform is temporarily unavailable." }));

  return {
    query,
    results: inProduct,
    handoffs: [...handoffs, ...notWired],
    unavailable,
    noBackend: searchable.length > 0,
  };
}
