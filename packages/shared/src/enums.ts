export const visibilityValues = ["public", "restricted", "internal"] as const;
export type Visibility = (typeof visibilityValues)[number];

export const recordStatusValues = ["draft", "reviewing", "published", "frozen", "offline"] as const;
export type RecordStatus = (typeof recordStatusValues)[number];

export const releaseStatusValues = ["draft", "published", "available", "unverified", "offline"] as const;
export type ReleaseStatus = (typeof releaseStatusValues)[number];

export const workRelationTypeValues = [
  "same_series",
  "sequel",
  "prequel",
  "remake",
  "remaster",
  "adaptation_of",
  "adapted_to",
  "spin_off",
  "compilation_of",
  "included_in",
  "alternate_version",
  "translation_of",
  "subtitle_version",
  "fanwork_of",
  "inspired_by",
  "references",
  "related"
] as const;
export type WorkRelationType = (typeof workRelationTypeValues)[number];
