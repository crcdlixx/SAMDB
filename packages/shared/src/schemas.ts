import { z } from "zod";
import { recordStatusValues, releaseStatusValues, visibilityValues, workRelationTypeValues } from "./enums";

export const workSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  titleOriginal: z.string().nullable().optional(),
  aliases: z.array(z.string()).default([]),
  series: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  year: z.string().nullable().optional(),
  summaryShort: z.string().min(1),
  summaryFull: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  sourcePrimary: z.string().min(1),
  recordStatus: z.enum(recordStatusValues).default("draft"),
  visibility: z.enum(visibilityValues).default("public"),
  rightsNote: z.string().nullable().optional(),
  editor: z.string().nullable().optional(),
  reviewer: z.string().nullable().optional()
});

export const releaseSchema = z.object({
  releaseId: z.string().min(1),
  parentWorkId: z.string().min(1),
  releaseTitle: z.string().nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  edition: z.string().nullable().optional(),
  episodeCount: z.number().int().nullable().optional(),
  duration: z.string().nullable().optional(),
  fileSize: z.string().nullable().optional(),
  resolution: z.string().nullable().optional(),
  audioTracks: z.array(z.record(z.unknown())).default([]),
  subtitleTracks: z.array(z.record(z.unknown())).default([]),
  qualityNote: z.string().nullable().optional(),
  releaseStatus: z.enum(releaseStatusValues).default("draft")
});

export const accessEntrySchema = z.object({
  accessId: z.string().min(1),
  parentReleaseId: z.string().min(1),
  accessType: z.string().min(1),
  platform: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  availability: z.string().nullable().optional(),
  accessNote: z.string().nullable().optional(),
  lastVerified: z.string().nullable().optional(),
  mirrorNote: z.string().nullable().optional(),
  accessRisk: z.string().nullable().optional(),
  checksum: z.string().nullable().optional(),
  extractCode: z.string().nullable().optional(),
  internalPath: z.string().nullable().optional(),
  sensitiveSource: z.string().nullable().optional(),
  visibility: z.enum(visibilityValues).default("restricted")
});

export const workRelationSchema = z.object({
  sourceWorkId: z.string().min(1),
  targetWorkId: z.string().min(1),
  relationType: z.enum(workRelationTypeValues),
  direction: z.enum(["directed", "bidirectional"]).default("directed"),
  note: z.string().nullable().optional(),
  confidence: z.string().default("manual"),
  visibility: z.enum(visibilityValues).default("public")
});
