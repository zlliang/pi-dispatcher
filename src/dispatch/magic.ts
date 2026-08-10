import { THINKING_LEVELS } from "../utils/schema";

import type { ModelThinkingLevel } from "@earendil-works/pi-ai";
import type { ModelConfig } from "../utils/schema";

export type MagicInstruction =
  | { type: "keep" }
  | { type: "model"; preference: string };

type ParsedRequest = {
  request: string;
  instruction: MagicInstruction | undefined;
};

/**
 * Match standalone `%keep` or `%model <preference>` instructions. The capture group contains the
 * non-whitespace model preference; optional trailing horizontal space is consumed for clean removal.
 */
const MAGIC_INSTRUCTION_PATTERN = /(?<!\S)%(?:keep(?=$|\s)|model[ \t]+(\S+))(?:[ \t]+(?=\S))?/g;

/** Parse and remove dispatcher instructions from the first user request. */
export function parseMagicInstructions(request: string): ParsedRequest {
  let instruction: MagicInstruction | undefined;
  let matched = false;

  const cleaned = request.replace(MAGIC_INSTRUCTION_PATTERN, (_match, preference?: string) => {
    matched = true;

    // If a request contains multiple model preferences, the last one wins; a `keep` instruction
    // overrides all preferences.
    if (preference === undefined || preference === "keep") {
      instruction = { type: "keep" };
    } else if (instruction?.type !== "keep") {
      instruction = { type: "model", preference };
    }

    return "";
  });

  return {
    request: matched ? cleaned.trim() : request,
    instruction,
  };
}

/** Match the provider exactly, the model as a family fragment, and the thinking level exactly. */
export function matchesModelPreference(preference: string, selection: ModelConfig): boolean {
  const parsed = splitModelPreference(preference);

  if (parsed.provider !== undefined && parsed.provider.toLowerCase() !== selection.provider.toLowerCase()) return false;
  if (!parsed.model || !selection.model.toLowerCase().includes(parsed.model.toLowerCase())) return false;
  return parsed.thinkingLevel === undefined || parsed.thinkingLevel === selection.thinkingLevel;
}

function splitModelPreference(preference: string): { provider: string | undefined; model: string; thinkingLevel: ModelThinkingLevel | undefined } {
  const thinkingSeparator = preference.lastIndexOf(":");
  const suffix = preference.slice(thinkingSeparator + 1).toLowerCase() as ModelThinkingLevel;
  const hasThinkingLevel = thinkingSeparator !== -1 && THINKING_LEVELS.includes(suffix);
  const modelReference = hasThinkingLevel ? preference.slice(0, thinkingSeparator) : preference;
  const providerSeparator = modelReference.indexOf("/");

  return {
    provider: providerSeparator === -1 ? undefined : modelReference.slice(0, providerSeparator),
    model: providerSeparator === -1 ? modelReference : modelReference.slice(providerSeparator + 1),
    thinkingLevel: hasThinkingLevel ? suffix : undefined,
  };
}

