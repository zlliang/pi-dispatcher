import { clampThinkingLevel, getSupportedThinkingLevels } from "@earendil-works/pi-ai";

import { formatModel } from "../utils/format";
import { resolveModel } from "../utils/model";
import { THINKING_LEVELS } from "../utils/schema";

import type { Api, Model, ModelThinkingLevel } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { CandidateConfig } from "../utils/schema";

export type DispatchCandidate = {
  id: string;
  model: Model<Api>;
  thinkingLevels: ModelThinkingLevel[];
  hint?: string;
};

type ResolvedCandidates = {
  candidates: DispatchCandidate[];
  warnings: string[];
};

const cache = new Map<string, ResolvedCandidates>();

/**
 * Expand configured entries into concrete candidates, dropping everything this session cannot run.
 * Configured thinking levels are clamped to the model and duplicates collapse; omitted levels
 * default to every level supported by the model.
 */
export async function resolveCandidates(ctx: ExtensionContext, configured: CandidateConfig[]): Promise<ResolvedCandidates> {
  const cached = cache.get(ctx.cwd);
  if (cached) return cached;

  const candidates = new Map<string, DispatchCandidate>();
  const warnings: string[] = [];

  for (const entry of configured) {
    const { model, warning } = await resolveModel(ctx, entry, "candidate");
    if (warning) warnings.push(warning);
    if (!model) continue;

    const thinkingLevels = [...new Set((entry.thinkingLevels ?? getSupportedThinkingLevels(model)).map((level) => clampThinkingLevel(model, level)))];

    const id = formatModel(model.provider, model.id);
    const existing = candidates.get(id);
    if (existing) {
      existing.thinkingLevels = [...new Set([...existing.thinkingLevels, ...thinkingLevels])];
      continue;
    }

    candidates.set(id, { id, model, thinkingLevels, hint: entry.hint });
  }

  for (const candidate of candidates.values()) {
    candidate.thinkingLevels.sort((left, right) => THINKING_LEVELS.indexOf(left) - THINKING_LEVELS.indexOf(right));
  }

  const resolved = { candidates: [...candidates.values()], warnings };
  cache.set(ctx.cwd, resolved);
  return resolved;
}
