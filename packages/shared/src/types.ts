import type { z } from "zod";
import type { accessEntrySchema, releaseSchema, workRelationSchema, workSchema } from "./schemas";

export type WorkInput = z.infer<typeof workSchema>;
export type ReleaseInput = z.infer<typeof releaseSchema>;
export type AccessEntryInput = z.infer<typeof accessEntrySchema>;
export type WorkRelationInput = z.infer<typeof workRelationSchema>;
