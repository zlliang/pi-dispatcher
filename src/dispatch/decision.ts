import * as z from "zod";

import { modelSchema } from "../utils/schema";

import type { DispatchCandidate } from "./candidates";

const decisionSchema = modelSchema.extend({
  reason: z.string().optional(),
});

export type DispatchDecision = z.infer<typeof decisionSchema>;

type ParsedDecision = {
  decision: DispatchDecision;
  candidate: DispatchCandidate;
};

/**
 * Parse the dispatcher model's reply into a decision.
 *
 * Only configured model and thinking level pairs are accepted, so hallucinated or prompt-injected
 * settings can never be applied.
 */
export function parseDecision(text: string, candidates: DispatchCandidate[]): ParsedDecision | undefined {
  const decision = parseJsonDecision(text);
  if (!decision) return;

  const candidate = candidates.find((entry) => entry.model.provider === decision.provider && entry.model.id === decision.model);
  if (!candidate?.thinkingLevels.includes(decision.thinkingLevel)) return;

  return { decision, candidate };
}

function parseJsonDecision(text: string): DispatchDecision | undefined {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;

  try {
    const result = decisionSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}
