import { getAuthToken } from "./auth";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8791";

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}/api/admin${path}`, {
    ...init,
    headers: authHeaders(init.headers as Record<string, string> | undefined)
  });
}

export type AuthUser = {
  id: string;
  username: string;
  displayName: string | null;
  role: "owner" | "editor" | "reviewer" | "viewer" | "public";
  isActive: boolean;
};

export type AuthResponse = {
  user: AuthUser;
  token: string;
  expiresAt: string;
};

export async function fetchBootstrapStatus(): Promise<{ needsBootstrap: boolean }> {
  const response = await fetch(`${baseUrl}/api/auth/bootstrap-status`);
  if (!response.ok) throw new Error("Failed to fetch bootstrap status");
  return response.json() as Promise<{ needsBootstrap: boolean }>;
}

export async function bootstrapOwner(payload: { username: string; password: string; displayName?: string | null }): Promise<AuthResponse> {
  const response = await fetch(`${baseUrl}/api/auth/bootstrap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to bootstrap owner");
  return response.json() as Promise<AuthResponse>;
}

export async function login(payload: { username: string; password: string }): Promise<AuthResponse> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to login");
  return response.json() as Promise<AuthResponse>;
}

export async function logout(): Promise<void> {
  const response = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: authHeaders()
  });
  if (!response.ok) throw new Error("Failed to logout");
}

export async function fetchAuthMe(): Promise<{ user: AuthUser }> {
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: authHeaders()
  });
  if (!response.ok) throw new Error("Unauthorized");
  return response.json() as Promise<{ user: AuthUser }>;
}

export type Work = {
  id: string;
  title: string;
  titleOriginal: string | null;
  aliases: string[];
  year: string | null;
  language: string | null;
  summaryShort: string;
  summaryFull: string | null;
  tags: string[];
  sourcePrimary: string;
  recordStatus: string;
  visibility: string;
};

export type AccessEntry = {
  accessId?: string;
  parentReleaseId?: string;
  accessType?: string;
  platform?: string | null;
  url?: string | null;
  availability?: string | null;
  accessNote?: string | null;
  lastVerified?: string | null;
  mirrorNote?: string | null;
  accessRisk?: string | null;
  checksum?: string | null;
  extractCode?: string | null;
  internalPath?: string | null;
  sensitiveSource?: string | null;
  visibility?: string;
};

export type Release = {
  releaseId: string;
  parentWorkId: string;
  releaseTitle: string | null;
  releaseDate: string | null;
  edition: string | null;
  episodeCount: number | null;
  duration: string | null;
  fileSize: string | null;
  resolution: string | null;
  audioTracks: Array<Record<string, unknown>>;
  subtitleTracks: Array<Record<string, unknown>>;
  qualityNote: string | null;
  releaseStatus: string;
  accessEntries?: AccessEntry[];
};

export type WorkDetail = Work & {
  releases: Release[];
  contributors?: Contributor[];
  covers?: Cover[];
  sources?: Source[];
  externalLinks?: ExternalLink[];
};

export type WorkPayload = {
  id: string;
  title: string;
  aliases: string[];
  tags: string[];
  summaryShort: string;
  summaryFull?: string | null;
  sourcePrimary: string;
  recordStatus: string;
  visibility: string;
};

export async function fetchWorks(q = ""): Promise<{ items: Work[] }> {
  const url = new URL(`${baseUrl}/api/public/works`);
  if (q) url.searchParams.set("q", q);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch works");
  return response.json() as Promise<{ items: Work[] }>;
}

export async function fetchWork(id: string): Promise<WorkDetail> {
  const response = await fetch(`${baseUrl}/api/public/works/${id}`);
  if (!response.ok) throw new Error("Failed to fetch work");
  return response.json() as Promise<WorkDetail>;
}

export async function fetchWorkTaxonomyTerms(workId: string): Promise<{ items: WorkTaxonomyTerm[] }> {
  const response = await fetch(`${baseUrl}/api/public/works/${workId}/taxonomy-terms`);
  if (!response.ok) throw new Error("Failed to fetch work taxonomy terms");
  return response.json() as Promise<{ items: WorkTaxonomyTerm[] }>;
}

export async function fetchWorkRelations(workId: string): Promise<{ items: WorkRelation[] }> {
  const response = await fetch(`${baseUrl}/api/public/works/${workId}/relations`);
  if (!response.ok) throw new Error("Failed to fetch work relations");
  return response.json() as Promise<{ items: WorkRelation[] }>;
}

export async function createAdminWork(payload: WorkPayload): Promise<Work> {
  const response = await adminFetch("/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to create work");
  return response.json() as Promise<Work>;
}

export async function updateAdminWork(id: string, payload: Partial<WorkPayload>): Promise<Work> {
  const response = await adminFetch(`/works/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to update work");
  return response.json() as Promise<Work>;
}

export async function deleteAdminWork(id: string): Promise<void> {
  const response = await adminFetch(`/works/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete work");
}

export async function fetchAdminWorks(q = ""): Promise<{ items: Work[] }> {
  const url = new URL(`${baseUrl}/api/admin/works`);
  if (q) url.searchParams.set("q", q);
  const response = await fetch(url, { headers: authHeaders() });
  if (!response.ok) throw new Error("Failed to fetch admin works");
  return response.json() as Promise<{ items: Work[] }>;
}

export async function fetchAdminWork(id: string): Promise<Work> {
  const response = await adminFetch(`/works/${id}`);
  if (!response.ok) throw new Error("Failed to fetch admin work");
  return response.json() as Promise<Work>;
}

export type ReleasePayload = {
  releaseId: string;
  releaseTitle?: string | null;
  releaseDate?: string | null;
  edition?: string | null;
  episodeCount?: number | null;
  duration?: string | null;
  fileSize?: string | null;
  resolution?: string | null;
  audioTracks: Array<Record<string, unknown>>;
  subtitleTracks: Array<Record<string, unknown>>;
  qualityNote?: string | null;
  releaseStatus: string;
};

export async function fetchAdminReleases(workId: string): Promise<{ items: Release[] }> {
  const response = await adminFetch(`/works/${workId}/releases`);
  if (!response.ok) throw new Error("Failed to fetch releases");
  return response.json() as Promise<{ items: Release[] }>;
}

export async function createAdminRelease(workId: string, payload: ReleasePayload): Promise<Release> {
  const response = await adminFetch(`/works/${workId}/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to create release");
  return response.json() as Promise<Release>;
}

export async function updateAdminRelease(releaseId: string, payload: Partial<ReleasePayload>): Promise<Release> {
  const response = await adminFetch(`/releases/${releaseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to update release");
  return response.json() as Promise<Release>;
}

export async function deleteAdminRelease(releaseId: string): Promise<void> {
  const response = await adminFetch(`/releases/${releaseId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete release");
}

export type AccessEntryPayload = {
  accessId: string;
  accessType: string;
  platform?: string | null;
  url?: string | null;
  availability?: string | null;
  accessNote?: string | null;
  lastVerified?: string | null;
  mirrorNote?: string | null;
  accessRisk?: string | null;
  checksum?: string | null;
  extractCode?: string | null;
  internalPath?: string | null;
  sensitiveSource?: string | null;
  visibility: string;
};

export async function fetchAdminAccessEntries(releaseId: string): Promise<{ items: AccessEntry[] }> {
  const response = await adminFetch(`/releases/${releaseId}/access`);
  if (!response.ok) throw new Error("Failed to fetch access entries");
  return response.json() as Promise<{ items: AccessEntry[] }>;
}

export async function createAdminAccessEntry(releaseId: string, payload: AccessEntryPayload): Promise<AccessEntry> {
  const response = await adminFetch(`/releases/${releaseId}/access`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to create access entry");
  return response.json() as Promise<AccessEntry>;
}

export async function updateAdminAccessEntry(accessId: string, payload: Partial<AccessEntryPayload>): Promise<AccessEntry> {
  const response = await adminFetch(`/access/${accessId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to update access entry");
  return response.json() as Promise<AccessEntry>;
}

export async function deleteAdminAccessEntry(accessId: string): Promise<void> {
  const response = await adminFetch(`/access/${accessId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete access entry");
}

export async function exportAdminWorks(): Promise<{ files: string[] }> {
  const response = await adminFetch(`/export`, { method: "POST" });
  if (!response.ok) throw new Error("Failed to export works");
  return response.json() as Promise<{ files: string[] }>;
}

export async function importAdminWork(markdown: string): Promise<Work> {
  const response = await adminFetch(`/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markdown })
  });
  if (!response.ok) throw new Error("Failed to import work");
  return response.json() as Promise<Work>;
}

export type AuditLog = {
  id: number;
  entityType: string;
  entityId: string;
  action: string;
  actor: string | null;
  before: unknown | null;
  after: unknown | null;
  createdAt: string;
};

export async function fetchAdminAuditLogs(limit = 20): Promise<{ items: AuditLog[] }> {
  const url = new URL(`${baseUrl}/api/admin/audit-logs`);
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url, { headers: authHeaders() });
  if (!response.ok) throw new Error("Failed to fetch audit logs");
  return response.json() as Promise<{ items: AuditLog[] }>;
}

export async function fetchAdminUsers(): Promise<{ items: AuthUser[] }> {
  const response = await adminFetch("/users");
  if (!response.ok) throw new Error("Failed to fetch users");
  return response.json() as Promise<{ items: AuthUser[] }>;
}

export async function createAdminUser(payload: {
  username: string;
  password: string;
  displayName?: string | null;
  role: AuthUser["role"];
}): Promise<AuthUser> {
  const response = await adminFetch("/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to create user");
  return response.json() as Promise<AuthUser>;
}

export async function updateAdminUser(
  username: string,
  patch: Partial<Pick<AuthUser, "role" | "displayName" | "isActive">>
): Promise<AuthUser> {
  const response = await adminFetch(`/users/${encodeURIComponent(username)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
  if (!response.ok) throw new Error("Failed to update user");
  return response.json() as Promise<AuthUser>;
}

export type Taxonomy = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system?: number;
};

export type TaxonomyTerm = {
  id: string;
  taxonomy_id: string;
  parent_id: string | null;
  label: string;
  slug: string;
  description: string | null;
};

export type WorkTaxonomyTerm = {
  id: number;
  work_id: string;
  term_id: string;
  relation_type: string;
  confidence: string;
  note: string | null;
  label: string;
  slug: string;
  taxonomy_code: string;
  taxonomy_name: string;
};

export async function fetchAdminTaxonomies(): Promise<{ items: Taxonomy[] }> {
  const response = await adminFetch(`/taxonomies`);
  if (!response.ok) throw new Error("Failed to fetch taxonomies");
  return response.json() as Promise<{ items: Taxonomy[] }>;
}

export async function createAdminTaxonomy(payload: { id: string; code: string; name: string; description?: string | null }): Promise<{ ok: true }> {
  const response = await adminFetch(`/taxonomies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to create taxonomy");
  return response.json() as Promise<{ ok: true }>;
}

export async function fetchAdminTaxonomyTerms(code: string): Promise<{ items: TaxonomyTerm[] }> {
  const response = await adminFetch(`/taxonomies/${code}/terms`);
  if (!response.ok) throw new Error("Failed to fetch taxonomy terms");
  return response.json() as Promise<{ items: TaxonomyTerm[] }>;
}

export async function createAdminTaxonomyTerm(code: string, payload: { id: string; taxonomyId: string; parentId?: string | null; label: string; slug: string; description?: string | null }): Promise<{ ok: true }> {
  const response = await adminFetch(`/taxonomies/${code}/terms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to create taxonomy term");
  return response.json() as Promise<{ ok: true }>;
}

export async function fetchAdminWorkTaxonomyTerms(workId: string): Promise<{ items: WorkTaxonomyTerm[] }> {
  const response = await adminFetch(`/works/${workId}/taxonomy-terms`);
  if (!response.ok) throw new Error("Failed to fetch work taxonomy terms");
  return response.json() as Promise<{ items: WorkTaxonomyTerm[] }>;
}

export async function attachAdminTaxonomyTerm(workId: string, payload: { termId: string; relationType?: string; note?: string | null }): Promise<{ ok: true }> {
  const response = await adminFetch(`/works/${workId}/taxonomy-terms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to attach taxonomy term");
  return response.json() as Promise<{ ok: true }>;
}

export async function detachAdminTaxonomyTerm(attachmentId: number): Promise<void> {
  const response = await adminFetch(`/work-taxonomy-terms/${attachmentId}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to detach taxonomy term");
}

export type WorkRelation = {
  id: number;
  source_work_id: string;
  target_work_id: string;
  relation_type: string;
  direction: string;
  note: string | null;
  visibility?: string;
  target_title: string;
};

export type RelationNetworkGroup = {
  group: string;
  label: string;
  items: Array<{
    relationId: number;
    workId: string;
    title: string;
    year: string | null;
    relationType: string;
    group: string;
    label: string;
    reverse: boolean;
    note: string | null;
  }>;
};

export async function fetchPublicRelationNetwork(workId: string): Promise<{ groups: RelationNetworkGroup[] }> {
  const response = await fetch(`${baseUrl}/api/public/works/${workId}/relation-network`);
  if (!response.ok) throw new Error("Failed to fetch relation network");
  return response.json() as Promise<{ groups: RelationNetworkGroup[] }>;
}

export type SeriesSummary = {
  name: string;
  workCount: number;
};

export type SeriesDetail = {
  name: string;
  works: Array<{ id: string; title: string; year: string | null; summaryShort: string }>;
};

export async function fetchPublicSeries(): Promise<{ items: SeriesSummary[] }> {
  const response = await fetch(`${baseUrl}/api/public/series`);
  if (!response.ok) throw new Error("Failed to fetch series");
  return response.json() as Promise<{ items: SeriesSummary[] }>;
}

export async function fetchPublicSeriesDetail(name: string): Promise<SeriesDetail> {
  const response = await fetch(`${baseUrl}/api/public/series/${encodeURIComponent(name)}`);
  if (!response.ok) throw new Error("Failed to fetch series detail");
  return response.json() as Promise<SeriesDetail>;
}

export async function fetchAdminRelationQuality(): Promise<{ items: Array<{ issueType: string; relationId: number; message: string }> }> {
  const response = await adminFetch("/relation-quality");
  if (!response.ok) throw new Error("Failed to fetch relation quality");
  return response.json() as Promise<{ items: Array<{ issueType: string; relationId: number; message: string }> }>;
}

export async function fetchAdminWorkRelations(workId: string): Promise<{ items: WorkRelation[] }> {
  const response = await adminFetch(`/works/${workId}/relations`);
  if (!response.ok) throw new Error("Failed to fetch work relations");
  return response.json() as Promise<{ items: WorkRelation[] }>;
}

export async function createAdminWorkRelation(workId: string, payload: { targetWorkId: string; relationType: string; direction: string; note?: string | null; visibility: string }): Promise<{ ok: true }> {
  const response = await adminFetch(`/works/${workId}/relations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to create work relation");
  return response.json() as Promise<{ ok: true }>;
}

export async function updateAdminWorkRelation(id: number, payload: { relationType?: string; direction?: string; note?: string | null; visibility?: string }): Promise<WorkRelation> {
  const response = await adminFetch(`/relations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to update work relation");
  return response.json() as Promise<WorkRelation>;
}

export async function deleteAdminWorkRelation(id: number): Promise<void> {
  const response = await adminFetch(`/relations/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete work relation");
}

export type Source = {
  id: number;
  workId: string;
  sourceType: string | null;
  url: string | null;
  title: string | null;
  evidenceLevel: string | null;
  note: string | null;
  visibility: string;
  lastChecked: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SourcePayload = {
  sourceType?: string | null;
  url?: string | null;
  title?: string | null;
  evidenceLevel?: string | null;
  note?: string | null;
  visibility: string;
  lastChecked?: string | null;
};

export async function fetchAdminSources(workId: string): Promise<{ items: Source[] }> {
  const response = await adminFetch(`/works/${workId}/sources`);
  if (!response.ok) throw new Error("Failed to fetch sources");
  return response.json() as Promise<{ items: Source[] }>;
}

export async function createAdminSource(workId: string, payload: SourcePayload): Promise<Source> {
  const response = await adminFetch(`/works/${workId}/sources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to create source");
  return response.json() as Promise<Source>;
}

export async function updateAdminSource(id: number, payload: Partial<SourcePayload>): Promise<Source> {
  const response = await adminFetch(`/sources/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to update source");
  return response.json() as Promise<Source>;
}

export async function deleteAdminSource(id: number): Promise<void> {
  const response = await adminFetch(`/sources/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete source");
}

export type ExternalLink = {
  id: number;
  workId: string;
  targetType: string;
  title: string | null;
  url: string | null;
  relationType: string | null;
  visibility: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExternalLinkPayload = {
  targetType: string;
  title?: string | null;
  url?: string | null;
  relationType?: string | null;
  visibility: string;
  note?: string | null;
};

export async function fetchAdminExternalLinks(workId: string): Promise<{ items: ExternalLink[] }> {
  const response = await adminFetch(`/works/${workId}/external-links`);
  if (!response.ok) throw new Error("Failed to fetch external links");
  return response.json() as Promise<{ items: ExternalLink[] }>;
}

export async function createAdminExternalLink(workId: string, payload: ExternalLinkPayload): Promise<ExternalLink> {
  const response = await adminFetch(`/works/${workId}/external-links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to create external link");
  return response.json() as Promise<ExternalLink>;
}

export async function updateAdminExternalLink(id: number, payload: Partial<ExternalLinkPayload>): Promise<ExternalLink> {
  const response = await adminFetch(`/external-links/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to update external link");
  return response.json() as Promise<ExternalLink>;
}

export async function deleteAdminExternalLink(id: number): Promise<void> {
  const response = await adminFetch(`/external-links/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete external link");
}

export type Contributor = {
  id: number;
  workId: string;
  name: string;
  role: string;
  creditName: string | null;
  note: string | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
};

export type ContributorPayload = {
  name: string;
  role: string;
  creditName?: string | null;
  note?: string | null;
  visibility: string;
};

export async function fetchAdminContributors(workId: string): Promise<{ items: Contributor[] }> {
  const response = await adminFetch(`/works/${workId}/contributors`);
  if (!response.ok) throw new Error("Failed to fetch contributors");
  return response.json() as Promise<{ items: Contributor[] }>;
}

export async function createAdminContributor(workId: string, payload: ContributorPayload): Promise<Contributor> {
  const response = await adminFetch(`/works/${workId}/contributors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to create contributor");
  return response.json() as Promise<Contributor>;
}

export async function updateAdminContributor(id: number, payload: Partial<ContributorPayload>): Promise<Contributor> {
  const response = await adminFetch(`/contributors/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to update contributor");
  return response.json() as Promise<Contributor>;
}

export async function deleteAdminContributor(id: number): Promise<void> {
  const response = await adminFetch(`/contributors/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete contributor");
}

export type Cover = {
  id: string;
  workId: string;
  releaseId: string | null;
  url: string;
  source: string | null;
  isPrimary: boolean;
  processNote: string | null;
  visibility: string;
  createdAt: string;
  updatedAt: string;
};

export type CoverPayload = {
  id: string;
  releaseId?: string | null;
  url: string;
  source?: string | null;
  isPrimary?: boolean;
  processNote?: string | null;
  visibility: string;
};

export async function fetchAdminCovers(workId: string): Promise<{ items: Cover[] }> {
  const response = await adminFetch(`/works/${workId}/covers`);
  if (!response.ok) throw new Error("Failed to fetch covers");
  return response.json() as Promise<{ items: Cover[] }>;
}

export async function createAdminCover(workId: string, payload: CoverPayload): Promise<Cover> {
  const response = await adminFetch(`/works/${workId}/covers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to create cover");
  return response.json() as Promise<Cover>;
}

export async function updateAdminCover(id: string, payload: Partial<CoverPayload>): Promise<Cover> {
  const response = await adminFetch(`/covers/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to update cover");
  return response.json() as Promise<Cover>;
}

export async function deleteAdminCover(id: string): Promise<void> {
  const response = await adminFetch(`/covers/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete cover");
}
