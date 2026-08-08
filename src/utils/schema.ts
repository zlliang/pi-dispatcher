import * as z from "zod";

import type { ModelThinkingLevel } from "@earendil-works/pi-ai";

export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const satisfies readonly ModelThinkingLevel[];

export const thinkingLevelSchema = z.enum(THINKING_LEVELS);

export const modelSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  thinkingLevel: thinkingLevelSchema,
});

export type ModelConfig = z.infer<typeof modelSchema>;

const optionalModelSchema = modelSchema.partial();

export type OptionalModelConfig = z.infer<typeof optionalModelSchema>;

const candidateSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  /**
   * Limits the thinking levels the dispatcher may choose. When omitted, all levels supported by
   * the model are used.
   */
  thinkingLevels: z.array(thinkingLevelSchema).min(1).optional(),
  hint: z.string().min(1).optional(),
});

export type CandidateConfig = z.infer<typeof candidateSchema>;

export const userConfigSchema = z.object({
  /** Model that makes dispatch decisions. Falls back to the session model when incomplete. */
  dispatcher: optionalModelSchema.optional(),
  // /** Reserved for the rules-learning step. Unused for now. */
  // analyzer: optionalModelSchema.optional(),
  candidates: z.array(candidateSchema).optional(),
});

export type UserConfig = z.infer<typeof userConfigSchema>;
